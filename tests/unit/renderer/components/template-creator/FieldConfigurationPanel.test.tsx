/**
 * Unit tests for FieldConfigurationPanel component
 * Tests default value setting and array configuration functionality
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FieldConfigurationPanel } from '../../../../../src/renderer/components/template-creator/FieldConfigurationPanel'
import type { EnhancedTemplateField, ArrayItemFieldConfig } from '../../../../../src/shared/types/enhanced-template-field'
import type { SchemaProperty } from '../../../../../src/renderer/components/template-creator/SchemaFieldSelectionModal'

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

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <button 
      data-testid="switch" 
      onClick={() => onCheckedChange(!checked)}
      aria-checked={checked}
    >
      {checked ? 'true' : 'false'}
    </button>
  )
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }: any) => (
    <input 
      type="checkbox" 
      data-testid="checkbox" 
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  )
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-testid="badge" data-variant={variant}>{children}</span>
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea data-testid="textarea" {...props} />
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

describe('FieldConfigurationPanel', () => {
  const mockOnDefaultValueChange = vi.fn()
  const mockOnNestedFieldToggle = vi.fn()
  const mockOnArrayConfigChange = vi.fn()

  const defaultProps = {
    field: null,
    onDefaultValueChange: mockOnDefaultValueChange,
    onNestedFieldToggle: mockOnNestedFieldToggle,
    onArrayConfigChange: mockOnArrayConfigChange
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    /**
     * Test basic component rendering without field
     */
    it('should render empty state when no field is selected', () => {
      render(<FieldConfigurationPanel {...defaultProps} />)
      
      expect(screen.getByText('Field Configuration')).toBeInTheDocument()
      expect(screen.getByText('Select a field to configure')).toBeInTheDocument()
      expect(screen.getByText('⚙️')).toBeInTheDocument()
    })

    /**
     * Test component rendering with field
     */
    it('should render field configuration when field is provided', () => {
      const mockField: EnhancedTemplateField = {
        path: 'spec.containers[].image',
        title: 'Container Image',
        type: 'string',
        required: true,
        description: 'Container image name'
      }

      render(<FieldConfigurationPanel {...defaultProps} field={mockField} />)
      
      expect(screen.getByText('Field Configuration')).toBeInTheDocument()
      expect(screen.getByText('Container Image • spec.containers[].image')).toBeInTheDocument()
      expect(screen.getByText('Container image name')).toBeInTheDocument()
    })
  })

  describe('String Field Configuration', () => {
    /**
     * Test string field default value setting
     */
    it('should handle string field default value changes', async () => {
      const user = userEvent.setup()
      const mockField: EnhancedTemplateField = {
        path: 'metadata.name',
        title: 'Name',
        type: 'string',
        required: true
      }

      render(<FieldConfigurationPanel {...defaultProps} field={mockField} />)
      
      const input = screen.getByTestId('input')
      await user.type(input, 'test-value')
      
      expect(mockOnDefaultValueChange).toHaveBeenCalledWith('metadata.name', 'test-value')
    })

    /**
     * Test enum field rendering
     */
    it('should render select for enum string fields', () => {
      const mockField: EnhancedTemplateField = {
        path: 'spec.type',
        title: 'Service Type',
        type: 'string',
        required: false,
        constraints: {
          enum: ['ClusterIP', 'NodePort', 'LoadBalancer']
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={mockField} />)
      
      expect(screen.getByTestId('select')).toBeInTheDocument()
    })

    /**
     * Test textarea for long string fields
     */
    it('should render textarea for long string fields', () => {
      const mockField: EnhancedTemplateField = {
        path: 'metadata.annotations.description',
        title: 'Description',
        type: 'string',
        required: false,
        constraints: {
          maxLength: 500
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={mockField} />)
      
      expect(screen.getByTestId('textarea')).toBeInTheDocument()
    })
  })

  describe('Number Field Configuration', () => {
    /**
     * Test number field default value setting
     */
    it('should handle number field default value changes', async () => {
      const user = userEvent.setup()
      const mockField: EnhancedTemplateField = {
        path: 'spec.replicas',
        title: 'Replicas',
        type: 'number',
        required: false,
        constraints: {
          minimum: 1,
          maximum: 10
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={mockField} />)
      
      const input = screen.getByTestId('input')
      await user.type(input, '3')
      
      expect(mockOnDefaultValueChange).toHaveBeenCalledWith('spec.replicas', 3)
    })
  })

  describe('Boolean Field Configuration', () => {
    /**
     * Test boolean field toggle
     */
    it('should handle boolean field toggle', async () => {
      const user = userEvent.setup()
      const mockField: EnhancedTemplateField = {
        path: 'spec.enabled',
        title: 'Enabled',
        type: 'boolean',
        required: false
      }

      render(<FieldConfigurationPanel {...defaultProps} field={mockField} />)
      
      const switchElement = screen.getByTestId('switch')
      await user.click(switchElement)
      
      expect(mockOnDefaultValueChange).toHaveBeenCalledWith('spec.enabled', true)
    })
  })

  describe('Array Field Configuration', () => {
    /**
     * Test array field with complex item schema
     */
    it('should render array configuration for complex array types', () => {
      const mockSchemaProperty: SchemaProperty = {
        name: 'apiGroups',
        path: 'apiGroups',
        type: 'array',
        description: 'API groups',
        required: false,
        hasChildren: false,
        isReference: false
      }

      const mockField: EnhancedTemplateField = {
        path: 'rules',
        title: 'Policy Rules',
        type: 'array',
        required: true,
        arrayItemSchema: {
          type: 'object',
          properties: [mockSchemaProperty]
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={mockField} />)
      
      expect(screen.getByText('Array Item Configuration')).toBeInTheDocument()
      expect(screen.getByText('Configure which fields to include for each object item')).toBeInTheDocument()
    })

    /**
     * Test array field selection toggle
     */
    it('should handle array field selection toggle', async () => {
      const user = userEvent.setup()
      const mockSchemaProperty: SchemaProperty = {
        name: 'apiGroups',
        path: 'apiGroups',
        type: 'array',
        description: 'API groups for the rule',
        required: true,
        hasChildren: false,
        isReference: false
      }

      const mockField: EnhancedTemplateField = {
        path: 'rules',
        title: 'Policy Rules',
        type: 'array',
        required: true,
        arrayItemSchema: {
          type: 'object',
          properties: [mockSchemaProperty]
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={mockField} />)
      
      const checkbox = screen.getByTestId('checkbox')
      await user.click(checkbox)
      
      expect(mockOnNestedFieldToggle).toHaveBeenCalledWith('rules', mockSchemaProperty, true)
      expect(mockOnArrayConfigChange).toHaveBeenCalled()
    })
  })

  describe('Object Field Configuration', () => {
    /**
     * Test object field rendering
     */
    it('should render object field configuration message', () => {
      const mockField: EnhancedTemplateField = {
        path: 'spec.selector',
        title: 'Selector',
        type: 'object',
        required: false
      }

      render(<FieldConfigurationPanel {...defaultProps} field={mockField} />)
      
      expect(screen.getByText('Complex Object')).toBeInTheDocument()
      expect(screen.getByText('Configure nested fields by selecting them in the schema tree')).toBeInTheDocument()
    })
  })

  describe('Field State Management', () => {
    /**
     * Test field change updates local state
     */
    it('should update local state when field changes', () => {
      const mockField1: EnhancedTemplateField = {
        path: 'field1',
        title: 'Field 1',
        type: 'string',
        required: false,
        defaultValue: 'initial-value'
      }

      const mockField2: EnhancedTemplateField = {
        path: 'field2',
        title: 'Field 2',
        type: 'string',
        required: false,
        defaultValue: 'new-value'
      }

      const { rerender } = render(<FieldConfigurationPanel {...defaultProps} field={mockField1} />)
      
      const input = screen.getByTestId('input')
      expect(input).toHaveValue('initial-value')
      
      rerender(<FieldConfigurationPanel {...defaultProps} field={mockField2} />)
      expect(input).toHaveValue('new-value')
    })
  })

  describe('UI Hints and Constraints', () => {
    /**
     * Test UI hints display
     */
    it('should display UI hints when provided', () => {
      const mockField: EnhancedTemplateField = {
        path: 'spec.image',
        title: 'Image',
        type: 'string',
        required: true,
        uiHints: {
          helpText: 'Use fully qualified image names',
          placeholder: 'nginx:latest'
        }
      }

      render(<FieldConfigurationPanel {...defaultProps} field={mockField} />)
      
      expect(screen.getByText('💡 Use fully qualified image names')).toBeInTheDocument()
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('placeholder', 'nginx:latest')
    })
  })
})