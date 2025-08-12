/**
 * Mock data service for testing the 3-panel product workspace layout
 * Provides comprehensive sample data for products, components, and K8s resources
 */
import type { Product, ProductComponentType } from '@/shared/types/product'
import type { KubernetesResource } from '@/shared/types/kubernetes'

export interface MockDataService {
  getProducts(): Product[]
  getProductComponents(productId: string): ProductComponentType[]
  getComponentResources(componentId: string): KubernetesResource[]
  getResourceYaml(resourceId: string): string
  getComponentHelmChart(componentId: string): { valuesYaml: string; valuesSchema: string } | null
}

/**
 * Comprehensive mock products for testing
 */
const mockProducts: Product[] = [
  {
    id: "product-cai",
    name: "cai",
    displayName: "Common Application Interface",
    description: "Microservices platform providing common APIs and shared services for enterprise applications",
    owner: "Tim Walker",
    isActive: true,
    createdAt: "2024-01-15T10:30:00.000Z",
    updatedAt: "2024-12-20T14:22:00.000Z",
    metadata: {
      category: "platform",
      tags: ["api", "microservice", "platform", "backend"]
    }
  },
  {
    id: "product-esb",
    name: "esb",
    displayName: "Enterprise Service Bus",
    description: "Message routing and transformation platform for enterprise integration",
    owner: "Platform Team",
    isActive: true,
    createdAt: "2024-02-01T09:15:00.000Z",
    updatedAt: "2024-12-18T16:45:00.000Z",
    metadata: {
      category: "integration",
      tags: ["messaging", "integration", "middleware"]
    }
  },
  {
    id: "product-portal",
    name: "portal",
    displayName: "Customer Portal",
    description: "Self-service customer portal with account management and billing features",
    owner: "Frontend Team",
    isActive: true,
    createdAt: "2024-03-10T11:20:00.000Z",
    updatedAt: "2024-12-19T13:30:00.000Z",
    metadata: {
      category: "frontend",
      tags: ["react", "customer", "portal", "ui"]
    }
  },
  {
    id: "product-analytics",
    name: "analytics",
    displayName: "Analytics Engine",
    description: "Real-time data processing and analytics platform for business intelligence",
    owner: "Data Team",
    isActive: false,
    createdAt: "2024-04-05T14:10:00.000Z",
    updatedAt: "2024-11-30T10:15:00.000Z",
    metadata: {
      category: "data",
      tags: ["analytics", "bigdata", "ml", "reporting"]
    }
  }
]

/**
 * Mock product components organized by product
 */
