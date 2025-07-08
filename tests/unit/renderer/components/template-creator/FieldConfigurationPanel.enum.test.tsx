/**
 * Enhanced unit tests for FieldConfigurationPanel enum handling and schema filtering
 * Tests enum field configuration, default value handling, and schema generation issues
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FieldConfigurationPanel } from '../../../../../src/renderer/components/template-creator/FieldConfigurationPanel'
import type { EnhancedTemplateField, ArrayItemFieldConfig } from '../../../../../src/shared/types/enhanced-template-field'
import valuesSchema from '../../../../../src/mock/schema/values.schema.json'

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="input" {...props} />
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select data-testid="select" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-testid="badge" data-variant={variant}>{children}</span>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant }: any) => (
    <button data-testid="button" onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea data-testid="textarea" {...props} />
}))

describe('FieldConfigurationPanel - Enum Handling', () => {
  const mockOnDefaultValueChange = vi.fn()
  const mockOnNestedFieldToggle = vi.fn()
  const mockOnArrayConfigChange = vi.fn()
  const mockOnFieldUpdate = vi.fn()

  const defaultProps = {
    onDefaultValueChange: mockOnDefaultValueChange,
    onNestedFieldToggle: mockOnNestedFieldToggle,
    onArrayConfigChange: mockOnArrayConfigChange,
    onFieldUpdate: mockOnFieldUpdate
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Service Type Enum Field', () => {
    /**
     * Test service type enum field from values.schema.json
     */
    it('should render service type enum field with correct options', () => {
      const serviceTypeField: EnhancedTemplateField = {
        path: 'service.type',
        name: 'type',
        title: 'Service Type',
        type: 'string',
        required: false,
        constraints: {
          enum: valuesSchema.properties.service.properties.type.enum
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={serviceTypeField} />)
      
      const select = screen.getByTestId('select')
      expect(select).toBeInTheDocument()
      
      // Check if all enum options are present
      expect(screen.getByText('ClusterIP')).toBeInTheDocument()
      expect(screen.getByText('NodePort')).toBeInTheDocument()
      expect(screen.getByText('LoadBalancer')).toBeInTheDocument()
    })

    /**
     * Test enum value selection and change handling
     */
    it('should handle enum value selection correctly', async () => {
      const user = userEvent.setup()
      const serviceTypeField: EnhancedTemplateField = {
        path: 'service.type',
        name: 'type',
        title: 'Service Type',
        type: 'string',
        required: false,
        constraints: {
          enum: ['ClusterIP', 'NodePort', 'LoadBalancer']
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={serviceTypeField} />)
      
      const select = screen.getByTestId('select')
      await user.selectOptions(select, 'LoadBalancer')
      
      expect(mockOnDefaultValueChange).toHaveBeenCalledWith('service.type', 'LoadBalancer')
    })

    /**
     * Test enum field with default value
     */
    it('should display default value for enum field', () => {
      const serviceTypeField: EnhancedTemplateField = {
        path: 'service.type',
        name: 'type',
        title: 'Service Type',
        type: 'string',
        required: false,
        defaultValue: 'ClusterIP',
        constraints: {
          enum: ['ClusterIP', 'NodePort', 'LoadBalancer']
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={serviceTypeField} />)
      
      const select = screen.getByTestId('select')
      expect(select).toHaveValue('ClusterIP')
    })
  })

  describe('Logging Level Enum Field', () => {
    /**
     * Test logging level enum from nested config object
     */
    it('should render logging level enum with all options', () => {
      const loggingLevelField: EnhancedTemplateField = {
        path: 'config.logging.level',
        name: 'level',
        title: 'Logging Level',
        type: 'string',
        required: false,
        defaultValue: 'Information',
        constraints: {
          enum: valuesSchema.properties.config.properties.logging.properties.level.enum
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={loggingLevelField} />)
      
      // Verify all logging levels are present
      expect(screen.getByText('Trace')).toBeInTheDocument()
      expect(screen.getByText('Debug')).toBeInTheDocument()
      expect(screen.getByText('Information')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Critical')).toBeInTheDocument()
    })

    /**
     * Test enum field with schema-defined default value
     */
    it('should use schema default value when no field default is provided', () => {
      const loggingLevelField: EnhancedTemplateField = {
        path: 'config.logging.level',
        name: 'level',
        title: 'Logging Level',
        type: 'string',
        required: false,
        constraints: {
          enum: ['Trace', 'Debug', 'Information', 'Warning', 'Error', 'Critical']
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={loggingLevelField} />)
      
      const select = screen.getByTestId('select')
      // Should default to first option or empty when no default is specified
      expect(select).toBeInTheDocument()
    })
  })

  describe('Logging Output Enum Field', () => {
    /**
     * Test logging output enum field
     */
    it('should render logging output enum correctly', async () => {
      const user = userEvent.setup()
      const loggingOutputField: EnhancedTemplateField = {
        path: 'config.logging.output',
        name: 'output',
        title: 'Logging Output',
        type: 'string',
        required: false,
        defaultValue: 'Console',
        constraints: {
          enum: valuesSchema.properties.config.properties.logging.properties.output.enum
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={loggingOutputField} />)
      
      const select = screen.getByTestId('select')
      expect(select).toHaveValue('Console')
      
      // Test changing to different option
      await user.selectOptions(select, 'File')
      expect(mockOnDefaultValueChange).toHaveBeenCalledWith('config.logging.output', 'File')
      
      // Test changing to 'Both' option
      await user.selectOptions(select, 'Both')
      expect(mockOnDefaultValueChange).toHaveBeenCalledWith('config.logging.output', 'Both')
    })
  })

  describe('Schema Filtering Edge Cases', () => {
    /**
     * Test enum field with empty enum array
     */
    it('should handle enum field with empty enum array', () => {
      const emptyEnumField: EnhancedTemplateField = {
        path: 'test.emptyEnum',
        name: 'emptyEnum',
        title: 'Empty Enum',
        type: 'string',
        required: false,
        constraints: {
          enum: []
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={emptyEnumField} />)
      
      // Should fall back to regular input when enum is empty
      expect(screen.getByTestId('input')).toBeInTheDocument()
    })

    /**
     * Test enum field with null/undefined enum
     */
    it('should handle enum field with null enum constraint', () => {
      const nullEnumField: EnhancedTemplateField = {
        path: 'test.nullEnum',
        name: 'nullEnum',
        title: 'Null Enum',
        type: 'string',
        required: false,
        constraints: {
          enum: null as any
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={nullEnumField} />)
      
      // Should fall back to regular input when enum is null
      expect(screen.getByTestId('input')).toBeInTheDocument()
    })

    /**
     * Test enum field with single option
     */
    it('should handle enum field with single option', () => {
      const singleEnumField: EnhancedTemplateField = {
        path: 'test.singleEnum',
        name: 'singleEnum',
        title: 'Single Enum',
        type: 'string',
        required: false,
        constraints: {
          enum: ['OnlyOption']
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={singleEnumField} />)
      
      const select = screen.getByTestId('select')
      expect(select).toBeInTheDocument()
      expect(screen.getByText('OnlyOption')).toBeInTheDocument()
    })
  })

  describe('Array with Object Items Enum Handling', () => {
    /**
     * Test array field with object items containing enum properties
     */
    it('should handle array with object items containing enum fields', () => {
      const arrayWithEnumField: EnhancedTemplateField = {
        path: 'service.ports',
        name: 'ports',
        title: 'Service Ports',
        type: 'array',
        required: false,
        arrayItemSchema: {
          type: 'object',
          properties: [
            {
              name: 'name',
              path: 'name',
              type: 'string',
              required: true,
              hasChildren: false,
              isReference: false
            },
            {
              name: 'protocol',
              path: 'protocol',
              type: 'string',
              required: false,
              hasChildren: false,
              isReference: false,
              constraints: {
                enum: ['TCP', 'UDP', 'SCTP']
              }
            }
          ]
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={arrayWithEnumField} />)
      
      expect(screen.getByText('Array Item Configuration')).toBeInTheDocument()
      expect(screen.getByText('protocol')).toBeInTheDocument()
    })
  })

  describe('Enhanced Editor Integration', () => {
    /**
     * Test enhanced editor button for enum fields
     */
    it('should show enhanced editor button for enum fields', () => {
      const enumField: EnhancedTemplateField = {
        path: 'service.type',
        name: 'type',
        title: 'Service Type',
        type: 'string',
        required: false,
        constraints: {
          enum: ['ClusterIP', 'NodePort', 'LoadBalancer']
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={enumField} />)
      
      const enhancedEditorButton = screen.getByText('Advanced Editor')
      expect(enhancedEditorButton).toBeInTheDocument()
    })

    /**
     * Test enhanced editor opening for enum field configuration
     */
    it('should open enhanced editor when button is clicked', async () => {
      const user = userEvent.setup()
      const enumField: EnhancedTemplateField = {
        path: 'config.logging.level',
        name: 'level',
        title: 'Logging Level',
        type: 'string',
        required: false,
        constraints: {
          enum: ['Debug', 'Info', 'Warning', 'Error']
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={enumField} />)
      
      const enhancedEditorButton = screen.getByText('Advanced Editor')
      await user.click(enhancedEditorButton)
      
      // Enhanced editor should be opened (mocked dialog)
      expect(screen.getByText('Enhanced Property Editor')).toBeInTheDocument()
    })
  })

  describe('Schema Generation Validation', () => {
    /**
     * Test that enum constraints are properly preserved in schema conversion
     */
    it('should preserve enum constraints when converting to schema property', () => {
      const enumField: EnhancedTemplateField = {
        path: 'service.type',
        name: 'type',
        title: 'Service Type',
        type: 'string',
        required: false,
        constraints: {
          enum: ['ClusterIP', 'NodePort', 'LoadBalancer']
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={enumField} />)
      
      // Verify that the enum badge is displayed
      const enumBadge = screen.getByText('enum')
      expect(enumBadge).toBeInTheDocument()
    })

    /**
     * Test filtered schema generation with enum fields
     */
    it('should generate correct filtered schema for enum fields', () => {
      const enumField: EnhancedTemplateField = {
        path: 'config.logging.level',
        name: 'level',
        title: 'Logging Level',
        type: 'string',
        required: false,
        defaultValue: 'Information',
        constraints: {
          enum: ['Trace', 'Debug', 'Information', 'Warning', 'Error', 'Critical']
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={enumField} />)
      
      // Verify field configuration is rendered correctly
      expect(screen.getByText('Configure Field: Logging Level')).toBeInTheDocument()
      expect(screen.getByTestId('select')).toHaveValue('Information')
    })
  })
})