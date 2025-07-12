import { TemplateField } from '../../shared/types/template'
import { SchemaTreeNode } from '../../shared/types/schema'

/**
 * Utility functions for normalizing and matching field paths in K8s schemas
 * Extracted for better testability and reusability
 */

/**
 * Normalizes a field path by removing resource prefixes to match tree node paths
 * @param fieldPath - The full field path (e.g., "io.k8s.api.rbac.v1.Role.metadata.name")
 * @param resourceKey - The current resource key (may be incorrect)
 * @returns Normalized relative path (e.g., "metadata.name")
 */
export function normalizeFieldPath(fieldPath: string, resourceKey: string): string {
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
 * Finds matching tree nodes for selected fields using universal path normalization
 * @param selectedFields - Array of selected template fields
 * @param treeNodes - Array of schema tree nodes
 * @param resourceKey - Current resource key (may be incorrect)
 * @returns Set of matched relative paths
 */
export function findMatchingTreeNodes(
  selectedFields: TemplateField[],
  treeNodes: SchemaTreeNode[],
  resourceKey: string
): Set<string> {
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
 * Builds a schema from selected tree nodes without infinite loops
 * @param originalSchema - The original schema object
 * @param selectedPaths - Set of selected relative paths
 * @param treeNodes - Array of schema tree nodes
 * @returns Filtered schema object
 */
export function buildSchemaFromSelectedNodes(
  originalSchema: any,
  selectedPaths: Set<string>,
  treeNodes: SchemaTreeNode[]
): any {
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

  const buildFromNodes = (nodes: SchemaTreeNode[], visited = new Set<string>()): any => {
    const properties: any = {}
    
    nodes.forEach(node => {
      // Prevent infinite loops
      if (visited.has(node.path)) {
        return
      }
      visited.add(node.path)
      
      const isSelected = selectedPaths.has(node.path)
      
      // Check if any children are selected (non-recursive to prevent loops)
      const hasSelectedChildren = node.children ? 
        node.children.some(child => selectedPaths.has(child.path)) : false
      
      if (isSelected || hasSelectedChildren) {
        // Get original property type from schema for selected fields
        const originalProperty = originalSchema?.properties ? 
          findPropertyInSchema(originalSchema, node.path) : null
        
        properties[node.name] = {
          type: (isSelected && originalProperty?.type) || node.type || 'object',
          ...(node.description && { description: node.description }),
          ...(node.required && { required: true })
        }

        if (node.children && node.children.length > 0) {
          const childVisited = new Set(visited)
          const childProperties = buildFromNodes(node.children, childVisited)
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

  // Build base schema with metadata description from tree nodes
  const metadataNode = nodeMap.get('metadata')
  const baseSchema = {
    type: 'object',
    properties: {
      apiVersion: originalSchema.properties?.apiVersion || { type: 'string' },
      kind: originalSchema.properties?.kind || { type: 'string' },
      metadata: {
        type: 'object',
        ...(metadataNode?.description && { description: metadataNode.description }),
        properties: {
          name: { type: 'string' },
          labels: { type: 'object' },
          annotations: { type: 'object' }
        }
      }
    }
  }

  const selectedProperties = buildFromNodes(treeNodes)
  
  // Merge properties carefully, preserving base metadata properties
  const mergedProperties = { ...baseSchema.properties }
  
  Object.keys(selectedProperties).forEach(key => {
    if (key === 'metadata' && mergedProperties.metadata) {
      // Special handling for metadata to preserve base properties
      mergedProperties.metadata = {
        ...mergedProperties.metadata,
        ...selectedProperties.metadata,
        properties: {
          ...mergedProperties.metadata.properties,
          ...selectedProperties.metadata.properties
        }
      }
    } else {
      mergedProperties[key] = selectedProperties[key]
    }
  })

  return {
    ...baseSchema,
    properties: mergedProperties
  }
}

/**
 * Finds a property in the original schema by following the dot-notation path
 * @param schema - The original schema object
 * @param path - Dot-notation path (e.g., "spec.replicas", "metadata.name")
 * @returns The property definition or null if not found
 */
export function findPropertyInSchema(schema: any, path: string): any {
  if (!schema || !schema.properties) {
    return null
  }

  const parts = path.split('.')
  let current = schema.properties

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!current || !current[part]) {
      return null
    }
    
    if (i === parts.length - 1) {
      // This is the final property
      return current[part]
    }
    
    if (current[part].properties) {
      current = current[part].properties
    } else {
      // No more properties to traverse but we're not at the end
      return null
    }
  }

  return null
}