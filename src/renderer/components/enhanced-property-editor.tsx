import { useState } from 'react';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Textarea } from '@/renderer/components/ui/textarea';
import { Label } from '@/renderer/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select';
import { Switch } from '@/renderer/components/ui/switch';
import { Badge } from '@/renderer/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';
import { SchemaProperty } from '@/shared/types/schema';

interface EnhancedPropertyEditorProps {
    property: SchemaProperty;
    onSave: (property: SchemaProperty) => void;
    onDelete: () => void;
    onCancel: () => void;
}

interface FormData {
    type: string;
    title: string;
    description: string;
    format: string;
    default: any;
    enum?: any[];
    items?: {
        type: string;
        properties?: Record<string, any>;
    };
    properties?: Record<string, any>;
}

export function EnhancedPropertyEditor({ property, onSave, onDelete, onCancel }: EnhancedPropertyEditorProps) {
    const [formData, setFormData] = useState<FormData>({
        type: property.type || 'string',
        title: property.title || property.name || '',
        description: property.description || '',
        format: property.format || '',
        default: property.default || getDefaultValueForType(property.type || 'string'),
        enum: property.enum || undefined,
        items: property.items || undefined,
        properties: property.properties || undefined
    });

    const [enumOptions, setEnumOptions] = useState<any[]>(property.enum || []);
    const [newEnumValue, setNewEnumValue] = useState('');
    const [enumType, setEnumType] = useState<'string' | 'number' | 'integer' | 'boolean'>('string');
    const [arrayItems, setArrayItems] = useState<any[]>(
        Array.isArray(property.default) ? property.default : []
    );

    /**
     * Clear handlers for different fields
     */
    const handleClearTitle = () => {
        setFormData(prev => ({ ...prev, title: '' }));
    };

    const handleClearDescription = () => {
        setFormData(prev => ({ ...prev, description: '' }));
    };

    const handleClearFormat = () => {
        setFormData(prev => ({ ...prev, format: '' }));
    };

    const handleClearDefault = () => {
        const defaultValue = getDefaultValueForType(formData.type);
        setFormData(prev => ({ ...prev, default: defaultValue }));
        if (formData.type === 'array') {
            setArrayItems([]);
        }
    };

    /**
     * Check if field has content to show clear button
     */
    const hasContent = (value: any, type?: string) => {
        if (type === 'array') {
            return Array.isArray(value) && value.length > 0;
        }
        return value !== null && value !== undefined && value !== '';
    };

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
     * Convert enum value to appropriate type
     */
    function convertEnumValue(value: string, type: 'string' | 'number' | 'integer' | 'boolean'): any {
        switch (type) {
            case 'string': return value;
            case 'number': return parseFloat(value) || 0;
            case 'integer': return parseInt(value) || 0;
            case 'boolean': return value.toLowerCase() === 'true';
            default: return value;
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
     * Add enum option with proper type conversion
     */
    const addEnumOption = () => {
        if (newEnumValue.trim()) {
            const convertedValue = convertEnumValue(newEnumValue.trim(), enumType);

            // Check for duplicates based on converted value
            if (!enumOptions.some(option => option === convertedValue)) {
                const updatedOptions = [...enumOptions, convertedValue];
                setEnumOptions(updatedOptions);
                setFormData(prev => ({ ...prev, enum: updatedOptions }));
                setNewEnumValue('');
            }
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
                            onValueChange={(value: any) => handleDefaultValueChange(value)}
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
                        onChange={(e: { target: { value: any; }; }) => handleDefaultValueChange(e.target.value)}
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
                        onChange={(e: any) => handleDefaultValueChange(
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
                <div className="flex items-center justify-between">
                    <Label htmlFor="title">Title</Label>
                    {hasContent(formData.title) && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClearTitle();
                            }}
                            className="h-6 px-2 text-xs"
                        >
                            <X className="h-3 w-3 mr-1" />
                            Clear
                        </Button>
                    )}
                </div>
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
                <div className="flex items-center justify-between">
                    <Label htmlFor="description">Description</Label>
                    {hasContent(formData.description) && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClearDescription();
                            }}
                            className="h-6 px-2 text-xs"
                        >
                            <X className="h-3 w-3 mr-1" />
                            Clear
                        </Button>
                    )}
                </div>
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
                    <div className="flex items-center justify-between">
                        <Label htmlFor="format">Format</Label>
                        {hasContent(formData.format) && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearFormat();
                                }}
                                className="h-6 px-2 text-xs"
                            >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                            </Button>
                        )}
                    </div>
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
                <div className="flex items-center justify-between">
                    <Label>Default Value</Label>
                    {hasContent(formData.default, formData.type) && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClearDefault();
                            }}
                            className="h-6 px-2 text-xs"
                        >
                            <X className="h-3 w-3 mr-1" />
                            Clear
                        </Button>
                    )}
                </div>
                {renderDefaultValueEditor()}
            </div>

            {/* Action Buttons - Plain HTML approach */}
            <div className="flex justify-end space-x-2 pt-4">
                {onCancel && (
                    <button 
                        onClick={onCancel}
                        className="h-10 px-4 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Cancel
                    </button>
                )}
                {onDelete && (
                    <button 
                        onClick={onDelete}
                        className="h-10 px-4 border border-red-300 rounded-md bg-white text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        Delete
                    </button>
                )}
                <button 
                    onClick={handleSave}
                    className="h-10 px-4 border border-orange-500 rounded-md bg-orange-500 text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                    Save Property
                </button>
            </div>
        </div>
    );
}