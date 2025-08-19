# 📝 Product Requirements Document (PRD): Product Git Integration - Metadata Focus

## 1. **Purpose**

To establish a GitOps structure focused on **product metadata management** - specifically product components, Helm charts, and Kubernetes manifests - completely separated from environment/customer deployment workflows.

---

## 2. **Goals**

* Restructure Git repositories to focus on **product components and their charts**
* Separate product metadata from deployment concerns (environments, customers, instances)
* Support Helm chart management per product component
* Enable version control for Kubernetes manifests and Helm templates
* Provide clear component-to-chart mapping
* Support future extensibility as products and components evolve

---

## 3. **Updated Folder Structure Specification**

### 3.1. **Product Repository Structure**

```plaintext
product-name.gitops-repo/
├── metadata.json                    # Product metadata and component registry
├── components/
│   ├── {component-name}/           # e.g., cai-api
│   │   ├── metadata.json           # Component-specific metadata
│   │   ├── README.md               # Component documentation
│   │   └── helm-chart/
│   │       ├── Chart.yaml          # Helm chart metadata
│   │       ├── values.yaml         # Default values
│   │       ├── values.schema.json  # JSON schema for values validation
│   │       └── templates/
│   └── {component-name}/           # e.g., cai-database
│       ├── metadata.json           # Component-specific metadata
│       ├── README.md
│       └── helm-chart/
└── README.md                       # Product documentation
```

### 3.2. **Product Metadata Schema**

```json
{
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "product": {
    "name": "cai",
    "displayName": "Customer Analytics Intelligence",
    "description": "Customer analytics and intelligence platform",
    "version": "1.0.0",
    "owner": "Product Team",
    "repository": {
      "url": "https://git.company.com/products/cai.git",
      "branch": "main"
    }
  },
  "components": [
    {
      "name": "cai-api",
      "displayName": "CAI API Service",
      "description": "REST API for customer analytics",
      "type": "service",
      "chartPath": "components/cai-api/helm-chart",
      "version": "1.0.0"
    },
    {
      "name": "cai-database",
      "displayName": "CAI Database",
      "description": "PostgreSQL database for analytics data",
      "type": "database",
      "chartPath": "components/cai-database/helm-chart",
      "version": "1.0.0"
    }
  ],
  "metadata": {
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "tags": ["analytics", "customer-intelligence"],
    "category": "data-platform"
  }
}
```

### 3.3. **Example: CAI Product Structure**

```plaintext
cai.gitops-repo/
├── metadata.json
├── components/
│   ├── cai-api/
│   │   └── helm-chart/
│   │       ├── Chart.yaml
│   │       ├── values.yaml
│   │       ├── values.schema.json
│   │       └── templates/
│   │           ├── _helpers.tpl
│   │           ├── deployment.yaml
│   │           ├── service.yaml
│   │           └── ingress.yaml
│   ├── cai-database/
│   │   └── helm-chart/
│   │       ├── Chart.yaml
│   │       ├── values.yaml
│   │       └── templates/
│   ├── cai-frontend/
│   │   └── helm-chart/
│   ├── cai-backend/
│   │   └── helm-chart/
│   └── cai-extract-job/
│       └── helm-chart/
└── README.md
```

### 3.4. **Product-Component Metadata Schema**

```json
{
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "component": {
    "name": "cai-api",
    "displayName": "CAI API Service",
    "description": "REST API for customer analytics",
    "version": "1.2.3",
    "owner": "Backend Team",
    "type": "microservice",
    "runtime": "nodejs",
    "category": "api"
  },
  "dependencies": {
    "internal": ["cai-database", "cai-cache"],
    "external": ["redis", "postgresql"]
  },
  "deployment": {
    "helmChartPath": "helm-chart",
    "defaultNamespace": "cai-api",
    "resourceRequirements": {
      "cpu": "500m",
      "memory": "512Mi"
    }
  },
  "gitOps": {
    "environments": ["dev", "sit", "uat", "prod"],
    "defaultBranch": "main",
    "environmentBranches": {
      "dev": "develop",
      "sit": "release",
      "uat": "release",
      "prod": "main"
    }
  },
  "monitoring": {
    "healthEndpoint": "/health",
    "metricsEndpoint": "/metrics",
    "logLevel": "info"
  },
  "security": {
    "requiresAuthentication": true,
    "exposedPorts": [8080],
    "networkPolicies": ["allow-ingress", "allow-database"]
  },
  "metadata": {
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-12-20T15:30:00Z",
    "tags": ["api", "microservice", "nodejs"],
    "documentation": "README.md",
    "maintainers": [
      {
        "name": "John Doe",
        "email": "john.doe@company.com",
        "role": "lead"
      }
    ]
  }
}
```


---

## 4. **Product-Component Relationship Model**

### 4.1. **Core Concepts**

