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
import { Plus, Trash2 } from 'lucide-react'

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
    const [arrayDefaultItems, setArrayDefaultItems] = useState<any[]>([])
    const [enumOptions, setEnumOptions] = useState<string[]>([])

    // Update local state when field changes
    useEffect(() => {
        if (field) {
            setLocalDefaultValue(field.defaultValue)
            if (field.type === 'array' && field.arrayItemSchema) {
                setArrayConfig({
                    parentPath: field.path,
                    itemType: field.arrayItemSchema.type,
                    selectedFields: field.nestedFields?.map((nf: { path: any }) => nf.path) || [],
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
        // if (field) {
        //     onDefaultValueChange(field.path, value)
        // }
        // Immediately save the default value
        if (onDefaultValueChange) {
            onDefaultValueChange(field?.path || '', value)
        }        
    }

    /**
     * Add a new array item with default values
     */
    const addArrayItem = () => {
        const newItem = createDefaultArrayItem()
        setArrayDefaultItems(prev => [...prev, newItem])
        updateArrayConfig([...arrayDefaultItems, newItem])
    }

    const removeArrayItem = (index: number) => {
        const updatedItems = arrayDefaultItems.filter((_, i) => i !== index)
        setArrayDefaultItems(updatedItems)
        updateArrayConfig(updatedItems)
    }

    const updateArrayItem = (index: number, fieldPath: string, value: any) => {
        const updatedItems = arrayDefaultItems.map((item, i) => 
            i === index ? { ...item, [fieldPath]: value } : item
        )
        setArrayDefaultItems(updatedItems)
        updateArrayConfig(updatedItems)
    }

    const createDefaultArrayItem = () => {
        if (!field?.arrayItemSchema?.properties) return {}
        
        const defaultItem: any = {}
        field.arrayItemSchema.properties.forEach((prop: SchemaProperty) => {
            if (arrayConfig?.selectedFields.includes(prop.path)) {
                defaultItem[prop.path] = getDefaultValueForType(prop.type)
            }
        })
        return defaultItem
    }

    const getDefaultValueForType = (type: string) => {
        switch (type) {
            case 'string': return ''
            case 'number':
            case 'integer': return 0
            case 'boolean': return false
            case 'array': return []
            case 'object': return {}
            default: return null
        }
    }

    const updateArrayConfig = (items: any[]) => {
        if (arrayConfig && onArrayConfigChange && field) {
            const updatedConfig = {
                ...arrayConfig,
                defaultItemValues: items.reduce((acc, item, index) => {
                    acc[`item_${index}`] = item
                    return acc
                }, {})
            }
            // Fix: Use consistent parameter signature
            onArrayConfigChange(field.path, updatedConfig)
        }
    }

    const addEnumOption = () => {
        const newOption = `option_${enumOptions.length + 1}`
        const updatedOptions = [...enumOptions, newOption]
        setEnumOptions(updatedOptions)
        updateFieldConstraints({ enum: updatedOptions })
    }


    const removeEnumOption = (index: number) => {
        const updatedOptions = enumOptions.filter((_, i) => i !== index)
        setEnumOptions(updatedOptions)
        updateFieldConstraints({ enum: updatedOptions })
    }

    const updateEnumOption = (index: number, value: string) => {
        const updatedOptions = enumOptions.map((option, i) => i === index ? value : option)
        setEnumOptions(updatedOptions)
        updateFieldConstraints({ enum: updatedOptions })
    }

    const updateFieldConstraints = (constraints: any) => {
        // This would need to be implemented to update field constraints
        // For now, we'll just update local state
        console.log('Updating field constraints:', constraints)
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
                : arrayConfig.selectedFields.filter((path: string) => path !== nestedField.path)
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
                    <div className="space-y-4">
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
                                    onChange={(e: { target: { value: any } }) => handleDefaultValueChange(e.target.value)}
                                    placeholder={field.uiHints?.placeholder || `Default ${field.title}`}
                                    className="min-h-[80px]"
                                />
                            ) : (
                                <Input
                                    data-testid="input"
                                    value={localDefaultValue || ''}
                                    onChange={(e: { target: { value: any } }) => handleDefaultValueChange(e.target.value)}
                                    placeholder={field.uiHints?.placeholder || `Default ${field.title}`}
                                />
                            )}
                        </div>
                        
                        {/* Enhanced Enum Management */}
                        {field.constraints?.enum && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Enum Options</label>
                                    <Button size="sm" variant="outline" onClick={addEnumOption}>
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add Option
                                    </Button>
                                </div>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {enumOptions.map((option, index) => (
                                        <div key={index} className="flex items-center space-x-2">
                                            <Input
                                                value={option}
                                                onChange={(e: { target: { value: string } }) => updateEnumOption(index, e.target.value)}
                                                placeholder="Enum option"
                                                className="flex-1"
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => removeEnumOption(index)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
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
                            onChange={(e: { target: { value: any } }) => {
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
                return renderEnhancedArrayConfiguration()

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
                            onChange={(e: { target: { value: any } }) => handleDefaultValueChange(e.target.value)}
                            placeholder={`Default ${field.title}`}
                        />
                    </div>
                )
        }
    }

    /**
     * Enhanced array configuration with default item management
     */
    const renderEnhancedArrayConfiguration = () => {
        if (!field?.arrayItemSchema || !arrayConfig) {
            return (
                <div className="space-y-2">
                    <label className="text-sm font-medium">Array Configuration</label>
                    <div className="text-sm text-gray-500">
                        Simple array - configure default values
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Default Array Items</label>
                        <div className="space-y-2">
                            {arrayDefaultItems.map((item, index) => (
                                <div key={index} className="flex items-center space-x-2 p-2 border rounded">
                                    <Input
                                        value={typeof item === 'object' ? JSON.stringify(item) : item}
                                        onChange={(e: { target: { value: string } }) => {
                                            try {
                                                const value = field.arrayItemSchema?.type === 'object' 
                                                    ? JSON.parse(e.target.value)
                                                    : e.target.value
                                                updateArrayItem(index, 'value', value)
                                            } catch {
                                                updateArrayItem(index, 'value', e.target.value)
                                            }
                                        }}
                                        placeholder={`Item ${index + 1}`}
                                        className="flex-1"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => removeArrayItem(index)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                            <Button size="sm" variant="outline" onClick={addArrayItem}>
                                <Plus className="h-3 w-3 mr-1" />
                                Add Item
                            </Button>
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <div className="space-y-4">
                <div className="border-b pb-2">
                    <h4 className="font-medium text-sm">Array Item Configuration</h4>
                    <p className="text-xs text-gray-500">
                        Configure fields and default values for each {field.arrayItemSchema.type} item
                    </p>
                </div>

                {/* Field Selection */}
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
                                    onCheckedChange={(checked: boolean) => handleArrayFieldToggle(prop, checked as boolean)}
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

                {/* Default Items Management */}
                {arrayConfig.selectedFields.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Default Array Items</label>
                            <Button size="sm" variant="outline" onClick={addArrayItem}>
                                <Plus className="h-3 w-3 mr-1" />
                                Add Item
                            </Button>
                        </div>
                        
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {arrayDefaultItems.map((item, itemIndex) => (
                                <div key={itemIndex} className="p-3 border rounded space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Item {itemIndex + 1}</span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => removeArrayItem(itemIndex)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    
                                    {arrayConfig.selectedFields.map((fieldPath: React.Key | null | undefined) => {
                                        const prop = field.arrayItemSchema?.properties?.find(
                                            (p: SchemaProperty) => p.path === fieldPath
                                        )
                                        if (!prop) return null
                                        
                                        return (
                                            <div key={fieldPath} className="space-y-1">
                                                <label className="text-xs font-medium">{prop.name}</label>
                                                {renderFieldInput(prop, item[fieldPath], (value) => 
                                                    updateArrayItem(itemIndex, fieldPath, value)
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {arrayConfig.selectedFields.length > 0 && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded border">
                        <div className="text-sm font-medium text-green-800 dark:text-green-200">
                            Selected Fields ({arrayConfig.selectedFields.length})
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-300 mt-1">
                            {arrayConfig.selectedFields.join(', ')}
                        </div>
                        {arrayDefaultItems.length > 0 && (
                            <div className="text-xs text-green-600 dark:text-green-300 mt-1">
                                Default items: {arrayDefaultItems.length}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }
    
    /**
     * Render appropriate input for different field types
     */
    const renderFieldInput = (prop: SchemaProperty, value: any, onChange: (value: any) => void) => {
        switch (prop.type) {
            case 'string':
                return (
                    <Input
                        value={value || ''}
                        onChange={(e: { target: { value: any } }) => onChange(e.target.value)}
                        placeholder={`Enter ${prop.name}`}
                        className="text-xs"
                    />
                )
            case 'number':
            case 'integer':
                return (
                    <Input
                        type="number"
                        value={value || ''}
                        onChange={(e: { target: { value: any } }) => onChange(Number(e.target.value))}
                        placeholder={`Enter ${prop.name}`}
                        className="text-xs"
                    />
                )
            case 'boolean':
                return (
                    <div className="flex items-center space-x-2">
                        <Switch
                            checked={value || false}
                            onCheckedChange={onChange}
                        />
                        <span className="text-xs">{value ? 'true' : 'false'}</span>
                    </div>
                )
            default:
                return (
                    <Input
                        value={value || ''}
                        onChange={(e: { target: { value: any } }) => onChange(e.target.value)}
                        placeholder={`Enter ${prop.name}`}
                        className="text-xs"
                    />
                )
        }
    }

    // Add the missing main return statement
    if (!field) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle>Field Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-gray-500 py-8">
                        Select a field to configure its properties
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Configure Field: {field.name}</CardTitle>
                <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="secondary">{field.type}</Badge>
                    {field.required && (
                        <Badge variant="destructive">Required</Badge>
                    )}
                </div>
                {field.description && (
                    <p className="text-sm text-gray-600 mt-2">{field.description}</p>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Default Value Configuration */}
                {renderDefaultValueEditor()}
                
                {/* Array Configuration */}
                {field.type === 'array' && renderEnhancedArrayConfiguration()}
            </CardContent>
        </Card>
    )  
}