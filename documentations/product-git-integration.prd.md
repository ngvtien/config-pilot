# 📝 Product Requirements Document (PRD): ArgoCD ApplicationSet GitOps Structure for Multi-Customer Products

## 1. **Purpose**

To standardize and simplify the structure of ArgoCD ApplicationSet resources for managing Helm-based deployments of multi-customer, multi-environment products — including UAT features like multiple instances — while supporting maintainable RBAC boundaries and minimizing coupling.

---

## 2. **Goals**

* Restructure Git repo to cleanly separate by `{product}/{env}/{customer}`.
* Support instance-based deployments (esp. for UAT).
* Generate ArgoCD `ApplicationSet` manifests based on a single `customers.yaml` matrix file per environment.
* Keep Helm `values.yaml` per instance/customer clean, isolated, and minimal.
* Maintain a consistent folder structure across environments.
* Ensure future extensibility as products evolve.

---

## 3. **Folder Structure Specification**

```plaintext
gitops/
├── product-x/
│   ├── uat/
│   │   ├── customers.yaml             # Defines matrix: customers + instances + optional overrides
│   │   ├── customer1/
│   │   │   └── instances/
│   │   │       └── 0/
│   │   │           └── values.yaml
│   │   ├── customer2/
│   │   │   └── instances/
│   │   │       ├── 0/
│   │   │       │   └── values.yaml
│   │   │       └── 1/
│   │   │           └── values.yaml
│   │   └── appset.yaml                # ArgoCD ApplicationSet targeting UAT
│   ├── prod/
│   │   ├── customers.yaml
│   │   ├── customer1/
│   │   │   └── instances/
│   │   │       └── 0/
│   │   │           └── values.yaml
│   │   └── appset.yaml                # ArgoCD ApplicationSet targeting PROD
```

### 3.1. **Folder Structure: UserData Temporary Storage**

```plaintext
{userData}/gitops/
├── product-x/
│   ├── uat/
│   │   ├── customers.yaml             # Defines matrix: customers + instances + optional overrides
│   │   ├── customer1/
│   │   │   └── instances/
│   │   │       └── 0/
│   │   │           └── values.yaml
│   │   ├── customer2/
│   │   │   └── instances/
│   │   │       ├── 0/
│   │   │       │   └── values.yaml
│   │   │       └── 1/
│   │   │           └── values.yaml
│   │   └── appset.yaml                # ArgoCD ApplicationSet targeting UAT
│   ├── prod/
│   │   ├── customers.yaml
│   │   ├── customer1/
│   │   │   └── instances/
│   │   │       └── 0/
│   │   │           └── values.yaml
│   │   └── appset.yaml                # ArgoCD ApplicationSet targeting PROD
```

---

## 4. **Matrix Input (`customers.yaml`)**

```yaml
customers:
  - name: customer1
    instances:
      - id: 0
        extraLabels:
          tier: alpha
  - name: customer2
    instances:
      - id: 0
      - id: 1
        extraLabels:
          tier: beta
```

This file drives the generation of `ApplicationSet` entries dynamically and ensures clarity on customer/instance mappings.

---

## 5. **ApplicationSet Template (Generated)**

Each `appset.yaml` should be generated from `customers.yaml` to produce one ArgoCD `ApplicationSet` per environment (UAT, PROD, etc.).

