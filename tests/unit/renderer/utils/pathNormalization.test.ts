import { describe, it, expect, beforeEach } from 'vitest'
import { 
  normalizeFieldPath, 
  findMatchingTreeNodes, 
  buildSchemaFromSelectedNodes 
} from '../../../../src/renderer/utils/pathNormalization'
import { TemplateField } from '../../../../src/shared/types/template'
import { SchemaTreeNode } from '../../../../src/shared/types/schema'

describe('Path Normalization Utilities - TDD', () => {
  // Mock data for testing
  let mockTreeNodes: SchemaTreeNode[]
  let mockSelectedFields: TemplateField[]
  let mockOriginalSchema: any

  beforeEach(() => {
    // Mock Kubernetes Role tree structure
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
          },
          {
            name: 'annotations',
            path: 'metadata.annotations',
            type: 'object',
            description: 'Map of string keys and values'
          }
        ]
      },
      {
        name: 'spec',
        path: 'spec',
        type: 'object',
        description: 'Role specification',
        children: [
          {
            name: 'rules',
            path: 'spec.rules',
            type: 'array',
            description: 'PolicyRules for this Role',
            children: [
              {
                name: 'apiGroups',
                path: 'spec.rules.apiGroups',
                type: 'array',
                description: 'APIGroups is the name of the APIGroup'
              },
              {
                name: 'resources',
                path: 'spec.rules.resources',
                type: 'array',
                description: 'Resources is a list of resources'
              },
              {
                name: 'verbs',
                path: 'spec.rules.verbs',
                type: 'array',
                description: 'Verbs is a list of Verbs'
              }
            ]
          }
        ]
      }
    ]

    // Mock selected fields with different path formats
    mockSelectedFields = [
      {
        path: 'io.k8s.api.rbac.v1.Role.metadata.name',
        defaultValue: '',
        title: 'Resource Name',
        description: 'Name of the Role resource'
      },
      {
        path: 'io.k8s.api.rbac.v1.Role.metadata.labels',
        defaultValue: {},
        title: 'Labels',
        description: 'Labels for the Role'
      },
      {
        path: 'io.k8s.api.rbac.v1.Role.spec.rules',
        defaultValue: [],
        title: 'Policy Rules',
        description: 'Rules for the Role'
      },
      {
        path: 'argoproj.io/v1alpha1/Application.spec.rules.verbs',
        defaultValue: [],
        title: 'Verbs',
        description: 'Allowed verbs'
      }
    ]

    // Mock original schema
    mockOriginalSchema = {
      type: 'object',
      properties: {
        apiVersion: { type: 'string' },
        kind: { type: 'string' },
        metadata: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            labels: { type: 'object' },
            annotations: { type: 'object' }
          }
        },
        spec: {
          type: 'object',
          properties: {
            rules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  apiGroups: { type: 'array' },
                  resources: { type: 'array' },
                  verbs: { type: 'array' }
                }
              }
            }
          }
        }
      }
    }
  })

  describe('normalizeFieldPath - Core Functionality', () => {
    it('should remove exact resource key prefix when present', () => {
      const fieldPath = 'io.k8s.api.rbac.v1.Role.metadata.name'
      const resourceKey = 'io.k8s.api.rbac.v1.Role'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('metadata.name')
    })

    it('should handle mismatched resource keys using K8s field boundaries', () => {
      const fieldPath = 'io.k8s.api.rbac.v1.Role.metadata.name'
      const resourceKey = 'argoproj.io/v1alpha1/Application'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('metadata.name')
    })

    it('should normalize paths starting with spec', () => {
      const fieldPath = 'io.k8s.api.rbac.v1.Role.spec.rules'
      const resourceKey = 'wrong.resource.key'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('spec.rules')
    })

    it('should normalize paths starting with data', () => {
      const fieldPath = 'v1.ConfigMap.data.config'
      const resourceKey = 'wrong.key'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('data.config')
    })

    it('should return original path if no normalization needed', () => {
      const fieldPath = 'metadata.name'
      const resourceKey = 'any.resource'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('metadata.name')
    })

    it('should handle complex nested paths', () => {
      const fieldPath = 'argoproj.io/v1alpha1/Application.spec.rules.verbs'
      const resourceKey = 'io.k8s.api.rbac.v1.Role'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('spec.rules.verbs')
    })
  })

  describe('findMatchingTreeNodes - Path Matching', () => {
    it('should find exact matches for normalized paths', () => {
      const resourceKey = 'argoproj.io/v1alpha1/Application'
      
      const result = findMatchingTreeNodes(mockSelectedFields, mockTreeNodes, resourceKey)
      
      expect(result.has('metadata.name')).toBe(true)
      expect(result.has('metadata.labels')).toBe(true)
      expect(result.has('spec.rules')).toBe(true)
      expect(result.has('spec.rules.verbs')).toBe(true)
      expect(result.size).toBe(4)
    })

    it('should handle empty selected fields', () => {
      const result = findMatchingTreeNodes([], mockTreeNodes, 'any.resource')
      
      expect(result.size).toBe(0)
    })

    it('should handle empty tree nodes', () => {
      const result = findMatchingTreeNodes(mockSelectedFields, [], 'any.resource')
      
      expect(result.size).toBe(0)
    })

    it('should handle correct resource key prefix', () => {
      const fieldsWithCorrectPrefix = [
        {
          path: 'io.k8s.api.rbac.v1.Role.metadata.name',
          defaultValue: '',
          title: 'Name',
          description: 'Resource name'
        }
      ]
      
      const result = findMatchingTreeNodes(
        fieldsWithCorrectPrefix, 
        mockTreeNodes, 
        'io.k8s.api.rbac.v1.Role'
      )
      
      expect(result.has('metadata.name')).toBe(true)
      expect(result.size).toBe(1)
    })

    it('should build comprehensive node map including nested children', () => {
      const deeplyNestedFields = [
        {
          path: 'io.k8s.api.rbac.v1.Role.spec.rules.verbs',
          defaultValue: [],
          title: 'Verbs',
          description: 'Allowed verbs'
        }
      ]
      
      const result = findMatchingTreeNodes(
        deeplyNestedFields, 
        mockTreeNodes, 
        'wrong.resource.key'
      )
      
      expect(result.has('spec.rules.verbs')).toBe(true)
    })
  })

  describe('buildSchemaFromSelectedNodes - Schema Generation', () => {
    it('should build schema with base K8s fields', () => {
      const selectedPaths = new Set(['metadata.name'])
      
      const result = buildSchemaFromSelectedNodes(
        mockOriginalSchema, 
        selectedPaths, 
        mockTreeNodes
      )
      
      expect(result.type).toBe('object')
      expect(result.properties.apiVersion).toBeDefined()
      expect(result.properties.kind).toBeDefined()
      expect(result.properties.metadata).toBeDefined()
      expect(result.properties.metadata.properties.name).toBeDefined()
      expect(result.properties.metadata.properties.labels).toBeDefined()
      expect(result.properties.metadata.properties.annotations).toBeDefined()
    })

    it('should include selected nested properties', () => {
      const selectedPaths = new Set(['spec.rules', 'spec.rules.verbs'])
      
      const result = buildSchemaFromSelectedNodes(
        mockOriginalSchema, 
        selectedPaths, 
        mockTreeNodes
      )
      
      expect(result.properties.spec).toBeDefined()
      expect(result.properties.spec.properties.rules).toBeDefined()
      expect(result.properties.spec.properties.rules.type).toBe('array')
    })

    it('should handle parent nodes when children are selected', () => {
      const selectedPaths = new Set(['metadata.name', 'metadata.labels'])
      
      const result = buildSchemaFromSelectedNodes(
        mockOriginalSchema, 
        selectedPaths, 
        mockTreeNodes
      )
      
      expect(result.properties.metadata).toBeDefined()
      expect(result.properties.metadata.type).toBe('object')
      expect(result.properties.metadata.properties.name).toBeDefined()
      expect(result.properties.metadata.properties.labels).toBeDefined()
    })

    it('should prevent infinite loops with visited set', () => {
      // Create a circular reference scenario
      const circularNodes: SchemaTreeNode[] = [
        {
          name: 'parent',
          path: 'parent',
          type: 'object',
          children: [
            {
              name: 'child',
              path: 'parent.child',
              type: 'object',
              children: [
                {
                  name: 'grandchild',
                  path: 'parent.child.grandchild',
                  type: 'string'
                }
              ]
            }
          ]
        }
      ]
      
      const selectedPaths = new Set(['parent', 'parent.child', 'parent.child.grandchild'])
      
      // This should not hang or throw due to infinite recursion
      const result = buildSchemaFromSelectedNodes(
        mockOriginalSchema, 
        selectedPaths, 
        circularNodes
      )
      
      expect(result).toBeDefined()
      expect(result.properties.parent).toBeDefined()
    })

    it('should preserve node descriptions and types', () => {
      const selectedPaths = new Set(['metadata.name'])
      
      const result = buildSchemaFromSelectedNodes(
        mockOriginalSchema, 
        selectedPaths, 
        mockTreeNodes
      )
      
      expect(result.properties.metadata.description).toBe('Standard object metadata')
      expect(result.properties.metadata.type).toBe('object')
    })
  })

  describe('Integration Tests - Complete Workflow', () => {
    it('should handle complete workflow from field selection to schema generation', () => {
      const resourceKey = 'argoproj.io/v1alpha1/Application'
      
      // Step 1: Find matching tree nodes
      const matchedPaths = findMatchingTreeNodes(mockSelectedFields, mockTreeNodes, resourceKey)
      
      // Step 2: Build schema from matched paths
      const schema = buildSchemaFromSelectedNodes(mockOriginalSchema, matchedPaths, mockTreeNodes)
      
      // Verify the complete workflow
      expect(matchedPaths.size).toBeGreaterThan(0)
      expect(schema.properties.metadata.properties.name).toBeDefined()
      expect(schema.properties.metadata.properties.labels).toBeDefined()
      expect(schema.properties.spec.properties.rules).toBeDefined()
    })

    it('should handle mixed resource prefixes in selected fields', () => {
      const mixedFields = [
        {
          path: 'io.k8s.api.rbac.v1.Role.metadata.name',
          defaultValue: '',
          title: 'Name',
          description: 'Resource name'
        },
        {
          path: 'argoproj.io/v1alpha1/Application.spec.rules',
          defaultValue: [],
          title: 'Rules',
          description: 'Policy rules'
        },
        {
          path: 'metadata.labels', // Already normalized
          defaultValue: {},
          title: 'Labels',
          description: 'Resource labels'
        }
      ]
      
      const resourceKey = 'some.other.resource'
      const matchedPaths = findMatchingTreeNodes(mixedFields, mockTreeNodes, resourceKey)
      
      expect(matchedPaths.has('metadata.name')).toBe(true)
      expect(matchedPaths.has('spec.rules')).toBe(true)
      expect(matchedPaths.has('metadata.labels')).toBe(true)
      expect(matchedPaths.size).toBe(3)
    })

    it('should generate valid JSON schema structure', () => {
      const selectedPaths = new Set(['metadata.name', 'spec.rules'])
      const schema = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes)
      
      // Verify JSON Schema compliance
      expect(schema.type).toBe('object')
      expect(schema.properties).toBeDefined()
      expect(typeof schema.properties).toBe('object')
      
      // Verify required K8s fields
      expect(schema.properties.apiVersion.type).toBe('string')
      expect(schema.properties.kind.type).toBe('string')
      expect(schema.properties.metadata.type).toBe('object')
      
      // Verify selected fields
      expect(schema.properties.metadata.properties.name.type).toBe('string')
      expect(schema.properties.spec.properties.rules.type).toBe('array')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed field paths gracefully', () => {
      const malformedFields = [
        {
          path: '',
          defaultValue: '',
          title: 'Empty',
          description: 'Empty path'
        },
        {
          path: '...',
          defaultValue: '',
          title: 'Dots',
          description: 'Only dots'
        },
        {
          path: 'single',
          defaultValue: '',
          title: 'Single',
          description: 'Single word'
        }
      ]
      
      const result = findMatchingTreeNodes(malformedFields, mockTreeNodes, 'any.resource')
      
      // Should not crash and return empty set
      expect(result.size).toBe(0)
    })

    it('should handle nodes without children', () => {
      const leafNodes: SchemaTreeNode[] = [
        {
          name: 'simpleField',
          path: 'simpleField',
          type: 'string',
          description: 'A simple field'
        }
      ]
      
      const selectedPaths = new Set(['simpleField'])
      const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, leafNodes)
      
      expect(result.properties.simpleField).toBeDefined()
      expect(result.properties.simpleField.type).toBe('string')
    })

    it('should handle deeply nested paths', () => {
      const deepPath = 'very.deep.nested.field.structure.value'
      const normalizedPath = normalizeFieldPath(deepPath, 'wrong.resource')
      
      expect(normalizedPath).toBe(deepPath) // Should remain unchanged
    })

    it('should handle empty selected paths', () => {
      const selectedPaths = new Set<string>()
      
      const result = buildSchemaFromSelectedNodes(
        mockOriginalSchema, 
        selectedPaths, 
        mockTreeNodes
      )
      
      // Should still have base K8s fields
      expect(result.properties.apiVersion).toBeDefined()
      expect(result.properties.kind).toBeDefined()
      expect(result.properties.metadata).toBeDefined()
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle the original bug scenario - mismatched resource keys', () => {
      // This reproduces the original issue where selectedFields have Role paths
      // but resourceKey is Application
      const roleFields = [
        {
          path: 'io.k8s.api.rbac.v1.Role.metadata.name',
          defaultValue: '',
          title: 'Name',
          description: 'Resource name'
        },
        {
          path: 'io.k8s.api.rbac.v1.Role.spec.rules',
          defaultValue: [],
          title: 'Rules',
          description: 'Policy rules'
        }
      ]
      
      const applicationResourceKey = 'argoproj.io/v1alpha1/Application'
      
      // This should work despite the mismatch
      const matchedPaths = findMatchingTreeNodes(roleFields, mockTreeNodes, applicationResourceKey)
      
      expect(matchedPaths.has('metadata.name')).toBe(true)
      expect(matchedPaths.has('spec.rules')).toBe(true)
      expect(matchedPaths.size).toBe(2)
    })

    it('should handle Kubernetes ConfigMap data fields', () => {
      const configMapNodes: SchemaTreeNode[] = [
        {
          name: 'data',
          path: 'data',
          type: 'object',
          description: 'Data contains the configuration data',
          children: [
            {
              name: 'config.yaml',
              path: 'data.config.yaml',
              type: 'string',
              description: 'Configuration file'
            }
          ]
        }
      ]
      
      const configMapFields = [
        {
          path: 'v1.ConfigMap.data.config.yaml',
          defaultValue: '',
          title: 'Config',
          description: 'Configuration data'
        }
      ]
      
      const result = findMatchingTreeNodes(configMapFields, configMapNodes, 'wrong.resource')
      
      expect(result.has('data.config.yaml')).toBe(true)
    })

    it('should handle ArgoCD Application spec fields', () => {
      const argoAppNodes: SchemaTreeNode[] = [
        {
          name: 'spec',
          path: 'spec',
          type: 'object',
          children: [
            {
              name: 'project',
              path: 'spec.project',
              type: 'string',
              description: 'ArgoCD project name'
            },
            {
              name: 'source',
              path: 'spec.source',
              type: 'object',
              children: [
                {
                  name: 'repoURL',
                  path: 'spec.source.repoURL',
                  type: 'string'
                }
              ]
            }
          ]
        }
      ]
      
      const argoFields = [
        {
          path: 'argoproj.io/v1alpha1/Application.spec.project',
          defaultValue: 'default',
          title: 'Project',
          description: 'ArgoCD project'
        },
        {
          path: 'argoproj.io/v1alpha1/Application.spec.source.repoURL',
          defaultValue: '',
          title: 'Repository URL',
          description: 'Git repository URL'
        }
      ]
      
      const result = findMatchingTreeNodes(argoFields, argoAppNodes, 'io.k8s.api.rbac.v1.Role')
      
      expect(result.has('spec.project')).toBe(true)
      expect(result.has('spec.source.repoURL')).toBe(true)
    })
  })
})