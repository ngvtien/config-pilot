# Complete Guide: Creating Helm Charts from Kubernetes Resources

## Step 1: Prepare Your Kubernetes Resources

### 1.1 Collect Your Resources
Start by gathering all your existing Kubernetes manifests:
```bash
# Example resources you might have
deployment.yaml
service.yaml
configmap.yaml
secret.yaml
ingress.yaml
```

### 1.2 Analyze Resource Structure
Review your resources to identify:
- Common patterns (labels, annotations)
- Values that should be configurable
- Environment-specific settings
- Resource interdependencies

## Step 2: Create Helm Chart Structure

### 2.1 Initialize Chart
```bash
# Create new chart
helm create my-app

# Or create from scratch
mkdir my-app-chart
cd my-app-chart
```

### 2.2 Standard Chart Directory Structure
```
my-app-chart/
├── Chart.yaml           # Chart metadata
├── values.yaml         # Default configuration values
├── values.schema.json  # JSON schema for values validation
├── charts/             # Chart dependencies
├── templates/          # Kubernetes manifest templates
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── ingress.yaml
│   ├── _helpers.tpl    # Template helpers
│   ├── NOTES.txt       # Post-install notes
│   └── tests/          # Test files
└── .helmignore         # Files to ignore during packaging
```

## Step 3: Create Chart.yaml

```yaml
apiVersion: v2
name: my-app
description: A Helm chart for my application
type: application
version: 0.1.0          # Chart version
appVersion: "1.0.0"     # Application version
keywords:
  - web
  - application
home: https://example.com
sources:
  - https://github.com/example/my-app
maintainers:
  - name: Your Name
    email: you@example.com
dependencies:
  - name: postgresql
    version: "12.1.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
```

## Step 4: Convert Resources to Templates

### 4.1 Basic Template Structure
Take your existing deployment.yaml and convert it:

**Original deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: my-app:latest
        ports:
        - containerPort: 8080
```

**Templated deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "my-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "my-app.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          {{- if .Values.resources }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          {{- end }}
```

### 4.2 Create Template Helpers (_helpers.tpl)
```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "my-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "my-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "my-app.labels" -}}
helm.sh/chart: {{ include "my-app.chart" . }}
{{ include "my-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "my-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "my-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
```

## Step 5: Create values.yaml

```yaml
# Default values for my-app
replicaCount: 1

image:
  repository: my-app
  pullPolicy: IfNotPresent
  tag: ""

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: false
  className: ""
  annotations: {}
    # kubernetes.io/ingress.class: nginx
    # kubernetes.io/tls-acme: "true"
  hosts:
    - host: chart-example.local
      paths:
        - path: /
          pathType: Prefix
  tls: []

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80

nodeSelector: {}
tolerations: []
affinity: {}

# Application specific configuration
app:
  config:
    database:
      host: "localhost"
      port: 5432
      name: "myapp"
    redis:
      host: "localhost"
      port: 6379
  
# External dependencies
postgresql:
  enabled: true
  auth:
    database: myapp
    username: myapp
```

## Step 6: Create values.schema.json

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "replicaCount": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10
    },
    "image": {
      "type": "object",
      "properties": {
        "repository": {
          "type": "string"
        },
        "tag": {
          "type": "string"
        },
        "pullPolicy": {
          "type": "string",
          "enum": ["Always", "IfNotPresent", "Never"]
        }
      },
      "required": ["repository"]
    },
    "service": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": ["ClusterIP", "NodePort", "LoadBalancer", "ExternalName"]
        },
        "port": {
          "type": "integer",
          "minimum": 1,
          "maximum": 65535
        }
      }
    },
    "ingress": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean"
        }
      }
    },
    "resources": {
      "type": "object",
      "properties": {
        "limits": {
          "type": "object"
        },
        "requests": {
          "type": "object"
        }
      }
    }
  },
  "required": ["image"]
}
```

## Step 7: Advanced Templating Techniques

### 7.1 Conditional Resources
```yaml
{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  # ... ingress spec
{{- end }}
```

### 7.2 Environment-Specific Values
Create environment-specific values files:
```bash
# values-dev.yaml
replicaCount: 1
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"

# values-prod.yaml
replicaCount: 3
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
```

### 7.3 Multi-Document Templates
```yaml
# In templates/secrets.yaml
{{- range $key, $value := .Values.secrets }}
---
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "my-app.fullname" $ }}-{{ $key }}
  labels:
    {{- include "my-app.labels" $ | nindent 4 }}
type: Opaque
data:
  {{- toYaml $value | nindent 2 }}
{{- end }}
```

## Step 8: Testing and Validation

### 8.1 Validate Chart Structure
```bash
# Lint the chart
helm lint my-app-chart/

# Validate against schema
helm template my-app my-app-chart/ --validate
```

### 8.2 Test Template Rendering
```bash
# Render templates with default values
helm template my-app my-app-chart/

# Test with specific values
helm template my-app my-app-chart/ -f values-prod.yaml

# Debug specific template
helm template my-app my-app-chart/ -s templates/deployment.yaml
```

### 8.3 Dry Run Installation
```bash
# Dry run with default values
helm install my-app my-app-chart/ --dry-run --debug

# Dry run with custom values
helm install my-app my-app-chart/ -f values-prod.yaml --dry-run
```

## Step 9: Create Chart Tests

### 9.1 Basic Test (templates/tests/test-connection.yaml)
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "my-app.fullname" . }}-test-connection"
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": test
spec:
  restartPolicy: Never
  containers:
    - name: wget
      image: busybox
      command: ['wget']
      args: ['{{ include "my-app.fullname" . }}:{{ .Values.service.port }}']
```

