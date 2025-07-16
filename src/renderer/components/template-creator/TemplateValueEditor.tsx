import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Edit3, Eye, EyeOff } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import * as yaml from 'js-yaml'

interface TemplateVariable {
  name: string
  path: string
  type: 'string' | 'number' | 'boolean' | 'object'
  value?: any
  description?: string
  required?: boolean
}

interface TemplateValueEditorProps {
  templateContent: string
  onTemplateChange: (content: string) => void
  onValuesChange: (values: Record<string, any>) => void
}

/**
 * Template Value Editor - allows users to view and edit template variables
 */
export function TemplateValueEditor({ 
  templateContent, 
  onTemplateChange, 
  onValuesChange 
}: TemplateValueEditorProps) {
  const [variables, setVariables] = useState<TemplateVariable[]>([])
  const [values, setValues] = useState<Record<string, any>>({})
  const [showRawTemplate, setShowRawTemplate] = useState(false)
  const [editedTemplate, setEditedTemplate] = useState(templateContent)

  // Extract variables from template content
  useEffect(() => {
    const extractedVars = extractTemplateVariables(templateContent)
    setVariables(extractedVars)
  }, [templateContent])

  /**
   * Extract template variables from content (Handlebars-like syntax)
   */
  const extractTemplateVariables = (content: string): TemplateVariable[] => {
    const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g
    const foundVars: TemplateVariable[] = []
    const seen = new Set<string>()
    let match

    while ((match = variableRegex.exec(content)) !== null) {
      const fullPath = match[1].trim()
      if (!seen.has(fullPath)) {
        seen.add(fullPath)
        const parts = fullPath.split('.')
        const name = parts[parts.length - 1]
        
        foundVars.push({
          name,
          path: fullPath,
          type: inferVariableType(fullPath),
          description: `Template variable: ${fullPath}`,
          required: false
        })
      }
    }

    return foundVars
  }

  /**
   * Infer variable type from path
   */
  const inferVariableType = (path: string): TemplateVariable['type'] => {
    const lowerPath = path.toLowerCase()
    if (lowerPath.includes('count') || lowerPath.includes('port') || lowerPath.includes('replicas')) {
      return 'number'
    }
    if (lowerPath.includes('enabled') || lowerPath.includes('debug')) {
      return 'boolean'
    }
    if (lowerPath.includes('data') || lowerPath.includes('config')) {
      return 'object'
    }
    return 'string'
  }

  /**
   * Handle value change for a variable
   */
  const handleValueChange = (variable: TemplateVariable, newValue: any) => {
    const updatedValues = { ...values }
    
    // Set nested value using path
    setNestedValue(updatedValues, variable.path, newValue)
    
    setValues(updatedValues)
    onValuesChange(updatedValues)
  }

  /**
   * Set nested value in object using dot notation path
   */
  const setNestedValue = (obj: any, path: string, value: any) => {
    const parts = path.split('.')
    let current = obj
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {}
      }
      current = current[parts[i]]
    }
    
    current[parts[parts.length - 1]] = value
  }

  /**
   * Get nested value from object using dot notation path
   */
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Add new custom variable
   */
  const addCustomVariable = () => {
    const newVar: TemplateVariable = {
      name: `customVar${variables.length + 1}`,
      path: `Values.customVar${variables.length + 1}`,
      type: 'string',
      description: 'Custom variable',
      required: false
    }
    setVariables([...variables, newVar])
  }

  /**
   * Remove variable
   */
  const removeVariable = (index: number) => {
    const newVariables = variables.filter((_, i) => i !== index)
    setVariables(newVariables)
  }

  /**
   * Render value input based on type
   */
  const renderValueInput = (variable: TemplateVariable) => {
    const currentValue = getNestedValue(values, variable.path)
    
    switch (variable.type) {
      case 'boolean':
        return (
          <select
            value={currentValue?.toString() || 'false'}
            onChange={(e) => handleValueChange(variable, e.target.value === 'true')}
            className="w-full p-2 border rounded"
          >
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        )
      
      case 'number':
        return (
          <Input
            type="number"
            value={currentValue || ''}
            onChange={(e) => handleValueChange(variable, Number(e.target.value))}
            placeholder="Enter number"
          />
        )
      
      case 'object':
        return (
          <Textarea
            value={currentValue ? JSON.stringify(currentValue, null, 2) : ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleValueChange(variable, parsed)
              } catch {
                // Invalid JSON, don't update
              }
            }}
            placeholder="Enter JSON object"
            rows={4}
          />
        )
      
      default:
        return (
          <Input
            value={currentValue || ''}
            onChange={(e) => handleValueChange(variable, e.target.value)}
            placeholder="Enter value"
          />
        )
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Template Variables
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawTemplate(!showRawTemplate)}
              >
                {showRawTemplate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showRawTemplate ? 'Hide' : 'Show'} Raw Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addCustomVariable}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Variable
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="variables" className="w-full">
            <TabsList>
              <TabsTrigger value="variables">Variables ({variables.length})</TabsTrigger>
              <TabsTrigger value="preview">Values Preview</TabsTrigger>
              {showRawTemplate && <TabsTrigger value="raw">Raw Template</TabsTrigger>}
            </TabsList>
            
            <TabsContent value="variables" className="space-y-4">
              {variables.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No template variables found. Add some variables or check your template syntax.
                </div>
              ) : (
                variables.map((variable, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Label className="font-medium">{variable.name}</Label>
                          <Badge variant="secondary">{variable.type}</Badge>
                          {variable.required && <Badge variant="destructive">Required</Badge>}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{variable.description}</p>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{variable.path}</code>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariable(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Value</Label>
                      {renderValueInput(variable)}
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
            
            <TabsContent value="preview">
              <Card className="p-4">
                <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-96">
                  {yaml.dump(values, { indent: 2 })}
                </pre>
              </Card>
            </TabsContent>
            
            {showRawTemplate && (
              <TabsContent value="raw">
                <div className="space-y-4">
                  <Textarea
                    value={editedTemplate}
                    onChange={(e) => setEditedTemplate(e.target.value)}
                    rows={20}
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={() => onTemplateChange(editedTemplate)}
                    className="w-full"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Update Template
                  </Button>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}