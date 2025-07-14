import { useEffect, useState } from 'react';
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
    fieldPath: string;
    onStateChange: (fieldPath: string, currentState: SchemaProperty) => void;
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

export function EnhancedPropertyEditor({ property, fieldPath, onStateChange }: EnhancedPropertyEditorProps) {
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

    const [enumOptions, setEnumOptions] = useState<any[]>(property.enum || []);
    const [newEnumValue, setNewEnumValue] = useState('');
    const [enumType, setEnumType] = useState<'string' | 'number' | 'integer' | 'boolean'>('string');
    const [arrayItems, setArrayItems] = useState<any[]>(
        Array.isArray(property.default) ? property.default : []
    );

    const [objectProperties, setObjectProperties] = useState<Array<{
        name: string;
        type: string;
        title?: string;
        description?: string;
    }>>([])

    const [keyValuePairs, setKeyValuePairs] = useState<Array<{
        key: string;
        value: any;
        valueType: 'string' | 'number' | 'integer' | 'boolean';
    }>>([]);

    /**
     * Determine if object should be treated as key-value pairs or structured properties
     */
    const isKeyValueObject = () => {
        return formData.type === 'object' && (!formData.properties || Object.keys(formData.properties).length === 0);
    };

    /**
     * Initialize key-value pairs from existing default object
     */
    const initializeKeyValuePairs = () => {
        if (isKeyValueObject() && formData.default && typeof formData.default === 'object') {
            const pairs = Object.entries(formData.default).map(([key, value]) => ({
                key,
                value,
                valueType: typeof value === 'number' ?
                    (Number.isInteger(value) ? 'integer' : 'number') :
                    typeof value === 'boolean' ? 'boolean' : 'string'
            }));
            setKeyValuePairs(pairs);
        }
    };

    /**
     * Add a new key-value pair
     */
    const handleAddKeyValuePair = () => {
        const newPair = {
            key: `key${keyValuePairs.length + 1}`,
            value: '',
            valueType: 'string' as const
        };

        setKeyValuePairs(prev => [...prev, newPair]);
        updateObjectFromKeyValuePairs([...keyValuePairs, newPair]);
    };

    /**
     * Remove a key-value pair by index
     */
    const handleRemoveKeyValuePair = (index: number) => {
        const updatedPairs = keyValuePairs.filter((_, i) => i !== index);
        setKeyValuePairs(updatedPairs);
        updateObjectFromKeyValuePairs(updatedPairs);
    };

    /**
     * Update a key-value pair
     */
    const handleKeyValuePairChange = (index: number, field: 'key' | 'value' | 'valueType', value: any) => {
        const updatedPairs = keyValuePairs.map((pair, i) => {
            if (i !== index) return pair;

            const updatedPair = { ...pair, [field]: value };

            // Convert value when type changes
            if (field === 'valueType') {
                updatedPair.value = convertValueToType(pair.value, value);
            }

            return updatedPair;
        });

        setKeyValuePairs(updatedPairs);
        updateObjectFromKeyValuePairs(updatedPairs);
    };

    /**
     * Convert value to specified type
     */
    const convertValueToType = (value: any, type: string): any => {
        switch (type) {
            case 'string': return String(value);
            case 'number': return parseFloat(value) || 0;
            case 'integer': return parseInt(value) || 0;
            case 'boolean': return Boolean(value);
            default: return value;
        }
    };

    /**
     * Update formData.default from key-value pairs
     */
    const updateObjectFromKeyValuePairs = (pairs: typeof keyValuePairs) => {
        const objectValue = pairs.reduce((acc, pair) => {
            if (pair.key.trim()) {
                acc[pair.key] = pair.value;
            }
            return acc;
        }, {} as Record<string, any>);

        setFormData(prev => {
            const updated = { ...prev, default: objectValue };

            setTimeout(() => {
                onStateChange(fieldPath, {
                    ...property,
                    type: updated.type,
                    title: prev.title === '' ? undefined : prev.title,
                    description: prev.description === '' ? undefined : prev.description,
                    format: prev.format === '' ? undefined : prev.format,
                    default: Object.keys(objectValue).length > 0 ? objectValue : undefined,
                    enum: updated.enum,
                    items: updated.items,
                    properties: updated.properties
                });
            }, 0);

            return updated;
        });
    };

    /**
     * Add a new object property with default values
     */
    const handleAddObjectProperty = () => {
        const name = `property${objectProperties.length + 1}`;
        const newProperty = {
            name,
            type: 'string',
            title: name,
            description: ''
        };

        setObjectProperties(prev => [...prev, newProperty]);

        // Update formData.properties to include the new property
        setFormData(prev => {
            const updatedProperties = {
                ...prev.properties,
                [name]: {
                    type: 'string',
                    title: name,
                    description: '',
                    default: getDefaultValueForType('string')
                }
            };

            const updated = {
                ...prev,
                properties: updatedProperties
            };

            // Notify parent of the change
            setTimeout(() => {
                onStateChange(fieldPath, {
                    ...property,
                    type: updated.type,
                    title: prev.title === '' ? undefined : prev.title,
                    description: prev.description === '' ? undefined : prev.description,
                    format: prev.format === '' ? undefined : prev.format,
                    default: isDefaultValueCleared(prev.default, prev.type) ? undefined : prev.default,
                    enum: updated.enum,
                    items: updated.items,
                    properties: updatedProperties
                });
            }, 0);

            return updated;
        });
    };

    /**
     * Remove an object property by index
     */
    const handleRemoveObjectProperty = (index: number) => {
        const propertyToRemove = objectProperties[index];
        if (!propertyToRemove) return;

        // Remove from objectProperties state
        setObjectProperties(prev => prev.filter((_, i) => i !== index));

        // Remove from formData.properties
        setFormData(prev => {
            const updatedProperties = { ...prev.properties };
            delete updatedProperties[propertyToRemove.name];

            const updated = {
                ...prev,
                properties: Object.keys(updatedProperties).length > 0 ? updatedProperties : undefined
            };

            // Notify parent of the change
            setTimeout(() => {
                onStateChange(fieldPath, {
                    ...property,
                    type: updated.type,
                    title: prev.title === '' ? undefined : prev.title,
                    description: prev.description === '' ? undefined : prev.description,
                    format: prev.format === '' ? undefined : prev.format,
                    default: isDefaultValueCleared(prev.default, prev.type) ? undefined : prev.default,
                    enum: updated.enum,
                    items: updated.items,
                    properties: updated.properties
                });
            }, 0);

            return updated;
        });
    };

    /**
     * Update a specific field of an object property
     */
    const handleObjectPropertyChange = (index: number, field: string, value: string) => {
        const oldProperty = objectProperties[index];
        if (!oldProperty) return;

        // Update objectProperties state
        setObjectProperties(prev =>
            prev.map((prop, i) =>
                i === index ? { ...prop, [field]: value } : prop
            )
        );

        // Update formData.properties
        setFormData(prev => {
            const updatedProperties = { ...prev.properties };

            // If changing the name, we need to rename the key
            if (field === 'name') {
                const oldName = oldProperty.name;
                const newName = value;

                // Remove old key and add new key
                if (updatedProperties[oldName]) {
                    updatedProperties[newName] = {
                        ...updatedProperties[oldName],
                        title: newName // Update title to match new name
                    };
                    delete updatedProperties[oldName];
                }
            } else {
                // Update other fields (type, title, description)
                const propertyName = oldProperty.name;
                if (updatedProperties[propertyName]) {
                    updatedProperties[propertyName] = {
                        ...updatedProperties[propertyName],
                        [field]: field === 'type' ? value : (value || undefined),
                        // Reset default value when type changes
                        ...(field === 'type' && { default: getDefaultValueForType(value) })
                    };
                }
            }

            const updated = {
                ...prev,
                properties: updatedProperties
            };

            // Notify parent of the change
            setTimeout(() => {
                onStateChange(fieldPath, {
                    ...property,
                    type: updated.type,
                    title: prev.title === '' ? undefined : prev.title,
                    description: prev.description === '' ? undefined : prev.description,
                    format: prev.format === '' ? undefined : prev.format,
                    default: isDefaultValueCleared(prev.default, prev.type) ? undefined : prev.default,
                    enum: updated.enum,
                    items: updated.items,
                    properties: updatedProperties
                });
            }, 0);

            return updated;
        });
    };

    /**
     * Initialize object properties from existing schema
     */
    const initializeObjectProperties = () => {
        if (formData.type === 'object' && formData.properties) {
            const props = Object.entries(formData.properties).map(([name, schema]) => ({
                name,
                type: schema.type || 'string',
                title: schema.title || name,
                description: schema.description || ''
            }));
            setObjectProperties(props);
        }
    };

    // Add useEffect to initialize object properties when component mounts or type changes
    useEffect(() => {
        if (formData.type === 'object') {
            initializeObjectProperties();
        } else {
            setObjectProperties([]);
        }
    }, [formData.type]);


    // Update the useEffect to handle both scenarios
    useEffect(() => {
        if (formData.type === 'object') {
            if (isKeyValueObject()) {
                initializeKeyValuePairs();
                setObjectProperties([]); // Clear structured properties
            } else {
                initializeObjectProperties();
                setKeyValuePairs([]); // Clear key-value pairs
            }
        } else {
            setObjectProperties([]);
            setKeyValuePairs([]);
        }
    }, [formData.type, formData.properties]);

    /**
     * Get current state as SchemaProperty object
     */
    const getCurrentState = (): SchemaProperty => {
        return {
            ...property,
            type: formData.type,
            title: formData.title || undefined,  // Convert empty string to undefined
            description: formData.description || undefined,
            format: formData.format || undefined,
            default: formData.default,
            enum: formData.enum,
            items: formData.items,
            properties: formData.properties
        };
    };

    /**
     * Notify parent of current state whenever it changes
     */
    const notifyStateChange = () => {
        onStateChange(fieldPath, getCurrentState());
    };

    /**
     * Helper function to determine if a default value should be treated as "cleared"
     */
    const isDefaultValueCleared = (value: any, type: string): boolean => {
        const typeDefault = getDefaultValueForType(type);
        return value === typeDefault || value === undefined || value === null;
    };

    /**
     * Clear handlers for different fields
     */
    // const handleClearTitle = () => {
    //     setFormData(prev => ({ ...prev, title: '' }));
    //     setTimeout(notifyStateChange, 0);
    // };
    const handleClearTitle = () => {
        setFormData(prev => {
            const updated = { ...prev, title: '' };
            // Notify parent immediately with the updated state
            setTimeout(() => {
                onStateChange(fieldPath, {
                    ...property,
                    type: updated.type,
                    title: undefined,
                    description: prev.description === '' ? undefined : prev.description,
                    format: prev.format === '' ? undefined : prev.format,
                    //default: updated.default,
                    default: isDefaultValueCleared(prev.default, prev.type) ? undefined : prev.default,
                    enum: updated.enum,
                    items: updated.items,
                    properties: updated.properties
                });
            }, 0);
            return updated;
        });
    };

    const handleClearDescription = () => {
        setFormData(prev => {
            const updated = { ...prev, description: '' }; // Empty string for UI display
            // Notify parent with undefined to exclude from schema
            setTimeout(() => {
                onStateChange(fieldPath, {
                    ...property,
                    type: updated.type,
                    title: prev.title === '' ? undefined : prev.title,
                    description: undefined, // Send undefined to parent
                    format: prev.format === '' ? undefined : prev.format,
                    //default: updated.default,
                    default: isDefaultValueCleared(prev.default, prev.type) ? undefined : prev.default,
                    enum: updated.enum,
                    items: updated.items,
                    properties: updated.properties
                });
            }, 0);
            return updated;
        });
    };

    // const handleClearFormat = () => {
    //     setFormData(prev => ({ ...prev, format: '' }));
    //     setTimeout(notifyStateChange, 0);
    // };

    const handleClearFormat = () => {
        setFormData(prev => {
            const updated = { ...prev, format: '' }; // Empty string for UI display
            // Notify parent with undefined to exclude from schema
            setTimeout(() => {
                onStateChange(fieldPath, {
                    ...property,
                    type: updated.type,
                    title: prev.title === '' ? undefined : prev.title,
                    description: prev.description === '' ? undefined : prev.description,
                    format: undefined, // Send undefined to parent
                    //default: updated.default,
                    default: isDefaultValueCleared(prev.default, prev.type) ? undefined : prev.default,
                    enum: updated.enum,
                    items: updated.items,
                    properties: updated.properties
                });
            }, 0);
            return updated;
        });
    };

    // const handleClearDefault = () => {
    //     const defaultValue = getDefaultValueForType(formData.type);
    //     setFormData(prev => ({ ...prev, default: defaultValue }));
    //     if (formData.type === 'array') {
    //         setArrayItems([]);
    //     }
    //     setTimeout(notifyStateChange, 0);
    // };
    const handleClearDefault = () => {
        setFormData(prev => {
            const typeDefault = getDefaultValueForType(prev.type);
            const updated = { ...prev, default: typeDefault }; // Set type-appropriate default for UI

            setTimeout(() => {
                onStateChange(fieldPath, {
                    ...property,
                    type: updated.type,
                    title: prev.title === '' ? undefined : prev.title,
                    description: prev.description === '' ? undefined : prev.description,
                    format: prev.format === '' ? undefined : prev.format,
                    default: undefined, // Always send undefined when cleared - let schema use its own defaults
                    enum: updated.enum,
                    items: updated.items,
                    properties: updated.properties
                });
            }, 0);
            return updated;
        });

        // Clear array items if it's an array type
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

            // Reset related fields when type changes
            if (field === 'type') {
                updated.default = getDefaultValueForType(value);
                updated.enum = undefined;
                updated.items = undefined;
                updated.properties = undefined;
                setEnumOptions([]);
                setArrayItems([]);
            }

            // Notify parent with the immediately updated state
            setTimeout(() => {
                onStateChange(fieldPath, {
                    ...property,
                    type: updated.type,
                    title: updated.title,
                    description: updated.description,
                    format: updated.format || undefined,
                    default: updated.default,
                    enum: updated.enum,
                    items: updated.items,
                    properties: updated.properties
                });
            }, 0);

            return updated;
        });
    };
    /**
     * Handle default value changes for different types
     */
    const handleDefaultValueChange = (value: any) => {
        setFormData(prev => ({ ...prev, default: value }));
        setTimeout(notifyStateChange, 0);
    };

    /**
     * Add enum option with proper type conversion
     */
    const addEnumOption = () => {
        if (newEnumValue.trim()) {
            const convertedValue = convertEnumValue(newEnumValue.trim(), enumType);

            if (!enumOptions.some(option => option === convertedValue)) {
                const updatedOptions = [...enumOptions, convertedValue];
                setEnumOptions(updatedOptions);
                setFormData(prev => ({ ...prev, enum: updatedOptions }));
                setNewEnumValue('');
                setTimeout(notifyStateChange, 0);
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
        setTimeout(notifyStateChange, 0);
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
        setTimeout(notifyStateChange, 0);
    };

    /**
     * Update array item
     */
    const updateArrayItem = (index: number, value: any) => {
        const updatedItems = arrayItems.map((item, i) => i === index ? value : item);
        setArrayItems(updatedItems);
        setFormData(prev => ({ ...prev, default: updatedItems }));
        setTimeout(notifyStateChange, 0);
    };

    /**
     * Remove array item
     */
    const removeArrayItem = (index: number) => {
        const updatedItems = arrayItems.filter((_, i) => i !== index);
        setArrayItems(updatedItems);
        setFormData(prev => ({ ...prev, default: updatedItems }));
        setTimeout(notifyStateChange, 0);
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
                                    setTimeout(notifyStateChange, 0);
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

            // case 'object':
            //     return (
            //         <Textarea
            //             data-testid="textarea"
            //             value={JSON.stringify(formData.default || {}, null, 2)}
            //             onChange={(e) => {
            //                 try {
            //                     const parsed = JSON.parse(e.target.value);
            //                     handleDefaultValueChange(parsed);
            //                 } catch {
            //                     // Invalid JSON, keep the text for editing
            //                 }
            //             }}
            //             placeholder="Enter JSON object"
            //             rows={5}
            //             className="font-mono text-sm"
            //         />
            //     );

            case 'object':
                if (isKeyValueObject()) {
                    // 3.1. Object without properties - Key-Value Pairs
                    return (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Key-Value Pairs</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddKeyValuePair}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Pair
                                </Button>
                            </div>

                            {keyValuePairs.length > 0 ? (
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {keyValuePairs.map((pair, index) => (
                                        <div key={index} className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                                            {/* Key Input */}
                                            <Input
                                                value={pair.key}
                                                onChange={(e) => handleKeyValuePairChange(index, 'key', e.target.value)}
                                                placeholder="Key name"
                                                className="flex-1"
                                            />

                                            {/* Value Type Selector */}
                                            <Select
                                                value={pair.valueType}
                                                onValueChange={(value) => handleKeyValuePairChange(index, 'valueType', value)}
                                            >
                                                <SelectTrigger className="w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="string">String</SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="integer">Integer</SelectItem>
                                                    <SelectItem value="boolean">Boolean</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            {/* Value Input */}
                                            {pair.valueType === 'boolean' ? (
                                                <div className="flex items-center space-x-2">
                                                    <Switch
                                                        checked={pair.value || false}
                                                        onCheckedChange={(checked) => handleKeyValuePairChange(index, 'value', checked)}
                                                    />
                                                    <Label className="text-xs">{pair.value ? 'True' : 'False'}</Label>
                                                </div>
                                            ) : (
                                                <Input
                                                    type={pair.valueType === 'string' ? 'text' : 'number'}
                                                    value={pair.value || ''}
                                                    onChange={(e) => {
                                                        const value = pair.valueType === 'string' ?
                                                            e.target.value :
                                                            pair.valueType === 'integer' ?
                                                                parseInt(e.target.value) || 0 :
                                                                parseFloat(e.target.value) || 0;
                                                        handleKeyValuePairChange(index, 'value', value);
                                                    }}
                                                    placeholder="Value"
                                                    className="flex-1"
                                                />
                                            )}

                                            {/* Remove Button */}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveKeyValuePair(index)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-md">
                                    No key-value pairs added. Click "Add Pair" to start.
                                </div>
                            )}
                        </div>
                    );
                } else {
                    // 3.2. Object with defined properties - Structured Properties
                    return (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Object Properties</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddObjectProperty}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Property
                                </Button>
                            </div>

                            {objectProperties.length > 0 ? (
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {objectProperties.map((prop, index) => (
                                        <div key={index} className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                                            <Input
                                                value={prop.name}
                                                onChange={(e) => handleObjectPropertyChange(index, 'name', e.target.value)}
                                                placeholder="Property name"
                                                className="flex-1"
                                            />
                                            <Select
                                                value={prop.type}
                                                onValueChange={(value) => handleObjectPropertyChange(index, 'type', value)}
                                            >
                                                <SelectTrigger className="w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="string">String</SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="integer">Integer</SelectItem>
                                                    <SelectItem value="boolean">Boolean</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveObjectProperty(index)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-md">
                                    No properties defined. Click "Add Property" to start.
                                </div>
                            )}
                        </div>
                    );
                }

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

            // case 'object':
            //     return (
            //         <Textarea
            //             data-testid="textarea"
            //             value={JSON.stringify(item || {}, null, 2)}
            //             onChange={(e) => {
            //                 try {
            //                     const parsed = JSON.parse(e.target.value);
            //                     updateArrayItem(index, parsed);
            //                 } catch {
            //                     // Invalid JSON, keep for editing
            //                 }
            //             }}
            //             placeholder="Enter JSON object"
            //             rows={3}
            //             className="flex-1 font-mono text-sm"
            //         />
            //     );

            case 'object':
                if (isKeyValueObject()) {
                    // 3.1. Object without properties - Key-Value Pairs
                    return (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Key-Value Pairs</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddKeyValuePair}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Pair
                                </Button>
                            </div>

                            {keyValuePairs.length > 0 ? (
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {keyValuePairs.map((pair, index) => (
                                        <div key={index} className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                                            {/* Key Input */}
                                            <Input
                                                value={pair.key}
                                                onChange={(e) => handleKeyValuePairChange(index, 'key', e.target.value)}
                                                placeholder="Key name"
                                                className="flex-1"
                                            />

                                            {/* Value Type Selector */}
                                            <Select
                                                value={pair.valueType}
                                                onValueChange={(value) => handleKeyValuePairChange(index, 'valueType', value)}
                                            >
                                                <SelectTrigger className="w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="string">String</SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="integer">Integer</SelectItem>
                                                    <SelectItem value="boolean">Boolean</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            {/* Value Input */}
                                            {pair.valueType === 'boolean' ? (
                                                <div className="flex items-center space-x-2">
                                                    <Switch
                                                        checked={pair.value || false}
                                                        onCheckedChange={(checked) => handleKeyValuePairChange(index, 'value', checked)}
                                                    />
                                                    <Label className="text-xs">{pair.value ? 'True' : 'False'}</Label>
                                                </div>
                                            ) : (
                                                <Input
                                                    type={pair.valueType === 'string' ? 'text' : 'number'}
                                                    value={pair.value || ''}
                                                    onChange={(e) => {
                                                        const value = pair.valueType === 'string' ?
                                                            e.target.value :
                                                            pair.valueType === 'integer' ?
                                                                parseInt(e.target.value) || 0 :
                                                                parseFloat(e.target.value) || 0;
                                                        handleKeyValuePairChange(index, 'value', value);
                                                    }}
                                                    placeholder="Value"
                                                    className="flex-1"
                                                />
                                            )}

                                            {/* Remove Button */}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveKeyValuePair(index)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-md">
                                    No key-value pairs added. Click "Add Pair" to start.
                                </div>
                            )}
                        </div>
                    );
                } else {
                    // 3.2. Object with defined properties - Structured Properties
                    return (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Object Properties</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddObjectProperty}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Property
                                </Button>
                            </div>

                            {objectProperties.length > 0 ? (
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {objectProperties.map((prop, index) => (
                                        <div key={index} className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                                            <Input
                                                value={prop.name}
                                                onChange={(e) => handleObjectPropertyChange(index, 'name', e.target.value)}
                                                placeholder="Property name"
                                                className="flex-1"
                                            />
                                            <Select
                                                value={prop.type}
                                                onValueChange={(value) => handleObjectPropertyChange(index, 'type', value)}
                                            >
                                                <SelectTrigger className="w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="string">String</SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="integer">Integer</SelectItem>
                                                    <SelectItem value="boolean">Boolean</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveObjectProperty(index)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-md">
                                    No properties defined. Click "Add Property" to start.
                                </div>
                            )}
                        </div>
                    );
                }

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
                                e.nativeEvent.stopImmediatePropagation();
                                e.preventDefault();
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
            {/* <div className="flex justify-end space-x-2 pt-4">
                {onCancel && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancel();
                        }}
                        className="h-10 px-4 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Cancel
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="h-10 px-4 border border-red-300 rounded-md bg-white text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        Delete
                    </button>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleSave();
                    }}
                    className="h-10 px-4 border border-orange-500 rounded-md bg-orange-500 text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                    Save Property
                </button>
            </div> */}
        </div>
    );
}