### 9.2 Run Tests
```bash
# Install chart
helm install my-app my-app-chart/

# Run tests
helm test my-app
```

## Step 10: Package and Distribute

### 10.1 Package Chart
```bash
# Package the chart
helm package my-app-chart/

# This creates: my-app-0.1.0.tgz
```

### 10.2 Create Chart Repository
```bash
# Create repository index
helm repo index . --url https://charts.example.com

# Upload to chart repository (example with Azure Container Registry)
az acr helm push my-app-0.1.0.tgz --name myregistry
```

### 10.3 Install from Repository
```bash
# Add repository
helm repo add myrepo https://charts.example.com

# Install chart
helm install my-app myrepo/my-app
```

## Step 11: Advanced Features

### 11.1 Chart Hooks
```yaml
# Pre-install hook
apiVersion: batch/v1
kind: Job
metadata:
  name: "{{ include "my-app.fullname" . }}-pre-install"
  annotations:
    "helm.sh/hook": pre-install
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": hook-succeeded
```

### 11.2 Chart Dependencies
```bash
# Add dependency
helm dependency add postgresql https://charts.bitnami.com/bitnami

# Update dependencies
helm dependency update

# Build dependencies
helm dependency build
```

### 11.3 Configuration Management Integration
For HashiCorp Vault integration:
```yaml
# In values.yaml
vault:
  enabled: true
  role: my-app-role
  secrets:
    - secretPath: "secret/my-app/db"
      secretKey: "password"
      mountPath: "/vault/secrets"
```

## Best Practices Summary

1. **Naming Convention**: Use consistent naming with helper templates
2. **Values Structure**: Organize values logically and document them
3. **Resource Management**: Always include resource limits and requests
4. **Security**: Use secrets management and security contexts
5. **Flexibility**: Make charts configurable but provide sensible defaults
6. **Documentation**: Include comprehensive NOTES.txt and README
7. **Testing**: Always test with different value combinations
8. **Versioning**: Follow semantic versioning for chart releases
9. **Dependencies**: Pin dependency versions for reproducibility
10. **Validation**: Use JSON schema for values validation

## Development Tool Suggestion
Try to see if the following tool helps

### @monokle/cli
there's a @monokle/cli package available on npm and Monokle is an open-source set of tools for Kubernetes configurations, I don't see evidence of a specific `@monokle/helm` package.

**What Monokle could potentially offer for your Electron app:**

1. **Advanced Validation**: Monokle provides validation against YAML formatting, K8s schemas including CRDs, and OPA policy rules
2. **Real-time Feedback**: Live validation as you build charts
3. **Cluster Integration**: Validation against actual cluster state
4. **Comprehensive Resource Understanding**: High-level view of manifests, their contained resources and relationships

**However, there are some considerations:**

- I couldn't find a dedicated `@monokle/helm` npm package
- The @monokle/cli exists but seems focused on validation
- You might need to extract and adapt code from the open-source Monokle project

**Better approach for your use case:**

the need for a comprehensive Helm chart generator, could be:

1. **Start with the standard libraries** I outlined earlier (`@kubernetes/client-node`, `js-yaml`, etc.)
2. **Add Monokle's validation** via `@monokle/cli` for enhanced chart validation
3. **Study Monokle's source code** to understand their Helm implementation patterns
4. **Consider contributing** a `@monokle/helm` package if you build something useful

The combination would give robust chart generation with enterprise-level validation capabilities that align well with your OpenShift and Kubernetes expertise.

### CDK8s

- CDK8s is a perfect fit for TypeScript/Electron Helm chart generator.
- Crossplane-cdk8s is a framework that lets you compose your own cloud APIs in Kubernetes using familiar languages like TypeScript. This is a game-changer for your Electron Helm chart generator, especially given your .NET stack and infrastructure focus.Crossplane-CDK8s is a game-changer for your use case! It's a multi-language toolkit with high level abstractions for authoring Crossplane Platform Configurations using familiar programming languages, which goes far beyond traditional Helm charts.

### Crossplane-CDK8s
**Key advantages of Crossplane-CDK8s for Electron app:**

1. **Complete Infrastructure-as-Code**: Define CompositeResourceDefinitions, Compositions, and Configurations entirely in TypeScript

2. **Self-Service Platform APIs**: Create self-service APIs for teams to provision resources - perfect for your .NET development teams

3. **Cloud Resource Management**: Import cloud service primitives using cdk8s import github:crossplane/provider-aws

4. **Beyond Helm**: While CDK8s generates Helm charts, Crossplane-CDK8s creates entire platform configurations including databases, networking, and cloud services

**Important consideration**: The package was last published 3 years ago, but the concepts are still valid and the codebase is open source.

**specifically .NET/OpenShift/HashiCorp Vault stack**, Crossplane-CDK8s would let you:
- Define complete .NET application platforms (app + database + secrets + networking)
- Create self-service APIs for your development teams
- Integrate HashiCorp Vault secrets management patterns
- Generate Kong API Gateway configurations
- Provision cloud resources alongside Kubernetes resources

**Recommended approach**:
1. Use **CDK8s** for Kubernetes-native resources and Helm chart generation
2. Use **Crossplane concepts** (potentially forking crossplane-cdk8s) for infrastructure provisioning
3. Combine both in your Electron app for complete platform generation

This gives the power to generate not just Helm charts, but complete self-service infrastructure platforms that your .NET teams can consume through simple APIs.