const mockProductComponents: Record<string, ProductComponentType[]> = {
  "product-cai": [
    {
      id: "comp-cai-api",
      name: "cai-api",
      displayName: "CAI API Gateway",
      description: "Main API gateway handling authentication and routing",
      parentProduct: "cai",
      isActive: true,
      createdAt: "2024-01-15T10:35:00.000Z",
      updatedAt: "2024-12-20T14:25:00.000Z",
      metadata: {
        type: "service",
        runtime: "nodejs",
        version: "v2.1.3"
      }
    },
    {
      id: "comp-cai-auth",
      name: "cai-auth",
      displayName: "Authentication Service",
      description: "OAuth2/OIDC authentication and authorization service",
      parentProduct: "cai",
      isActive: true,
      createdAt: "2024-01-16T09:20:00.000Z",
      updatedAt: "2024-12-19T11:40:00.000Z",
      metadata: {
        type: "service",
        runtime: "java",
        version: "v1.8.2"
      }
    },
    {
      id: "comp-cai-db",
      name: "cai-database",
      displayName: "CAI Database",
      description: "PostgreSQL database for CAI platform data",
      parentProduct: "cai",
      isActive: true,
      createdAt: "2024-01-15T10:40:00.000Z",
      updatedAt: "2024-12-15T16:20:00.000Z",
      metadata: {
        type: "database",
        runtime: "postgresql",
        version: "v14.9"
      }
    }
  ],
  "product-esb": [
    {
      id: "comp-esb-broker",
      name: "esb-message-broker",
      displayName: "Message Broker",
      description: "Apache Kafka message broker for event streaming",
      parentProduct: "esb",
      isActive: true,
      createdAt: "2024-02-01T09:20:00.000Z",
      updatedAt: "2024-12-18T15:30:00.000Z",
      metadata: {
        type: "messaging",
        runtime: "kafka",
        version: "v3.6.0"
      }
    },
    {
      id: "comp-esb-transform",
      name: "esb-transformer",
      displayName: "Message Transformer",
      description: "Data transformation and routing engine",
      parentProduct: "esb",
      isActive: true,
      createdAt: "2024-02-02T10:15:00.000Z",
      updatedAt: "2024-12-17T14:45:00.000Z",
      metadata: {
        type: "service",
        runtime: "spring-boot",
        version: "v2.3.1"
      }
    }
  ],
  "product-portal": [
    {
      id: "comp-portal-web",
      name: "portal-webapp",
      displayName: "Portal Web Application",
      description: "React-based customer portal frontend",
      parentProduct: "portal",
      isActive: true,
      createdAt: "2024-03-10T11:25:00.000Z",
      updatedAt: "2024-12-19T12:15:00.000Z",
      metadata: {
        type: "frontend",
        runtime: "react",
        version: "v18.2.0"
      }
    },
    {
      id: "comp-portal-api",
      name: "portal-backend",
      displayName: "Portal Backend API",
      description: "Backend services for customer portal",
      parentProduct: "portal",
      isActive: true,
      createdAt: "2024-03-11T08:30:00.000Z",
      updatedAt: "2024-12-18T17:20:00.000Z",
      metadata: {
        type: "service",
        runtime: "python",
        version: "v3.11.5"
      }
    }
  ],
  "product-analytics": [
    {
      id: "comp-analytics-spark",
      name: "analytics-spark",
      displayName: "Spark Processing Engine",
      description: "Apache Spark cluster for big data processing",
      parentProduct: "analytics",
      isActive: false,
      createdAt: "2024-04-05T14:15:00.000Z",
      updatedAt: "2024-11-30T10:20:00.000Z",
      metadata: {
        type: "processing",
        runtime: "spark",
        version: "v3.5.0"
      }
    }
  ]
}

/**
 * Enhanced Kubernetes resources with more comprehensive data for better PoC visualization
 */
