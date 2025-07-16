import { TemplateMetadata } from '../../shared/types/template-metadata';

/**
 * Template engine that resolves {{.path.to.value}} placeholders
 */
export class TemplateEngine {
  /**
   * Resolve template placeholders with actual values
   * @param template - Template metadata with placeholders
   * @param parameters - User-provided parameter values
   * @returns Resolved template with actual values
   */
  resolveTemplate(template: TemplateMetadata, parameters: Record<string, any>): TemplateMetadata {
    const context = {
      metadata: template.metadata,
      parameters: { ...this.getDefaultParameters(template), ...parameters }
    };
    
    return this.deepResolve(template, context) as TemplateMetadata;
  }

  /**
   * Extract default parameter values from template, including nested properties
   */
  private getDefaultParameters(template: TemplateMetadata): Record<string, any> {
    const defaults: Record<string, any> = {};
    
    for (const [key, param] of Object.entries(template.parameters)) {
      if (param.default !== undefined) {
        defaults[key] = param.default;
      } else if (param.type === 'object' && param.properties) {
        // Handle nested object properties
        const nestedDefaults: Record<string, any> = {};
        for (const [propKey, propDef] of Object.entries(param.properties)) {
          if (propDef.default !== undefined) {
            nestedDefaults[propKey] = propDef.default;
          }
        }
        if (Object.keys(nestedDefaults).length > 0) {
          defaults[key] = nestedDefaults;
        }
      }
    }
    
    return defaults;
  }

  /**
   * Recursively resolve template placeholders
   */
  private deepResolve(obj: any, context: any): any {
    if (typeof obj === 'string') {
      return this.resolvePlaceholders(obj, context);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepResolve(item, context));
    }
    
    if (obj && typeof obj === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.deepResolve(value, context);
      }
      return resolved;
    }
    
    return obj;
  }

  /**
   * Replace {{.path.to.value}} with actual values
   * Preserves original data types when entire string is a single placeholder
   */
  private resolvePlaceholders(template: string, context: any): any {
    // Check if the entire string is a single placeholder
    const singlePlaceholderMatch = template.match(/^\{\{\.([\w.]+)\}\}$/);
    if (singlePlaceholderMatch) {
      const path = singlePlaceholderMatch[1];
      const value = this.getNestedValue(context, path);
      return value !== undefined ? value : template;
    }
    
    // Handle multiple placeholders or mixed content (return as string)
    return template.replace(/\{\{\.([\w.]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested object value by dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}