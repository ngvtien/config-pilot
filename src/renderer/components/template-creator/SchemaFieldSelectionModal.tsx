import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/renderer/components/ui/dialog'
import { Button } from '@/renderer/components/ui/button'
import { Badge } from '@/renderer/components/ui/badge'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import { ScrollArea } from '@/renderer/components/ui/scroll-area'
import { Separator } from '@/renderer/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { DescriptionTooltip } from './DescriptionTooltip'
import type { KubernetesResourceSchema } from '@/renderer/services/kubernetes-schema-indexer'
import type { TemplateField } from '@/shared/types/template'

interface SchemaFieldSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  resource: KubernetesResourceSchema | null
  selectedFields: TemplateField[]
  onFieldsChange: (fields: TemplateField[]) => void
}

interface SchemaProperty {
  name: string
  path: string
  type: string
  description?: string
  required?: boolean
  properties?: SchemaProperty[]
  items?: SchemaProperty
}

/**
 * Modal component for selecting schema fields with tooltips and hierarchical display
 * Displays the resource schema side-by-side with field selection UI
 */
export function SchemaFieldSelectionModal({
  isOpen,
  onClose,
  resource,
  selectedFields,
  onFieldsChange
}: SchemaFieldSelectionModalProps) {
  const [localSelectedFields, setLocalSelectedFields] = useState<TemplateField[]>(selectedFields)

  /**
   * Recursively parse schema properties into a flat structure for easier rendering
   */
  const parseSchemaProperties = (schema: any, basePath = '', level = 0): SchemaProperty[] => {
    if (!schema || !schema.properties) return []

    const properties: SchemaProperty[] = []
    const required = schema.required || []

    Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
      const currentPath = basePath ? `${basePath}.${key}` : key
      const property: SchemaProperty = {
        name: key,
        path: currentPath,
        type: value.type || 'object',
        description: value.description,
        required: required.includes(key)
      }

      properties.push(property)

      // Recursively parse nested objects
      if (value.type === 'object' && value.properties && level < 3) {
        property.properties = parseSchemaProperties(value, currentPath, level + 1)
      }

      // Handle array items
      if (value.type === 'array' && value.items && level < 3) {
        property.items = {
          name: 'items',
          path: `${currentPath}[]`,
          type: value.items.type || 'object',
          description: value.items.description
        }
        if (value.items.properties) {
          property.items.properties = parseSchemaProperties(value.items, `${currentPath}[]`, level + 1)
        }
      }
    })

    return properties
  }

  const schemaProperties = useMemo(() => {
    if (!resource?.schema) return []
    return parseSchemaProperties(resource.schema)
  }, [resource])

  /**
   * Handle field selection toggle
   */
  const handleFieldToggle = (property: SchemaProperty, checked: boolean) => {
    const field: TemplateField = {
      path: property.path,
      title: property.name,
      type: property.type,
      required: property.required || false,
      description: property.description
    }

    if (checked) {
      setLocalSelectedFields(prev => [...prev, field])
    } else {
      setLocalSelectedFields(prev => prev.filter(f => f.path !== property.path))
    }
  }

  /**
   * Check if a field is currently selected
   */
  const isFieldSelected = (path: string) => {
    return localSelectedFields.some(field => field.path === path)
  }

  /**
   * Render a schema property with selection checkbox
   */
  const renderProperty = (property: SchemaProperty, level = 0) => {
    const isSelected = isFieldSelected(property.path)
    const indent = level * 20

    return (
      <div key={property.path} className="space-y-2">
        <div 
          className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50"
          style={{ marginLeft: `${indent}px` }}
        >
          <Checkbox
            id={property.path}
            checked={isSelected}
            onCheckedChange={(checked) => handleFieldToggle(property, checked as boolean)}
          />
          <div className="flex-1 flex items-center space-x-2">
            <label htmlFor={property.path} className="text-sm font-medium cursor-pointer">
              {property.name}
            </label>
            {property.required && (
              <Badge variant="destructive" className="text-xs px-1 py-0">Required</Badge>
            )}
            <Badge variant="secondary" className="text-xs px-1 py-0">
              {property.type}
            </Badge>
            <DescriptionTooltip description={property.description} />
          </div>
        </div>
        
        {/* Render nested properties */}
        {property.properties && property.properties.map(nestedProp => 
          renderProperty(nestedProp, level + 1)
        )}
        
        {/* Render array items */}
        {property.items && (
          <div style={{ marginLeft: `${indent + 20}px` }}>
            {renderProperty(property.items, level + 1)}
          </div>
        )}
      </div>
    )
  }

  /**
   * Handle save and close
   */
  const handleSave = () => {
    onFieldsChange(localSelectedFields)
    onClose()
  }

  /**
   * Handle cancel - reset to original selection
   */
  const handleCancel = () => {
    setLocalSelectedFields(selectedFields)
    onClose()
  }

  if (!resource) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>Configure Fields for {resource.kind}</span>
            <Badge variant="outline">{resource.apiVersion}</Badge>
          </DialogTitle>
          <DialogDescription>
            Select the fields you want to include in your template. Use the tooltips to understand each field's purpose.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
          {/* Left Panel - Schema Display */}
          <Card className="flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-lg">Schema Structure</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-1">
                  {schemaProperties.map(property => renderProperty(property))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right Panel - Selected Fields Summary */}
          <Card className="flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-lg">
                Selected Fields ({localSelectedFields.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {localSelectedFields.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    No fields selected yet.
                    <br />
                    Select fields from the schema on the left.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {localSelectedFields.map((field, index) => (
                      <div key={field.path} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{field.title}</span>
                            {field.required && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {field.type}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{field.path}</div>
                        {field.description && (
                          <div className="text-xs text-gray-600 mt-1">{field.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Separator />
        
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Selection ({localSelectedFields.length} fields)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}