* **Product**: Logical grouping of related components (e.g., `cai`, `billing`, `user-management`)
* **Product Component**: Individual deployable unit with its own Helm chart (e.g., `cai-infra`, `cai-api`)
* **Helm Chart**: 1:1 mapping with Product Component
* **Git Repository**: 1:1 mapping with Product (contains all components for that product)

### 4.2. **Relationships**
```plaintext

Product (1) ──────── (m) Product Components
│                        │
│                        │
└── Git Repository       └── Helm Chart
(1:1)                (1:1)
```

### 4.3. **Component Metadata**

Each component should maintain:
- **Parent Reference**: Points back to the product name
- **Chart Version**: Semantic versioning for the Helm chart
- **Dependencies**: References to other components (if any)
- **Kubernetes Resources**: List of generated K8s manifests

---

## 5. **Chart Structure Standards**

### 5.1. **Required Files per Component Chart**

```plaintext
{component-name}/
├── Chart.yaml              # Helm chart metadata
├── values.yaml             # Default values
├── values.schema.json      # JSON schema for values validation
├── index.yaml              # Chart index (for Helm repository)
└── templates/
    ├── _helpers.tpl        # Template helpers
    ├── deployment.yaml     # Kubernetes Deployment
    ├── service.yaml        # Kubernetes Service (if applicable)
    ├── ingress.yaml        # Kubernetes Ingress (if applicable)
    └── namespace.yaml      # Kubernetes Namespace (if needed)
```

### 5.2. **Chart.yaml Template**

```yaml
apiVersion: v2
name: {component-name}
description: Helm chart for {component-name} component
type: application
version: 0.1.0
appVersion: "1.0.0"
maintainers:
  - name: {team-name}
    email: {team-email}
dependencies: []
keywords:
  - {product-name}
  - {component-category}
home: {repository-url}
sources:
  - {source-code-url}
```

### 5.3. **values.schema.json Template**

```json
{
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "type": "object",
  "properties": {
    "image": {
      "type": "object",
      "properties": {
        "repository": { "type": "string" },
        "tag": { "type": "string" },
        "pullPolicy": { "type": "string", "enum": ["Always", "IfNotPresent", "Never"] }
      },
      "required": ["repository", "tag"]
    },
    "service": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["ClusterIP", "NodePort", "LoadBalancer"] },
        "port": { "type": "integer", "minimum": 1, "maximum": 65535 }
      }
    }
  },
  "required": ["image"]
}
```

---

## 6. **Git Integration Workflow**

### 6.1. **Product Creation Workflow**

1. **Product Registration**
   - User creates product with Git repository association
   - System validates repository structure
   - System checks for `gitops/products/{product-name}/` structure

2. **Component Initialization**
   - User adds components to the product
   - System generates Helm chart scaffolding for each component
   - System commits initial chart structure to Git

3. **Chart Management**
   - User edits Helm templates and values
   - System validates chart syntax and schema
   - System commits changes with proper versioning

### 6.2. **Component Management Workflow**

1. **Add Component**
   - Generate chart directory structure
   - Create default templates based on component type
   - Initialize Chart.yaml with metadata
   - Commit to Git repository

2. **Edit Component**
   - Modify Helm templates or values
   - Validate changes against schema
   - Update chart version if needed
   - Commit changes with descriptive message

