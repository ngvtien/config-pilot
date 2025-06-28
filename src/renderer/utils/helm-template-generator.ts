import yaml from 'js-yaml'

/**
 * Utility functions for generating Helm templates
 */

/**
 * Generate Helm resource template
 * @param resource - Kubernetes resource object
 * @param templateName - Name of the template
 * @returns Generated Helm template string
 */
// export const generateHelmResourceTemplate = (resource: any, templateName: string): string => {
//   const chartName = templateName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  
//   let template = `apiVersion: ${resource.apiVersion}\n`
//   template += `kind: ${resource.kind}\n`
//   template += `metadata:\n`
//   template += `  name: {{ include "${chartName}.fullname" . }}\n`
//   template += `  labels:\n`
//   template += `    {{- include "${chartName}.labels" . | nindent 4 }}\n`
  
//   if (resource.kind === 'Deployment' || resource.kind === 'StatefulSet' || resource.kind === 'DaemonSet') {
//     template += `spec:\n`
//     template += `  replicas: {{ .Values.${resource.kind.toLowerCase()}.replicas | default 1 }}\n`
//     template += `  selector:\n`
//     template += `    matchLabels:\n`
//     template += `      {{- include "${chartName}.selectorLabels" . | nindent 6 }}\n`
//     template += `  template:\n`
//     template += `    metadata:\n`
//     template += `      labels:\n`
//     template += `        {{- include "${chartName}.selectorLabels" . | nindent 8 }}\n`
//     template += `    spec:\n`
//     template += `      containers:\n`
//     template += `      - name: {{ .Chart.Name }}\n`
//     template += `        image: "{{ .Values.${resource.kind.toLowerCase()}.image.repository }}:{{ .Values.${resource.kind.toLowerCase()}.image.tag | default .Chart.AppVersion }}"\n`
//     template += `        imagePullPolicy: {{ .Values.${resource.kind.toLowerCase()}.image.pullPolicy }}\n`
//   } else {
//     template += `spec:\n`
//     template += `  # Add your ${resource.kind} specification here\n`
//     if (resource.selectedFields && resource.selectedFields.length > 0) {
//       template += `  # Based on selected fields: ${resource.selectedFields.map((f: any) => f.path).join(', ')}\n`
//     }
//   }
  
//   return template
// }

/**
 * Generate comprehensive Helm resource template based on selected fields
 * @param resource - Kubernetes resource object with selected fields
 * @param templateName - Name of the template
 * @param includeHelmHelpers - Whether to include Helm helper functions (for save) or simple values (for preview)
 * @returns Generated YAML template string
 */
export const generateHelmResourceTemplate = (resource: any, templateName: string, includeHelmHelpers: boolean = true): string => {
  const chartName = templateName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  
  // Base structure
  const yamlStructure: any = {
    apiVersion: resource.apiVersion,
    kind: resource.kind,
    metadata: {
      name: includeHelmHelpers ? `{{ include "${chartName}.fullname" . }}` : `{{ .Values.${resource.kind.toLowerCase()}.name | default "${resource.kind.toLowerCase()}-instance" }}`,
      ...(includeHelmHelpers && {
        labels: `{{- include "${chartName}.labels" . | nindent 4 }}`
      })
    }
  }

  // Add selected fields to the structure
  if (resource.selectedFields && resource.selectedFields.length > 0) {
    resource.selectedFields.forEach((field: any) => {
      const pathParts = field.path.split('.')
      let current = yamlStructure
      
      // Navigate/create the nested structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i]
        if (!current[part]) {
          current[part] = {}
        }
        current = current[part]
      }
      
      // Set the final value
      const finalKey = pathParts[pathParts.length - 1]
      const helmPath = `${resource.kind.toLowerCase()}.${pathParts.slice(1).join('.')}`
      
      // Generate appropriate default value based on field type
      let defaultValue: any
      switch (field.type) {
        case 'string':
          defaultValue = field.example || `"example-${finalKey}"`
          break
        case 'number':
        case 'integer':
          defaultValue = field.example || (finalKey === 'replicas' ? 1 : 0)
          break
        case 'boolean':
          defaultValue = field.example !== undefined ? field.example : false
          break
        case 'array':
          defaultValue = field.example || []
          break
        case 'object':
          defaultValue = field.example || {}
          break
        default:
          defaultValue = field.example || `"${finalKey}-value"`
      }
      
      current[finalKey] = `{{ .Values.${helmPath} | default ${typeof defaultValue === 'string' && !defaultValue.startsWith('"') ? `"${defaultValue}"` : defaultValue} }}`
    })
  } else {
    // Fallback for resources without selected fields
    yamlStructure.spec = {
      [`# Add your ${resource.kind} specification here`]: null,
      [`# No fields selected for this ${resource.kind}`]: null
    }
  }

  // Add common Helm helpers for workload resources when saving
  if (includeHelmHelpers && ['Deployment', 'StatefulSet', 'DaemonSet'].includes(resource.kind)) {
    if (!yamlStructure.spec) yamlStructure.spec = {}
    if (!yamlStructure.spec.selector) {
      yamlStructure.spec.selector = {
        matchLabels: `{{- include "${chartName}.selectorLabels" . | nindent 6 }}`
      }
    }
    if (!yamlStructure.spec.template) {
      yamlStructure.spec.template = {
        metadata: {
          labels: `{{- include "${chartName}.selectorLabels" . | nindent 8 }}`
        },
        spec: {
          containers: [{
            name: '{{ .Chart.Name }}',
            image: `"{{ .Values.${resource.kind.toLowerCase()}.image.repository }}:{{ .Values.${resource.kind.toLowerCase()}.image.tag | default .Chart.AppVersion }}"`,
            imagePullPolicy: `{{ .Values.${resource.kind.toLowerCase()}.image.pullPolicy }}`
          }]
        }
      }
    }
  }

  return yaml.dump(yamlStructure, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"'
  })
}

