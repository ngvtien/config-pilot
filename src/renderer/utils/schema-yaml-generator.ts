import * as yaml from 'js-yaml'
import { sample } from '@stoplight/json-schema-sampler'

/**
 * Generate realistic sample data from a JSON schema
 * @param schema - The filtered JSON schema containing only selected fields
 * @param path - Current path for debugging
 * @returns Sample data object
 */
function generateSampleFromSchema(schema: any, path: string = ''): any {
  if (!schema) return null

  // Handle different schema types
  switch (schema.type) {
    case 'object':
      if (!schema.properties) return {}
      
      const obj: any = {}
      Object.entries(schema.properties).forEach(([key, propSchema]: [string, any]) => {
        obj[key] = generateSampleFromSchema(propSchema, `${path}.${key}`)
      })
      return obj

    case 'array':
      if (!schema.items) return []
      
      // Generate 1-2 sample items for arrays
      const sampleCount = schema.items.type === 'object' ? 1 : 2
      return Array.from({ length: sampleCount }, () => 
        generateSampleFromSchema(schema.items, `${path}[]`)
      )

    case 'string':
      return generateRealisticStringValue(path, schema)

    case 'number':
    case 'integer':
      return schema.minimum || schema.default || 1

    case 'boolean':
      return schema.default !== undefined ? schema.default : true

    default:
      // Handle enum values
      if (schema.enum && schema.enum.length > 0) {
        return schema.enum[0]
      }
      
      // Fallback for unknown types
      return schema.default || `<${schema.type || 'unknown'}>`
  }
}

/**
 * Generate realistic string values based on field path and schema
 * @param path - Field path for context
 * @param schema - Schema definition
 * @returns Realistic string value
 */
function generateRealisticStringValue(path: string, schema: any): string {
  const lowerPath = path.toLowerCase()
  
  // Use default value if available
  if (schema.default) return schema.default
  
  // Use enum value if available
  if (schema.enum && schema.enum.length > 0) return schema.enum[0]
  
  // Generate realistic values based on field name
  if (lowerPath.includes('name')) return 'sample-name'
  if (lowerPath.includes('namespace')) return 'default'
  if (lowerPath.includes('image')) return 'nginx:latest'
  if (lowerPath.includes('port')) return '8080'
  if (lowerPath.includes('host')) return 'example.com'
  if (lowerPath.includes('path')) return '/api/v1'
  if (lowerPath.includes('url')) return 'https://example.com'
  if (lowerPath.includes('email')) return 'user@example.com'
  if (lowerPath.includes('version')) return 'v1.0.0'
  if (lowerPath.includes('label')) return 'sample-label'
  if (lowerPath.includes('annotation')) return 'sample-annotation'
  if (lowerPath.includes('secret')) return 'sample-secret'
  if (lowerPath.includes('key')) return 'sample-key'
  if (lowerPath.includes('value')) return 'sample-value'
  if (lowerPath.includes('resource')) return 'pods'
  if (lowerPath.includes('verb')) return 'get'
  if (lowerPath.includes('group')) return 'apps'
  
  // Default fallback
  return 'sample-value'
}

import * as yaml from 'js-yaml'
import { sample } from '@stoplight/json-schema-sampler'

/**
 * Generate YAML preview from persisted filtered schema
 * @param resourceKey - The resource key to get persisted schema for
 * @param resource - The resource object containing apiVersion and kind
 * @returns Generated YAML string
 */
export function generateYamlFromFilteredSchema(resourceKey: string, resource: any): string {
  try {
    console.log('🎯 generateYamlFromFilteredSchema called with:', resourceKey)
    
    // Get the persisted filtered schemas from localStorage
    const stored = localStorage.getItem('schema-field-selection-selected-fields-schema')
    if (!stored) {
      return '# No filtered schema found\n# Please select fields first'
    }
    
    const schemas = JSON.parse(stored)
    const filteredSchema = schemas[resourceKey]
    
    if (!filteredSchema) {
      return `# No filtered schema found for: ${resourceKey}\n# Please select fields first`
    }
    
    console.log('✅ Using filtered schema with properties:', Object.keys(filteredSchema.properties || {}))
    
    // Use the library to generate sample data from the filtered schema
    const sampleData = sample(filteredSchema)
    
    // Ensure we have the basic Kubernetes structure
    const yamlData = {
      apiVersion: resource.apiVersion || 'v1',
      kind: resource.kind,
      ...sampleData
    }
    
    return yaml.dump(yamlData, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false
    })
    
  } catch (error) {
    console.error('❌ Error generating YAML:', error)
    return `# Error: ${error.message}`
  }
}