import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SchemaTreeNode } from '../../../../src/shared/types/schema'
import { TemplateField } from '../../../../src/shared/types/template'

/**
 * Test suite for SchemaTreeView component and related path matching logic
 * Following TDD approach to identify and fix current issues
 */

/**
 * Helper function to extract path normalization logic for testing
 * This should be moved to a utility file and imported by SchemaFieldSelectionModal
 */
function normalizeFieldPath(fieldPath: string, resourceKey: string): string {
  let normalizedPath = fieldPath

  // Strategy 1: Remove current resourceKey prefix if present
  if (normalizedPath.startsWith(`${resourceKey}.`)) {
    normalizedPath = normalizedPath.substring(`${resourceKey}.`.length)
    return normalizedPath
  }

  // Strategy 2: Remove any resource-like prefix using K8s field boundaries
  const parts = normalizedPath.split('.')
  if (parts.length > 2) {
    // Extended list of common K8s fields including RBAC-specific fields
    const commonK8sFields = ['metadata', 'spec', 'data', 'status', 'kind', 'apiVersion', 'rules', 'subjects', 'roleRef']
    
    for (let i = 0; i < parts.length; i++) {
      if (commonK8sFields.includes(parts[i])) {
        normalizedPath = parts.slice(i).join('.')
        break
      }
    }
  }

  return normalizedPath
}

/**
 * Function to test tree node matching logic
 * This should be extracted from SchemaFieldSelectionModal
 */
const findMatchingTreeNodes = (
  selectedFields: TemplateField[],
  treeNodes: SchemaTreeNode[],
  resourceKey: string
): Set<string> => {
  const matchedPaths = new Set<string>()

  // Build node map for quick lookup
  const nodeMap = new Map<string, SchemaTreeNode>()
  const buildNodeMap = (nodes: SchemaTreeNode[]) => {
    nodes.forEach(node => {
      nodeMap.set(node.path, node)
      if (node.children && node.children.length > 0) {
        buildNodeMap(node.children)
      }
    })
  }
  buildNodeMap(treeNodes)

  // Normalize and match paths
  selectedFields.forEach(field => {
    const normalizedPath = normalizeFieldPath(field.path, resourceKey)
    
    if (nodeMap.has(normalizedPath)) {
      matchedPaths.add(normalizedPath)
    }
  })

  return matchedPaths
}

/**
 * Function to test schema building logic
 * This should be extracted from SchemaFieldSelectionModal
 */
const buildSchemaFromSelectedNodes = (
  originalSchema: any,
  selectedPaths: Set<string>,
  treeNodes: SchemaTreeNode[]
): any => {
  const buildFromNodes = (nodes: SchemaTreeNode[]): any => {
    const properties: any = {}
    
    nodes.forEach(node => {
      const isSelected = selectedPaths.has(node.path)
      
      // Check if any children are selected - fix recursive logic
      const hasSelectedChildren = node.children ? 
        node.children.some(child => 
          selectedPaths.has(child.path) || 
          (child.children && child.children.some(grandChild => 
            selectedPaths.has(grandChild.path)
          ))
        ) : false
      
      if (isSelected || hasSelectedChildren) {
        properties[node.name] = {
          type: node.type || 'object',
          ...(node.description && { description: node.description }),
          ...(node.required && { required: true })
        }

        if (node.children && node.children.length > 0) {
          const childProperties = buildFromNodes(node.children)
          if (Object.keys(childProperties).length > 0) {
            properties[node.name].properties = childProperties
            if (!properties[node.name].type) {
              properties[node.name].type = 'object'
            }
          }
        }
      }
    })

    return properties
  }

  const baseSchema = {
    type: 'object',
    properties: {
      apiVersion: { type: 'string' },
      kind: { type: 'string' },
      metadata: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      }
    }
  }

  const selectedProperties = buildFromNodes(treeNodes)
  
  return {
    ...baseSchema,
    properties: {
      ...baseSchema.properties,
      ...selectedProperties
    }
  }
}

