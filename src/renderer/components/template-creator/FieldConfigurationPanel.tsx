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
import { Plus, Trash2, Settings, X } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/renderer/components/ui/dialog'
import { Label } from '@/renderer/components/ui/label'
import { DialogDescription } from '@/renderer/components/ui/dialog'

interface FieldConfigurationPanelProps {
    field: EnhancedTemplateField | null
    onDefaultValueChange: (fieldPath: string, value: any) => void
    onNestedFieldToggle: (parentPath: string, nestedField: SchemaProperty, checked: boolean) => void
    onArrayConfigChange: (parentPath: string, config: ArrayItemFieldConfig) => void
    onFieldUpdate?: (fieldPath: string, updatedField: SchemaProperty) => void
    onTitleChange?: (fieldPath: string, title: string) => void
    onDescriptionChange?: (fieldPath: string, description: string) => void
    onFormatChange?: (fieldPath: string, format: string) => void
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
    onTitleChange,
    onDescriptionChange,
    onFormatChange,
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
            // Fix: Initialize enumOptions from field constraints
            setEnumOptions(field.constraints?.enum || [])
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
            // Fix: Reset enumOptions when no field
            setEnumOptions([])
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
     * Handle Enhanced Property Editor save with JSONSchema7 persistence
     */
    const handleEnhancedEditorSave = (updatedProperty: SchemaProperty) => {
        if (!field) return

        console.log('🔧 DEBUG: Enhanced editor save called', { updatedProperty, fieldPath: field.path })

        // Apply default value change
        if (updatedProperty.default !== field.defaultValue) {
            handleDefaultValueChange(updatedProperty.default)
        }

        // Apply title change if handler is provided
        if (onTitleChange && updatedProperty.title !== field.title) {
            console.log('🔧 DEBUG: Applying title change', {
                oldTitle: field.title,
                newTitle: updatedProperty.title,
                fieldPath: field.path
            })
            onTitleChange(field.path, updatedProperty.title || '')
        }

        // Apply description change if handler is provided
        if (onDescriptionChange && updatedProperty.description !== field.description) {
            console.log('🔧 DEBUG: Applying description change', {
                oldDescription: field.description,
                newDescription: updatedProperty.description,
                fieldPath: field.path
            })
            onDescriptionChange(field.path, updatedProperty.description || '')
        }

        // Apply format change if handler is provided
        if (onFormatChange && updatedProperty.format !== field.format) {
            console.log('🔧 DEBUG: Applying format change', {
                oldFormat: field.format,
                newFormat: updatedProperty.format,
                fieldPath: field.path
            })
            onFormatChange(field.path, updatedProperty.format || '')
        }

        // Call existing field update handler if provided
        if (onFieldUpdate) {
            onFieldUpdate(field.path, updatedProperty)
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
    const handleClearDefaultValue = () => {
        setLocalDefaultValue(null)
        if (field) {
            handleDefaultValueChange(null)
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
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Default Value</label>
                                {localDefaultValue !== null && localDefaultValue !== undefined && localDefaultValue !== '' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleClearDefaultValue}
                                        className="h-6 px-2 text-xs"
                                    >
                                        <X className="h-3 w-3 mr-1" />
                                        Clear
                                    </Button>
                                )}
                            </div>
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
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Default Value</label>
                            {localDefaultValue !== null && localDefaultValue !== undefined && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleClearDefaultValue}
                                    className="h-6 px-2 text-xs"
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    Clear
                                </Button>
                            )}
                        </div>
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
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Default Value</label>
                            {localDefaultValue !== null && localDefaultValue !== undefined && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleClearDefaultValue}
                                    className="h-6 px-2 text-xs"
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    Clear
                                </Button>
                            )}
                        </div>
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
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Default Value</label>
                            {localDefaultValue !== null && localDefaultValue !== undefined && localDefaultValue !== '' && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleClearDefaultValue}
                                    className="h-6 px-2 text-xs"
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    Clear
                                </Button>
                            )}
                        </div>
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
                <div className="space-y-2">
                    <Select value={value || ''} onValueChange={onChange}>
                        <SelectTrigger data-testid="select" className="text-xs">
                            <SelectValue placeholder={`Select ${prop.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">-- None --</SelectItem>
                            {prop.constraints.enum.map((option: any) => (
                                <SelectItem key={option} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="text-xs text-gray-500">
                        Available options: {prop.constraints.enum.length}
                    </div>
                </div>
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
                // Enhanced array handling with proper item management
                const arrayValue = Array.isArray(value) ? value : [];
                return (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Array Items</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const newArray = [...arrayValue, ''];
                                    onChange(newArray);
                                }}
                                className="h-6 px-2 text-xs"
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Item
                            </Button>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {arrayValue.length === 0 ? (
                                <div className="text-xs text-gray-500 p-2 border border-dashed rounded">
                                    No items. Click "Add Item" to start.
                                </div>
                            ) : (
                                arrayValue.map((item: any, index: number) => (
                                    <div key={index} className="flex items-center space-x-1">
                                        <Input
                                            value={item || ''}
                                            onChange={(e) => {
                                                const newArray = [...arrayValue];
                                                newArray[index] = e.target.value;
                                                onChange(newArray);
                                            }}
                                            placeholder={`Item ${index + 1}`}
                                            className="text-xs flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                const newArray = arrayValue.filter((_, i) => i !== index);
                                                onChange(newArray);
                                            }}
                                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )

            case 'object':
                // Enhanced object handling for key-value pairs
                let objectValue;
                try {
                    objectValue = typeof value === 'string' ? JSON.parse(value) : (value || {});
                } catch {
                    objectValue = {};
                }

                const objectEntries = Object.entries(objectValue);

                return (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Key-Value Pairs</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const newObj = { ...objectValue, [`key${Object.keys(objectValue).length + 1}`]: '' };
                                    onChange(newObj);
                                }}
                                className="h-6 px-2 text-xs"
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Pair
                            </Button>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {objectEntries.length === 0 ? (
                                <div className="text-xs text-gray-500 p-2 border border-dashed rounded">
                                    No key-value pairs. Click "Add Pair" to start.
                                </div>
                            ) : (
                                objectEntries.map(([key, val], index) => (
                                    <div key={index} className="flex items-center space-x-1">
                                        <Input
                                            value={key}
                                            onChange={(e) => {
                                                const newObj = { ...objectValue };
                                                delete newObj[key];
                                                newObj[e.target.value] = val;
                                                onChange(newObj);
                                            }}
                                            placeholder="Key"
                                            className="text-xs flex-1"
                                        />
                                        <Input
                                            value={val as string}
                                            onChange={(e) => {
                                                const newObj = { ...objectValue, [key]: e.target.value };
                                                onChange(newObj);
                                            }}
                                            placeholder="Value"
                                            className="text-xs flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                const newObj = { ...objectValue };
                                                delete newObj[key];
                                                onChange(newObj);
                                            }}
                                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                        <details className="text-xs">
                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">JSON View</summary>
                            <Textarea
                                value={JSON.stringify(objectValue, null, 2)}
                                onChange={(e) => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        onChange(parsed);
                                    } catch {
                                        // Invalid JSON, don't update
                                    }
                                }}
                                className="text-xs font-mono mt-1 min-h-[60px]"
                                rows={3}
                            />
                        </details>
                    </div>
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
                        {field.constraints?.enum && (
                            <Badge variant="outline">enum</Badge>
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
                        <DialogDescription>
                            Configure advanced properties, constraints, and default values for this field.
                        </DialogDescription>
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