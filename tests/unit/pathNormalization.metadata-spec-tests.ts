import { describe, it, expect } from 'vitest'
import { buildSchemaFromSelectedNodes, findMatchingTreeNodes } from '../../src/renderer/utils/pathNormalization'

describe('buildSchemaFromSelectedNodes - Metadata and Spec Field Tests', () => {
  const mockSchema = {
    type: 'object',
    properties: {
      apiVersion: { type: 'string' },
      kind: { type: 'string' },
      metadata: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          namespace: { type: 'string' },
          labels: { type: 'object', additionalProperties: { type: 'string' } }
        }
      },
      spec: {
        type: 'object',
        properties: {
          replicas: { type: 'integer' },
          selector: {
            type: 'object',
            properties: {
              matchLabels: { type: 'object', additionalProperties: { type: 'string' } }
            }
          },
          template: {
            type: 'object',
            properties: {
              metadata: {
                type: 'object',
                properties: {
                  labels: { type: 'object', additionalProperties: { type: 'string' } }
                }
              },
              spec: {
                type: 'object',
                properties: {
                  containers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        image: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const mockTreeNodes = [
    {
      name: 'apiVersion',
      path: 'apiVersion',
      type: 'string',
      children: []
    },
    {
      name: 'kind',
      path: 'kind',
      type: 'string',
      children: []
    },
    {
      name: 'metadata',
      path: 'metadata',
      type: 'object',
      children: [
        { name: 'name', path: 'metadata.name', type: 'string', children: [] },
        { name: 'namespace', path: 'metadata.namespace', type: 'string', children: [] },
        { name: 'labels', path: 'metadata.labels', type: 'object', children: [] }
      ]
    },
    {
      name: 'spec',
      path: 'spec',
      type: 'object',
      children: [
        { name: 'replicas', path: 'spec.replicas', type: 'integer', children: [] },
        {
          name: 'selector',
          path: 'spec.selector',
          type: 'object',
          children: [
            { name: 'matchLabels', path: 'spec.selector.matchLabels', type: 'object', children: [] }
          ]
        },
        {
          name: 'template',
          path: 'spec.template',
          type: 'object',
          children: [
            {
              name: 'metadata',
              path: 'spec.template.metadata',
              type: 'object',
              children: [
                { name: 'labels', path: 'spec.template.metadata.labels', type: 'object', children: [] }
              ]
            },
            {
              name: 'spec',
              path: 'spec.template.spec',
              type: 'object',
              children: [
                {
                  name: 'containers',
                  path: 'spec.template.spec.containers',
                  type: 'array',
                  children: [
                    { name: 'name', path: 'spec.template.spec.containers.name', type: 'string', children: [] },
                    { name: 'image', path: 'spec.template.spec.containers.image', type: 'string', children: [] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]

  describe('BUG: Metadata should NOT be included when no metadata fields are selected', () => {
    it('should NOT include metadata when only spec.replicas is selected', () => {
      const selectedPaths = new Set(['spec.replicas'])
      const result = buildSchemaFromSelectedNodes(mockTreeNodes, selectedPaths, mockSchema)
      
      console.log('🔍 TEST: Only spec.replicas selected')
      console.log('Selected paths:', Array.from(selectedPaths))
      console.log('Result properties:', Object.keys(result.properties))
      console.log('Full result:', JSON.stringify(result, null, 2))
      
      // Should only have apiVersion, kind, and spec
      expect(result.properties).toHaveProperty('apiVersion')
      expect(result.properties).toHaveProperty('kind')
      expect(result.properties).toHaveProperty('spec')
      expect(result.properties).not.toHaveProperty('metadata') // BUG: This currently fails!
      
      // Spec should only contain replicas
      expect(result.properties.spec.properties).toHaveProperty('replicas')
      expect(Object.keys(result.properties.spec.properties)).toEqual(['replicas'])
    })

    it('should NOT include metadata when only spec.selector.matchLabels is selected', () => {
      const selectedPaths = new Set(['spec.selector.matchLabels'])
      const result = buildSchemaFromSelectedNodes(mockTreeNodes, selectedPaths, mockSchema)
      
      console.log('🔍 TEST: Only spec.selector.matchLabels selected')
      console.log('Selected paths:', Array.from(selectedPaths))
      console.log('Result properties:', Object.keys(result.properties))
      
      // Should only have apiVersion, kind, and spec
      expect(result.properties).toHaveProperty('apiVersion')
      expect(result.properties).toHaveProperty('kind')
      expect(result.properties).toHaveProperty('spec')
      expect(result.properties).not.toHaveProperty('metadata') // BUG: This currently fails!
      
      // Spec should contain selector with matchLabels
      expect(result.properties.spec.properties).toHaveProperty('selector')
      expect(result.properties.spec.properties.selector.properties).toHaveProperty('matchLabels')
    })

    it('should NOT include metadata when multiple spec fields are selected', () => {
      const selectedPaths = new Set(['spec.replicas', 'spec.selector.matchLabels'])
      const result = buildSchemaFromSelectedNodes(mockTreeNodes, selectedPaths, mockSchema)
      
      console.log('🔍 TEST: Multiple spec fields selected')
      console.log('Selected paths:', Array.from(selectedPaths))
      console.log('Result properties:', Object.keys(result.properties))
      
      // Should only have apiVersion, kind, and spec
      expect(result.properties).toHaveProperty('apiVersion')
      expect(result.properties).toHaveProperty('kind')
      expect(result.properties).toHaveProperty('spec')
      expect(result.properties).not.toHaveProperty('metadata') // BUG: This currently fails!
    })
  })

  describe('CORRECT: Metadata should be included when metadata fields are selected', () => {
    it('should include metadata when metadata.name is selected', () => {
      const selectedPaths = new Set(['metadata.name'])
      const result = buildSchemaFromSelectedNodes(mockTreeNodes, selectedPaths, mockSchema)
      
      console.log('🔍 TEST: metadata.name selected')
      console.log('Selected paths:', Array.from(selectedPaths))
      console.log('Result properties:', Object.keys(result.properties))
      
      // Should have apiVersion, kind, and metadata
      expect(result.properties).toHaveProperty('apiVersion')
      expect(result.properties).toHaveProperty('kind')
      expect(result.properties).toHaveProperty('metadata')
      expect(result.properties).not.toHaveProperty('spec')
      
      // Metadata should only contain name
      expect(result.properties.metadata.properties).toHaveProperty('name')
      expect(Object.keys(result.properties.metadata.properties)).toEqual(['name'])
    })

    it('should include metadata when both metadata and spec fields are selected', () => {
      const selectedPaths = new Set(['metadata.name', 'spec.replicas'])
      const result = buildSchemaFromSelectedNodes(mockTreeNodes, selectedPaths, mockSchema)
      
      console.log('🔍 TEST: Both metadata.name and spec.replicas selected')
      console.log('Selected paths:', Array.from(selectedPaths))
      console.log('Result properties:', Object.keys(result.properties))
      
      // Should have apiVersion, kind, metadata, and spec
      expect(result.properties).toHaveProperty('apiVersion')
      expect(result.properties).toHaveProperty('kind')
      expect(result.properties).toHaveProperty('metadata')
      expect(result.properties).toHaveProperty('spec')
      
      // Metadata should only contain name
      expect(result.properties.metadata.properties).toHaveProperty('name')
      expect(Object.keys(result.properties.metadata.properties)).toEqual(['name'])
      
      // Spec should only contain replicas
      expect(result.properties.spec.properties).toHaveProperty('replicas')
      expect(Object.keys(result.properties.spec.properties)).toEqual(['replicas'])
    })
  })

  describe('CORRECT: Spec fields should be included when selected', () => {
    it('should include spec.replicas when selected', () => {
      const selectedPaths = new Set(['spec.replicas'])
      const result = buildSchemaFromSelectedNodes(mockTreeNodes, selectedPaths, mockSchema)
      
      console.log('🔍 TEST: spec.replicas inclusion check')
      console.log('Selected paths:', Array.from(selectedPaths))
      console.log('Spec properties:', result.properties.spec?.properties ? Object.keys(result.properties.spec.properties) : 'No spec properties')
      
      expect(result.properties).toHaveProperty('spec')
      expect(result.properties.spec.properties).toHaveProperty('replicas')
      expect(result.properties.spec.properties.replicas.type).toBe('integer')
    })

    it('should include nested spec fields when selected', () => {
      const selectedPaths = new Set(['spec.template.spec.containers.name'])
      const result = buildSchemaFromSelectedNodes(mockTreeNodes, selectedPaths, mockSchema)
      
      console.log('🔍 TEST: Nested spec field inclusion check')
      console.log('Selected paths:', Array.from(selectedPaths))
      console.log('Result structure:', JSON.stringify(result, null, 2))
      
      expect(result.properties).toHaveProperty('spec')
      expect(result.properties.spec.properties).toHaveProperty('template')
      expect(result.properties.spec.properties.template.properties).toHaveProperty('spec')
      expect(result.properties.spec.properties.template.properties.spec.properties).toHaveProperty('containers')
      expect(result.properties.spec.properties.template.properties.spec.properties.containers.properties).toHaveProperty('name')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty selection correctly', () => {
      const selectedPaths = new Set<string>()
      const result = buildSchemaFromSelectedNodes(mockTreeNodes, selectedPaths, mockSchema)
      
      console.log('🔍 TEST: Empty selection')
      console.log('Result properties:', Object.keys(result.properties))
      
      // Should have minimal schema with apiVersion, kind, and basic metadata
      expect(result.properties).toHaveProperty('apiVersion')
      expect(result.properties).toHaveProperty('kind')
      expect(result.properties).toHaveProperty('metadata')
      expect(result.properties).not.toHaveProperty('spec')
    })

    it('should handle only apiVersion and kind selection', () => {
      const selectedPaths = new Set(['apiVersion', 'kind'])
      const result = buildSchemaFromSelectedNodes(mockTreeNodes, selectedPaths, mockSchema)
      
      console.log('🔍 TEST: Only apiVersion and kind selected')
      console.log('Selected paths:', Array.from(selectedPaths))
      console.log('Result properties:', Object.keys(result.properties))
      
      // Should only have apiVersion and kind, no metadata or spec
      expect(result.properties).toHaveProperty('apiVersion')
      expect(result.properties).toHaveProperty('kind')
      expect(result.properties).not.toHaveProperty('metadata')
      expect(result.properties).not.toHaveProperty('spec')
    })
  })
})