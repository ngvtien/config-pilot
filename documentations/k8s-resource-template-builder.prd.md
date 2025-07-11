# 🧾 Product Requirements Document (PRD)

## 🧱 Project Name:

**Kubernetes Resource Template Builder**

---

## 1. 🧭 Objective

To provide a visual, multi-stage UI tool that helps platform engineers and DevOps teams:

* Interactively select only relevant fields from Kubernetes schemas (CRD or vanilla)
* Define metadata such as default values, titles, and descriptions
* Compose modular `values.schema.json` files
* Enable form-based value editing later (via tools like KubeApps, Backstage, or ConfigPilot)
* Abstract away from complex YAML, enforce SoD, and drive standardization

---

## 2. 🎯 Key Goals

* ✅ Support both CRDs and vanilla Kubernetes resources
* ✅ Present schema as interactive tree view
* ✅ Let users select a subset of meaningful fields
* ✅ Capture per-field metadata (title, description, default)
* ✅ Generate filtered JSON Schema (`values.schema.json`)
* ✅ Generate values.yaml scaffolds from selected schema
* ✅ Allow future editing via form-based UI

---

## 2.1 🏗️ System Architecture Overview

### Multi-Stage Template Builder Workflow

The system implements a **multi-stage K8s resource template builder** with the following workflow:

1. **Schema Presentation**: Present the original schema as a treeview
2. **Field Selection**: User selects interested properties and defines default values and titles
3. **Information Storage**: System stores this information for generating custom schema
4. **Resource Iteration**: Repeat steps 1-3 for other resources until finished
5. **Schema Generation**: System uses collected info to generate overall `values.schema.json`
6. **Template Output**: Generate Helm chart or Kustomize YAML files
7. **Form-Based Editing**: Later, consumers edit `values.yaml` via form-based interface using `values.schema.json`

### Data Model Relationships

The architecture follows these key relationships:

| Relationship | Cardinality | Description |
|--------------|-------------|-------------|
| **Template ↔ Resources** | `1:n` | One template contains multiple K8s resources |
| **Template ↔ Schema** | `1:1` | One template generates one `values.schema.json` |
| **Resource ↔ Selected Fields** | `1:m` | One resource has multiple selected fields |
| **Resource ↔ Filtered Schema** | `1:1` | One resource produces one filtered schema |
| **Selected Field ↔ Default Value** | `1:0..1` | Field may have optional default value |
| **Selected Field ↔ Title** | `1:0..1` | Field may have optional display title |
| **Selected Field ↔ Description** | `1:0..1` | Field may have optional description |
| **Selected Field ↔ Name** | `1:1` | Field must have a name |
| **Selected Field ↔ JSONPath** | `1:1` | Field must have a JSONPath reference |

### Benefits

This architecture enables:
- **Multiple Small Apps**: Generate multiple focused applications for K8s deployment
- **YAML Abstraction**: Abstract away from complex YAML jungle
- **Separation of Duties (SoD)**: Template authors vs. value editors
- **Standardization**: Consistent field selection and metadata across teams

---

## 3. 🧩 Components & Workflow

### 📌 3.1 Schema Ingestion

#### For CRDs:

* Use `kubectl get crd <name> -o json` to obtain schema
* Traverse `.spec.versions[x].schema.openAPIV3Schema`

#### For Vanilla K8s:

* Use `kubectl get --raw /openapi/v2` or pre-bundled OpenAPI definitions
* Parse using OpenAPI parser (v2/swagger JSON)

---

### 📌 3.2 Stage 1 – Schema Tree Rendering

#### Input:

* Full schema document (OpenAPI v2 or `openAPIV3Schema`)

#### Output:

* Tree view with checkbox/selectable fields
* Recursive traversal of `.properties`
* Display:

  * Field path (`spec.template.spec.containers[].image`)
  * Type (`string`, `array`, etc.)
  * Description (if present)

#### Rules:

* Skip non-editable fields (`status`)
* Allow filtering on scope (`spec`, `metadata.labels`, etc.)
* Support arrays, objects, and enums

---

### 📌 3.3 Stage 2 – Field Metadata Annotation

For each selected field, user can define:

| Property      | Description                         |
| ------------- | ----------------------------------- |
| `title`       | Display label for form rendering    |
| `description` | Help tooltip or field documentation |
| `default`     | Default value to show in forms      |
| `required`    | (Optional) Mark field as required   |

Store this as:

```json
{
  "field": "spec.replicas",
  "jsonPath": "$.spec.replicas",
  "type": "integer",
  "default": 1,
  "title": "Number of Replicas",
  "description": "How many pod replicas to run"
}
```

---

### 📌 3.4 Stage 3 – Per-Resource Filtered Schema Generation

Each resource (Deployment, Service, CRD, etc.) results in a **filtered JSON schema** that includes:

* Only the selected fields
* Structure maintained (i.e. nesting preserved)
* Injected metadata (`title`, `description`, `default`)
* Optional `required` fields list

---

### 📌 3.5 Stage 4 – Aggregated Template Composition

Combine per-resource filtered schemas into one unified schema file:

#### Example `values.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "deployment": { "$ref": "#/definitions/Deployment" },
    "service": { "$ref": "#/definitions/Service" }
  },
  "definitions": {
    "Deployment": { /* filtered schema */ },
    "Service": { /* filtered schema */ }
  }
}
```

---

### 📌 3.6 Stage 5 – values.yaml Scaffolding

Based on selected fields and defaults, generate a minimal working `values.yaml`:

```yaml
deployment:
  spec:
    replicas: 1
    template:
      spec:
        containers:
          - image: nginx:latest
