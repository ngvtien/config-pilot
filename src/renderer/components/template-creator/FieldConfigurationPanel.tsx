import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/renderer/components/ui/card'
import { Input } from '@/renderer/components/ui/input'
import { Switch } from '@/renderer/components/ui/switch'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import { Badge } from '@/renderer/components/ui/badge'
import { Button } from '@/renderer/components/ui/button'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { EnhancedTemplateField, ArrayItemFieldConfig } from '@/shared/types/enhanced-template-field'
import { SchemaProperty } from './SchemaFieldSelectionModal'

interface FieldConfigurationPanelProps {
    field: EnhancedTemplateField | null
    onDefaultValueChange: (fieldPath: string, value: any) => void
    onNestedFieldToggle: (parentPath: string, nestedField: SchemaProperty, checked: boolean) => void
    onArrayConfigChange: (parentPath: string, config: ArrayItemFieldConfig) => void
    className?: string
}

/**
 * Field configuration panel for setting default values and configuring complex types
 * Handles both simple field default values and complex array item field selection
 */
export const FieldConfigurationPanel: React.FC<FieldConfigurationPanelProps> = ({
    field,
    onDefaultValueChange,
    onNestedFieldToggle,
    onArrayConfigChange,
    className = ""
}) => {
    const [localDefaultValue, setLocalDefaultValue] = useState<any>(null)
    const [arrayConfig, setArrayConfig] = useState<ArrayItemFieldConfig | null>(null)

    // Update local state when field changes
    useEffect(() => {
        if (field) {
            setLocalDefaultValue(field.defaultValue)
            if (field.type === 'array' && field.arrayItemSchema) {
                setArrayConfig({
                    parentPath: field.path,
                    itemType: field.arrayItemSchema.type,
                    selectedFields: field.nestedFields?.map(nf => nf.path) || [],
                    defaultItemValues: {}
                })
            }
        } else {
            setLocalDefaultValue(null)
            setArrayConfig(null)
        }
    }, [field])

    /**
     * Handle default value changes with immediate callback
     */
    const handleDefaultValueChange = (value: any) => {
        setLocalDefaultValue(value)
        if (field) {
            onDefaultValueChange(field.path, value)
        }
    }

    /**
     * Handle array item field selection
     */
    const handleArrayFieldToggle = (nestedField: SchemaProperty, checked: boolean) => {
        if (!field || !arrayConfig) return
        
        onNestedFieldToggle(field.path, nestedField, checked)
        
        // Update local array config
        const updatedConfig = {
            ...arrayConfig,
            selectedFields: checked 
                ? [...arrayConfig.selectedFields, nestedField.path]
                : arrayConfig.selectedFields.filter(path => path !== nestedField.path)
        }
        setArrayConfig(updatedConfig)
        onArrayConfigChange(field.path, updatedConfig)
    }

    /**
     * Render default value editor based on field type
     */
    const renderDefaultValueEditor = () => {
        if (!field) return null

        switch (field.type) {
            case 'string':
                return (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Default Value</label>
                        {field.constraints?.enum ? (
                            <Select value={localDefaultValue || ''} onValueChange={handleDefaultValueChange}>
                                <SelectTrigger data-testid="select">
                                    <SelectValue placeholder="Select default value" />
                                </SelectTrigger>
                                <SelectContent>
                                    {field.constraints.enum.map((option: any) => (
                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : field.constraints?.maxLength && field.constraints.maxLength > 100 ? (
                            <Textarea
                                data-testid="textarea"
                                value={localDefaultValue || ''}
                                onChange={(e) => handleDefaultValueChange(e.target.value)}
                                placeholder={field.uiHints?.placeholder || `Default ${field.title}`}
                                className="min-h-[80px]"
                            />
                        ) : (
                            <Input
                                data-testid="input"
                                value={localDefaultValue || ''}
                                onChange={(e) => handleDefaultValueChange(e.target.value)}
                                placeholder={field.uiHints?.placeholder || `Default ${field.title}`}
                            />
                        )}
                    </div>
                )

            case 'number':
            case 'integer':
                return (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Default Value</label>
                        <Input
                            data-testid="input"
                            type="number"
                            value={localDefaultValue || ''}
                            onChange={(e) => {
                                const value = e.target.value ? Number(e.target.value) : undefined
                                handleDefaultValueChange(value)
                            }}
                            placeholder={`Default ${field.title}`}
                            min={field.constraints?.minimum}
                            max={field.constraints?.maximum}
                        />
                    </div>
                )

            case 'boolean':
                return (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Default Value</label>
                        <div className="flex items-center space-x-2">
                            <Switch
                                data-testid="switch"
                                checked={localDefaultValue || false}
                                onCheckedChange={handleDefaultValueChange}
                            />
                            <span className="text-sm">{localDefaultValue ? 'true' : 'false'}</span>
                        </div>
                    </div>
                )

            case 'array':
                return renderArrayConfiguration()

            case 'object':
                return (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Complex Object</label>
                        <div className="text-sm text-gray-500">
                            Configure nested fields by selecting them in the schema tree
                        </div>
                    </div>
                )

            default:
                return (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Default Value</label>
                        <Input
                            data-testid="input"
                            value={localDefaultValue || ''}
                            onChange={(e) => handleDefaultValueChange(e.target.value)}
                            placeholder={`Default ${field.title}`}
                        />
                    </div>
                )
        }
    }

    /**
     * Render array configuration for complex array types like PolicyRule
     */
    const renderArrayConfiguration = () => {
        if (!field?.arrayItemSchema || !arrayConfig) {
            return (
                <div className="space-y-2">
                    <label className="text-sm font-medium">Array Configuration</label>
                    <div className="text-sm text-gray-500">
                        Simple array - no item configuration available
                    </div>
                </div>
            )
        }

        return (
            <div className="space-y-4">
                <div className="border-b pb-2">
                    <h4 className="font-medium text-sm">Array Item Configuration</h4>
                    <p className="text-xs text-gray-500">
                        Configure which fields to include for each {field.arrayItemSchema.type} item
                    </p>
                </div>
                
                <div className="space-y-3">
                    <div className="text-sm font-medium">
                        Select fields for each {field.arrayItemSchema.type}:
                    </div>
                    
                    {field.arrayItemSchema.properties?.map((prop: SchemaProperty) => {
                        const isSelected = arrayConfig.selectedFields.includes(prop.path)
                        return (
                            <div key={prop.path} className="flex items-center space-x-3 p-2 rounded border">
                                <Checkbox
                                    data-testid="checkbox"
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleArrayFieldToggle(prop, checked as boolean)}
                                />
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm font-medium">{prop.name}</span>
                                        <Badge variant="secondary" className="text-xs">{prop.type}</Badge>
                                        {prop.required && (
                                            <Badge variant="destructive" className="text-xs">Required</Badge>
                                        )}
                                    </div>
                                    {prop.description && (
                                        <p className="text-xs text-gray-500 mt-1">{prop.description}</p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
                
                {arrayConfig.selectedFields.length > 0 && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded border">
                        <div className="text-sm font-medium text-green-800 dark:text-green-200">
                            Selected Fields ({arrayConfig.selectedFields.length})
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-300 mt-1">
                            {arrayConfig.selectedFields.join(', ')}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    if (!field) {
        return (
            <Card className={`flex flex-col min-h-0 ${className}`}>
                <CardHeader className="flex-shrink-0">
                    <CardTitle className="text-lg">Field Configuration</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                        <div className="text-4xl mb-2">⚙️</div>
                        <div className="text-sm">Select a field to configure</div>
                        <div className="text-xs text-gray-400 mt-1">
                            Set default values and configure complex types
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={`flex flex-col min-h-0 ${className}`}>
            <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Field Configuration</CardTitle>
                    <Badge variant="outline">{field.type}</Badge>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                    {field.title} • {field.path}
                </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                {field.description && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border">
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                            {field.description}
                        </div>
                    </div>
                )}
                
                {renderDefaultValueEditor()}
                
                {field.uiHints?.helpText && (
                    <div className="text-xs text-gray-500 mt-2">
                        💡 {field.uiHints.helpText}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}