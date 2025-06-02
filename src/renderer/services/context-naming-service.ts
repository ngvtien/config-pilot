import type { ContextData } from '@/shared/types/context-data'
import type { ContextNaming } from '@/shared/types/kubernetes'

export class ContextNamingService implements ContextNaming {
  generateResourceName(
    context: ContextData, 
    resourceType: string, 
    customName?: string
  ): string {
    if (customName) {
      return `${context.product}-${context.customer}-${context.environment}-${customName}`
    }
    
    const instanceSuffix = context.instance > 0 ? `-${context.instance}` : ''
    const typeSuffix = resourceType.toLowerCase() !== 'deployment' ? `-${resourceType.toLowerCase()}` : ''
    
    return `${context.product}-${context.customer}-${context.environment}${instanceSuffix}${typeSuffix}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  generateNamespace(context: ContextData): string {
    return `${context.customer}-${context.environment}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  generateLabels(context: ContextData): Record<string, string> {
    return {
      'app.kubernetes.io/name': context.product,
      'app.kubernetes.io/instance': context.instance.toString(),
      'app.kubernetes.io/version': context.version,
      'app.kubernetes.io/managed-by': 'configpilot',
      'configpilot.io/customer': context.customer,
      'configpilot.io/environment': context.environment,
      'configpilot.io/product': context.product
    }
  }

  generateFilePath(context: ContextData, resourceType: string): string {
    return `k8s-resources/${context.product}/${context.customer}/${context.environment}/${context.instance}/${resourceType.toLowerCase()}.yaml`
  }

  validateNaming(name: string, context: ContextData): boolean {
    // Kubernetes naming validation
    const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/
    if (!k8sNameRegex.test(name)) return false
    
    // Length validation (max 253 characters for most resources)
    if (name.length > 253) return false
    
    // Context consistency validation
    const expectedPrefix = `${context.product}-${context.customer}-${context.environment}`
    return name.startsWith(expectedPrefix.toLowerCase())
  }

  interpolatePattern(pattern: string, context: ContextData): string {
    return pattern
      .replace(/{product}/g, context.product)
      .replace(/{customer}/g, context.customer)
      .replace(/{environment}/g, context.environment)
      .replace(/{instance}/g, context.instance.toString())
      .replace(/{version}/g, context.version)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }
}

export const contextNamingService = new ContextNamingService()