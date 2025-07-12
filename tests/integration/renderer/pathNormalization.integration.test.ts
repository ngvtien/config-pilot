import { describe, it, expect, beforeEach } from 'vitest'
import { 
  normalizeFieldPath, 
  findMatchingTreeNodes, 
  buildSchemaFromSelectedNodes 
} from '../../../src/renderer/utils/pathNormalization'
import { TemplateField } from '../../../src/shared/types/template'
import { SchemaTreeNode } from '../../../src/shared/types/schema'

describe('pathNormalization - Integration Tests', () => {
  
  describe('Real-world Kubernetes Deployment Schema', () => {
    let deploymentSchema: any
    let deploymentTreeNodes: SchemaTreeNode[]

    beforeEach(() => {
      // Real Kubernetes Deployment schema structure
      deploymentSchema = {
        type: 'object',
        properties: {
          apiVersion: { 
            type: 'string',
            enum: ['apps/v1'],
            description: 'APIVersion defines the versioned schema of this representation of an object.'
          },
          kind: { 
            type: 'string',
            enum: ['Deployment'],
            description: 'Kind is a string value representing the REST resource this object represents.'
          },
          metadata: {
            type: 'object',
            description: 'Standard object metadata.',
            properties: {
              name: { 
                type: 'string',
                description: 'Name must be unique within a namespace.',
                pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
              },
              namespace: { 
                type: 'string',
                description: 'Namespace defines the space within which each name must be unique.',
                default: 'default'
              },
              labels: {
                type: 'object',
                description: 'Map of string keys and values that can be used to organize and categorize objects.',
                additionalProperties: { type: 'string' }
              },
              annotations: {
                type: 'object',
                description: 'Annotations is an unstructured key value map stored with a resource.',
                additionalProperties: { type: 'string' }
              }
            }
          },
          spec: {
            type: 'object',
            description: 'Specification of the desired behavior of the Deployment.',
            properties: {
              replicas: {
                type: 'integer',
                description: 'Number of desired pods.',
                minimum: 0,
                maximum: 1000,
                default: 1
              },
              selector: {
                type: 'object',
                description: 'Label selector for pods.',
                properties: {
                  matchLabels: {
                    type: 'object',
                    description: 'matchLabels is a map of {key,value} pairs.',
                    additionalProperties: { type: 'string' }
                  }
                },
                required: ['matchLabels']
              },
              template: {
                type: 'object',
                description: 'Template describes the pods that will be created.',
                properties: {
                  metadata: {
                    type: 'object',
                    properties: {
                      labels: {
                        type: 'object',
                        additionalProperties: { type: 'string' }
                      }
                    }
                  },
                  spec: {
                    type: 'object',
                    properties: {
                      containers: {
                        type: 'array',
                        description: 'List of containers belonging to the pod.',
                        items: {
                          type: 'object',
                          properties: {
                            name: { 
                              type: 'string',
                              description: 'Name of the container specified as a DNS_LABEL.'
                            },
                            image: { 
                              type: 'string',
                              description: 'Docker image name.'
                            },
                            ports: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  containerPort: { 
                                    type: 'integer',
                                    minimum: 1,
                                    maximum: 65535
                                  },
                                  protocol: { 
                                    type: 'string',
                                    enum: ['TCP', 'UDP'],
                                    default: 'TCP'
                                  }
                                }
                              }
                            },
                            env: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  name: { type: 'string' },
                                  value: { type: 'string' }
                                }
                              }
                            }
                          },
                          required: ['name', 'image']
                        }
                      }
                    }
                  }
                }
              }
            },
            required: ['selector', 'template']
          }
        },
        required: ['apiVersion', 'kind', 'metadata', 'spec']
      }

      // Corresponding tree nodes structure
      deploymentTreeNodes = [
        {
          name: 'metadata',
          path: 'metadata',
          type: 'object',
          required: true,
          children: [
            {
              name: 'name',
              path: 'metadata.name',
              type: 'string',
              required: true,
              children: []
            },
            {
              name: 'namespace',
              path: 'metadata.namespace',
              type: 'string',
              required: false,
              children: []
            },
            {
              name: 'labels',
              path: 'metadata.labels',
              type: 'object',
              required: false,
              children: []
            }
          ]
        },
        {
          name: 'spec',
          path: 'spec',
          type: 'object',
          required: true,
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
              required: true,
              children: [
                {
                  name: 'matchLabels',
                  path: 'spec.selector.matchLabels',
                  type: 'object',
                  required: true,
                  children: []
                }
              ]
            },
            {
              name: 'template',
              path: 'spec.template',
              type: 'object',
              required: true,
              children: [
                {
                  name: 'spec',
                  path: 'spec.template.spec',
                  type: 'object',
                  required: false,
                  children: [
                    {
                      name: 'containers',
                      path: 'spec.template.spec.containers',
                      type: 'array',
                      required: false,
                      children: []
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })

    it('should handle complete deployment template creation workflow', () => {
      // Simulate user selecting specific fields for a deployment template
      const selectedFields: TemplateField[] = [
        { path: 'deployment.metadata.name', name: 'name', type: 'string' },
        { path: 'deployment.metadata.namespace', name: 'namespace', type: 'string' },
        { path: 'deployment.spec.replicas', name: 'replicas', type: 'integer' },
        { path: 'deployment.spec.selector.matchLabels', name: 'matchLabels', type: 'object' }
      ]

      // Step 1: Normalize paths
      const normalizedPaths = selectedFields.map(field => 
        normalizeFieldPath(field.path, 'deployment')
      )
      expect(normalizedPaths).toEqual([
        'metadata.name',
        'metadata.namespace', 
        'spec.replicas',
        'spec.selector.matchLabels'
      ])

      // Step 2: Find matching tree nodes
      const matchedPaths = findMatchingTreeNodes(selectedFields, deploymentTreeNodes, 'deployment')
      expect(matchedPaths).toEqual(new Set([
        'metadata.name',
        'metadata.namespace',
        'spec.replicas',
        'spec.selector.matchLabels'
      ]))

      // Step 3: Build filtered schema
      const filteredSchema = buildSchemaFromSelectedNodes(
        deploymentSchema,
        matchedPaths,
        deploymentTreeNodes
      )

      // Verify the filtered schema structure
      expect(filteredSchema.type).toBe('object')
      expect(filteredSchema.properties.apiVersion).toBeDefined()
      expect(filteredSchema.properties.kind).toBeDefined()
      expect(filteredSchema.properties.metadata).toBeDefined()
      expect(filteredSchema.properties.spec).toBeDefined()

      // Verify metadata contains only selected fields
      expect(filteredSchema.properties.metadata.properties.name).toBeDefined()
      expect(filteredSchema.properties.metadata.properties.namespace).toBeDefined()
      expect(filteredSchema.properties.metadata.properties.labels).toBeUndefined()
      expect(filteredSchema.properties.metadata.properties.annotations).toBeUndefined()

      // Verify spec contains only selected fields
      expect(filteredSchema.properties.spec.properties.replicas).toBeDefined()
      expect(filteredSchema.properties.spec.properties.selector).toBeDefined()
      expect(filteredSchema.properties.spec.properties.selector.properties.matchLabels).toBeDefined()
      expect(filteredSchema.properties.spec.properties.template).toBeUndefined()

      // Verify original schema properties are preserved
      expect(filteredSchema.properties.metadata.properties.name.pattern).toBe('^[a-z0-9]([-a-z0-9]*[a-z0-9])?$')
      expect(filteredSchema.properties.metadata.properties.namespace.default).toBe('default')
      expect(filteredSchema.properties.spec.properties.replicas.minimum).toBe(0)
      expect(filteredSchema.properties.spec.properties.replicas.maximum).toBe(1000)
      expect(filteredSchema.properties.spec.properties.replicas.default).toBe(1)
    })

    it('should handle container-specific field selection', () => {
      const selectedFields: TemplateField[] = [
        { path: 'deployment.spec.template.spec.containers', name: 'containers', type: 'array' }
      ]

      const matchedPaths = findMatchingTreeNodes(selectedFields, deploymentTreeNodes, 'deployment')
      const filteredSchema = buildSchemaFromSelectedNodes(
        deploymentSchema,
        matchedPaths,
        deploymentTreeNodes
      )

      expect(filteredSchema.properties.spec.properties.template.properties.spec.properties.containers).toBeDefined()
      expect(filteredSchema.properties.spec.properties.template.properties.spec.properties.containers.type).toBe('array')
      expect(filteredSchema.properties.spec.properties.template.properties.spec.properties.containers.items).toBeDefined()
      
      // Should NOT include other spec properties like replicas or selector
      expect(filteredSchema.properties.spec.properties.replicas).toBeUndefined()
      expect(filteredSchema.properties.spec.properties.selector).toBeUndefined()
    })

    it('should handle minimal field selection', () => {
      const selectedFields: TemplateField[] = [
        { path: 'deployment.metadata.name', name: 'name', type: 'string' }
      ]

      const matchedPaths = findMatchingTreeNodes(selectedFields, deploymentTreeNodes, 'deployment')
      const filteredSchema = buildSchemaFromSelectedNodes(
        deploymentSchema,
        matchedPaths,
        deploymentTreeNodes
      )

      // Should include base K8s fields
      expect(filteredSchema.properties.apiVersion).toBeDefined()
      expect(filteredSchema.properties.kind).toBeDefined()
      expect(filteredSchema.properties.metadata).toBeDefined()

      // Should only include selected metadata field
      expect(filteredSchema.properties.metadata.properties.name).toBeDefined()
      expect(filteredSchema.properties.metadata.properties.namespace).toBeUndefined()
      expect(filteredSchema.properties.metadata.properties.labels).toBeUndefined()

      // Should NOT include spec since it wasn't selected
      expect(filteredSchema.properties.spec).toBeUndefined()
    })
  })

  describe('Real-world Service Schema', () => {
    let serviceSchema: any
    let serviceTreeNodes: SchemaTreeNode[]

    beforeEach(() => {
      serviceSchema = {
        type: 'object',
        properties: {
          apiVersion: { type: 'string', enum: ['v1'] },
          kind: { type: 'string', enum: ['Service'] },
          metadata: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              namespace: { type: 'string', default: 'default' }
            }
          },
          spec: {
            type: 'object',
            properties: {
              type: { 
                type: 'string',
                enum: ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'],
                default: 'ClusterIP'
              },
              ports: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    port: { type: 'integer', minimum: 1, maximum: 65535 },
                    targetPort: { type: 'integer', minimum: 1, maximum: 65535 },
                    protocol: { type: 'string', enum: ['TCP', 'UDP'], default: 'TCP' }
                  }
                }
              },
              selector: {
                type: 'object',
                additionalProperties: { type: 'string' }
              }
            }
          }
        }
      }

      serviceTreeNodes = [
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
              name: 'type',
              path: 'spec.type',
              type: 'string',
              required: false,
              children: []
            },
            {
              name: 'ports',
              path: 'spec.ports',
              type: 'array',
              required: false,
              children: []
            },
            {
              name: 'selector',
              path: 'spec.selector',
              type: 'object',
              required: false,
              children: []
            }
          ]
        }
      ]
    })

    it('should handle service template with port configuration', () => {
      const selectedFields: TemplateField[] = [
        { path: 'service.metadata.name', name: 'name', type: 'string' },
        { path: 'service.spec.type', name: 'type', type: 'string' },
        { path: 'service.spec.ports', name: 'ports', type: 'array' },
        { path: 'service.spec.selector', name: 'selector', type: 'object' }
      ]

      const matchedPaths = findMatchingTreeNodes(selectedFields, serviceTreeNodes, 'service')
      const filteredSchema = buildSchemaFromSelectedNodes(
        serviceSchema,
        matchedPaths,
        serviceTreeNodes
      )

      // Verify all selected fields are included with their constraints
      expect(filteredSchema.properties.spec.properties.type.enum).toEqual(['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'])
      expect(filteredSchema.properties.spec.properties.type.default).toBe('ClusterIP')
      expect(filteredSchema.properties.spec.properties.ports.type).toBe('array')
      expect(filteredSchema.properties.spec.properties.ports.items.properties.port.minimum).toBe(1)
      expect(filteredSchema.properties.spec.properties.ports.items.properties.port.maximum).toBe(65535)
      expect(filteredSchema.properties.spec.properties.selector.additionalProperties.type).toBe('string')
    })
  })

  describe('Cross-function Integration', () => {
    it('should work seamlessly across all three functions', () => {
      const originalSchema = {
        type: 'object',
        properties: {
          apiVersion: { type: 'string' },
          kind: { type: 'string' },
          spec: {
            type: 'object',
            properties: {
              replicas: { type: 'integer', minimum: 1, default: 3 },
              image: { type: 'string', pattern: '^[a-z0-9.-]+:[a-z0-9.-]+$' }
            }
          }
        }
      }

      const treeNodes: SchemaTreeNode[] = [
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
              name: 'image',
              path: 'spec.image',
              type: 'string',
              required: true,
              children: []
            }
          ]
        }
      ]

      const selectedFields: TemplateField[] = [
        { path: 'myapp.spec.replicas', name: 'replicas', type: 'integer' }
      ]

      // Full workflow integration
      const normalizedPath = normalizeFieldPath(selectedFields[0].path, 'myapp')
      expect(normalizedPath).toBe('spec.replicas')

      const matchedPaths = findMatchingTreeNodes(selectedFields, treeNodes, 'myapp')
      expect(matchedPaths.has('spec.replicas')).toBe(true)

      const filteredSchema = buildSchemaFromSelectedNodes(originalSchema, matchedPaths, treeNodes)
      expect(filteredSchema.properties.spec.properties.replicas.minimum).toBe(1)
      expect(filteredSchema.properties.spec.properties.replicas.default).toBe(3)
      expect(filteredSchema.properties.spec.properties.image).toBeUndefined() // Not selected
    })
  })
})