import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Textarea } from '@/renderer/components/ui/textarea';
import { Label } from '@/renderer/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select';
import { Switch } from '@/renderer/components/ui/switch';
import { Badge } from '@/renderer/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';
import { SchemaProperty } from '@/shared/types/schema';

/**
 * Enhanced PropertyEditor component that provides comprehensive schema property definition
 * capabilities including metadata editing and advanced default value configuration
 */
interface EnhancedPropertyEditorProps {
    property: SchemaProperty;
    onSave: (property: SchemaProperty) => void;
    onDelete?: () => void;
    onCancel?: () => void;
}

interface FormData {
    type: string;
    title: string;
    description: string;
    format: string;
    default: any;
    enum?: string[];
    items?: {
        type: string;
        properties?: Record<string, any>;
    };
    properties?: Record<string, any>;
}

export function EnhancedPropertyEditor({ property, onSave, onDelete, onCancel }: EnhancedPropertyEditorProps) {
    const [formData, setFormData] = useState<FormData>({
        type: property.type || 'string',
        title: property.title || '',
        description: property.description || '',
        format: property.format || '',
        default: property.default || getDefaultValueForType(property.type || 'string'),
        enum: property.enum || undefined,
        items: property.items || undefined,
        properties: property.properties || undefined
    });

    const [enumOptions, setEnumOptions] = useState<string[]>(property.enum || []);
    const [newEnumValue, setNewEnumValue] = useState('');
    const [arrayItems, setArrayItems] = useState<any[]>(
        Array.isArray(property.default) ? property.default : []
    );

    /**
     * Get default value based on property type
     */
    function getDefaultValueForType(type: string): any {
        switch (type) {
            case 'string': return '';
            case 'number': return 0;
            case 'integer': return 0;
            case 'boolean': return false;
            case 'array': return [];
            case 'object': return {};
            default: return '';
        }
    }

    /**
     * Handle form field changes
     */
    const handleFieldChange = (field: keyof FormData, value: any) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };

            // Reset default value when type changes
            if (field === 'type') {
                updated.default = getDefaultValueForType(value);
                updated.enum = undefined;
                updated.items = undefined;
                updated.properties = undefined;
                setEnumOptions([]);
                setArrayItems([]);
            }

            return updated;
        });
    };

    /**
     * Handle default value changes for different types
     */
    const handleDefaultValueChange = (value: any) => {
        setFormData(prev => ({ ...prev, default: value }));
    };

    /**
     * Add enum option for string types
     */
    const addEnumOption = () => {
        if (newEnumValue.trim() && !enumOptions.includes(newEnumValue.trim())) {
            const updatedOptions = [...enumOptions, newEnumValue.trim()];
            setEnumOptions(updatedOptions);
            setFormData(prev => ({ ...prev, enum: updatedOptions }));
            setNewEnumValue('');
        }
    };

    /**
     * Remove enum option
     */
    const removeEnumOption = (index: number) => {
        const updatedOptions = enumOptions.filter((_, i) => i !== index);
        setEnumOptions(updatedOptions);
        setFormData(prev => ({
            ...prev,
            enum: updatedOptions.length > 0 ? updatedOptions : undefined
        }));
    };

    /**
     * Add array item
     */
    const addArrayItem = () => {
        const itemType = formData.items?.type || 'string';
        const newItem = getDefaultValueForType(itemType);
        const updatedItems = [...arrayItems, newItem];
        setArrayItems(updatedItems);
        setFormData(prev => ({ ...prev, default: updatedItems }));
    };

    /**
     * Update array item
     */
    const updateArrayItem = (index: number, value: any) => {
        const updatedItems = arrayItems.map((item, i) => i === index ? value : item);
        setArrayItems(updatedItems);
        setFormData(prev => ({ ...prev, default: updatedItems }));
    };

    /**
     * Remove array item
     */
    const removeArrayItem = (index: number) => {
        const updatedItems = arrayItems.filter((_, i) => i !== index);
        setArrayItems(updatedItems);
        setFormData(prev => ({ ...prev, default: updatedItems }));
    };

    /**
     * Render default value editor based on type
     */
    const renderDefaultValueEditor = () => {
        switch (formData.type) {
            case 'string':
                if (enumOptions.length > 0) {
                    return (
                        <Select
                            value={formData.default || ''}
                            onValueChange={(value) => handleDefaultValueChange(value)}
                        >
                            <SelectTrigger data-testid="select">
                                <SelectValue placeholder="Select default value" />
                            </SelectTrigger>
                            <SelectContent>
                                {enumOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    );
                }
                return (
                    <Textarea
                        data-testid="textarea"
                        value={formData.default || ''}
                        onChange={(e) => handleDefaultValueChange(e.target.value)}
                        placeholder="Enter default value"
                        rows={3}
                    />
                );

            case 'number':
            case 'integer':
                return (
                    <Input
                        data-testid="input"
                        type="number"
                        value={formData.default || 0}
                        onChange={(e) => handleDefaultValueChange(
                            formData.type === 'integer'
                                ? parseInt(e.target.value) || 0
                                : parseFloat(e.target.value) || 0
                        )}
                        placeholder="Enter default value"
                    />
                );

            case 'boolean':
                return (
                    <div className="flex items-center space-x-2">
                        <Switch
                            data-testid="switch"
                            checked={formData.default || false}
                            onCheckedChange={handleDefaultValueChange}
                        />
                        <Label>{formData.default ? 'True' : 'False'}</Label>
                    </div>
                );

            case 'array':
                return (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Array Items</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addArrayItem}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Item
                            </Button>
                        </div>

                        {/* Array item type selector */}
                        <div className="space-y-2">
                            <Label>Item Type</Label>
                            <Select
                                value={formData.items?.type || 'string'}
                                onValueChange={(value) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        items: { ...prev.items, type: value }
                                    }));
                                    setArrayItems([]);
                                }}
                            >
                                <SelectTrigger data-testid="select" aria-label="array item type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="string">String</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="integer">Integer</SelectItem>
                                    <SelectItem value="boolean">Boolean</SelectItem>
                                    <SelectItem value="object">Object</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Array items */}
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {arrayItems.map((item, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    {renderArrayItemEditor(item, index)}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeArrayItem(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'object':
                return (
                    <Textarea
                        data-testid="textarea"
                        value={JSON.stringify(formData.default || {}, null, 2)}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                handleDefaultValueChange(parsed);
                            } catch {
                                // Invalid JSON, keep the text for editing
                            }
                        }}
                        placeholder="Enter JSON object"
                        rows={5}
                        className="font-mono text-sm"
                    />
                );

            default:
                return (
                    <Input
                        data-testid="input"
                        value={formData.default || ''}
                        onChange={(e) => handleDefaultValueChange(e.target.value)}
                        placeholder="Enter default value"
                    />
                );
        }
    };

    /**
     * Render array item editor based on item type
     */
    const renderArrayItemEditor = (item: any, index: number) => {
        const itemType = formData.items?.type || 'string';

        switch (itemType) {
            case 'string':
                return (
                    <Input
                        data-testid="input"
                        value={item || ''}
                        onChange={(e) => updateArrayItem(index, e.target.value)}
                        placeholder="Enter string value"
                        className="flex-1"
                    />
                );

            case 'number':
            case 'integer':
                return (
                    <Input
                        data-testid="input"
                        type="number"
                        value={item || 0}
                        onChange={(e) => updateArrayItem(
                            index,
                            itemType === 'integer'
                                ? parseInt(e.target.value) || 0
                                : parseFloat(e.target.value) || 0
                        )}
                        placeholder="Enter number"
                        className="flex-1"
                    />
                );

            case 'boolean':
                return (
                    <div className="flex items-center space-x-2 flex-1">
                        <Switch
                            data-testid="switch"
                            checked={item || false}
                            onCheckedChange={(checked) => updateArrayItem(index, checked)}
                        />
                        <Label>{item ? 'True' : 'False'}</Label>
                    </div>
                );

            case 'object':
                return (
                    <Textarea
                        data-testid="textarea"
                        value={JSON.stringify(item || {}, null, 2)}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                updateArrayItem(index, parsed);
                            } catch {
                                // Invalid JSON, keep for editing
                            }
                        }}
                        placeholder="Enter JSON object"
                        rows={3}
                        className="flex-1 font-mono text-sm"
                    />
                );

            default:
                return (
                    <Input
                        data-testid="input"
                        value={item || ''}
                        onChange={(e) => updateArrayItem(index, e.target.value)}
                        placeholder="Enter value"
                        className="flex-1"
                    />
                );
        }
    };

    /**
  
              value={item || ''}
              onChange={(e) => updateArrayItem(index, e.target.value)}
              placeholder="Enter value"
              className="flex-1"
            />
          );
      }
    };
  
    /**
     * Handle save operation
     */
    const handleSave = () => {
        const updatedProperty: SchemaProperty = {
            ...property,
            type: formData.type,
            title: formData.title,
            description: formData.description,
            format: formData.format || undefined,
            default: formData.default,
            enum: formData.enum,
            items: formData.items,
            properties: formData.properties
        };

        onSave(updatedProperty);
    };

    return (
        <div className="w-full space-y-6">
            {/* Property Type */}
            <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                    value={formData.type}
                    onValueChange={(value) => handleFieldChange('type', value)}
                >
                    <SelectTrigger data-testid="select" aria-label="type">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="integer">Integer</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="array">Array</SelectItem>
                        <SelectItem value="object">Object</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Property Title */}
            <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                    data-testid="input"
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    placeholder="Enter property title"
                />
            </div>

            {/* Property Description */}
            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    data-testid="textarea"
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Enter property description"
                    rows={3}
                />
            </div>

            {/* Property Format (for strings) */}
            {formData.type === 'string' && (
                <div className="space-y-2">
                    <Label htmlFor="format">Format</Label>
                    <Select
                        value={formData.format || 'none'}
                        onValueChange={(value) => handleFieldChange('format', value === 'none' ? '' : value)}
                    >
                        <SelectTrigger data-testid="select" aria-label="format">
                            <SelectValue placeholder="Select format (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="uri">URI</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="date-time">Date-Time</SelectItem>
                            <SelectItem value="password">Password</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Enum Options (for strings) */}
            {formData.type === 'string' && (
                <div className="space-y-4">
                    <Label>Enum Options (Optional)</Label>

                    {/* Add new enum option */}
                    <div className="flex space-x-2">
                        <Input data-testid="input"
                            value={newEnumValue}
                            onChange={(e) => setNewEnumValue(e.target.value)}
                            placeholder="Add enum option"
                            onKeyPress={(e) => e.key === 'Enter' && addEnumOption()}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={addEnumOption}
                            disabled={!newEnumValue.trim()}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Display enum options */}
                    {enumOptions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {enumOptions.map((option, index) => (
                                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                    {option}
                                    <X
                                        className="h-3 w-3 cursor-pointer hover:text-red-500"
                                        onClick={() => removeEnumOption(index)}
                                    />
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Default Value */}
            <div className="space-y-2">
                <Label>Default Value</Label>
                {renderDefaultValueEditor()}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
                {onCancel && (
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                {onDelete && (
                    <Button variant="destructive" onClick={onDelete}>
                        Delete
                    </Button>
                )}
                <Button onClick={handleSave}>
                    Save Property
                </Button>
            </div>
        </div>
    );
}