import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SchemaFieldSelectionModal } from '../../../../../src/renderer/components/template-creator/SchemaFieldSelectionModal'
import { KubernetesResource } from '../../../../../src/shared/types/kubernetes'
import { SchemaTreeNode } from '../../../../../src/shared/types/schema'

/**
 * Mock the electron API to avoid IPC calls in tests
 */
Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: vi.fn().mockImplementation((channel: string, ...args: any[]) => {
      if (channel === 'schema:getResourceSchemaTree') {
        // Return mock schema tree with enum property
        const mockSchemaTree: SchemaTreeNode[] = [
          {
            path: 'apiVersion',
            name: 'apiVersion',
            type: 'string',
            required: true,
            enum: ['v1'],
            description: 'APIVersion defines the versioned schema',
            children: []
          },
          {
            path: 'metadata',
            name: 'metadata',
            type: 'object',
            required: true,
            description: 'Standard object metadata',
            children: [
              {
                path: 'metadata.name',
                name: 'name',
                type: 'string',
                required: false,
                description: 'Name must be unique within a namespace',
                children: []
              }
            ]
          }
        ]
        return Promise.resolve(mockSchemaTree)
      }
      return Promise.resolve([])
    })
  },
  writable: true
})

/**
 * Test suite for debugging enum detection in SchemaFieldSelectionModal tree view
 */
describe('SchemaFieldSelectionModal - Enum Detection Debug', () => {
  const mockOnClose = vi.fn()
  const mockOnFieldsChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Test that verifies enum properties are correctly parsed and displayed in tree view
   */
  it('should detect and display enum badge for apiVersion field', async () => {
    // Use a standard Kubernetes resource instead of CRD
    const mockResource: KubernetesResource = {
      kind: 'Pod',
      apiVersion: 'v1',
      key: 'v1/Pod',
      source: 'kubernetes', // Changed from 'cluster-crds' to 'kubernetes'
      metadata: {
        name: 'test-pod',
        namespace: 'default'
      }
    }

    render(
      <SchemaFieldSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        resource={mockResource}
        selectedFields={[]}
        onFieldsChange={mockOnFieldsChange}
      />
    )

    // Wait for the component to load and process schema
    await waitFor(() => {
      expect(screen.getByText('apiVersion')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Check if enum badge is displayed
    const enumBadges = screen.queryAllByText('enum')
    console.log('Found enum badges:', enumBadges.length)
    
    // This should pass if enum detection works correctly
    expect(enumBadges.length).toBeGreaterThan(0)
  })
})