import { describe, it, expect, beforeEach } from 'vitest'
import { 
  normalizeFieldPath, 
  findMatchingTreeNodes, 
  buildSchemaFromSelectedNodes 
} from '../../../../src/renderer/utils/pathNormalization'
import { TemplateField } from '../../../../src/shared/types/template'
import { SchemaTreeNode } from '../../../../src/shared/types/schema'

describe('pathNormalization - Comprehensive Tests', () => {
  
  describe('normalizeFieldPath', () => {
    it('should remove resource key prefix when present', () => {
      const result = normalizeFieldPath('deployment.spec.replicas', 'deployment')
      expect(result).toBe('spec.replicas')
    })

    it('should handle paths without resource prefix', () => {
      const result = normalizeFieldPath('spec.replicas', 'deployment')
      expect(result).toBe('spec.replicas')
    })

    it('should find K8s field boundaries and normalize accordingly', () => {
      const result = normalizeFieldPath('myapp.deployment.spec.replicas', 'deployment')
      expect(result).toBe('spec.replicas')
    })

    it('should handle RBAC-specific fields', () => {
      const result = normalizeFieldPath('clusterrole.rules.0.verbs', 'clusterrole')
      expect(result).toBe('rules.0.verbs')
    })

    it('should handle metadata fields', () => {
      const result = normalizeFieldPath('service.metadata.name', 'service')
      expect(result).toBe('metadata.name')
    })

    it('should return original path if no K8s fields found', () => {
      const result = normalizeFieldPath('custom.field.path', 'resource')
      expect(result).toBe('custom.field.path')
    })

    it('should handle empty strings gracefully', () => {
      const result = normalizeFieldPath('', 'resource')
      expect(result).toBe('')
    })
  })

  describe('findMatchingTreeNodes', () => {
    let mockTreeNodes: SchemaTreeNode[]
    let mockSelectedFields: TemplateField[]

    beforeEach(() => {
      mockTreeNodes = [
        {
          name: 'spec',
          path: 'spec',
          type: 'object',
          required: false,
          children: [
            {
              name: 'replicas',
              path: 'spec.replicas',
              type: 'integer',
              required: false,
              children: []
            },
            {
              name: 'selector',
              path: 'spec.selector',
              type: 'object',
              required: false,
              children: [
                {
                  name: 'matchLabels',
                  path: 'spec.selector.matchLabels',
                  type: 'object',
                  required: false,
                  children: []
                }
              ]
            }
          ]
        },
        {
          name: 'metadata',
          path: 'metadata',
          type: 'object',
          required: false,
          children: [
            {
              name: 'name',
              path: 'metadata.name',
              type: 'string',
              required: true,
              children: []
            }
          ]
        }
      ]

      mockSelectedFields = [
        { path: 'deployment.spec.replicas', name: 'replicas', type: 'integer' },
        { path: 'deployment.metadata.name', name: 'name', type: 'string' }
      ]
    })

    it('should find matching tree nodes for selected fields', () => {
      const result = findMatchingTreeNodes(mockSelectedFields, mockTreeNodes, 'deployment')
      expect(result).toEqual(new Set(['spec.replicas', 'metadata.name']))
    })

    it('should handle nested paths correctly', () => {
      const selectedFields: TemplateField[] = [
        { path: 'deployment.spec.selector.matchLabels', name: 'matchLabels', type: 'object' }
      ]
      const result = findMatchingTreeNodes(selectedFields, mockTreeNodes, 'deployment')
      expect(result).toEqual(new Set(['spec.selector.matchLabels']))
    })

    it('should return empty set when no matches found', () => {
      const selectedFields: TemplateField[] = [
        { path: 'deployment.nonexistent.field', name: 'field', type: 'string' }
      ]
      const result = findMatchingTreeNodes(selectedFields, mockTreeNodes, 'deployment')
      expect(result).toEqual(new Set())
    })

    it('should handle empty selected fields', () => {
      const result = findMatchingTreeNodes([], mockTreeNodes, 'deployment')
      expect(result).toEqual(new Set())
    })

    it('should handle empty tree nodes', () => {
      const result = findMatchingTreeNodes(mockSelectedFields, [], 'deployment')
      expect(result).toEqual(new Set())
    })
  })

  describe('buildSchemaFromSelectedNodes', () => {
    let mockOriginalSchema: any
    let mockTreeNodes: SchemaTreeNode[]

    beforeEach(() => {
      mockOriginalSchema = {
        type: 'object',
        properties: {
          apiVersion: { type: 'string' },
          kind: { type: 'string' },
          metadata: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the resource' },
              namespace: { type: 'string', description: 'Namespace of the resource' },
              labels: { 
                type: 'object',
                additionalProperties: { type: 'string' }
              }
            }
          },
          spec: {
            type: 'object',
            properties: {
              replicas: { 
                type: 'integer', 
                description: 'Number of replicas',
                minimum: 1,
                maximum: 100,
                default: 1
              },
              selector: {
                type: 'object',
                properties: {
                  matchLabels: {
                    type: 'object',
                    additionalProperties: { type: 'string' }
                  }
                }
              },
              template: {
                type: 'object',
                properties: {
                  metadata: { type: 'object' },
                  spec: { type: 'object' }
                }
              }
            }
          }
        }
      }

      mockTreeNodes = [
        {
          name: 'spec',
          path: 'spec',
          type: 'object',
          required: false,
          children: [
            {
              name: 'replicas',
              path: 'spec.replicas',
              type: 'integer',
              required: false,
              children: []
            },
            {
              name: 'selector',
              path: 'spec.selector',
              type: 'object',
              required: false,
              children: [
                {
                  name: 'matchLabels',
                  path: 'spec.selector.matchLabels',
                  type: 'object',
                  required: false,
                  children: []
                }
              ]
            }
          ]
        },
        {
          name: 'metadata',
          path: 'metadata',
          type: 'object',
          required: false,
          children: [
            {
              name: 'name',
              path: 'metadata.name',
              type: 'string',
              required: true,
              children: []
            }
          ]
        }
      ]
    })

    describe('Signature 1: buildSchemaFromSelectedNodes(originalSchema, selectedPaths, treeNodes)', () => {
      it('should build schema with only selected leaf nodes', () => {
        const selectedPaths = new Set(['spec.replicas'])
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)

        expect(result.type).toBe('object')
        expect(result.properties.apiVersion).toBeDefined()
        expect(result.properties.kind).toBeDefined()
        expect(result.properties.metadata).toBeDefined()
        expect(result.properties.spec).toBeDefined()
        expect(result.properties.spec.properties.replicas).toBeDefined()
        expect(result.properties.spec.properties.replicas.type).toBe('integer')
        expect(result.properties.spec.properties.replicas.description).toBe('Number of replicas')
        expect(result.properties.spec.properties.replicas.minimum).toBe(1)
        expect(result.properties.spec.properties.replicas.maximum).toBe(100)
        expect(result.properties.spec.properties.replicas.default).toBe(1)
        
        // Should NOT include other spec properties like selector or template
        expect(result.properties.spec.properties.selector).toBeUndefined()
        expect(result.properties.spec.properties.template).toBeUndefined()
      })

      it('should preserve original schema properties for selected fields', () => {
        const selectedPaths = new Set(['metadata.name'])
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)

        expect(result.properties.metadata.properties.name.type).toBe('string')
        expect(result.properties.metadata.properties.name.description).toBe('Name of the resource')
        
        // Should NOT include other metadata properties like namespace or labels
        expect(result.properties.metadata.properties.namespace).toBeUndefined()
        expect(result.properties.metadata.properties.labels).toBeUndefined()
      })

      it('should handle nested selections correctly', () => {
        const selectedPaths = new Set(['spec.selector.matchLabels'])
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)

        expect(result.properties.spec.properties.selector.properties.matchLabels).toBeDefined()
        expect(result.properties.spec.properties.selector.properties.matchLabels.type).toBe('object')
        expect(result.properties.spec.properties.selector.properties.matchLabels.additionalProperties).toBeDefined()
        
        // Should NOT include other spec properties
        expect(result.properties.spec.properties.replicas).toBeUndefined()
        expect(result.properties.spec.properties.template).toBeUndefined()
      })

      it('should handle multiple selections', () => {
        const selectedPaths = new Set(['spec.replicas', 'metadata.name'])
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)

        expect(result.properties.spec.properties.replicas).toBeDefined()
        expect(result.properties.metadata.properties.name).toBeDefined()
        
        // Should NOT include unselected properties
        expect(result.properties.spec.properties.selector).toBeUndefined()
        expect(result.properties.metadata.properties.namespace).toBeUndefined()
      })

      it('should return minimal schema when no paths selected', () => {
        const selectedPaths = new Set<string>()
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)

        expect(result.type).toBe('object')
        expect(result.properties.apiVersion).toBeDefined()
        expect(result.properties.kind).toBeDefined()
        expect(result.properties.metadata).toBeDefined()
        expect(result.properties.metadata.properties.name).toBeDefined()
      })

      it('should handle missing original schema gracefully', () => {
        const selectedPaths = new Set(['spec.replicas'])
        const result = buildSchemaFromSelectedNodes(null, selectedPaths, mockTreeNodes)

        expect(result.type).toBe('object')
        expect(result.properties.spec).toBeDefined()
        expect(result.properties.spec.properties.replicas).toBeDefined()
        expect(result.properties.spec.properties.replicas.type).toBe('integer')
      })
    })

    describe('Signature 2: buildSchemaFromSelectedNodes(originalSchema, treeNodes, selectedFields)', () => {
      it('should work with TemplateField array', () => {
        const selectedFields: TemplateField[] = [
          { path: 'spec.replicas', name: 'replicas', type: 'integer' }
        ]
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)

        expect(result.properties.spec.properties.replicas).toBeDefined()
        expect(result.properties.spec.properties.replicas.type).toBe('integer')
        expect(result.properties.spec.properties.replicas.description).toBe('Number of replicas')
      })

      it('should handle multiple template fields', () => {
        const selectedFields: TemplateField[] = [
          { path: 'spec.replicas', name: 'replicas', type: 'integer' },
          { path: 'metadata.name', name: 'name', type: 'string' }
        ]
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)

        expect(result.properties.spec.properties.replicas).toBeDefined()
        expect(result.properties.metadata.properties.name).toBeDefined()
      })
    })

    describe('Edge Cases and Error Handling', () => {
      it('should handle circular references in tree nodes', () => {
        const circularTreeNodes: SchemaTreeNode[] = [
          {
            name: 'parent',
            path: 'parent',
            type: 'object',
            required: false,
            children: []
          }
        ]
        
        // Create circular reference
        circularTreeNodes[0].children = [circularTreeNodes[0]]
        
        const selectedPaths = new Set(['parent'])
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, circularTreeNodes)

        expect(result).toBeDefined()
        expect(result.properties.parent).toBeDefined()
      })

      it('should handle tree nodes with missing properties', () => {
        const incompleteTreeNodes: SchemaTreeNode[] = [
          {
            name: 'incomplete',
            path: 'incomplete',
            type: undefined as any,
            required: false,
            children: []
          }
        ]
        
        const selectedPaths = new Set(['incomplete'])
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, incompleteTreeNodes)

        expect(result.properties.incomplete).toBeDefined()
        expect(result.properties.incomplete.type).toBe('object') // Should default to 'object'
      })

      it('should preserve all schema constraints from original', () => {
        const selectedPaths = new Set(['spec.replicas'])
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)

        const replicasProperty = result.properties.spec.properties.replicas
        expect(replicasProperty.type).toBe('integer')
        expect(replicasProperty.description).toBe('Number of replicas')
        expect(replicasProperty.minimum).toBe(1)
        expect(replicasProperty.maximum).toBe(100)
        expect(replicasProperty.default).toBe(1)
      })

      it('should handle additionalProperties correctly', () => {
        const selectedPaths = new Set(['spec.selector.matchLabels'])
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)

        const matchLabelsProperty = result.properties.spec.properties.selector.properties.matchLabels
        expect(matchLabelsProperty.additionalProperties).toBeDefined()
        expect(matchLabelsProperty.additionalProperties.type).toBe('string')
      })

      it('should handle required fields correctly', () => {
        const selectedPaths = new Set(['metadata.name'])
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)

        expect(result.properties.metadata.properties.name.required).toBe(true)
      })
    })

    describe('Performance and Memory Tests', () => {
      it('should handle large tree structures efficiently', () => {
        const largeTreeNodes: SchemaTreeNode[] = []
        const selectedPaths = new Set<string>()
        
        // Create a large tree structure
        for (let i = 0; i < 100; i++) {
          largeTreeNodes.push({
            name: `field${i}`,
            path: `field${i}`,
            type: 'string',
            required: false,
            children: []
          })
          selectedPaths.add(`field${i}`)
        }

        const startTime = Date.now()
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, largeTreeNodes)
        const endTime = Date.now()

        expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
        expect(Object.keys(result.properties)).toContain('field0')
        expect(Object.keys(result.properties)).toContain('field99')
      })

      it('should handle deeply nested structures', () => {
        const deepTreeNodes: SchemaTreeNode[] = []
        let currentNode: SchemaTreeNode = {
          name: 'level0',
          path: 'level0',
          type: 'object',
          required: false,
          children: []
        }
        deepTreeNodes.push(currentNode)

        // Create 10 levels of nesting
        for (let i = 1; i < 10; i++) {
          const newNode: SchemaTreeNode = {
            name: `level${i}`,
            path: `level0.${'level1.'.repeat(i-1)}level${i}`,
            type: 'object',
            required: false,
            children: []
          }
          currentNode.children = [newNode]
          currentNode = newNode
        }

        const selectedPaths = new Set(['level0.level1.level2.level3.level4.level5.level6.level7.level8.level9'])
        const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, deepTreeNodes)

        expect(result.properties.level0).toBeDefined()
        // Should handle deep nesting without stack overflow
      })
    })
  })
})