// /**
//  * Generate clean YAML preview with simple placeholder values
//  * @param resource - Kubernetes resource object with selected fields
//  * @param templateName - Name of the template (unused for preview)
//  * @returns Clean YAML string with placeholder values
//  */
// export const generateResourceYamlPreview = (resource: any, templateName: string): string => {
//   // Base structure with clean values
//   const yamlStructure: any = {
//     apiVersion: resource.apiVersion,
//     kind: resource.kind,
//     metadata: {
//       name: 'x'
//     }
//   }

//   // Add selected fields to the structure with simple placeholder values
//   if (resource.selectedFields && resource.selectedFields.length > 0) {
//     resource.selectedFields.forEach((field: any) => {
//       const pathParts = field.path.split('.')
//       let current = yamlStructure
      
//       // Navigate/create the nested structure
//       for (let i = 0; i < pathParts.length - 1; i++) {
//         const part = pathParts[i]
//         if (!current[part]) {
//           current[part] = {}
//         }
//         current = current[part]
//       }
      
//       // Set the final value with simple placeholder
//       const finalKey = pathParts[pathParts.length - 1]
      
//       // Generate simple placeholder value based on field type
//       let placeholderValue: any
//       switch (field.type) {
//         case 'string':
//           placeholderValue = 'x'
//           break
//         case 'number':
//         case 'integer':
//           placeholderValue = 0
//           break
//         case 'boolean':
//           placeholderValue = false
//           break
//         case 'array':
//           placeholderValue = ['x']
//           break
//         case 'object':
//           placeholderValue = { key: 'x' }
//           break
//         default:
//           placeholderValue = 'x'
//       }
      
//       current[finalKey] = placeholderValue
//     })
//   } else {
//     // Fallback for resources without selected fields
//     yamlStructure.spec = {
//       '# No fields selected': 'Please select fields to see YAML structure'
//     }
//   }

//   return yaml.dump(yamlStructure, {
//     indent: 2,
//     lineWidth: -1,
//     noRefs: true,
//     quotingType: '"'
//   })
// }


/**
 * Dynamically extracts field paths by taking everything after the resource kind
 * This avoids any hard-coding and works with any Kubernetes API structure
 */
const extractFieldPathAfterKind = (fieldPath: string, resourceKind: string): string => {
  const pathParts = fieldPath.split('.')
  
  // Find the index where the resource kind appears
  const kindIndex = pathParts.findIndex(part => part === resourceKind)
  
  if (kindIndex === -1) {
    // If kind not found, return the original path (might be a direct field)
    return fieldPath
  }
  
  // Take everything after the kind
  const fieldsAfterKind = pathParts.slice(kindIndex + 1)
  
  // If nothing after kind, this was just the resource definition itself
  if (fieldsAfterKind.length === 0) {
    return ''
  }
  
  return fieldsAfterKind.join('.')
}

/**
 * Generate YAML preview for a resource with clean field paths
 * @param resource - Resource with selectedFields containing full schema paths
 * @param templateName - Name of the template (unused for preview)
 * @returns Clean YAML string with placeholder values
 */
export const generateResourceYamlPreview = (resource: any, templateName: string): string => {
  // Start with minimal base structure
  const yamlStructure: any = {
    apiVersion: resource.apiVersion,
    kind: resource.kind
  }

  // Add selected fields to the structure with simple placeholder values
  if (resource.selectedFields && resource.selectedFields.length > 0) {
    resource.selectedFields.forEach((field: any) => {
      // Extract field path after the resource kind - completely dynamic!
      const cleanPath = extractFieldPathAfterKind(field.path, resource.kind)
      
      // Skip if the cleaned path is empty (means it was just the resource definition itself)
      if (!cleanPath) {
        return
      }
      
      const pathParts = cleanPath.split('.')
      let current = yamlStructure
      
      // Navigate/create the nested structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i]
        if (!current[part]) {
          current[part] = {}
        }
        current = current[part]
      }
      
      // Set the final value with simple placeholder
      const finalKey = pathParts[pathParts.length - 1]
      
      // Generate simple placeholder value based on field type
      let placeholderValue: any
      switch (field.type) {
        case 'string':
          placeholderValue = 'x'
          break
        case 'number':
        case 'integer':
          placeholderValue = 0
          break
        case 'boolean':
          placeholderValue = false
          break
        case 'array':
          placeholderValue = ['x']
          break
        case 'object':
          placeholderValue = { key: 'x' }
          break
        default:
          placeholderValue = 'x'
      }
      
      current[finalKey] = placeholderValue
    })
  } else {
    // Fallback for resources without selected fields
    yamlStructure.metadata = {
      name: 'x'
    }
    yamlStructure.spec = {
      '# No fields selected': 'Please select fields to see YAML structure'
    }
  }

  return yaml.dump(yamlStructure, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"'
  })
}