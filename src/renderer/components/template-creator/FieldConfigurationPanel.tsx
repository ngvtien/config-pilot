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
import { EnhancedPropertyEditor } from '../enhanced-property-editor'
import { Plus, Trash2, Settings } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/renderer/components/ui/dialog'

interface FieldConfigurationPanelProps {
    field: EnhancedTemplateField | null
    onDefaultValueChange: (fieldPath: string, value: any) => void
    onNestedFieldToggle: (parentPath: string, nestedField: SchemaProperty, checked: boolean) => void
    onArrayConfigChange: (parentPath: string, config: ArrayItemFieldConfig) => void
    onFieldUpdate?: (fieldPath: string, updatedField: SchemaProperty) => void
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
    onFieldUpdate,
    className = ""
}) => {
    const [localDefaultValue, setLocalDefaultValue] = useState<any>(null)
    const [arrayConfig, setArrayConfig] = useState<ArrayItemFieldConfig | null>(null)
    const [arrayDefaultItems, setArrayDefaultItems] = useState<any[]>([])
    const [enumOptions, setEnumOptions] = useState<string[]>([])
    const [showEnhancedEditor, setShowEnhancedEditor] = useState(false)

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
     * Convert EnhancedTemplateField to SchemaProperty for Enhanced Property Editor
     */
    const convertToSchemaProperty = (field: EnhancedTemplateField): SchemaProperty => {
        return {
            path: field.path,
            name: field.name,
            type: field.type,
            title: field.title || field.name,
            description: field.description,
            required: field.required,
            default: field.defaultValue,
            format: field.format,
            constraints: field.constraints,
            enum: field.constraints?.enum,
            items: field.arrayItemSchema ? {
                type: field.arrayItemSchema.type,
                properties: field.arrayItemSchema.properties
            } : undefined
        }
    }

    /**
     * Handle Enhanced Property Editor save
     */
    const handleEnhancedEditorSave = (updatedProperty: SchemaProperty) => {
        if (field && onFieldUpdate) {
            onFieldUpdate(field.path, updatedProperty)
        }

        // Update local default value
        if (updatedProperty.default !== undefined) {
            handleDefaultValueChange(updatedProperty.default)
        }

        setShowEnhancedEditor(false)
    }

    /**
     * Handle Enhanced Property Editor cancel
     */
    const handleEnhancedEditorCancel = () => {
        setShowEnhancedEditor(false)
    }

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
                        <Textarea
                            data-testid="textarea"
                            value={Array.isArray(localDefaultValue) ? localDefaultValue.join('\n') : ''}
                            onChange={(e) => {
                                const items = e.target.value.split('\n').filter(item => item.trim())
                                handleDefaultValueChange(items)
                            }}
                            placeholder="Enter default items (one per line)"
                            rows={4}
                        />
                    </div>
                </div>
            )
        }

        return (
            <div className="space-y-4">
                <div className="border-b pb-2">
                    <h4 className="font-medium text-sm">Array Configuration</h4>
                    <p className="text-xs text-gray-500">
                        Configure template for {field.arrayItemSchema.type} items
                    </p>
                </div>

                {/* Simplified Field Selection */}
                <div className="space-y-3">
                    <div className="text-sm font-medium">
                        Available fields for {field.arrayItemSchema.type}:
                    </div>

                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                        {field.arrayItemSchema.properties?.map((prop: SchemaProperty) => {
                            const isSelected = arrayConfig.selectedFields.includes(prop.path)
                            return (
                                <div key={prop.path} className="flex items-center space-x-2 p-2 rounded border hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <Checkbox
                                        data-testid="checkbox"
                                        checked={isSelected}
                                        onCheckedChange={(checked: boolean) => handleArrayFieldToggle(prop, checked)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-sm font-medium truncate">{prop.name}</span>
                                            <Badge variant="secondary" className="text-xs shrink-0">{prop.type}</Badge>
                                            {prop.required && (
                                                <Badge variant="destructive" className="text-xs shrink-0">Required</Badge>
                                            )}
                                        </div>
                                        {prop.description && (
                                            <p className="text-xs text-gray-500 truncate" title={prop.description}>
                                                {prop.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Single Template Item Configuration */}
                {arrayConfig.selectedFields.length > 0 && (
                    <div className="space-y-3">
                        <div className="text-sm font-medium">Template Item Configuration</div>
                        <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                                Configure the template that will be used for new array items
                            </div>

                            <div className="space-y-3">
                                {arrayConfig.selectedFields.map((fieldPath) => {
                                    const prop = field.arrayItemSchema?.properties?.find(
                                        (p: SchemaProperty) => p.path === fieldPath
                                    )
                                    if (!prop) return null

                                    const templateValue = arrayConfig.defaultItemValues?.[fieldPath]

                                    return (
                                        <div key={fieldPath} className="space-y-1">
                                            <label className="text-xs font-medium flex items-center space-x-2">
                                                <span>{prop.name}</span>
                                                <Badge variant="outline" className="text-xs">{prop.type}</Badge>
                                            </label>
                                            {renderFieldInput(prop, templateValue, (value) => {
                                                const newDefaults = { ...arrayConfig.defaultItemValues, [fieldPath]: value }
                                                onArrayConfigChange(field.path, {
                                                    ...arrayConfig,
                                                    defaultItemValues: newDefaults
                                                })
                                            })}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary */}
                {arrayConfig.selectedFields.length > 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border">
                        <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Array Template Summary
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                            Selected fields: {arrayConfig.selectedFields.length}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-300">
                            Fields: {arrayConfig.selectedFields.join(', ')}
                        </div>
                    </div>
                )}
            </div>
        )
    }
    /**
     * Enhanced field input renderer that properly handles array item types
     */
    const renderFieldInput = (prop: SchemaProperty, value: any, onChange: (value: any) => void) => {
        // Handle enum constraints first
        if (prop.constraints?.enum) {
            return (
                <Select value={value || ''} onValueChange={onChange}>
                    <SelectTrigger data-testid="select" className="text-xs">
                        <SelectValue placeholder={`Select ${prop.name}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {prop.constraints.enum.map((option: any) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )
        }

        // Handle different field types
        switch (prop.type) {
            case 'string':
                // Check for format hints
                if (prop.format === 'textarea' || (prop.constraints?.maxLength && prop.constraints.maxLength > 100)) {
                    return (
                        <Textarea
                            data-testid="textarea"
                            value={value || ''}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={`Enter ${prop.name}`}
                            className="text-xs min-h-[60px]"
                            rows={3}
                        />
                    )
                }
                return (
                    <Input
                        data-testid="input"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={`Enter ${prop.name}`}
                        className="text-xs"
                    />
                )

            case 'number':
            case 'integer':
                return (
                    <Input
                        data-testid="input"
                        type="number"
                        value={value || ''}
                        onChange={(e) => {
                            const numValue = prop.type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value)
                            onChange(isNaN(numValue) ? '' : numValue)
                        }}
                        placeholder={`Enter ${prop.name}`}
                        className="text-xs"
                        min={prop.constraints?.minimum}
                        max={prop.constraints?.maximum}
                    />
                )

            case 'boolean':
                return (
                    <div className="flex items-center space-x-2">
                        <Switch
                            data-testid="switch"
                            checked={value || false}
                            onCheckedChange={onChange}
                        />
                        <span className="text-xs">{value ? 'true' : 'false'}</span>
                    </div>
                )

            case 'array':
                // For nested arrays, show a simplified input
                return (
                    <Textarea
                        data-testid="textarea"
                        value={Array.isArray(value) ? value.join('\n') : (value || '')}
                        onChange={(e) => {
                            const lines = e.target.value.split('\n').filter(line => line.trim())
                            onChange(lines)
                        }}
                        placeholder={`Enter ${prop.name} (one per line)`}
                        className="text-xs min-h-[60px]"
                        rows={3}
                    />
                )

            case 'object':
                // For objects, show JSON input
                return (
                    <Textarea
                        data-testid="textarea"
                        value={typeof value === 'object' ? JSON.stringify(value, null, 2) : (value || '')}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value)
                                onChange(parsed)
                            } catch {
                                onChange(e.target.value)
                            }
                        }}
                        placeholder={`Enter ${prop.name} as JSON`}
                        className="text-xs min-h-[80px] font-mono"
                        rows={4}
                    />
                )

            default:
                return (
                    <Input
                        data-testid="input"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={`Enter ${prop.name}`}
                        className="text-xs"
                    />
                )
        }
    }

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

    // Show Enhanced Property Editor if enabled
    if (showEnhancedEditor) {
        return (
            <>
                <Card className={className}>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Configure Field: {field.name}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowEnhancedEditor(true)}
                                className="flex items-center gap-2"
                            >
                                <Settings className="h-4 w-4" />
                                Advanced Editor
                            </Button>
                        </CardTitle>
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

                <Dialog open={showEnhancedEditor} onOpenChange={setShowEnhancedEditor}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Enhanced Property Editor</DialogTitle>
                        </DialogHeader>
                        <EnhancedPropertyEditor
                            property={convertToSchemaProperty(field)}
                            onSave={handleEnhancedEditorSave}
                            onCancel={handleEnhancedEditorCancel}
                        />
                    </DialogContent>
                </Dialog>
            </>
        )
    }


    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Configure Field: {field.name}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowEnhancedEditor(true)}
                        className="flex items-center gap-2"
                    >
                        <Settings className="h-4 w-4" />
                        Advanced Editor
                    </Button>
                </CardTitle>
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