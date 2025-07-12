/**
 * Enhanced template field interface supporting default values and nested field selection
 * Extends the base TemplateField with additional configuration capabilities
 */
export interface EnhancedTemplateField {
    name: string;
    type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
    title?: string;
    description?: string;
    required?: boolean;
    default?: any;
    format?: string;
    enum?: any[];  // Fixed: enum should be any[] not string[]
    items?: {
        type: EnhancedTemplateField['type'];
        fields?: EnhancedTemplateField[];
    };
    properties?: EnhancedTemplateField[];
    constraints?: {
        minLength?: number;
        maxLength?: number;
        minimum?: number;
        maximum?: number;
        pattern?: string;
        enum?: any[];  // Fixed: enum should be any[] not string[]
    };
}

/**
 * Configuration for array item field selection
 */
export interface ArrayItemFieldConfig {
    parentPath: string // Path to the array field
    itemType: string // Type of array items
    selectedFields: string[] // Selected field paths within array items
    defaultItemValues?: Record<string, any> // Default values for array items
}

/**
 * Field configuration state for the middle panel
 */
export interface FieldConfigurationState {
    selectedField: EnhancedTemplateField | null
    defaultValues: Record<string, any>
    arrayConfigurations: Record<string, ArrayItemFieldConfig>
    isDirty: boolean // Whether configuration has unsaved changes
}