const mockKubernetesResources: Record<string, KubernetesResource[]> = {
  "comp-cai-api": [
    {
      id: "res-cai-api-deploy",
      name: "cai-api-deployment",
      namespace: "cai-prod",
      kind: "Deployment",
      apiVersion: "apps/v1",
      status: "Running",
      createdAt: "2024-12-20T14:25:00.000Z",
      metadata: {
        labels: {
          app: "cai-api",
          version: "v2.1.3",
          environment: "production",
          tier: "backend"
        },
        annotations: {
          "deployment.kubernetes.io/revision": "3",
          "kubectl.kubernetes.io/last-applied-configuration": "..."
        }
      }
    },
    {
      id: "res-cai-api-svc",
      name: "cai-api-service",
      namespace: "cai-prod",
      kind: "Service",
      apiVersion: "v1",
      status: "Active",
      createdAt: "2024-12-20T14:26:00.000Z",
      metadata: {
        labels: {
          app: "cai-api",
          type: "LoadBalancer"
        }
      }
    },
    {
      id: "res-cai-api-ing",
      name: "cai-api-ingress",
      namespace: "cai-prod",
      kind: "Ingress",
      apiVersion: "networking.k8s.io/v1",
      status: "Ready",
      createdAt: "2024-12-20T14:27:00.000Z",
      metadata: {
        labels: {
          app: "cai-api",
          ingress: "nginx"
        }
      }
    },
    {
      id: "res-cai-api-hpa",
      name: "cai-api-hpa",
      namespace: "cai-prod",
      kind: "HorizontalPodAutoscaler",
      apiVersion: "autoscaling/v2",
      status: "Active",
      createdAt: "2024-12-20T14:28:00.000Z",
      metadata: {
        labels: {
          app: "cai-api",
          scaling: "auto"
        }
      }
    },
    {
      id: "res-cai-api-cm",
      name: "cai-api-config",
      namespace: "cai-prod",
      kind: "ConfigMap",
      apiVersion: "v1",
      status: "Active",
      createdAt: "2024-12-20T14:29:00.000Z",
      metadata: {
        labels: {
          app: "cai-api",
          config: "application"
        }
      }
    }
  ],
  "comp-cai-auth": [
    {
      id: "res-cai-auth-deploy",
      name: "cai-auth-deployment",
      namespace: "cai-prod",
      kind: "Deployment",
      apiVersion: "apps/v1",
      status: "Running",
      createdAt: "2024-12-19T11:40:00.000Z",
      metadata: {
        labels: {
          app: "cai-auth",
          version: "v1.8.2",
          tier: "security"
        }
      }
    },
    {
      id: "res-cai-auth-secret",
      name: "cai-auth-secrets",
      namespace: "cai-prod",
      kind: "Secret",
      apiVersion: "v1",
      status: "Active",
      createdAt: "2024-12-19T11:41:00.000Z",
      metadata: {
        labels: {
          app: "cai-auth",
          type: "oauth-keys"
        }
      }
    },
    {
      id: "res-cai-auth-svc",
      name: "cai-auth-service",
      namespace: "cai-prod",
      kind: "Service",
      apiVersion: "v1",
      status: "Active",
      createdAt: "2024-12-19T11:42:00.000Z",
      metadata: {
        labels: {
          app: "cai-auth",
          type: "ClusterIP"
        }
      }
    },
    {
      id: "res-cai-auth-pdb",
      name: "cai-auth-pdb",
      namespace: "cai-prod",
      kind: "PodDisruptionBudget",
      apiVersion: "policy/v1",
      status: "Active",
      createdAt: "2024-12-19T11:43:00.000Z",
      metadata: {
        labels: {
          app: "cai-auth",
          policy: "disruption"
        }
      }
    }
  ],
  "comp-cai-db": [
    {
      id: "res-cai-db-sts",
      name: "cai-database-statefulset",
      namespace: "cai-prod",
      kind: "StatefulSet",
      apiVersion: "apps/v1",
      status: "Running",
      createdAt: "2024-12-15T16:20:00.000Z",
      metadata: {
        labels: {
          app: "cai-database",
          version: "v14.9",
          tier: "database"
        }
      }
    },
    {
      id: "res-cai-db-svc",
      name: "cai-database-service",
      namespace: "cai-prod",
      kind: "Service",
      apiVersion: "v1",
      status: "Active",
      createdAt: "2024-12-15T16:21:00.000Z",
      metadata: {
        labels: {
          app: "cai-database",
          type: "ClusterIP"
        }
      }
    },
    {
      id: "res-cai-db-pvc",
      name: "cai-database-storage",
      namespace: "cai-prod",
      kind: "PersistentVolumeClaim",
      apiVersion: "v1",
      status: "Bound",
      createdAt: "2024-12-15T16:22:00.000Z",
      metadata: {
        labels: {
          app: "cai-database",
          storage: "persistent"
        }
      }
    },
    {
      id: "res-cai-db-backup",
      name: "cai-database-backup",
      namespace: "cai-prod",
      kind: "CronJob",
      apiVersion: "batch/v1",
      status: "Active",
      createdAt: "2024-12-15T16:23:00.000Z",
      metadata: {
        labels: {
          app: "cai-database",
          job: "backup"
        }
      }
    }
  ],
  "comp-esb-broker": [
    {
      id: "res-esb-broker-sts",
      name: "esb-kafka-cluster",
      namespace: "esb-prod",
      kind: "StatefulSet",
      apiVersion: "apps/v1",
      status: "Running",
      createdAt: "2024-12-18T15:30:00.000Z",
      metadata: {
        labels: {
          app: "esb-kafka",
          version: "v3.6.0",
          tier: "messaging"
        }
      }
    },
    {
      id: "res-esb-broker-svc",
      name: "esb-kafka-service",
      namespace: "esb-prod",
      kind: "Service",
      apiVersion: "v1",
      status: "Active",
      createdAt: "2024-12-18T15:31:00.000Z",
      metadata: {
        labels: {
          app: "esb-kafka",
          type: "ClusterIP"
        }
      }
    },
    {
      id: "res-esb-zk-sts",
      name: "esb-zookeeper",
      namespace: "esb-prod",
      kind: "StatefulSet",
      apiVersion: "apps/v1",
      status: "Running",
      createdAt: "2024-12-18T15:32:00.000Z",
      metadata: {
        labels: {
          app: "esb-zookeeper",
          component: "coordination"
        }
      }
    }
  ],
  "comp-esb-transform": [
    {
      id: "res-esb-transform-deploy",
      name: "esb-transformer-deployment",
      namespace: "esb-prod",
      kind: "Deployment",
      apiVersion: "apps/v1",
      status: "Running",
      createdAt: "2024-12-17T14:45:00.000Z",
      metadata: {
        labels: {
          app: "esb-transformer",
          version: "v2.3.1",
          tier: "processing"
        }
      }
    },
    {
      id: "res-esb-transform-svc",
      name: "esb-transformer-service",
      namespace: "esb-prod",
      kind: "Service",
      apiVersion: "v1",
      status: "Active",
      createdAt: "2024-12-17T14:46:00.000Z",
      metadata: {
        labels: {
          app: "esb-transformer",
          type: "ClusterIP"
        }
      }
    }
  ],
  "comp-portal-web": [
    {
      id: "res-portal-web-deploy",
      name: "portal-webapp-deployment",
      namespace: "portal-prod",
      kind: "Deployment",
      apiVersion: "apps/v1",
      status: "Running",
      createdAt: "2024-12-19T12:15:00.000Z",
      metadata: {
        labels: {
          app: "portal-webapp",
          version: "v18.2.0",
          tier: "frontend"
        }
      }
    },
    {
      id: "res-portal-web-svc",
      name: "portal-webapp-service",
      namespace: "portal-prod",
      kind: "Service",
      apiVersion: "v1",
      status: "Active",
      createdAt: "2024-12-19T12:16:00.000Z",
      metadata: {
        labels: {
          app: "portal-webapp",
          type: "LoadBalancer"
        }
      }
    },
    {
      id: "res-portal-web-ing",
      name: "portal-webapp-ingress",
      namespace: "portal-prod",
      kind: "Ingress",
      apiVersion: "networking.k8s.io/v1",
      status: "Ready",
      createdAt: "2024-12-19T12:17:00.000Z",
      metadata: {
        labels: {
          app: "portal-webapp",
          ingress: "nginx"
        }
      }
    }
  ],
  "comp-portal-api": [
    {
      id: "res-portal-api-deploy",
      name: "portal-backend-deployment",
      namespace: "portal-prod",
      kind: "Deployment",
      apiVersion: "apps/v1",
      status: "Running",
      createdAt: "2024-12-18T17:20:00.000Z",
      metadata: {
        labels: {
          app: "portal-backend",
          version: "v3.11.5",
          tier: "backend"
        }
      }
    },
    {
      id: "res-portal-api-svc",
      name: "portal-backend-service",
      namespace: "portal-prod",
      kind: "Service",
      apiVersion: "v1",
      status: "Active",
      createdAt: "2024-12-18T17:21:00.000Z",
      metadata: {
        labels: {
          app: "portal-backend",
          type: "ClusterIP"
        }
      }
    }
  ],
  "comp-analytics-spark": [
    {
      id: "res-analytics-spark-master",
      name: "analytics-spark-master",
      namespace: "analytics-dev",
      kind: "Deployment",
      apiVersion: "apps/v1",
      status: "Stopped",
      createdAt: "2024-11-30T10:20:00.000Z",
      metadata: {
        labels: {
          app: "analytics-spark",
          component: "master",
          version: "v3.5.0"
        }
      }
    },
    {
      id: "res-analytics-spark-worker",
      name: "analytics-spark-worker",
      namespace: "analytics-dev",
      kind: "Deployment",
      apiVersion: "apps/v1",
      status: "Stopped",
      createdAt: "2024-11-30T10:21:00.000Z",
      metadata: {
        labels: {
          app: "analytics-spark",
          component: "worker",
          version: "v3.5.0"
        }
      }
    }
  ]
}

