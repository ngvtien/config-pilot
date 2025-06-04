// Resource templates for common Kubernetes resources
export const KUBERNETES_RESOURCE_TEMPLATES = [
    {
        kind: 'Deployment',
        apiVersion: 'apps/v1',
        displayName: 'Deployment',
        description: 'Manages a replicated application',
        category: 'workload',
        schemaUrl: 'https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master/v1.27.0/deployment-apps-v1.json',
        defaultSpec: {
            replicas: 1,
            selector: { matchLabels: {} },
            template: {
                metadata: { labels: {} },
                spec: {
                    containers: [{
                            name: 'app',
                            image: 'nginx:latest',
                            ports: [{ containerPort: 80 }]
                        }]
                }
            }
        },
        requiredFields: ['spec.selector', 'spec.template'],
        contextFields: {
            namePattern: '{product}-{customer}-{environment}-{instance}',
            namespacePattern: '{customer}-{environment}',
            defaultLabels: {
                'app.kubernetes.io/name': '{product}',
                'app.kubernetes.io/instance': '{instance}',
                'app.kubernetes.io/version': '{version}',
                'app.kubernetes.io/component': 'application',
                'app.kubernetes.io/part-of': '{product}',
                'app.kubernetes.io/managed-by': 'configpilot'
            }
        }
    },
    {
        kind: 'Service',
        apiVersion: 'v1',
        displayName: 'Service',
        description: 'Exposes an application running on a set of Pods',
        category: 'network',
        schemaUrl: 'https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master/v1.27.0/service-v1.json',
        defaultSpec: {
            type: 'ClusterIP',
            ports: [{ port: 80, targetPort: 80, protocol: 'TCP' }],
            selector: {}
        },
        requiredFields: ['spec.ports', 'spec.selector'],
        contextFields: {
            namePattern: '{product}-{customer}-{environment}-{instance}-svc',
            namespacePattern: '{customer}-{environment}',
            defaultLabels: {
                'app.kubernetes.io/name': '{product}',
                'app.kubernetes.io/instance': '{instance}',
                'app.kubernetes.io/component': 'service'
            }
        }
    },
    {
        kind: 'ConfigMap',
        apiVersion: 'v1',
        displayName: 'ConfigMap',
        description: 'Stores configuration data in key-value pairs',
        category: 'config',
        schemaUrl: 'https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master/v1.27.0/configmap-v1.json',
        defaultSpec: {
            data: {}
        },
        requiredFields: [],
        contextFields: {
            namePattern: '{product}-{customer}-{environment}-{instance}-config',
            namespacePattern: '{customer}-{environment}',
            defaultLabels: {
                'app.kubernetes.io/name': '{product}',
                'app.kubernetes.io/instance': '{instance}',
                'app.kubernetes.io/component': 'configuration'
            }
        }
    },
    {
        kind: 'Secret',
        apiVersion: 'v1',
        displayName: 'Secret',
        description: 'Stores sensitive data such as passwords, tokens, or keys',
        category: 'security',
        schemaUrl: 'https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master/v1.27.0/secret-v1.json',
        defaultSpec: {
            type: 'Opaque',
            data: {}
        },
        requiredFields: [],
        contextFields: {
            namePattern: '{product}-{customer}-{environment}-{instance}-secret',
            namespacePattern: '{customer}-{environment}',
            defaultLabels: {
                'app.kubernetes.io/name': '{product}',
                'app.kubernetes.io/instance': '{instance}',
                'app.kubernetes.io/component': 'secret'
            }
        }
    },
    {
        kind: 'Ingress',
        apiVersion: 'networking.k8s.io/v1',
        displayName: 'Ingress',
        description: 'Manages external access to services in a cluster',
        category: 'network',
        schemaUrl: 'https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master/v1.27.0/ingress-networking-v1.json',
        defaultSpec: {
            rules: [{
                    host: '',
                    http: {
                        paths: [{
                                path: '/',
                                pathType: 'Prefix',
                                backend: {
                                    service: {
                                        name: '',
                                        port: { number: 80 }
                                    }
                                }
                            }]
                    }
                }]
        },
        requiredFields: ['spec.rules'],
        contextFields: {
            namePattern: '{product}-{customer}-{environment}-{instance}-ingress',
            namespacePattern: '{customer}-{environment}',
            defaultLabels: {
                'app.kubernetes.io/name': '{product}',
                'app.kubernetes.io/instance': '{instance}',
                'app.kubernetes.io/component': 'ingress'
            }
        }
    }
];
