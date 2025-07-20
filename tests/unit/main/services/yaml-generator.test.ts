import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YamlGenerator } from '../../../../src/main/services/yaml-generator';
import { TemplateMetadata } from '../../../../src/shared/types/template-metadata';
import * as yaml from 'js-yaml';

// Mock js-yaml
vi.mock('js-yaml', () => ({
  dump: vi.fn((obj) => `# YAML content for: ${JSON.stringify(obj, null, 2)}`)
}));

describe('YamlGenerator', () => {
  let yamlGenerator: YamlGenerator;
  let mockTemplate: TemplateMetadata;

  beforeEach(() => {
    yamlGenerator = new YamlGenerator();
    
    // Create a comprehensive mock template based on our simple-nginx example
    mockTemplate = {
      metadata: {
        name: 'simple-nginx',
        version: '1.0.0',
        description: 'A simple nginx deployment template',
        category: 'web',
        tags: ['nginx', 'web', 'deployment']
      },
      parameters: {
        replicaCount: {
          type: 'number',
          default: 1,
          description: 'Number of replicas'
        },
        image: {
          type: 'object',
          properties: {
            repository: {
              type: 'string',
              default: 'nginx',
              description: 'Image repository'
            },
            tag: {
              type: 'string',
              default: 'latest',
              description: 'Image tag'
            }
          }
        }
      },
      resources: {
        deployment: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'nginx-deployment'
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: 'nginx'
              }
            },
            template: {
              metadata: {
                labels: {
                  app: 'nginx'
                }
              },
              spec: {
                containers: [{
                  name: 'nginx',
                  image: 'nginx:latest',
                  ports: [{
                    containerPort: 80
                  }]
                }]
              }
            }
          }
        }
      },
      generation: {
        helm: {
          enabled: true,
          chartName: 'simple-nginx',
          chartVersion: '0.1.0'
        },
        kustomize: {
          enabled: false
        }
      }
    };
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('generateYaml', () => {
    /**
     * Test basic YAML generation from template resources
     */
    it('should generate YAML files for all resources', () => {
      const result = yamlGenerator.generateYaml(mockTemplate);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(1);
      expect(result.has('deployment.yaml')).toBe(true);
      
      const deploymentYaml = result.get('deployment.yaml');
      expect(deploymentYaml).toBeDefined();
      expect(yaml.dump).toHaveBeenCalledWith(mockTemplate.resources.deployment, { indent: 2 });
    });

    /**
     * Test handling of multiple resources
     */
    it('should generate separate YAML files for multiple resources', () => {
      // Add a service resource to the template
      mockTemplate.resources.service = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'nginx-service'
        },
        spec: {
          selector: {
            app: 'nginx'
          },
          ports: [{
            port: 80,
            targetPort: 80
          }]
        }
      };
      
      const result = yamlGenerator.generateYaml(mockTemplate);
      
      expect(result.size).toBe(2);
      expect(result.has('deployment.yaml')).toBe(true);
      expect(result.has('service.yaml')).toBe(true);
      expect(yaml.dump).toHaveBeenCalledTimes(2);
    });

    /**
     * Test handling of empty resources
     */
    it('should handle template with no resources', () => {
      mockTemplate.resources = {};
      
      const result = yamlGenerator.generateYaml(mockTemplate);
      
      expect(result.size).toBe(0);
      expect(yaml.dump).not.toHaveBeenCalled();
    });
  });

  describe('generateHelmChart', () => {
    /**
     * Test Helm chart generation when enabled
     */
    it('should generate complete Helm chart structure when enabled', () => {
      const result = yamlGenerator.generateHelmChart(mockTemplate);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3); // Chart.yaml, values.yaml, templates/deployment.yaml
      
      // Check Chart.yaml
      expect(result.has('Chart.yaml')).toBe(true);
      const chartYaml = result.get('Chart.yaml');
      expect(chartYaml).toBeDefined();
      
      // Check values.yaml
      expect(result.has('values.yaml')).toBe(true);
      const valuesYaml = result.get('values.yaml');
      expect(valuesYaml).toBeDefined();
      
      // Check templates/deployment.yaml
      expect(result.has('templates/deployment.yaml')).toBe(true);
      const templateYaml = result.get('templates/deployment.yaml');
      expect(templateYaml).toBeDefined();
      
      expect(yaml.dump).toHaveBeenCalledTimes(3);
    });

    /**
     * Test Chart.yaml generation with correct metadata
     */
    it('should generate Chart.yaml with correct metadata', () => {
      yamlGenerator.generateHelmChart(mockTemplate);
      
      // Verify Chart.yaml was generated with correct structure
      expect(yaml.dump).toHaveBeenCalledWith({
        apiVersion: 'v2',
        name: 'simple-nginx',
        version: '0.1.0',
        description: 'A simple nginx deployment template'
      });
    });

    /**
     * Test values.yaml generation with parameter defaults
     */
    it('should generate values.yaml with parameter defaults', () => {
      yamlGenerator.generateHelmChart(mockTemplate);
      
      // Check that values.yaml includes parameter defaults
      const expectedValues = {
        replicaCount: 1,
        image: {
          repository: 'nginx',
          tag: 'latest'
        }
      };
      
      // Check the second call (values.yaml) specifically
      expect(yaml.dump).toHaveBeenNthCalledWith(2, expectedValues);
    });

    /**
     * Test handling when Helm is disabled
     */
    it('should return empty map when Helm generation is disabled', () => {
      mockTemplate.generation.helm.enabled = false;
      
      const result = yamlGenerator.generateHelmChart(mockTemplate);
      
      expect(result.size).toBe(0);
      expect(yaml.dump).not.toHaveBeenCalled();
    });

    /**
     * Test handling when Helm configuration is missing
     */
    it('should return empty map when Helm configuration is missing', () => {
      delete mockTemplate.generation.helm;
      
      const result = yamlGenerator.generateHelmChart(mockTemplate);
      
      expect(result.size).toBe(0);
      expect(yaml.dump).not.toHaveBeenCalled();
    });
  });

  describe('extractValues', () => {
    /**
     * Test extraction of flat parameter values
     */
    it('should extract flat parameter defaults', () => {
      // Access private method for testing
      const extractValues = (yamlGenerator as any).extractValues.bind(yamlGenerator);
      
      const simpleTemplate = {
        ...mockTemplate,
        parameters: {
          replicaCount: {
            type: 'number',
            default: 3
          },
          serviceName: {
            type: 'string',
            default: 'my-service'
          }
        }
      };
      
      const result = extractValues(simpleTemplate);
      
      expect(result).toEqual({
        replicaCount: 3,
        serviceName: 'my-service'
      });
    });

    /**
     * Test extraction of nested parameter values
     */
    it('should extract nested parameter defaults', () => {
      const extractValues = (yamlGenerator as any).extractValues.bind(yamlGenerator);
      
      const result = extractValues(mockTemplate);
      
      expect(result).toEqual({
        replicaCount: 1,
        image: {
          repository: 'nginx',
          tag: 'latest'
        }
      });
    });

    /**
     * Test handling parameters without defaults
     */
    it('should skip parameters without default values', () => {
      const extractValues = (yamlGenerator as any).extractValues.bind(yamlGenerator);
      
      const templateWithoutDefaults = {
        ...mockTemplate,
        parameters: {
          replicaCount: {
            type: 'number',
            default: 1
          },
          requiredParam: {
            type: 'string',
            description: 'Required parameter without default'
          }
        }
      };
      
      const result = extractValues(templateWithoutDefaults);
      
      expect(result).toEqual({
        replicaCount: 1
      });
      expect(result.hasOwnProperty('requiredParam')).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    /**
     * Test complete workflow with resolved template
     */
    it('should handle complete template resolution workflow', () => {
      // Simulate a resolved template with actual values
      const resolvedTemplate = {
        ...mockTemplate,
        resources: {
          deployment: {
            ...mockTemplate.resources.deployment,
            spec: {
              ...mockTemplate.resources.deployment.spec,
              replicas: 3,
              template: {
                ...mockTemplate.resources.deployment.spec.template,
                spec: {
                  containers: [{
                    name: 'nginx',
                    image: 'custom-nginx:v1.0',
                    ports: [{ containerPort: 80 }]
                  }]
                }
              }
            }
          }
        }
      };
      
      const yamlResult = yamlGenerator.generateYaml(resolvedTemplate);
      const helmResult = yamlGenerator.generateHelmChart(resolvedTemplate);
      
      expect(yamlResult.size).toBe(1);
      expect(helmResult.size).toBe(3);
      expect(yaml.dump).toHaveBeenCalledTimes(4); // 1 for YAML + 3 for Helm
    });
  });
});