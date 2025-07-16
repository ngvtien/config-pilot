# Preload Templates - Product Requirements Document (PRD)

## Overview

This document outlines the requirements for implementing a **parseable template system** that generates complete Kubernetes application templates including Helm charts and Kustomize configurations from a single `metadata.json` source of truth.

## Objectives

### Primary Goals
1. **Single Source of Truth**: Each `metadata.json` contains ALL information needed to generate complete template structures
2. **Parseable Resources**: Use structured, parseable format instead of hardcoded YAML strings
3. **Multi-Format Generation**: Generate both Helm charts and Kustomize configurations from the same source
4. **Template Extensibility**: Enable template inheritance and composition
5. **Minimal Maintenance**: Reduce hardcoded content and maximize reusability

### Secondary Goals
- Template categorization (web, worker, database, infrastructure)
- Form-based UI integration (can be hardcoded in base templates)
- Team-based access control (future consideration)

## Core Architecture

### Parseable `metadata.json` Structure

Each template is defined by a single `metadata.json` file with the following structure:

```json
{
  "metadata": {
    "name": "template-name",
    "version": "1.0.0",
    "description": "Template description",
    "category": "web|worker|database|infrastructure",
    "tags": ["aspnet", "api", "microservice"]
  },
  "parameters": {
    "parameterName": {
      "type": "string|number|boolean|object|array",
      "default": "default-value",
      "description": "Parameter description",
      "required": true,
      "validation": {
        "pattern": "regex-pattern",
        "min": 1,
        "max": 100
      }
    }
  },
  "resources": {
    "resourceName": {
      "apiVersion": "apps/v1",
      "kind": "Deployment",
      "metadata": {
        "name": "{{.metadata.name}}"
      },
      "spec": {
        "replicas": "{{.parameters.replicaCount}}",
        "selector": {
          "matchLabels": {
            "app": "{{.metadata.name}}"
          }
        }
      }
    }
  },
  "generation": {
    "helm": {
      "enabled": true,
      "chartName": "{{.metadata.name}}",
      "chartVersion": "{{.metadata.version}}",
      "dependencies": []
    },
    "kustomize": {
      "enabled": true,
      "baseDir": "base",
      "overlays": ["dev", "staging", "prod"]
    }
  },
  "inheritance": {
    "extends": "base-template-name",
    "overrides": {
      "resources": {
        "deployment": {
          "spec": {
            "template": {
              "spec": {
                "containers": [{
                  "name": "{{.metadata.name}}",
                  "image": "{{.parameters.image.repository}}:{{.parameters.image.tag}}"
                }]
              }
            }
          }
        }
      }
    }
  }
}
```

## Template Engine Integration

Templating Syntax : Uses {{.path.to.value}} format compatible with:

- Handlebars
- Go templates
- Mustache
- Custom template engines
Parameter Resolution :

- {{.metadata.name}} - Template metadata
- {{.parameters.paramName}} - User-defined parameters
- {{.generation.helm.chartName}} - Generation configuration
## Directory Structure

```plaintext
templates/
├── web/
│   ├── aspnet-webapi/
│   │   ├── metadata.json          # Complete template definition
│   │   └── README.md              # Generated documentation
│   ├── nodejs-express/
│   │   ├── metadata.json
│   │   └── README.md
│   └── react-spa/
│       ├── metadata.json
│       └── README.md
├── worker/
│   ├── background-service/
│   │   ├── metadata.json
│   │   └── README.md
│   └── message-processor/
│       ├── metadata.json
│       └── README.md
├── database/
│   ├── postgresql/
│   │   ├── metadata.json
│   │   └── README.md
│   └── redis/
│       ├── metadata.json
│       └── README.md
└── infrastructure/
    ├── ingress-nginx/
    │   ├── metadata.json
    │   └── README.md
    └── cert-manager/
        ├── metadata.json
        └── README.md
```
## Generation Process
### Template Generator Service

The TemplateGeneratorService processes metadata.json files to generate:

