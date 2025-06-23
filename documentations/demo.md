# ConfigPilot Demo Deployment Structures

# ============================
# Deployment Set 1: Vault + ESO
# ============================

# Folder Structure:
# └── demo-set-1-vault-eso/
#     ├── infra/
#     │   ├── external-secret.yaml
#     │   └── values-infra.yaml
#     └── app/
#         ├── values.yaml
#         └── helm-release.yaml

---
# demo-set-1-vault-eso/infra/external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: acme-cai-api-uat
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: db-secret
    creationPolicy: Owner
  data:
    - secretKey: db-password
      remoteRef:
        key: /secret/acme/cai-api-service/uat/db-password

---
# demo-set-1-vault-eso/infra/values-infra.yaml
externalSecrets:
  enabled: true
  secretStoreName: vault-backend
  secrets:
    - name: db-password
      key: /secret/acme/cai-api-service/uat/db-password

---
# demo-set-1-vault-eso/app/values.yaml
context:
  customer: acme
  product: cai-api-service
  environment: uat
  version: "1.0.0"

database:
  passwordSecretName: db-secret
  connectionString: Server=db;Database=main;User Id=appuser;

---
# demo-set-1-vault-eso/app/helm-release.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: acme-cai-api-service-uat
  namespace: argocd
spec:
  destination:
    namespace: acme-cai-api-uat
    server: https://kubernetes.default.svc
  source:
    repoURL: https://chart-repo-service.chartrepo.svc.cluster.local
    chart: cai-api-service
    targetRevision: 1.0.0
    helm:
      valueFiles:
        - values.yaml
  project: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true


# ============================
# Deployment Set 2: ArgoCD App-of-Apps
# ============================

# Folder Structure:
# └── demo-set-2-app-of-apps/
#     ├── parent-app.yaml
#     ├── infra/
#     │   ├── namespace.yaml
#     │   └── values-infra.yaml
#     └── app/
#         ├── helm-release.yaml
#         └── values.yaml

---
# demo-set-2-app-of-apps/parent-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: acme-cai-api-service-uat-parent
  namespace: argocd
spec:
  project: default
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  source:
    repoURL: https://gitea.local/acme/configs.git
    path: demo-set-2-app-of-apps
    targetRevision: HEAD
    directory:
      recurse: true
  syncPolicy:
    automated: {}

---
# demo-set-2-app-of-apps/infra/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: acme-cai-api-uat
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: product-deployer
  namespace: acme-cai-api-uat
rules:
  - apiGroups: [""]
    resources: ["pods", "secrets"]
    verbs: ["get", "list", "create", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: product-deployer-binding
  namespace: acme-cai-api-uat
subjects:
  - kind: User
    name: dev-team
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: product-deployer
  apiGroup: rbac.authorization.k8s.io

---
# demo-set-2-app-of-apps/app/values.yaml
context:
  customer: acme
  product: cai-api-service
  environment: uat
  instance: "01"

api:
  replicas: 2
  env:
    - name: ASPNETCORE_ENVIRONMENT
      value: UAT

---
# demo-set-2-app-of-apps/app/helm-release.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: acme-cai-api-service-uat-app
  namespace: argocd
spec:
  destination:
    namespace: acme-cai-api-uat
    server: https://kubernetes.default.svc
  source:
    repoURL: https://chart-repo-service.chartrepo.svc.cluster.local
    chart: cai-api-service
    targetRevision: 1.0.0
    helm:
      valueFiles:
        - values.yaml
  project: default
  syncPolicy:
    automated: {}


# ============================
# Deployment Set 3: Helm OCI + Git Values
# ============================

# Folder Structure:
# └── demo-set-3-oci-git-values/
#     ├── infra-values.yaml
#     └── app-values.yaml
#     └── helm-release.yaml

---
# demo-set-3-oci-git-values/infra-values.yaml
namespace: acme-cai-api-uat

limits:
  cpu: "1"
  memory: "512Mi"

annotations:
  vault.io/secrets: enabled

---
# demo-set-3-oci-git-values/app-values.yaml
context:
  customer: acme
  product: cai-api-service
  environment: uat

database:
  connectionString: "Server=sql;Database=main;User Id=app;"

replicaCount: 2

---
# demo-set-3-oci-git-values/helm-release.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: acme-cai-api-service-uat-oci
  namespace: argocd
spec:
  destination:
    server: https://kubernetes.default.svc
    namespace: acme-cai-api-uat
  source:
    chart: oci://registry.local/charts/cai-api-service
    targetRevision: 1.0.0
    helm:
      valuesFiles:
        - https://gitea.local/raw/acme/values/acme/cai-api-service/uat/infra-values.yaml
        - https://gitea.local/raw/acme/values/acme/cai-api-service/uat/app-values.yaml
  project: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
