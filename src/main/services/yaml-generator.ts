import { TemplateMetadata } from '../../shared/types/template-metadata';
import * as yaml from 'js-yaml';

/**
 * Generate Kubernetes YAML from resolved templates
 */
export class YamlGenerator {
    /**
     * Generate Kubernetes YAML files from template
     * @param template - Resolved template metadata
     * @returns Map of filename to YAML content
     */
    generateYaml(template: TemplateMetadata): Map<string, string> {
        const files = new Map<string, string>();

        for (const [resourceName, resource] of Object.entries(template.resources)) {
            const filename = `${resourceName}.yaml`;
            const yamlContent = yaml.dump(resource, { indent: 2 });
            files.set(filename, yamlContent);
        }

        return files;
    }

    /**
     * Generate Helm chart structure
     */
    generateHelmChart(template: TemplateMetadata): Map<string, string> {
        const files = new Map<string, string>();

        if (template.generation.helm?.enabled) {
            // Chart.yaml
            const chartYaml = {
                apiVersion: 'v2',
                name: template.generation.helm.chartName,
                version: template.generation.helm.chartVersion,
                description: template.metadata.description
            };
            files.set('Chart.yaml', yaml.dump(chartYaml));

            // values.yaml
            const valuesYaml = this.extractValues(template);
            files.set('values.yaml', yaml.dump(valuesYaml));

            // templates/*.yaml
            const templateFiles = this.generateYaml(template);
            for (const [filename, content] of templateFiles) {
                files.set(`templates/${filename}`, content);
            }
        }

        return files;
    }

    /**
     * Generate Kustomize structure
     */
    generateKustomize(template: TemplateMetadata): Map<string, string> {
        const files = new Map<string, string>();

        if (template.generation.kustomize?.enabled) {
            // kustomization.yaml
            const kustomization = {
                apiVersion: 'kustomize.config.k8s.io/v1beta1',
                kind: 'Kustomization',
                resources: Object.keys(template.resources).map(name => `${name}.yaml`)
            };
            files.set('kustomization.yaml', yaml.dump(kustomization));

            // Individual resource files
            const resourceFiles = this.generateYaml(template);
            for (const [filename, content] of resourceFiles) {
                files.set(filename, content);
            }
        }

        return files;
    }

    /**
     * Extract parameter values for Helm values.yaml
     * Recursively builds nested parameter structure from parameter definitions
     */
    private extractValues(template: TemplateMetadata): Record<string, any> {
        const values: Record<string, any> = {};

        for (const [key, param] of Object.entries(template.parameters)) {
            if (param.default !== undefined) {
                values[key] = param.default;
            } else if (param.type === 'object' && param.properties) {
                // Handle nested object parameters
                const nestedValues = this.extractNestedValues(param.properties);
                if (Object.keys(nestedValues).length > 0) {
                    values[key] = nestedValues;
                }
            }
        }

        return values;
    }

    /**
     * Recursively extract values from nested parameter properties
     * @param properties - Parameter properties object
     * @returns Nested values object
     */
    private extractNestedValues(properties: Record<string, any>): Record<string, any> {
        const values: Record<string, any> = {};

        for (const [key, prop] of Object.entries(properties)) {
            if (prop.default !== undefined) {
                values[key] = prop.default;
            } else if (prop.type === 'object' && prop.properties) {
                // Recursively handle deeper nesting
                const nestedValues = this.extractNestedValues(prop.properties);
                if (Object.keys(nestedValues).length > 0) {
                    values[key] = nestedValues;
                }
            }
        }

        return values;
    }
}