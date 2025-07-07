/**
 * Enhanced template field interface supporting default values and nested field selection
 * Extends the base TemplateField with additional configuration capabilities
 */
export interface EnhancedTemplateField {
    path: string // Field path (e.g., "spec.containers[].image")
    title: string // Human-readable field name
    type: string // Field type (string, number, boolean, object, array)
    required: boolean // Whether field is required
    description?: string // Field description for tooltips/help
    format?: string // Format hint (e.g., "email", "uri", "date-time")
    templateType?: 'kubernetes' | 'terraform' | 'ansible' | 'kustomize' | 'helm' | 'docker-compose'
    
    // Enhanced configuration properties
    defaultValue?: any // Default value for the field
    nestedFields?: EnhancedTemplateField[] // For complex types like PolicyRule
    isArrayItem?: boolean // Indicates if this is an array item field
    arrayItemSchema?: {
        type: string
        properties?: SchemaProperty[]
        items?: SchemaProperty
    } // Schema for array items
    
    // Field configuration state
    hasDefaultValue?: boolean // Whether a default value has been set
    isConfigured?: boolean // Whether field has been configured
    configurationLevel?: 'basic' | 'advanced' // Configuration complexity level
    
    // Validation constraints
    constraints?: {
        minimum?: number
        maximum?: number
        pattern?: string
        enum?: string[]
        minLength?: number
        maxLength?: number
        minItems?: number
        maxItems?: number
    }
    
    // UI hints
    uiHints?: {
        widget?: 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'slider'
        placeholder?: string
        helpText?: string
        group?: string // For grouping related fields
    }
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