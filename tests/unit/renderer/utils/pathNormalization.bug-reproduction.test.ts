import { describe, it, expect, beforeEach } from 'vitest'
import { buildSchemaFromSelectedNodes } from '../../../../src/renderer/utils/pathNormalization'
import { SchemaTreeNode } from '../../../../src/shared/types/schema'

describe('pathNormalization - Bug Reproduction Tests', () => {
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
            name: { type: 'string', description: 'Name of the resource', required: true },
            namespace: { type: 'string', description: 'Namespace of the resource' },
            labels: { 
              type: 'object',
              additionalProperties: { type: 'string' }
            }
          }
        },
        spec: {
          type: 'object',
          description: 'DeploymentSpec is the specification of the desired behavior of the Deployment.',
          properties: {
            replicas: { 
              type: 'integer', 
              description: 'Number of replicas',
              minimum: 1,
              maximum: 100,
              default: 1
            },
            paused: {
              type: 'boolean',
              description: 'Indicates that the deployment is paused.'
            },
            selector: {
              type: 'object',
              properties: {
                matchLabels: {
                  type: 'object',
                  additionalProperties: { type: 'string' }
                },
                matchExpressions: {
                  type: 'array',
                  items: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }

    mockTreeNodes = [
      {
        name: 'apiVersion',
        path: 'apiVersion',
        type: 'string',
        required: false,
        children: []
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
      },
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
            name: 'paused',
            path: 'spec.paused',
            type: 'boolean',
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
                name: 'matchExpressions',
                path: 'spec.selector.matchExpressions',
                type: 'array',
                required: false,
                children: []
              }
            ]
          }
        ]
      },
      {
        name: 'status',
        path: 'status',
        type: 'object',
        required: false,
        children: []
      }
    ]
  })

  describe('BUG 1: Metadata included when NOT selected', () => {
    it('SHOULD FAIL - metadata should NOT be included when only spec fields are selected', () => {
      const selectedPaths = ['spec.replicas']
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)
      
      // THIS SHOULD FAIL - metadata should NOT be included
      expect(result.properties).not.toHaveProperty('metadata')
      expect(Object.keys(result.properties)).toEqual(['apiVersion', 'kind', 'spec'])
    })

    it('SHOULD FAIL - metadata should NOT be included when multiple spec fields are selected', () => {
      const selectedPaths = ['spec.replicas', 'spec.paused', 'spec.selector.matchExpressions']
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)
      
      // THIS SHOULD FAIL - metadata should NOT be included
      expect(result.properties).not.toHaveProperty('metadata')
      expect(Object.keys(result.properties)).toEqual(['apiVersion', 'kind', 'spec'])
    })
  })

  describe('BUG 2: Selected spec fields NOT included in spec properties', () => {
    it('SHOULD FAIL - spec.replicas should be included in spec.properties when selected', () => {
      const selectedPaths = ['spec.replicas']
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)
      
      // THIS SHOULD FAIL - spec should contain the selected replicas field
      expect(result.properties.spec).toHaveProperty('properties')
      expect(result.properties.spec.properties).toHaveProperty('replicas')
      expect(result.properties.spec.properties.replicas).toEqual({
        type: 'integer',
        description: 'Number of replicas',
        minimum: 1,
        maximum: 100,
        default: 1
      })
    })

    it('SHOULD FAIL - multiple selected spec fields should be included in spec.properties', () => {
      const selectedPaths = ['spec.replicas', 'spec.paused']
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)
      
      // THIS SHOULD FAIL - spec should contain both selected fields
      expect(result.properties.spec).toHaveProperty('properties')
      expect(result.properties.spec.properties).toHaveProperty('replicas')
      expect(result.properties.spec.properties).toHaveProperty('paused')
      expect(Object.keys(result.properties.spec.properties)).toEqual(['replicas', 'paused'])
    })

    it('SHOULD FAIL - nested spec fields should be included correctly', () => {
      const selectedPaths = ['spec.selector.matchExpressions']
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)
      
      // THIS SHOULD FAIL - spec should contain nested selector with matchExpressions
      expect(result.properties.spec).toHaveProperty('properties')
      expect(result.properties.spec.properties).toHaveProperty('selector')
      expect(result.properties.spec.properties.selector).toHaveProperty('properties')
      expect(result.properties.spec.properties.selector.properties).toHaveProperty('matchExpressions')
    })
  })

  describe('CORRECT BEHAVIOR: Metadata only when selected', () => {
    it('SHOULD PASS - metadata should be included when metadata fields are selected', () => {
      const selectedPaths = ['metadata.name']
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)
      
      expect(result.properties).toHaveProperty('metadata')
      expect(result.properties.metadata).toHaveProperty('properties')
      expect(result.properties.metadata.properties).toHaveProperty('name')
    })

    it('SHOULD PASS - both metadata and spec when both are selected', () => {
      const selectedPaths = ['metadata.name', 'spec.replicas']
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)
      
      expect(result.properties).toHaveProperty('metadata')
      expect(result.properties).toHaveProperty('spec')
      expect(result.properties.metadata.properties).toHaveProperty('name')
      expect(result.properties.spec.properties).toHaveProperty('replicas')
    })
  })
})