```

---

### 📌 3.7 Stage 6 – Helm / Kustomize Integration

Support rendering templated YAML manifests via:

* **Helm**: use `.Values` path mapping from selected schema paths
* **Kustomize**: inject values via `patches`, `vars`, or `configMapGenerator`

---

## 4. 🔐 SoD + Governance Considerations

This architecture supports:

| Concern              | Support Strategy                                  |
| -------------------- | ------------------------------------------------- |
| Separation of Duties | Template authors define schema; users fill values |
| DRY principle        | Shared templates + schema can be reused per team  |
| RBAC                 | UI tools (ConfigPilot) can scope access per role  |
| Customization        | Per field title/default allows tailored UX        |

---

## 5. 📦 Data Model Overview

### For Each Selected Field:

| Property      | Notes                                 |
| ------------- | ------------------------------------- |
| `fieldPath`   | Dot path (`spec.replicas`)            |
| `jsonPath`    | JSONPath (`$.spec.replicas`)          |
| `name`        | Logical label or key (`replicaCount`) |
| `type`        | Inferred or from schema (`string`)    |
| `default`     | User-provided or schema-derived       |
| `title`       | UI field label                        |
| `description` | Tooltip/help text                     |
| `required`    | Boolean                               |

---

## 6. 🧪 Validation & Testing

### ✅ Acceptance Criteria

* [ ] Can parse both CRD and vanilla K8s schemas
* [ ] Tree view renders all fields properly
* [ ] Users can select fields and annotate metadata
* [ ] Filtered schema is structurally correct
* [ ] Aggregated `values.schema.json` compiles
* [ ] Helm templates render with values
* [ ] Form UI (later phase) honors schema and defaults

---

## 7. 🔮 Future Enhancements

* ✅ Drag-and-drop tree reordering
* ✅ Field grouping (form sections)
* ✅ Schema versioning and diff support
* ✅ Backstage/KubeApps live integration
* ✅ YAML → form UI reverse parsing (JSON Schema inference)
* ✅ GitOps integration (save schema + values into Git)

---

## 8. 🛠️ Suggested Implementation Stack

| Component        | Tech Choices                               |
| ---------------- | ------------------------------------------ |
| Schema parser    | `json-schema-ref-parser`, `swagger-parser` |
| Tree UI          | React + Material UI / Ant Design           |
| Data model store | LocalStorage or IndexedDB initially        |
| Values editor    | Monaco Editor / Custom Form                |
| Export logic     | JSON Schema + YAML emitter                 |

---

### ✅ Appendices

## A. 📘 Example 1 – Filtered JSON Schema (Per Resource)

### 📌 Resource: `Deployment`

#### Selected Fields

* `metadata.name`
* `spec.replicas`
* `spec.template.spec.containers[].image`

#### Resulting Filtered Schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Deployment Configuration",
  "type": "object",
  "properties": {
    "metadata": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "title": "Deployment Name",
          "description": "Unique name for this deployment"
        }
      },
      "required": ["name"]
    },
    "spec": {
      "type": "object",
      "properties": {
        "replicas": {
          "type": "integer",
          "default": 1,
          "title": "Replica Count",
          "description": "Number of pod replicas to run"
        },
        "template": {
          "type": "object",
          "properties": {
            "spec": {
              "type": "object",
              "properties": {
                "containers": {
                  "type": "array",
                  "title": "Containers",
                  "items": {
                    "type": "object",
                    "properties": {
                      "image": {
                        "type": "string",
                        "default": "nginx:latest",
                        "title": "Container Image",
                        "description": "Docker image to deploy"
                      }
                    },
                    "required": ["image"]
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "required": ["metadata", "spec"]
}
```

---

## B. 📘 Example 2 – Aggregated values.schema.json

### 📌 Resources:

* Deployment
* Service

#### Aggregated JSON Schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Application Configuration Schema",
  "properties": {
    "deployment": {
      "$ref": "#/definitions/DeploymentSchema"
    },
    "service": {
      "$ref": "#/definitions/ServiceSchema"
    }
  },
  "definitions": {
    "DeploymentSchema": {
      "type": "object",
      "properties": {
        "metadata": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "title": "Deployment Name"
            }
          },
          "required": ["name"]
        },
        "spec": {
          "type": "object",
          "properties": {
            "replicas": {
              "type": "integer",
              "default": 2,
              "title": "Replicas"
            }
          }
        }
      }
    },
    "ServiceSchema": {
      "type": "object",
      "properties": {
        "metadata": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "title": "Service Name"
            }
          },
          "required": ["name"]
        },
        "spec": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["ClusterIP", "NodePort", "LoadBalancer"],
              "title": "Service Type",
              "default": "ClusterIP"
            },
            "ports": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "port": {
                    "type": "integer",
                    "title": "Port"
                  }
                },
                "required": ["port"]
              }
            }
          }
        }
      }
    }
  }
}
```

---

## C. 📘 Example 3 – Generated values.yaml from Schema

```yaml
deployment:
  metadata:
    name: my-app
  spec:
    replicas: 2
    template:
      spec:
        containers:
        - image: nginx:latest

service:
  metadata:
    name: my-app-service
  spec:
    type: ClusterIP
    ports:
      - port: 80
```

---