/**
 * Enhanced YAML content with more comprehensive examples
 */
const mockResourceYaml: Record<string, string> = {
  "res-cai-api-deploy": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: cai-api-deployment
  namespace: cai-prod
  labels:
    app: cai-api
    version: v2.1.3
    environment: production
    tier: backend
  annotations:
    deployment.kubernetes.io/revision: "3"
    kubectl.kubernetes.io/last-applied-configuration: |
      {"apiVersion":"apps/v1","kind":"Deployment"}
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: cai-api
  template:
    metadata:
      labels:
        app: cai-api
        version: v2.1.3
    spec:
      containers:
      - name: cai-api
        image: registry.company.com/cai/api:v2.1.3
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: cai-db-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: cai-api-config
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
      serviceAccountName: cai-api-sa
      securityContext:
        fsGroup: 2000`,

  "res-cai-api-svc": `apiVersion: v1
kind: Service
metadata:
  name: cai-api-service
  namespace: cai-prod
  labels:
    app: cai-api
    type: LoadBalancer
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  - port: 443
    targetPort: 8080
    protocol: TCP
    name: https
  selector:
    app: cai-api
  sessionAffinity: None
  externalTrafficPolicy: Cluster`,

  "res-cai-api-hpa": `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cai-api-hpa
  namespace: cai-prod
  labels:
    app: cai-api
    scaling: auto
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cai-api-deployment
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60`,

  "res-cai-db-sts": `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: cai-database-statefulset
  namespace: cai-prod
  labels:
    app: cai-database
    version: v14.9
    tier: database
spec:
  serviceName: cai-database-service
  replicas: 1
  selector:
    matchLabels:
      app: cai-database
  template:
    metadata:
      labels:
        app: cai-database
    spec:
      containers:
      - name: postgresql
        image: postgres:14.9-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          value: cai_production
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: cai-db-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: cai-db-secret
              key: password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: gp2
      resources:
        requests:
          storage: 100Gi`,

  "res-esb-broker-sts": `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: esb-kafka-cluster
  namespace: esb-prod
  labels:
    app: esb-kafka
    version: v3.6.0
    tier: messaging
spec:
  serviceName: esb-kafka-service
  replicas: 3
  selector:
    matchLabels:
      app: esb-kafka
  template:
    metadata:
      labels:
        app: esb-kafka
    spec:
      containers:
      - name: kafka
        image: confluentinc/cp-kafka:7.5.0
        ports:
        - containerPort: 9092
          name: kafka
        - containerPort: 9093
          name: kafka-ssl
        env:
        - name: KAFKA_BROKER_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: KAFKA_ZOOKEEPER_CONNECT
          value: esb-zookeeper:2181
        - name: KAFKA_ADVERTISED_LISTENERS
          value: PLAINTEXT://$(POD_NAME).esb-kafka-service:9092
        - name: KAFKA_LISTENER_SECURITY_PROTOCOL_MAP
          value: PLAINTEXT:PLAINTEXT
        - name: KAFKA_INTER_BROKER_LISTENER_NAME
          value: PLAINTEXT
        - name: KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR
          value: "3"
        - name: KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR
          value: "3"
        - name: KAFKA_TRANSACTION_STATE_LOG_MIN_ISR
          value: "2"
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        volumeMounts:
        - name: kafka-storage
          mountPath: /var/lib/kafka/data
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
  volumeClaimTemplates:
  - metadata:
      name: kafka-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: gp2
      resources:
        requests:
          storage: 200Gi`,

  "res-portal-web-ing": `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: portal-webapp-ingress
  namespace: portal-prod
  labels:
    app: portal-webapp
    ingress: nginx
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - portal.company.com
    secretName: portal-tls-secret
  rules:
  - host: portal.company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: portal-webapp-service
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: portal-backend-service
            port:
              number: 80`
}

/**
 * Mock Helm chart data for components (1:1 relationship)
 */
const mockComponentHelmCharts: Record<string, { valuesYaml: string; valuesSchema: string }> = {
  "comp-cai-api": {
    valuesYaml: `# CAI API Gateway Helm Values
global:
  product: cai
  component: cai-api
  environment: production

deployment:
  enabled: true
  name: cai-api-deployment
  replicas: 3
  image:
    repository: registry.company.com/cai/api
    tag: v2.1.3
    pullPolicy: IfNotPresent
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"
  env:
    NODE_ENV: production
    
service:
  enabled: true
  name: cai-api-service
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
      name: http
    - port: 443
      targetPort: 8080
      protocol: TCP
      name: https

ingress:
  enabled: true
  name: cai-api-ingress
  className: nginx
  hosts:
    - host: api.cai.company.com
      paths:
        - path: /
          pathType: Prefix

autoscaling:
  enabled: true
  name: cai-api-hpa
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

configMap:
  enabled: true
  name: cai-api-config
  data:
    redis-url: "redis://cai-redis:6379"
    log-level: "info"`,
    
    valuesSchema: `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "CAI API Gateway Configuration Schema",
  "properties": {
    "global": {
      "type": "object",
      "properties": {
        "product": { "type": "string", "default": "cai" },
        "component": { "type": "string", "default": "cai-api" },
        "environment": { "type": "string", "enum": ["development", "staging", "production"], "default": "production" }
      },
      "required": ["product", "component", "environment"]
    },
    "deployment": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "name": { "type": "string", "default": "cai-api-deployment" },
        "replicas": { "type": "integer", "minimum": 1, "maximum": 20, "default": 3 },
        "image": {
          "type": "object",
          "properties": {
            "repository": { "type": "string", "default": "registry.company.com/cai/api" },
            "tag": { "type": "string", "default": "v2.1.3" },
            "pullPolicy": { "type": "string", "enum": ["Always", "IfNotPresent", "Never"], "default": "IfNotPresent" }
          },
          "required": ["repository", "tag"]
        },
        "resources": {
          "type": "object",
          "properties": {
            "requests": {
              "type": "object",
              "properties": {
                "memory": { "type": "string", "default": "256Mi" },
                "cpu": { "type": "string", "default": "250m" }
              }
            },
            "limits": {
              "type": "object",
              "properties": {
                "memory": { "type": "string", "default": "512Mi" },
                "cpu": { "type": "string", "default": "500m" }
              }
            }
          }
        }
      },
      "required": ["enabled", "name", "replicas", "image"]
    },
    "service": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "name": { "type": "string", "default": "cai-api-service" },
        "type": { "type": "string", "enum": ["ClusterIP", "NodePort", "LoadBalancer"], "default": "LoadBalancer" },
        "ports": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "port": { "type": "integer", "minimum": 1, "maximum": 65535 },
              "targetPort": { "type": "integer", "minimum": 1, "maximum": 65535 },
              "protocol": { "type": "string", "enum": ["TCP", "UDP"], "default": "TCP" },
              "name": { "type": "string" }
            },
            "required": ["port", "targetPort"]
          }
        }
      },
      "required": ["enabled", "name", "type"]
    },
    "autoscaling": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "name": { "type": "string", "default": "cai-api-hpa" },
        "minReplicas": { "type": "integer", "minimum": 1, "default": 3 },
        "maxReplicas": { "type": "integer", "minimum": 1, "default": 10 },
        "targetCPUUtilizationPercentage": { "type": "integer", "minimum": 1, "maximum": 100, "default": 70 },
        "targetMemoryUtilizationPercentage": { "type": "integer", "minimum": 1, "maximum": 100, "default": 80 }
      },
      "required": ["enabled", "minReplicas", "maxReplicas"]
    }
  },
  "required": ["global", "deployment", "service"]
}`
  },
  
  "comp-cai-auth": {
    valuesYaml: `# CAI Authentication Service Helm Values
