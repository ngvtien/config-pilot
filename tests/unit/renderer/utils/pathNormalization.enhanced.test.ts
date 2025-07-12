import { describe, it, expect, beforeEach } from 'vitest'
import { 
  buildSchemaFromSelectedNodes 
} from '../../../../src/renderer/utils/pathNormalization'
import { TemplateField } from '../../../../src/shared/types/template'
import { SchemaTreeNode } from '../../../../src/shared/types/schema'

describe('Enhanced buildSchemaFromSelectedNodes - Type and Property Preservation', () => {
  let mockTreeNodes: SchemaTreeNode[]
  let mockSelectedFields: TemplateField[]
  let mockOriginalSchema: any

  beforeEach(() => {
    // Enhanced mock tree nodes with various types
    mockTreeNodes = [
      {
        name: 'metadata',
        path: 'metadata',
        type: 'object',
        description: 'Standard object metadata',
        children: [
          {
            name: 'name',
            path: 'metadata.name',
            type: 'string',
            description: 'Name of the resource'
          },
          {
            name: 'labels',
            path: 'metadata.labels',
            type: 'object',
            description: 'Map of string keys and values'
          }
        ]
      },
      {
        name: 'spec',
        path: 'spec',
        type: 'object',
        description: 'Specification of the resource',
        children: [
          {
            name: 'replicas',
            path: 'spec.replicas',
            type: 'integer',
            description: 'Number of desired pods'
          },
          {
            name: 'selector',
            path: 'spec.selector',
            type: 'object',
            description: 'Label selector for pods'
          },
          {
            name: 'template',
            path: 'spec.template',
            type: 'object',
            description: 'Pod template',
            children: [
              {
                name: 'spec',
                path: 'spec.template.spec',
                type: 'object',
                description: 'Pod specification',
                children: [
                  {
                    name: 'containers',
                    path: 'spec.template.spec.containers',
                    type: 'array',
                    description: 'List of containers'
                  }
                ]
              }
            ]
          },
          {
            name: 'strategy',
            path: 'spec.strategy',
            type: 'object',
            description: 'Deployment strategy'
          },
          {
            name: 'paused',
            path: 'spec.paused',
            type: 'boolean',
            description: 'Indicates that the deployment is paused'
          }
        ]
      },
      {
        name: 'status',
        path: 'status',
        type: 'object',
        description: 'Most recently observed status'
      }
    ]

    // Enhanced mock selected fields
    mockSelectedFields = [
      {
        path: 'metadata.name',
        defaultValue: '',
        title: 'Resource Name',
        description: 'Name of the resource'
      },
      {
        path: 'metadata.labels',
        defaultValue: {},
        title: 'Labels',
        description: 'Labels for the resource'
      },
      {
        path: 'spec.replicas',
        defaultValue: 1,
        title: 'Replicas',
        description: 'Number of desired pods'
      },
      {
        path: 'spec.template.spec.containers',
        defaultValue: [],
        title: 'Containers',
        description: 'List of containers'
      },
      {
        path: 'spec.paused',
        defaultValue: false,
        title: 'Paused',
        description: 'Deployment paused state'
      },
      {
        path: 'spec.strategy',
        defaultValue: {},
        title: 'Strategy',
        description: 'Deployment strategy'
      }
    ]

    // Enhanced original schema with rich type information
    mockOriginalSchema = {
      type: 'object',
      properties: {
        apiVersion: { 
          type: 'string',
          description: 'APIVersion defines the versioned schema',
          default: 'apps/v1'
        },
        kind: { 
          type: 'string',
          description: 'Kind is a string value representing the REST resource',
          enum: ['Deployment', 'ReplicaSet', 'DaemonSet'],
          default: 'Deployment'
        },
        metadata: {
          type: 'object',
          description: 'Standard object metadata',
          properties: {
            name: { 
              type: 'string',
              description: 'Name must be unique within a namespace',
              pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
              maxLength: 253
            },
            labels: { 
              type: 'object',
              description: 'Map of string keys and values that can be used to organize and categorize objects',
              additionalProperties: { type: 'string' }
            },
            annotations: { 
              type: 'object',
              description: 'Annotations is an unstructured key value map',
              additionalProperties: { type: 'string' }
            }
          }
        },
        spec: {
          type: 'object',
          description: 'Specification of the desired behavior of the Deployment',
          properties: {
            replicas: { 
              type: 'integer',
              description: 'Number of desired pods',
              default: 1,
              minimum: 0,
              maximum: 1000
            },
            selector: {
              type: 'object',
              description: 'Label selector for pods',
              properties: {
                matchLabels: {
                  type: 'object',
                  additionalProperties: { type: 'string' }
                }
              }
            },
            template: {
              type: 'object',
              description: 'Template describes the pods that will be created',
              properties: {
                spec: {
                  type: 'object',
                  description: 'Specification of the desired behavior of the pod',
                  properties: {
                    containers: {
                      type: 'array',
                      description: 'List of containers belonging to the pod',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          image: { type: 'string' },
                          ports: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                containerPort: { type: 'integer' },
                                protocol: { 
                                  type: 'string',
                                  enum: ['TCP', 'UDP', 'SCTP'],
                                  default: 'TCP'
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
            },
            strategy: {
              type: 'object',
              description: 'The deployment strategy to use to replace existing pods with new ones',
              properties: {
                type: {
                  type: 'string',
                  enum: ['Recreate', 'RollingUpdate'],
                  default: 'RollingUpdate'
                }
              }
            },
            paused: {
              type: 'boolean',
              description: 'Indicates that the deployment is paused',
              default: false
            }
          }
        },
        status: {
          type: 'object',
          description: 'Most recently observed status of the Deployment'
        }
      }
    }
  })

  describe('Type Preservation', () => {
    it('should preserve string type from original schema', () => {
      const selectedFields = [{ path: 'metadata.name', defaultValue: '', title: 'Name', description: 'Resource name' }]
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)
      
      expect(result.properties.metadata.properties.name.type).toBe('string')
      expect(result.properties.metadata.properties.name.description).toBe('Name must be unique within a namespace')
      expect(result.properties.metadata.properties.name.pattern).toBe('^[a-z0-9]([-a-z0-9]*[a-z0-9])?$')
      expect(result.properties.metadata.properties.name.maxLength).toBe(253)
    })

    it('should preserve integer type with constraints from original schema', () => {
      const selectedFields = [{ path: 'spec.replicas', defaultValue: 1, title: 'Replicas', description: 'Pod count' }]
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)
      
      expect(result.properties.spec.properties.replicas.type).toBe('integer')
      expect(result.properties.spec.properties.replicas.description).toBe('Number of desired pods')
      expect(result.properties.spec.properties.replicas.default).toBe(1)
      expect(result.properties.spec.properties.replicas.minimum).toBe(0)
      expect(result.properties.spec.properties.replicas.maximum).toBe(1000)
    })

    it('should preserve boolean type with default from original schema', () => {
      const selectedFields = [{ path: 'spec.paused', defaultValue: false, title: 'Paused', description: 'Paused state' }]
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)
      
      expect(result.properties.spec.properties.paused.type).toBe('boolean')
      expect(result.properties.spec.properties.paused.description).toBe('Indicates that the deployment is paused')
      expect(result.properties.spec.properties.paused.default).toBe(false)
    })

    it('should preserve array type with items definition from original schema', () => {
      const selectedFields = [{ path: 'spec.template.spec.containers', defaultValue: [], title: 'Containers', description: 'Container list' }]
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)
      
      expect(result.properties.spec.properties.template.properties.spec.properties.containers.type).toBe('array')
      expect(result.properties.spec.properties.template.properties.spec.properties.containers.description).toBe('List of containers belonging to the pod')
      expect(result.properties.spec.properties.template.properties.spec.properties.containers.items).toBeDefined()
      expect(result.properties.spec.properties.template.properties.spec.properties.containers.items.type).toBe('object')
    })
  })

  describe('Enum and Default Value Preservation', () => {
    it('should preserve enum values and default from original schema', () => {
      const selectedFields = [{ path: 'kind', defaultValue: 'Deployment', title: 'Kind', description: 'Resource kind' }]
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)
      
      expect(result.properties.kind.type).toBe('string')
      expect(result.properties.kind.enum).toEqual(['Deployment', 'ReplicaSet', 'DaemonSet'])
      expect(result.properties.kind.default).toBe('Deployment')
      expect(result.properties.kind.description).toBe('Kind is a string value representing the REST resource')
    })

    it('should preserve nested enum values', () => {
      const selectedFields = [{ path: 'spec.strategy', defaultValue: {}, title: 'Strategy', description: 'Deployment strategy' }]
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)
      
      expect(result.properties.spec.properties.strategy.type).toBe('object')
      expect(result.properties.spec.properties.strategy.properties.type.enum).toEqual(['Recreate', 'RollingUpdate'])
      expect(result.properties.spec.properties.strategy.properties.type.default).toBe('RollingUpdate')
    })
  })

  describe('Key-Value Pair Objects', () => {
    it('should handle objects without properties as key-value pairs', () => {
      const selectedFields = [{ path: 'metadata.labels', defaultValue: {}, title: 'Labels', description: 'Resource labels' }]
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)
      
      expect(result.properties.metadata.properties.labels.type).toBe('object')
      expect(result.properties.metadata.properties.labels.description).toBe('Map of string keys and values that can be used to organize and categorize objects')
      expect(result.properties.metadata.properties.labels.additionalProperties).toEqual({ type: 'string' })
    })

    it('should preserve additionalProperties for key-value objects', () => {
      const selectedFields = [{ path: 'metadata.annotations', defaultValue: {}, title: 'Annotations', description: 'Resource annotations' }]
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)
      
      expect(result.properties.metadata.properties.annotations.type).toBe('object')
      expect(result.properties.metadata.properties.annotations.additionalProperties).toEqual({ type: 'string' })
    })
  })

  describe('Complex Integration Tests', () => {
    it('should handle multiple selected fields with different types', () => {
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, mockSelectedFields)
      
      // Check that all selected fields are present with correct types
      expect(result.properties.metadata.properties.name.type).toBe('string')
      expect(result.properties.metadata.properties.labels.type).toBe('object')
      expect(result.properties.spec.properties.replicas.type).toBe('integer')
      expect(result.properties.spec.properties.template.properties.spec.properties.containers.type).toBe('array')
      expect(result.properties.spec.properties.paused.type).toBe('boolean')
      expect(result.properties.spec.properties.strategy.type).toBe('object')
      
      // Check that descriptions are preserved
      expect(result.properties.metadata.properties.name.description).toBe('Name must be unique within a namespace')
      expect(result.properties.spec.properties.replicas.description).toBe('Number of desired pods')
      expect(result.properties.spec.properties.paused.description).toBe('Indicates that the deployment is paused')
    })

    it('should preserve nested array item schemas', () => {
      const selectedFields = [{ path: 'spec.template.spec.containers', defaultValue: [], title: 'Containers', description: 'Container list' }]
      
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, selectedFields)
      
      const containersSchema = result.properties.spec.properties.template.properties.spec.properties.containers
      expect(containersSchema.type).toBe('array')
      expect(containersSchema.items.type).toBe('object')
      expect(containersSchema.items.properties.name).toEqual({ type: 'string' })
      expect(containersSchema.items.properties.image).toEqual({ type: 'string' })
      expect(containersSchema.items.properties.ports.type).toBe('array')
    })
  })

  describe('Edge Cases and Fallbacks', () => {
    it('should fallback to tree node type when original schema property not found', () => {
      const limitedSchema = {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            properties: {
              name: { type: 'string' }
              // labels missing from original schema
            }
          }
        }
      }
      
      const selectedFields = [
        { path: 'metadata.name', defaultValue: '', title: 'Name', description: 'Resource name' },
        { path: 'metadata.labels', defaultValue: {}, title: 'Labels', description: 'Resource labels' }
      ]
      
      const result = buildSchemaFromSelectedNodes(limitedSchema, mockTreeNodes, selectedFields)
      
      expect(result.properties.metadata.properties.name.type).toBe('string')
      expect(result.properties.metadata.properties.labels.type).toBe('object') // fallback to tree node type
    })

    it('should handle missing original schema gracefully', () => {
      const selectedFields = [{ path: 'metadata.name', defaultValue: '', title: 'Name', description: 'Resource name' }]
      
      const result = buildSchemaFromSelectedNodes(null, mockTreeNodes, selectedFields)
      
      expect(result.properties.metadata.properties.name.type).toBe('string') // from tree node
    })

    it('should handle empty selected paths', () => {
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, mockTreeNodes, [])
      
      expect(result.type).toBe('object')
      expect(result.properties).toEqual({
        apiVersion: mockOriginalSchema.properties.apiVersion,
        kind: mockOriginalSchema.properties.kind,
        metadata: mockOriginalSchema.properties.metadata,
        spec: mockOriginalSchema.properties.spec
      })
    })

    it('should preserve format and pattern constraints', () => {
      const schemaWithFormat = {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            pattern: '^[^@]+@[^@]+\\.[^@]+$'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      }
      
      const treeNodes = [
        { name: 'email', path: 'email', type: 'string' },
        { name: 'timestamp', path: 'timestamp', type: 'string' }
      ]
      
      const selectedFields = [
        { path: 'email', defaultValue: '', title: 'Email', description: 'User email' },
        { path: 'timestamp', defaultValue: '', title: 'Timestamp', description: 'Creation time' }
      ]
      
      const result = buildSchemaFromSelectedNodes(schemaWithFormat, treeNodes, selectedFields)
      
      expect(result.properties.email.format).toBe('email')
      expect(result.properties.email.pattern).toBe('^[^@]+@[^@]+\\.[^@]+$')
      expect(result.properties.timestamp.format).toBe('date-time')
    })
  })

  describe('Additional Schema Properties', () => {
    it('should preserve minLength, maxLength, minimum, maximum constraints', () => {
      const constrainedSchema = {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 20,
            pattern: '^[a-zA-Z0-9_]+$'
          },
          age: {
            type: 'integer',
            minimum: 0,
            maximum: 150
          }
        }
      }
      
      const treeNodes = [
        { name: 'username', path: 'username', type: 'string' },
        { name: 'age', path: 'age', type: 'integer' }
      ]
      
      const selectedFields = [
        { path: 'username', defaultValue: '', title: 'Username', description: 'User name' },
        { path: 'age', defaultValue: 0, title: 'Age', description: 'User age' }
      ]
      
      const result = buildSchemaFromSelectedNodes(constrainedSchema, treeNodes, selectedFields)
      
      expect(result.properties.username.minLength).toBe(3)
      expect(result.properties.username.maxLength).toBe(20)
      expect(result.properties.username.pattern).toBe('^[a-zA-Z0-9_]+$')
      expect(result.properties.age.minimum).toBe(0)
      expect(result.properties.age.maximum).toBe(150)
    })
  })
})