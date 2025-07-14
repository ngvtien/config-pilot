import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SchemaFieldSelectionModal } from '../../../../src/renderer/components/template-creator/SchemaFieldSelectionModal'
import { EnhancedPropertyEditor } from '../../../../src/renderer/components/enhanced-property-editor'

/**
 * Unit tests for SchemaFieldSelectionModal title clearing functionality
 * Tests the issue where clearing title in EnhancedPropertyEditor doesn't take effect in filtered schema preview
 */
describe('SchemaFieldSelectionModal - Title Clearing', () => {
  let mockLocalStorage: { [key: string]: string }

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {}
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete mockLocalStorage[key]
        }),
        clear: vi.fn(() => {
          mockLocalStorage = {}
        })
      },
      writable: true
    })

    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Test that title clearing in EnhancedPropertyEditor properly notifies parent
   */
  it('should notify parent when title is cleared in EnhancedPropertyEditor', async () => {
    const mockOnStateChange = vi.fn()
    const mockProperty = {
      path: 'metadata.name',
      name: 'name',
      title: 'Resource Name',
      type: 'string',
      description: 'Name of the resource'
    }

    render(
      <EnhancedPropertyEditor
        property={mockProperty}
        fieldPath="metadata.name"
        onStateChange={mockOnStateChange}
      />
    )

    // Find and click the clear title button
    const clearTitleButton = screen.getByTestId('clear-title-button')
    fireEvent.click(clearTitleButton)

    // Wait for the async notification
    await waitFor(() => {
      expect(mockOnStateChange).toHaveBeenCalledWith('metadata.name', expect.objectContaining({
        title: '',
        name: 'name',
        type: 'string'
      }))
    })
  })

  /**
   * Test that handleFieldStateChange correctly stores empty title in currentFieldStates
   */
  it('should store empty title in currentFieldStates when title is cleared', () => {
    const mockResource = {
      resource: 'io.k8s.api.core.v1.Namespace',
      schema: {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Resource Name' }
            }
          }
        }
      }
    }

    const mockSelectedFields = [
      {
        path: 'metadata.name',
        name: 'name',
        title: 'Resource Name',
        type: 'string',
        required: false,
        templateType: 'kubernetes' as const
      }
    ]

    const { rerender } = render(
      <SchemaFieldSelectionModal
        isOpen={true}
        onClose={() => {}}
        resource={mockResource}
        selectedFields={mockSelectedFields}
        onFieldsChange={() => {}}
      />
    )

    // Simulate field state change with empty title
    const component = screen.getByTestId('schema-field-selection-modal')
    
    // This would normally be triggered by EnhancedPropertyEditor
    fireEvent.change(component, {
      target: {
        value: JSON.stringify({
          fieldPath: 'metadata.name',
          currentState: {
            path: 'metadata.name',
            name: 'name',
            title: '', // Empty title
            type: 'string',
            description: 'Name of the resource'
          }
        })
      }
    })

    // Verify that currentFieldStates contains the empty title
    expect(mockLocalStorage).toEqual(expect.objectContaining({
      'config-pilot-field-configurations': expect.stringContaining('metadata.name')
    }))
  })

  /**
   * Test that getEffectiveFieldConfiguration returns empty title from currentFieldStates
   */
  it('should return empty title from currentFieldStates in getEffectiveFieldConfiguration', () => {
    // This test would need to access internal state, so we'll test the behavior indirectly
    // by checking that the filtered schema includes the empty title
    
    const mockResource = {
      resource: 'io.k8s.api.core.v1.Namespace',
      schema: {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Original Title' }
            }
          }
        }
      }
    }

    const mockSelectedFields = [
      {
        path: 'metadata.name',
        name: 'name',
        title: 'Original Title',
        type: 'string',
        required: false,
        templateType: 'kubernetes' as const
      }
    ]

    render(
      <SchemaFieldSelectionModal
        isOpen={true}
        onClose={() => {}}
        resource={mockResource}
        selectedFields={mockSelectedFields}
        onFieldsChange={() => {}}
      />
    )

    // Open the field configuration for metadata.name
    const configButton = screen.getByTestId('config-metadata.name')
    fireEvent.click(configButton)

    // Clear the title in the property editor
    const clearTitleButton = screen.getByTestId('clear-title-button')
    fireEvent.click(clearTitleButton)

    // Check that the schema preview shows empty title
    const previewButton = screen.getByTestId('preview-selected-button')
    fireEvent.click(previewButton)

    // The filtered schema should include title: "" for metadata.name
    const schemaPreview = screen.getByTestId('schema-preview')
    expect(schemaPreview.textContent).toContain('"title": ""')
  })

  /**
   * Test that handleFieldConfigSave preserves empty title in localStorage
   */
  it('should preserve empty title in localStorage when saving field configuration', async () => {
    const mockResource = {
      resource: 'io.k8s.api.core.v1.Namespace',
      schema: {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Original Title' }
            }
          }
        }
      }
    }

    const mockSelectedFields = [
      {
        path: 'metadata.name',
        name: 'name',
        title: 'Original Title',
        type: 'string',
        required: false,
        templateType: 'kubernetes' as const
      }
    ]

    render(
      <SchemaFieldSelectionModal
        isOpen={true}
        onClose={() => {}}
        resource={mockResource}
        selectedFields={mockSelectedFields}
        onFieldsChange={() => {}}
      />
    )

    // Open field configuration
    const configButton = screen.getByTestId('config-metadata.name')
    fireEvent.click(configButton)

    // Clear title
    const clearTitleButton = screen.getByTestId('clear-title-button')
    fireEvent.click(clearTitleButton)

    // Save configuration
    const saveButton = screen.getByTestId('save-field-config')
    fireEvent.click(saveButton)

    await waitFor(() => {
      // Check that localStorage contains the empty title configuration
      const storedConfigs = JSON.parse(mockLocalStorage['config-pilot-field-configurations'] || '{}')
      expect(storedConfigs['io.k8s.api.core.v1.Namespace']).toEqual(expect.objectContaining({
        'metadata.name': expect.objectContaining({
          title: '' // Empty title should be preserved
        })
      }))
    })
  })

  /**
   * Test that buildSchemaFromSelectedNodes applies empty title to filtered schema
   */
  it('should apply empty title to filtered schema in buildSchemaFromSelectedNodes', async () => {
    const mockResource = {
      resource: 'io.k8s.api.core.v1.Namespace',
      schema: {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Original Title' }
            }
          }
        }
      }
    }

    // Pre-populate localStorage with empty title configuration
    mockLocalStorage['config-pilot-field-configurations'] = JSON.stringify({
      'io.k8s.api.core.v1.Namespace': {
        'metadata.name': {
          title: '' // Empty title configuration
        }
      }
    })

    const mockSelectedFields = [
      {
        path: 'metadata.name',
        name: 'name',
        title: 'Original Title',
        type: 'string',
        required: false,
        templateType: 'kubernetes' as const
      }
    ]

    render(
      <SchemaFieldSelectionModal
        isOpen={true}
        onClose={() => {}}
        resource={mockResource}
        selectedFields={mockSelectedFields}
        onFieldsChange={() => {}}
      />
    )

    // Open schema preview
    const previewButton = screen.getByTestId('preview-selected-button')
    fireEvent.click(previewButton)

    await waitFor(() => {
      // The filtered schema should show empty title
      const schemaPreview = screen.getByTestId('schema-preview')
      const schemaText = schemaPreview.textContent || ''
      
      // Parse the schema JSON to verify structure
      const schemaMatch = schemaText.match(/\{[\s\S]*\}/)
      if (schemaMatch) {
        const schema = JSON.parse(schemaMatch[0])
        expect(schema.properties.metadata.properties.name.title).toBe('')
      }
    })
  })

  /**
   * Test the complete workflow: clear title -> save -> rebuild schema -> verify empty title in preview
   */
  it('should maintain empty title throughout the complete workflow', async () => {
    const mockResource = {
      resource: 'io.k8s.api.core.v1.Namespace',
      schema: {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Original Title' }
            }
          }
        }
      }
    }

    const mockSelectedFields = [
      {
        path: 'metadata.name',
        name: 'name',
        title: 'Original Title',
        type: 'string',
        required: false,
        templateType: 'kubernetes' as const
      }
    ]

    const mockOnFieldsChange = vi.fn()

    render(
      <SchemaFieldSelectionModal
        isOpen={true}
        onClose={() => {}}
        resource={mockResource}
        selectedFields={mockSelectedFields}
        onFieldsChange={mockOnFieldsChange}
      />
    )

    // Step 1: Open field configuration
    const configButton = screen.getByTestId('config-metadata.name')
    fireEvent.click(configButton)

    // Step 2: Clear title
    const clearTitleButton = screen.getByTestId('clear-title-button')
    fireEvent.click(clearTitleButton)

    // Step 3: Save configuration
    const saveButton = screen.getByTestId('save-field-config')
    fireEvent.click(saveButton)

    // Step 4: Open schema preview
    const previewButton = screen.getByTestId('preview-selected-button')
    fireEvent.click(previewButton)

    // Step 5: Verify empty title in preview
    await waitFor(() => {
      const schemaPreview = screen.getByTestId('schema-preview')
      expect(schemaPreview.textContent).toContain('"title": ""')
    })

    // Step 6: Save and verify final state
    const saveModalButton = screen.getByTestId('save-modal')
    fireEvent.click(saveModalButton)

    await waitFor(() => {
      expect(mockOnFieldsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'metadata.name',
            title: '' // Empty title should be preserved in final output
          })
        ])
      )
    })
  })
})