global:
  product: cai
  component: cai-auth
  environment: production

deployment:
  enabled: true
  name: cai-auth-deployment
  replicas: 2
  image:
    repository: registry.company.com/cai/auth
    tag: v1.8.2
    pullPolicy: IfNotPresent
  resources:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "1Gi"
      cpu: "1000m"
  env:
    JAVA_OPTS: "-Xmx768m -Xms512m"
    SPRING_PROFILES_ACTIVE: production
    
service:
  enabled: true
  name: cai-auth-service
  type: ClusterIP
  ports:
    - port: 8080
      targetPort: 8080
      protocol: TCP
      name: http

secret:
  enabled: true
  name: cai-auth-secrets
  data:
    oauth-client-id: "cai-oauth-client"
    oauth-client-secret: "super-secret-key"
    jwt-signing-key: "jwt-secret-key"

podDisruptionBudget:
  enabled: true
  name: cai-auth-pdb
  minAvailable: 1`,
    
    valuesSchema: `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "CAI Authentication Service Configuration Schema",
  "properties": {
    "global": {
      "type": "object",
      "properties": {
        "product": { "type": "string", "default": "cai" },
        "component": { "type": "string", "default": "cai-auth" },
        "environment": { "type": "string", "enum": ["development", "staging", "production"], "default": "production" }
      },
      "required": ["product", "component", "environment"]
    },
    "deployment": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "name": { "type": "string", "default": "cai-auth-deployment" },
        "replicas": { "type": "integer", "minimum": 1, "maximum": 10, "default": 2 },
        "image": {
          "type": "object",
          "properties": {
            "repository": { "type": "string", "default": "registry.company.com/cai/auth" },
            "tag": { "type": "string", "default": "v1.8.2" },
            "pullPolicy": { "type": "string", "enum": ["Always", "IfNotPresent", "Never"], "default": "IfNotPresent" }
          },
          "required": ["repository", "tag"]
        }
      },
      "required": ["enabled", "name", "replicas", "image"]
    },
    "service": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "name": { "type": "string", "default": "cai-auth-service" },
        "type": { "type": "string", "enum": ["ClusterIP", "NodePort", "LoadBalancer"], "default": "ClusterIP" }
      },
      "required": ["enabled", "name", "type"]
    },
    "secret": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "name": { "type": "string", "default": "cai-auth-secrets" }
      },
      "required": ["enabled", "name"]
    },
    "podDisruptionBudget": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "name": { "type": "string", "default": "cai-auth-pdb" },
        "minAvailable": { "type": "integer", "minimum": 1, "default": 1 }
      },
      "required": ["enabled", "name"]
    }
  },
  "required": ["global", "deployment", "service"]
}`
  }
}


/**
 * Mock data service implementation
 */
export const mockDataService: MockDataService = {
  /**
   * Get all mock products
   */
  getProducts(): Product[] {
    return mockProducts
  },

  /**
   * Get components for a specific product
   */
  getProductComponents(productId: string): ProductComponentType[] {
    return mockProductComponents[productId] || []
  },

  /**
   * Get Kubernetes resources for a specific component
   */
  getComponentResources(componentId: string): KubernetesResource[] {
    return mockKubernetesResources[componentId] || []
  },

  /**
   * Get YAML content for a specific resource
   */
  getResourceYaml(resourceId: string): string {
    return mockResourceYaml[resourceId] || `# Resource YAML for ${resourceId}\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${resourceId}\n  namespace: default\ndata:\n  config: "sample configuration"`
  },

  getComponentHelmChart: function (componentId: string): { valuesYaml: string; valuesSchema: string } | null {
    return mockComponentHelmCharts[componentId] || null
  }
}

/**
 * Hook for using mock data in components
 */
export const useMockData = () => {
  return {
    products: mockDataService.getProducts(),
    getComponents: mockDataService.getProductComponents,
    getResources: mockDataService.getComponentResources,
    getYaml: mockDataService.getResourceYaml,
    getHelmChart: mockDataService.getComponentHelmChart,
  }
}