Example output structure for UAT:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: product-x-uat
spec:
  generators:
    - matrix:
        generators:
          - list:
              elements:
                - customer: customer1
                  instance: 0
                  labels: { tier: alpha }
                - customer: customer2
                  instance: 0
                  labels: {}
                - customer: customer2
                  instance: 1
                  labels: { tier: beta }
  template:
    metadata:
      name: '{{customer}}-uat-{{instance}}'
      labels:
        customer: '{{customer}}'
        instance: '{{instance}}'
        {{- if labels.tier }}
        tier: '{{labels.tier}}'
        {{- end }}
    spec:
      project: default
      source:
        repoURL: https://gitea.example.com/gitops/product-x
        targetRevision: HEAD
        path: 'product-x/uat/{{customer}}/instances/{{instance}}'
        helm:
          valueFiles:
            - values.yaml
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{customer}}-uat-{{instance}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

### 5.1 feed the **ApplicationSet matrix** using **Git directory structure** as input.

This is exactly what the `GitDirectoryGenerator` (or `GitFilesGenerator`) is designed for in Argo CD ApplicationSet.

---

### ✅ **GitDirectoryGenerator Recap**

You can configure `generators.git.directory` to recursively search folders in your Git repo and feed them into the ApplicationSet matrix.

For example, given a path like this:

```
gitops/product-x/uat/customer2/instances/1/values.yaml
```

You can use the **directory name(s)** (like `customer2`, `1`, etc.) as **matrix parameters** by templating them in your ApplicationSet.

---

### ✅ Example Matrix Using Git Path

```yaml
generators:
  - git:
      repoURL: https://gitea.local/my-org/gitops
      revision: HEAD
      directories:
        - path: product-x/uat/*/instances/*
```

This would expand into multiple values like:

```yaml
parameters:
  - customer: customer1
    instance: 0
  - customer: customer2
    instance: 0
  - customer: customer2
    instance: 1
```

Assuming your paths look like this:

```plaintext
product-x/uat/customer1/instances/0
product-x/uat/customer2/instances/0
product-x/uat/customer2/instances/1
```

Then, in your template, you can use:

```yaml
metadata:
  name: product-x-uat-{{customer}}-{{instance}}
spec:
  source:
    path: product-x/uat/{{customer}}/instances/{{instance}}
```

---

### 🧩 Bonus: Combine with `matrix`

If you want to mix values from **`customers.yaml`** (via `ListGenerator`) **and** file path (via `GitDirectoryGenerator`), you can do:

```yaml
generators:
  - matrix:
      generators:
        - git:
            directories:
              - path: product-x/uat/*/instances/*
        - list:
            elements:
              - version: "v1.2.3"
              - version: "v2.0.0"
```

Now, each combination of `{customer, instance}` with `version` becomes one Application.

---

### 5.2 Product Gitops relationship
- 1:1 Product : repo
- 1:1 environment : repo-branch
- 1:1 appset.yaml : envrionment
- 1:1 customers.yaml : envrionment

## 6. **RBAC Strategy**

With the folder structure rooted at:

```
{product}/{environment}/{customer}/instances/{id}
```

We can implement RBAC at:

```
{product}/{environment}
```

This supports environment-scoped team access (e.g., UAT vs PROD), while isolating customer data per folder. Additional tools like Gitea Teams or Bitbucket branch protections can enforce write restrictions accordingly.

---

## 7. **Automation Requirements**

A helper tool or script should:

* Read `customers.yaml`
* Generate `appset.yaml` dynamically
* Validate paths like `instances/{id}/values.yaml` exist
* Optionally warn if `values.yaml` is missing or incomplete

---

## 8. **UAT Specific Behavior**

* UAT is the only environment that supports multiple active `instances` per customer for comparison testing.
* Each instance is deployed as a separate ArgoCD Application.
* Other environments (e.g., PROD) should be restricted to `instance: 0`.

---

## 9. **Future Considerations**

* Product evolution (e.g., adding new components) can be handled by:

  * Creating additional `customers.yaml` variants per component if needed
  * Splitting infrastructure and application into separate folders/repos
* Helm schema validation can be added to enforce expected keys in `values.yaml`
* ConfigPilot (Electron UI) can support visual editing of `customers.yaml` and generation of `appset.yaml`

---

## 10. **Deliverables**

* 📁 Product tile in `product-management-page.tsx` Folder scaffolding per product/environment/customer/instance
* 📄 `customers.yaml` schema with examples and base on the list of available customers
* ⚙️ Product tile in `product-management-page.tsx` would need to auto-generate `appset.yaml`
* ✅ Linter to check missing or malformed `values.yaml`
* 🧪 Sample test deployment for product-x → customer1 → uat → instance 0

---

## Wireframe 1: Enhanced Repository Selector

```text
┌─────────────────────────────────────────────────────────────────┐
│ Edit Product Modal                                              │
├─────────────────────────────────────────────────────────────────┤
│ Display Name: [Product Name                    ]                │
│ Internal Name: [product-name                   ]                │
│ Owner:        [Team Alpha                      ]                │
│                                                                 │
│ Repository: *Enhanced Repository Selector*                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search repositories...                    [+ Add New]    │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ 📁 product-configs                    ✅ Authenticated │ │ │
│ │ │ https://gitlab.company.com/devops/configs               │ │ │
│ │ │ Default: main | Last sync: 2 mins ago                   │ │ │
│ │ │ [Test Connection] [Create Branch] [GitOps ✅]           │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ 📁 legacy-configs                     ❌ Auth Required │ │ │
│ │ │ https://github.com/company/legacy-configs               │ │ │
│ │ │ Default: master | Last sync: Never                      │ │ │
│ │ │ [Configure Auth] [Test Connection] [GitOps ❌]          │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Description: [Multi-line text area...                         ] │
│ Category:    [Backend Services          ▼]                      │
│                                                                 │
│                                    [Cancel] [Save Changes]      │
└─────────────────────────────────────────────────────────────────┘
```

### Wireframe 2: GitOps Structure Validator
```
┌─────────────────────────────────────────────────────────────────┐
│ GitOps Structure Validation                                     │
├─────────────────────────────────────────────────────────────────┤
│ Repository: product-configs                                     │
│ Branch: main                                                    │
│                                                                 │
│ ✅ Required Structure Found:                                    │
│ ├── ✅ gitops/                                                  │
│ │   ├── ✅ products/                                            │
│ │   │   ├── ✅ product-name/                                    │
│ │   │   │   ├── ✅ environments/                                │
│ │   │   │   │   ├── ✅ dev/                                     │
│ │   │   │   │   ├── ✅ staging/                                 │
│ │   │   │   │   └── ✅ prod/                                    │
│ │   │   │   └── ✅ customers.yaml                               │
│ │   │   └── ...                                                 │
│ │   └── applicationsets/                                        │
│ └── README.md                                                   │
│                                                                 │
│ 🎯 Validation Status: PASSED                                    │
│ 📝 Ready for GitOps deployment                                  │
│                                                                 │
│ ❌ Issues Found (if any):                                       │
│ • Missing customers.yaml in product-name/                       │
│ • Environment folder 'prod' not found                           │
│                                                                 │
│                              [Auto-Fix] [Manual Setup] [Skip]   │
└─────────────────────────────────────────────────────────────────┘
```

### Wireframe 3: Branch Management Dialog
```text
┌─────────────────────────────────────────────────────────────────┐
│ Create New Branch                                               │
├─────────────────────────────────────────────────────────────────┤
│ Repository: product-configs                                     │
│ Current Branch: main                                            │
│                                                                 │
│ Branch Type: ● Feature  ○ Environment  ○ Customer               │
│                                                                 │
│ Branch Name: [feature/enhanced-repository-mgmt]                 │
│              └─ Auto-generated based on type                    │
│                                                                 │
│ Base Branch: [main                              ▼]              │
│                                                                 │
│ Description: [Optional description for the branch...          ] │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔧 Advanced Options                                         │ │
│ │ ☑ Create pull request template                              │ │
│ │ ☑ Initialize with GitOps structure                          │ │
│ │ ☑ Set as default branch for this product                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 📋 Preview:                                                     │
│ • Branch: feature/enhanced-repository-mgmt                      │
│ • Will be created from: main                                    │
│ • GitOps structure will be validated                            │
│                                                                 │
│                                    [Cancel] [Create Branch]     │
└─────────────────────────────────────────────────────────────────┘
```

### Wireframe 4: Repository Registration Dialog (Enhanced)
```plaintext
┌─────────────────────────────────────────────────────────────────┐
│ Register New Repository                                         │
├─────────────────────────────────────────────────────────────────┤
│ Repository Name: [my-product-configs                          ] │
│ Repository URL:  [https://gitlab.company.com/devops/configs   ] │
│                  └─ 🔍 Auto-detect provider: GitLab             │
│                                                                 │
│ Authentication:                                                 │
│ ● Personal Access Token  ○ SSH Key  ○ OAuth                     │
│                                                                 │
│ Token/Credentials: [••••••••••••••••••••••] [Test Connection]   │
│                                                                 │
│ Default Branch: [main                       ▼] [Fetch Branches] │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🏗️ GitOps Setup                                             │ │
│ │ ☑ Initialize GitOps structure                               │ │
│ │ ☑ Create customers.yaml template                            │ │
│ │ ☑ Setup environment folders (dev, staging, prod)            │ │
│ │ ☐ Create sample ApplicationSet                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Description: [Optional repository description...              ] │
│                                                                 │
│ 🔍 Connection Status: ✅ Connected | 📊 3 branches found       │
│                                                                 │
│                                    [Cancel] [Register & Setup]  │
└─────────────────────────────────────────────────────────────────┘
```