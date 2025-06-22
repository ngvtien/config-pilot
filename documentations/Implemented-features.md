### 1. Resource Import & Schema Management (Partially Implemented)
- Import Kubernetes resources, metadata, and schemas
- Store resource definitions for template creation
### 2. Template Creation (Role: Template Creator)
- Define what resources are needed based on context:
  - Product : The application/service being deployed
  - Customer : Client-specific configurations
  - Environment : dev/sit/uat/prod
  - Instance : Multiple instances of same product
  - Version : Application version
- Create templates that generate appropriate Helm charts
### 3. Helm Chart Generation (Role: Template User)
- Take templates and generate specific Helm charts for {product}-{customer}-{environment}-{instance}
- Create Chart.yaml, templates, values.yaml, values.schema.json
- Customize settings and values for specific deployments
### 4. OCI Registry Push (Role: Template User/DevOps)
- Package Helm charts as .tgz
- Push to OCI registries (Quay, Harbor)
- Version management and tagging
### 5. Values Management & GitOps (Role: DevOps/Ops/Support)
- Update values.yaml for in-flight products
- Commit changes to Git repository
- ArgoCD syncs changes automatically (partially implemented)
## Role-Based Access Control (SoD):
- Developers : Limited to dev environment
- Template Creators : Can create/modify templates
- Template Users : Can generate charts for specific contexts
- DevOps/Ops/Support : Can update values for deployed instances
## Implementation Priority:
### Phase 1: Core Template System
1. Fix Template Edit Functionality
2. Redesign Generation Workflow :
   - Change from "Generate Values" to "Generate Helm Chart"
   - Add context inputs: product, customer, environment, instance, version
   - Generate complete Helm chart structure
### Phase 2: Helm Chart Generation
1. Chart.yaml Generation : Based on template metadata and context
2. Template Files : Generate Kubernetes resource templates
3. Values.yaml : Create structured values file
4. Values.schema.json : Generate JSON schema for validation
### Phase 3: OCI Integration
1. Helm Package Creation : Bundle charts as .tgz
2. OCI Registry Integration : Push to Quay/Harbor
3. Version Management : Handle chart versioning
### Phase 4: Enhanced GitOps
1. Values Update Interface : UI for updating deployed instance values
2. Git Integration : Commit changes to repository
3. ArgoCD Integration : Enhanced sync capabilities
### Phase 5: Role-Based Access
1. User Authentication : Role management system
2. Environment Access Control : Restrict based on user role
3. Action Permissions : Control who can create/update/deploy