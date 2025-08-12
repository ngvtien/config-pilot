"use client"

import React, { useState, useMemo } from "react"
import { Search, Plus, AlertTriangle, CheckCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Badge } from "@/renderer/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { Checkbox } from "@/renderer/components/ui/checkbox"
import { ScrollArea } from "@/renderer/components/ui/scroll-area"
import { Separator } from "@/renderer/components/ui/separator"
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { typography } from "@/renderer/lib/typography"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { useEditorTheme } from '@/renderer/hooks/useEditorTheme'


/**
 * Kubernetes resource kind definitions with validation metadata
 */
interface ResourceKind {
    kind: string
    apiVersion: string
    category: 'workload' | 'config' | 'network' | 'storage' | 'security'
    description: string
    commonFields: string[]
    dependencies?: string[]
}

/**
 * Resource addition wizard step interface
 */
interface WizardStep {
    id: string
    title: string
    completed: boolean
    current: boolean
}

interface ResourceAdditionWizardProps {
    existingResources: string[]
    onResourceCreate: (resourceConfig: ResourceConfig) => void
    onCancel: () => void
    className?: string
}

interface ResourceConfig {
    kind: string
    apiVersion: string
    fileName: string
    template: string
    includeLabels: boolean
    includeResourceLimits: boolean
    includeHealthChecks: boolean
    linkedResources: string[]
}

/**
 * Comprehensive resource addition wizard with validation
 * Implements all best practices for Kubernetes resource creation
 */