describe('SchemaTreeView Path Matching Logic', () => {
  
  /**
   * Mock data representing a typical K8s Role resource tree structure
   */
  const mockRoleTreeNodes: SchemaTreeNode[] = [
    {
      name: 'metadata',
      path: 'metadata',
      type: 'object',
      description: 'Standard object metadata',
      required: true,
      children: [
        {
          name: 'name',
          path: 'metadata.name',
          type: 'string',
          description: 'Name of the role',
          required: true
        },
        {
          name: 'labels',
          path: 'metadata.labels',
          type: 'object',
          description: 'Map of string keys and values',
          required: false
        }
      ]
    },
    {
      name: 'rules',
      path: 'rules',
      type: 'array',
      description: 'PolicyRules for this Role',
      required: false,
      children: [
        {
          name: 'apiGroups',
          path: 'rules.apiGroups',
          type: 'array',
          description: 'API groups',
          required: false
        },
        {
          name: 'resources',
          path: 'rules.resources',
          type: 'array',
          description: 'Resources',
          required: false
        }
      ]
    }
  ]

  /**
   * Mock selected fields with full resource paths (current problematic format)
   */
  const mockSelectedFieldsWithResourcePrefix: TemplateField[] = [
    {
      path: 'io.k8s.api.rbac.v1.Role.metadata.name',
      title: 'Role Name',
      defaultValue: 'my-role',
      description: 'Name of the role'
    },
    {
      path: 'io.k8s.api.rbac.v1.Role.rules.apiGroups',
      title: 'API Groups',
      defaultValue: [''],
      description: 'API groups for the role'
    }
  ]

  /**
   * Mock selected fields with relative paths (target format)
   */
  const mockSelectedFieldsRelative: TemplateField[] = [
    {
      path: 'metadata.name',
      title: 'Role Name',
      defaultValue: 'my-role',
      description: 'Name of the role'
    },
    {
      path: 'rules.apiGroups',
      title: 'API Groups',
      defaultValue: [''],
      description: 'API groups for the role'
    }
  ]

  describe('Path Normalization Function', () => {

    it('should remove correct resourceKey prefix', () => {
      const resourceKey = 'io.k8s.api.rbac.v1.Role'
      const fieldPath = 'io.k8s.api.rbac.v1.Role.metadata.name'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('metadata.name')
    })

    it('should remove incorrect resourceKey prefix using K8s field boundaries', () => {
      const resourceKey = 'argoproj.io/v1alpha1/Application' // Wrong resource key
      const fieldPath = 'io.k8s.api.rbac.v1.Role.metadata.name'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('metadata.name')
    })

    it('should handle spec fields correctly', () => {
      const resourceKey = 'argoproj.io/v1alpha1/Application'
      const fieldPath = 'io.k8s.api.rbac.v1.Role.spec.template.spec.containers'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('spec.template.spec.containers')
    })

    it('should return unchanged path if no K8s fields found', () => {
      const resourceKey = 'some.resource'
      const fieldPath = 'custom.field.path'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('custom.field.path')
    })

    it('should handle already normalized paths', () => {
      const resourceKey = 'io.k8s.api.rbac.v1.Role'
      const fieldPath = 'metadata.name'
      
      const result = normalizeFieldPath(fieldPath, resourceKey)
      
      expect(result).toBe('metadata.name')
    })
  })

  describe('Tree Node Matching Function', () => {

    it('should match fields with correct resource key', () => {
      const resourceKey = 'io.k8s.api.rbac.v1.Role'
      
      const result = findMatchingTreeNodes(
        mockSelectedFieldsWithResourcePrefix,
        mockRoleTreeNodes,
        resourceKey
      )
      
      expect(result.size).toBe(2)
      expect(result.has('metadata.name')).toBe(true)
      expect(result.has('rules.apiGroups')).toBe(true)
    })

    it('should match fields with incorrect resource key using fallback logic', () => {
      const resourceKey = 'argoproj.io/v1alpha1/Application' // Wrong resource key
      
      const result = findMatchingTreeNodes(
        mockSelectedFieldsWithResourcePrefix,
        mockRoleTreeNodes,
        resourceKey
      )
      
      expect(result.size).toBe(2)
      expect(result.has('metadata.name')).toBe(true)
      expect(result.has('rules.apiGroups')).toBe(true)
    })

    it('should match already normalized paths', () => {
      const resourceKey = 'io.k8s.api.rbac.v1.Role'
      
      const result = findMatchingTreeNodes(
        mockSelectedFieldsRelative,
        mockRoleTreeNodes,
        resourceKey
      )
      
      expect(result.size).toBe(2)
      expect(result.has('metadata.name')).toBe(true)
      expect(result.has('rules.apiGroups')).toBe(true)
    })

    it('should return empty set when no matches found', () => {
      const resourceKey = 'io.k8s.api.rbac.v1.Role'
      const nonMatchingFields: TemplateField[] = [
        {
          path: 'nonexistent.field',
          title: 'Non-existent',
          defaultValue: '',
          description: 'This field does not exist'
        }
      ]
      
      const result = findMatchingTreeNodes(
        nonMatchingFields,
        mockRoleTreeNodes,
        resourceKey
      )
      
      expect(result.size).toBe(0)
    })
  })

  describe('Schema Building Function', () => {

    it('should build schema with selected leaf nodes', () => {
      const selectedPaths = new Set(['metadata.name', 'rules.apiGroups'])
      
      const result = buildSchemaFromSelectedNodes(
        {},
        selectedPaths,
        mockRoleTreeNodes
      )
      
      expect(result.properties.metadata).toBeDefined()
      expect(result.properties.metadata.properties.name).toBeDefined()
      expect(result.properties.rules).toBeDefined()
      expect(result.properties.rules.properties.apiGroups).toBeDefined()
    })

    it('should include parent nodes when children are selected', () => {
      const selectedPaths = new Set(['metadata.name'])
      
      const result = buildSchemaFromSelectedNodes(
        {},
        selectedPaths,
        mockRoleTreeNodes
      )
      
      expect(result.properties.metadata).toBeDefined()
      expect(result.properties.metadata.type).toBe('object')
      expect(result.properties.metadata.properties.name).toBeDefined()
    })

    it('should not include unselected nodes', () => {
      const selectedPaths = new Set(['metadata.name'])
      
      const result = buildSchemaFromSelectedNodes(
        {},
        selectedPaths,
        mockRoleTreeNodes
      )
      
      expect(result.properties.rules).toBeUndefined()
    })

    it('should preserve node metadata', () => {
      const selectedPaths = new Set(['metadata.name'])
      
      const result = buildSchemaFromSelectedNodes(
        {},
        selectedPaths,
        mockRoleTreeNodes
      )
      
      expect(result.properties.metadata.description).toBe('Standard object metadata')
      expect(result.properties.metadata.properties.name.description).toBe('Name of the role')
    })
  })

  describe('Integration Tests', () => {
    
    it('should handle complete workflow with resource key mismatch', () => {
      const resourceKey = 'argoproj.io/v1alpha1/Application' // Wrong resource key
      
      // Step 1: Find matching tree nodes
      const matchedPaths = findMatchingTreeNodes(
        mockSelectedFieldsWithResourcePrefix,
        mockRoleTreeNodes,
        resourceKey
      )
      
      // Step 2: Build schema from matched paths
      const schema = buildSchemaFromSelectedNodes(
        {},
        matchedPaths,
        mockRoleTreeNodes
      )
      
      // Verify the complete workflow works
      expect(matchedPaths.size).toBe(2)
      expect(schema.properties.metadata.properties.name).toBeDefined()
      expect(schema.properties.rules.properties.apiGroups).toBeDefined()
    })

    it('should handle empty selected fields gracefully', () => {
      const resourceKey = 'io.k8s.api.rbac.v1.Role'
      
      const matchedPaths = findMatchingTreeNodes(
        [],
        mockRoleTreeNodes,
        resourceKey
      )
      
      const schema = buildSchemaFromSelectedNodes(
        {},
        matchedPaths,
        mockRoleTreeNodes
      )
      
      expect(matchedPaths.size).toBe(0)
      expect(Object.keys(schema.properties)).toEqual(['apiVersion', 'kind', 'metadata'])
    })
  })
})