3. **Remove Component**
   - Archive component chart (don't delete)
   - Update product metadata
   - Commit removal with proper documentation

---

## 7. **UI Integration Points**

### 7.1. **Enhanced Product Management Page**

#### **Product Creation Dialog**
```plaintext
┌─────────────────────────────────────────────────────────────────┐
│ Create New Product                                              │
├─────────────────────────────────────────────────────────────────┤
│ Product Name: [CAI Platform                    ]                │
│ Internal Name: [cai                            ]                │
│ Owner:        [Platform Team                   ]                │
│ Category:     [Enterprise Application ▼]                        │
│                                                                 │
│ Git Repository Configuration:                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Repository URL: [ https://git.company.com/products/cai.git ]│ │
│ │ Branch: [main ▼]                              [Test Conn]   │ │
│ │                                                             │ │
│ │ GitOps Structure Validation:                                │ │
│ │ ✅ Repository accessible                                    │ │
│ │ ✅ gitops/products/ structure found                         │ │
│ │ ✅ Ready for component management                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Initial Components (Optional):                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑ Infrastructure (cai-infra)     ☑ API Service (cai-api)   │ │
│ │ ☑ Database (cai-database)        ☐ Frontend (cai-frontend) │ │
│ │ ☐ Backend (cai-backend)          ☐ Extract Job (cai-extract)│ │
│ │ ☐ Web API (cai-webapi)           ☐ SOAP Service (cai-soap)  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                    [Cancel] [Create Product]    │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2. **Enhanced Product Workspace Page**

#### **Component Management Panel**
```plaintext
┌─────────────────────────────────────────────────────────────────┐
│ Product: CAI Platform (cai)                   [Git: ✅ Synced]  │
├─────────────────────────────────────────────────────────────────┤
│ Repository: https://git.company.com/products/cai.git            │
│ Branch: main | Last Sync: 2 minutes ago                         │
│                                                                 │
│ Components (6):                               [+ Add Component] │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📦 cai-infra                                    v1.2.3      │ │
│ │ Infrastructure components and networking                    │ │
│ │ Chart Status: ✅ Valid | Templates: 4 | Last Modified: 1h   │ │
│ │ [Edit Chart] [View Templates] [Sync] [Version History]      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📦 cai-api                                      v2.1.0      │ │
│ │ REST API service for CAI platform                           │ │
│ │ Chart Status: ⚠️ Modified | Templates: 5 | Uncommitted      │ │
│ │ [Edit Chart] [Commit Changes] [Discard] [View Diff]         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📦 cai-database                                 v1.0.5      │ │
│ │ PostgreSQL database for CAI platform                        │ │
│ │ Chart Status: ✅ Valid | Templates: 3 | Last Modified: 2d   │ │
│ │ [Edit Chart] [View Templates] [Sync] [Dependencies]         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Sync All] [Commit All] [Git Status] [Repository Settings]      │
└─────────────────────────────────────────────────────────────────┘
```

#### **Component Chart Editor**
```plaintext
┌─────────────────────────────────────────────────────────────────┐
│ Edit Chart: cai-api (v2.1.0)                                    │
├─────────────────────────────────────────────────────────────────┤
│ Tabs: [Chart.yaml] [values.yaml] [Templates] [Schema] [Preview] │
│                                                                 │
│ Chart.yaml:                                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ apiVersion: v2                                              │ │
│ │ name: cai-api                                               │ │
│ │ description: REST API service for CAI platform              │ │
│ │ type: application                                           │ │
│ │ version: 2.1.0                                              │ │
│ │ appVersion: "2.1.0"                                         │ │
│ │ maintainers:                                                │ │
│ │   - name: Platform Team                                     │ │
│ │     email: platform@company.com                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Validation: ✅ Chart syntax valid | ✅ Schema compliant        │
│                                                                 │
│ [Save] [Validate] [Preview K8s] [Commit] [Cancel]               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. **Implementation Phases**

### **Phase 1: Core Git Integration (Week 1-2)**
1. **Repository Management**
   - Product-to-repository binding
   - Git connection validation
   - Branch management
   - GitOps structure validation

2. **Basic Component Management**
   - Component CRUD operations
   - Chart scaffolding generation
   - File system integration

### **Phase 2: Chart Management (Week 3-4)**
1. **Helm Chart Operations**
   - Chart editing interface
   - Template management
   - Values.yaml editing
   - Schema validation

2. **Git Operations**
   - Commit/push changes
   - Pull latest changes
   - Conflict resolution
   - Version management

### **Phase 3: Advanced Features (Week 5-6)**
1. **Chart Dependencies**
   - Inter-component dependencies
   - Dependency resolution
   - Update propagation

2. **Validation & Testing**
   - Helm chart linting
   - Template validation
   - Dry-run deployments
   - Chart testing

---

## 9. **Technical Requirements**

### 9.1. **Backend Services**
- **Git Service**: Repository operations, branch management
- **Helm Service**: Chart validation, template processing
- **File Service**: File system operations, content management
- **Validation Service**: Schema validation, chart linting

### 9.2. **Frontend Components**
- **Enhanced Repository Selector**: Repository selection and validation
- **Component Manager**: Component CRUD operations
- **Chart Editor**: Helm chart editing interface
- **Git Status Panel**: Git operations and status display

### 9.3. **Data Models**
```typescript
interface Product {
  id: string;
  name: string;
  internalName: string;
  owner: string;
  category: string;
  repository: GitRepository;
  components: ProductComponent[];
  createdAt: Date;
  updatedAt: Date;
}

interface ProductComponent {
  id: string;
  name: string;
  description: string;
  parentProduct: string;
  chartVersion: string;
  chartPath: string;
  templates: string[];
  dependencies: string[];
  status: ComponentStatus;
}

interface GitRepository {
  url: string;
  branch: string;
  credentials: GitCredentials;
  lastSync: Date;
  status: RepositoryStatus;
}
```

---

## 10. **Success Metrics**

- **Product Creation Time**: < 2 minutes from start to first component
- **Chart Validation**: Real-time validation with < 1 second response
- **Git Operations**: Commit/push operations complete within 10 seconds
- **Component Management**: Add/edit/remove components within 30 seconds
- **Repository Sync**: Full repository sync within 1 minute

---

## 11. **Future Considerations**

- **Multi-Repository Support**: Products spanning multiple repositories
- **Chart Marketplace**: Shared component charts across products
- **Automated Testing**: CI/CD integration for chart validation
- **Deployment Integration**: Direct deployment from charts to environments
- **Chart Versioning**: Advanced semantic versioning and release management

This updated PRD focuses purely on product metadata management, separating it cleanly from deployment concerns while providing a robust foundation for GitOps-based component management.