export function ResourceAdditionWizard({
    existingResources,
    onResourceCreate,
    onCancel,
    className
}: ResourceAdditionWizardProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedKind, setSelectedKind] = useState<ResourceKind | null>(null)
    const [fileName, setFileName] = useState("")
    const [includeLabels, setIncludeLabels] = useState(true)
    const [includeResourceLimits, setIncludeResourceLimits] = useState(false)
    const [includeHealthChecks, setIncludeHealthChecks] = useState(false)
    const [linkedResources, setLinkedResources] = useState<string[]>([])

    // Add theme hook
    const { syntaxHighlighterTheme, syntaxHighlighterCustomStyle } = useEditorTheme()
        
    // Kubernetes resource kinds database
    const resourceKinds: ResourceKind[] = [
        {
            kind: "Deployment",
            apiVersion: "apps/v1",
            category: "workload",
            description: "Manages a replicated application",
            commonFields: ["replicas", "selector", "template"],
            dependencies: ["ConfigMap", "Secret"]
        },
        {
            kind: "Service",
            apiVersion: "v1",
            category: "network",
            description: "Exposes an application running on a set of Pods",
            commonFields: ["selector", "ports", "type"]
        },
        {
            kind: "ConfigMap",
            apiVersion: "v1",
            category: "config",
            description: "Stores non-confidential configuration data",
            commonFields: ["data", "binaryData"]
        },
        {
            kind: "Secret",
            apiVersion: "v1",
            category: "config",
            description: "Stores sensitive configuration data",
            commonFields: ["data", "stringData", "type"]
        },
        {
            kind: "Ingress",
            apiVersion: "networking.k8s.io/v1",
            category: "network",
            description: "Manages external access to services",
            commonFields: ["rules", "tls"]
        },
        {
            kind: "PersistentVolumeClaim",
            apiVersion: "v1",
            category: "storage",
            description: "Requests storage resources",
            commonFields: ["accessModes", "resources", "storageClassName"]
        },
        {
            kind: "HorizontalPodAutoscaler",
            apiVersion: "autoscaling/v2",
            category: "workload",
            description: "Automatically scales pods based on metrics",
            commonFields: ["scaleTargetRef", "minReplicas", "maxReplicas"],
            dependencies: ["Deployment"]
        },
        {
            kind: "NetworkPolicy",
            apiVersion: "networking.k8s.io/v1",
            category: "security",
            description: "Controls network traffic between pods",
            commonFields: ["podSelector", "policyTypes", "ingress", "egress"]
        }
    ]

    // Filter resource kinds based on search query
    const filteredResourceKinds = useMemo(() => {
        if (!searchQuery) return resourceKinds
        return resourceKinds.filter(kind =>
            kind.kind.toLowerCase().includes(searchQuery.toLowerCase()) ||
            kind.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [searchQuery])

    // Generate suggested file name based on resource kind
    const generateFileName = (kind: string): string => {
        return kind.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '') + '.yaml'
    }

    // Check for naming conflicts
    const hasNamingConflict = useMemo(() => {
        return fileName && existingResources.includes(fileName)
    }, [fileName, existingResources])

    // Generate alternative file name suggestions
    const getAlternativeNames = (baseName: string): string[] => {
        const base = baseName.replace('.yaml', '')
        return [
            `${base}-worker.yaml`,
            `${base}-api.yaml`,
            `${base}-v2.yaml`,
            `${base}-secondary.yaml`
        ].filter(name => !existingResources.includes(name))
    }

    // Generate YAML template based on selections
    const generateTemplate = (): string => {
        if (!selectedKind) return ""

        // Add header comments
        let template = `# ${fileName}\n# Content for /resources/${fileName}\n\n`

        const labels = includeLabels ? `\n  labels:\n    app: component-name\n    version: v1.0.0\n    component: ${selectedKind.kind.toLowerCase()}` : ""

        template += `apiVersion: ${selectedKind.apiVersion}\nkind: ${selectedKind.kind}\nmetadata:\n  name: resource-name${labels}\nspec:\n`

        // Add kind-specific template sections
        switch (selectedKind.kind) {
            case "Deployment":
                template += `  replicas: 1\n  selector:\n    matchLabels:\n      app: component-name\n  template:\n    metadata:\n      labels:\n        app: component-name\n    spec:\n      containers:\n      - name: container-name\n        image: nginx:latest\n        ports:\n        - containerPort: 80`

                if (includeResourceLimits) {
                    template += `\n        resources:\n          limits:\n            cpu: 500m\n            memory: 512Mi\n          requests:\n            cpu: 250m\n            memory: 256Mi`
                }

                if (includeHealthChecks) {
                    template += `\n        livenessProbe:\n          httpGet:\n            path: /health\n            port: 80\n          initialDelaySeconds: 30\n          periodSeconds: 10\n        readinessProbe:\n          httpGet:\n            path: /ready\n            port: 80\n          initialDelaySeconds: 5\n          periodSeconds: 5`
                }
                break

            case "Service":
                template += `  selector:\n    app: component-name\n  ports:\n  - port: 80\n    targetPort: 80\n    protocol: TCP\n  type: ClusterIP`
                break

            case "ConfigMap":
                template += `  data:\n    config.yaml: |\n      # Configuration data here\n    app.properties: |\n      # Application properties here`
                break

            case "Secret":
                template += `  type: Opaque\n  data:\n    username: dXNlcm5hbWU=\n    password: cGFzc3dvcmQ=`
                break

            default:
                template += `  # Add ${selectedKind.kind} specific configuration here`
        }

        return template
    }
    // Wizard steps configuration
    const steps: WizardStep[] = [
        { id: "select", title: "Select Resource Kind", completed: !!selectedKind, current: currentStep === 0 },
        { id: "validate", title: "Validation & Naming", completed: !!selectedKind && !!fileName && !hasNamingConflict, current: currentStep === 1 },
        { id: "configure", title: "Template & Dependencies", completed: false, current: currentStep === 2 }
    ]

    /**
     * Handle resource kind selection
     */
    const handleKindSelect = (kind: ResourceKind) => {
        setSelectedKind(kind)
        setFileName(generateFileName(kind.kind))
        setCurrentStep(1)
    }

    /**
     * Handle wizard step navigation
     */
    const handleStepChange = (stepIndex: number) => {
        if (stepIndex <= currentStep || steps[stepIndex - 1]?.completed) {
            setCurrentStep(stepIndex)
        }
    }

    /**
     * Handle resource creation
     */
    const handleCreateResource = () => {
        if (!selectedKind || !fileName || hasNamingConflict) return

        const resourceConfig: ResourceConfig = {
            kind: selectedKind.kind,
            apiVersion: selectedKind.apiVersion,
            fileName,
            template: generateTemplate(),
            includeLabels,
            includeResourceLimits,
            includeHealthChecks,
            linkedResources
        }

        onResourceCreate(resourceConfig)
    }

    return (
        <Card className={cn("w-full max-w-4xl mx-auto", className)}>
            <CardHeader>
                <CardTitle className={typography.tile.title}>Add New Kubernetes Resource</CardTitle>

                {/* Progress Steps */}
                <div className="flex items-center space-x-4 mt-4">
                    {steps.map((step, index) => (
                        <div key={step.id} className="flex items-center">
                            <Button
                                variant={step.current ? "default" : step.completed ? "outline" : "ghost"}
                                size="sm"
                                onClick={() => handleStepChange(index)}
                                className="h-8"
                            >
                                {step.completed && <CheckCircle className="w-4 h-4 mr-1" />}
                                {index + 1}
                            </Button>
                            <span className={cn(
                                "ml-2 text-sm",
                                step.current ? "font-medium" : "text-muted-foreground"
                            )}>
                                {step.title}
                            </span>
                            {index < steps.length - 1 && (
                                <div className="w-8 h-px bg-border mx-4" />
                            )}
                        </div>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Step 1: Resource Kind Selection */}
                {currentStep === 0 && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className={typography.form.label}>Search Resource Kind</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search for Kubernetes resource kinds..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className={typography.form.label}>Common Resources</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {['Deployment', 'Service', 'ConfigMap', 'Secret'].map(kind => {
                                    const resourceKind = resourceKinds.find(r => r.kind === kind)
                                    return resourceKind ? (
                                        <Button
                                            key={kind}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleKindSelect(resourceKind)}
                                            className="justify-start"
                                        >
                                            {kind}
                                        </Button>
                                    ) : null
                                })}
                            </div>
                        </div>

                        <ScrollArea className="h-64">
                            <div className="space-y-2">
                                {filteredResourceKinds.map(kind => (
                                    <Card
                                        key={kind.kind}
                                        className="cursor-pointer hover:bg-accent transition-colors"
                                        onClick={() => handleKindSelect(kind)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <div className="flex items-center space-x-2">
                                                        <h4 className={typography.card.title}>{kind.kind}</h4>
                                                        <Badge variant="secondary">{kind.category}</Badge>
                                                    </div>
                                                    <p className={typography.card.subtitle}>{kind.description}</p>
                                                    <p className="text-xs text-muted-foreground">API: {kind.apiVersion}</p>
                                                </div>
                                                <Plus className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Step 2: Validation & Naming */}
                {currentStep === 1 && selectedKind && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={typography.form.label}>Resource Kind</label>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className={typography.form.value}>{selectedKind.kind}</span>
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                </div>
                            </div>
                            <div>
                                <label className={typography.form.label}>API Version</label>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className={typography.form.value}>{selectedKind.apiVersion}</span>
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className={typography.form.label}>File Name</label>
                            <Input
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                placeholder="resource-name.yaml"
                                className={hasNamingConflict ? "border-destructive" : ""}
                            />

                            {hasNamingConflict && (
                                <Alert>
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        File name conflicts with existing resource. Try one of these alternatives:
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {getAlternativeNames(fileName).map(name => (
                                                <Button
                                                    key={name}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setFileName(name)}
                                                >
                                                    {name}
                                                </Button>
                                            ))}
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {!hasNamingConflict && fileName && (
                                <div className="flex items-center space-x-2 text-sm text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>File name is available</span>
                                </div>
                            )}
                        </div>

                        {selectedKind.dependencies && (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                    This resource typically depends on: {selectedKind.dependencies.join(", ")}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setCurrentStep(0)}>Back</Button>
                            <Button
                                onClick={() => setCurrentStep(2)}
                                disabled={!fileName || hasNamingConflict}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Template & Dependencies */}
                {currentStep === 2 && selectedKind && (
                    <div className="space-y-4">
                        <div className="space-y-4">
                            <h3 className={typography.card.title}>Template Options</h3>

                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="labels"
                                        checked={includeLabels}
                                        onCheckedChange={setIncludeLabels}
                                    />
                                    <label htmlFor="labels" className={typography.form.label}>
                                        Include common labels
                                    </label>
                                </div>

                                {selectedKind.kind === "Deployment" && (
                                    <>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="resources"
                                                checked={includeResourceLimits}
                                                onCheckedChange={setIncludeResourceLimits}
                                            />
                                            <label htmlFor="resources" className={typography.form.label}>
                                                Add resource limits and requests
                                            </label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="health"
                                                checked={includeHealthChecks}
                                                onCheckedChange={setIncludeHealthChecks}
                                            />
                                            <label htmlFor="health" className={typography.form.label}>
                                                Configure health checks (liveness/readiness probes)
                                            </label>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <h3 className={typography.card.title}>Generated Template Preview</h3>
                            <div className="h-64 w-full border rounded-md overflow-hidden">
                                <SyntaxHighlighter
                                    language="yaml"
                                    style={syntaxHighlighterTheme}
                                    showLineNumbers={true}
                                    wrapLines={true}
                                    customStyle={{
                                        ...syntaxHighlighterCustomStyle,
                                        height: '100%',
                                        margin: 0,
                                        borderRadius: '0.375rem'
                                    }}
                                    className="border-0"
                                >
                                    {generateTemplate()}                                    
                                </SyntaxHighlighter>                                
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setCurrentStep(1)}>Back</Button>
                            <div className="space-x-2">
                                <Button variant="outline" onClick={onCancel}>Cancel</Button>
                                <Button onClick={handleCreateResource}>Create Resource</Button>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}