1. Helm Chart Structure :
   
   ```
   generated/
   ├── Chart.yaml              # From metadata + generation.helm
   ├── values.yaml             # From parameters with defaults
   ├── values.schema.json      # From parameters validation
   └── templates/
       ├── deployment.yaml     # From resources.deployment
       ├── service.yaml        # From resources.service
       └── _helpers.tpl        # Generated helpers
   ```
2. Kustomize Structure :
   
   ```
   generated/
   ├── base/
   │   ├── kustomization.yaml  # Resource list
   │   ├── deployment.yaml     # From resources.deployment
   │   └── service.yaml        # From resources.service
   └── overlays/
       ├── dev/
       │   └── kustomization.yaml
       ├── staging/
       │   └── kustomization.yaml
       └── prod/
           └── kustomization.yaml
   ```
3. Documentation :
   
   - README.md with usage instructions
   - Parameter documentation
   - Example configurations
### Template Inheritance
Base Template Extension :
Base Template Extension :

```json
{
  "inheritance": {
    "extends": "base-web-service",
    "overrides": {
      "parameters": {
        "additionalParam": {
          "type": "string",
          "default": "value"
        }
      },
      "resources": {
        "deployment": {
          "spec": {
            "template": {
              "spec": {
                "containers": [{
                  "env": [
                    {
                      "name": "CUSTOM_ENV",
                      "value": "{{.parameters.additionalParam}}"
                    }
                  ]
                }]
              }
            }
          }
        }
      }
    }
  }
}
```
## Implementation Plan
### Phase 1: Core Template Engine
1. Template Parser : Read and validate metadata.json
2. Parameter Resolver : Process {{.path.to.value}} syntax
3. Resource Generator : Convert parseable resources to YAML
4. Basic Helm Generation : Chart.yaml, values.yaml, templates/
### Phase 2: Advanced Features
1. Kustomize Generation : Base and overlay structures
2. Template Inheritance : Extend and override capabilities
3. Validation Engine : JSON Schema validation for parameters
4. Documentation Generator : Auto-generate README files
### Phase 3: Integration
1. UI Integration : Form generation from parameters
2. Template Catalog : Browse and search templates
3. Multi-Template Applications : Compose multiple templates
4. Version Management : Template versioning and updates
## Example: ASP.NET Web API Template
```json
{
  "metadata": {
    "name": "aspnet-webapi",
    "version": "1.0.0",
    "description": "ASP.NET Core Web API with standard configuration",
    "category": "web",
    "tags": ["aspnet", "api", "dotnet"]
  },
  "parameters": {
    "replicaCount": {
      "type": "number",
      "default": 1,
      "description": "Number of pod replicas",
      "validation": { "min": 1, "max": 10 }
    },
    "image": {
      "type": "object",
      "properties": {
        "repository": { "type": "string", "default": "myregistry/
        aspnet-webapi" },
        "tag": { "type": "string", "default": "latest" },
        "pullPolicy": { "type": "string", "default": "IfNotPresent" }
      }
    },
    "service": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "default": "ClusterIP" },
        "port": { "type": "number", "default": 80 }
      }
    },
    "appSettings": {
      "type": "object",
      "properties": {
        "ASPNETCORE_ENVIRONMENT": { "type": "string", "default": 
        "Production" },
        "ASPNETCORE_URLS": { "type": "string", "default": "http://+:80" }
      }
    }
  },
  "resources": {
    "deployment": {
      "apiVersion": "apps/v1",
      "kind": "Deployment",
      "metadata": {
        "name": "{{.metadata.name}}",
        "labels": {
          "app": "{{.metadata.name}}",
          "version": "{{.metadata.version}}"
        }
      },
      "spec": {
        "replicas": "{{.parameters.replicaCount}}",
        "selector": {
          "matchLabels": {
            "app": "{{.metadata.name}}"
          }
        },
        "template": {
          "metadata": {
            "labels": {
              "app": "{{.metadata.name}}"
            }
          },
          "spec": {
            "containers": [{
              "name": "{{.metadata.name}}",
              "image": "{{.parameters.image.repository}}:{{.parameters.image.
              tag}}",
              "imagePullPolicy": "{{.parameters.image.pullPolicy}}",
              "ports": [{
                "containerPort": 80,
                "protocol": "TCP"
              }],
              "env": [
                {
                  "name": "ASPNETCORE_ENVIRONMENT",
                  "value": "{{.parameters.appSettings.ASPNETCORE_ENVIRONMENT}}
                  "
                },
                {
                  "name": "ASPNETCORE_URLS",
                  "value": "{{.parameters.appSettings.ASPNETCORE_URLS}}"
                }
              ],
              "livenessProbe": {
                "httpGet": {
                  "path": "/health",
                  "port": 80
                },
                "initialDelaySeconds": 30,
                "periodSeconds": 10
              },
              "readinessProbe": {
                "httpGet": {
                  "path": "/health/ready",
                  "port": 80
                },
                "initialDelaySeconds": 5,
                "periodSeconds": 5
              }
            }]
          }
        }
      }
    },
    "service": {
      "apiVersion": "v1",
      "kind": "Service",
      "metadata": {
        "name": "{{.metadata.name}}-service",
        "labels": {
          "app": "{{.metadata.name}}"
        }
      },
      "spec": {
        "type": "{{.parameters.service.type}}",
        "ports": [{
          "port": "{{.parameters.service.port}}",
          "targetPort": 80,
          "protocol": "TCP"
        }],
        "selector": {
          "app": "{{.metadata.name}}"
        }
      }
    }
  },
  "generation": {
    "helm": {
      "enabled": true,
      "chartName": "{{.metadata.name}}",
      "chartVersion": "{{.metadata.version}}",
      "appVersion": "{{.metadata.version}}",
      "description": "{{.metadata.description}}",
      "keywords": "{{.metadata.tags}}"
    },
    "kustomize": {
      "enabled": true,
      "baseDir": "base",
      "overlays": ["dev", "staging", "prod"]
    }
  }
}
```
## Benefits
### 🎯 Parseable Resources
- Type Safety : Structured objects instead of strings
- Validation : Can validate resource structure
- Extensibility : Easy to extend and override
- Multi-Format : Generate Helm and Kustomize from same source
### 🔧 Template Engine Integration
- Familiar Syntax : Standard {{.path}} templating
- Parameter Substitution : Type-safe parameter resolution
- Conditional Logic : Support for template conditionals
- Tool Compatibility : Works with existing template engines
### 🛠️ Maintenance Benefits
- Single Source : One file defines everything
- No Hardcoding : Eliminate scattered YAML files
- Inheritance : Extend templates without duplication
- Consistency : Standardized structure across all templates
### 📈 Scalability
- 50-70 Templates : Designed for large template catalogs
- Team Separation : Clear ownership boundaries
- Version Control : Git-friendly single-file approach
- Automated Generation : Reduce manual maintenance
## Quality Requirements
- Validation : JSON Schema validation for all metadata.json files
- Testing : Unit tests for template generation logic
- Documentation : Auto-generated README files for each template
- Performance : Sub-second generation for individual templates
- Reliability : Fail-fast validation with clear error messages
## Delivery Artifacts
1. Template Generator Service ( src/main/services/template-generator.ts )
2. Template Parser ( src/main/services/template-parser.ts )
3. Parameter Resolver ( src/main/services/parameter-resolver.ts )
4. Helm Generator ( src/main/services/helm-generator.ts )
5. Kustomize Generator ( src/main/services/kustomize-generator.ts )
6. Template Inheritance Engine ( src/main/services/template-inheritance.ts )
7. Validation Schemas ( src/shared/schemas/template-metadata.schema.json )
8. Example Templates ( templates/ directory with sample templates)
9. Unit Tests ( tests/unit/template-generation/ )
10. Integration Tests ( tests/integration/template-generation/ )
11. Documentation (Updated PRD and implementation guides)
## Future Considerations
- Secret Management : Integration with Kubernetes secrets and external secret stores
- Multi-Environment Support : Environment-specific parameter overrides
- Custom Resource Definitions (CRDs) : Support for custom Kubernetes resources
- CI/CD Integration : Tekton pipeline templates and ArgoCD application definitions
- Template Marketplace : Community-contributed templates
- Visual Template Designer : Drag-and-drop template composition