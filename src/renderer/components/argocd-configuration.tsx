import { useState, useEffect } from 'react'
import { toast } from "@/renderer/hooks/use-toast"
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { Badge } from "@/renderer/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/renderer/components/ui/select"
import { Checkbox } from "@/renderer/components/ui/checkbox"
import { GitBranch, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { ArgoCDCredentialManager } from "@/renderer/services/argocd-credential-manager"
import { useApiCall } from '@/renderer/hooks/use-api-call'
import { ArgoCDApiService } from '@/renderer/services/argocd-api-service'

import type { Environment, ContextData } from "@/shared/types/context-data"
import type { SettingsData } from "@/shared/types/settings-data"

interface ArgoCDConfigurationProps {
    context: ContextData
    settings: SettingsData
    onSettingsChange: (settings: SettingsData) => void
    onContextChange?: (context: ContextData) => void
}

const ENVIRONMENTS: Environment[] = ['dev', 'sit', 'uat', 'prod']

export function ArgoCDConfigurationSection({ context, settings, onSettingsChange, onContextChange }: ArgoCDConfigurationProps) {
    const currentEnvironment = context.environment as Environment

    const [config, setConfig] = useState({
        url: '',
        token: '',
        username: '',
        password: '',
        authMethod: 'token' as 'token' | 'username' | 'sso',
        insecureSkipTLSVerify: false,
        connectionStatus: 'unknown' as 'unknown' | 'success' | 'error',
        isTestingConnection: false,
        hasStoredCredentials: false
    })

    const applicationsList = useApiCall({
        apiFunction: () => ArgoCDApiService.getApplications(currentEnvironment),
        onSuccess: (apps: any) => {
          console.log('ArgoCD applications loaded:', apps)
        },
        onError: (error: any) => {
          toast({
            title: "Failed to Load Applications",
            description: error.message,
            variant: "destructive"
          })
        }
      })

    // Load applications when environment changes
    useEffect(() => {
        if (config.hasStoredCredentials) {
        applicationsList.execute()
        }
    }, [currentEnvironment, config.hasStoredCredentials])

    const argoCDCredManager = ArgoCDCredentialManager

    useEffect(() => {
        loadCurrentEnvironmentConfiguration()
    }, [currentEnvironment])

    const loadCurrentEnvironmentConfiguration = async () => {
        // Load URL and settings from settings
        const envConfig = settings.argoCDConfigurations?.[currentEnvironment]
        if (envConfig) {
            setConfig(prev => ({
                ...prev,
                url: envConfig.url,
                authMethod: envConfig.authMethod,
                insecureSkipTLSVerify: envConfig.insecureSkipTLSVerify || false
            }))
        }

        // Check for stored credentials
        const stored = await argoCDCredManager.getCredentials(currentEnvironment)
        setConfig(prev => ({
            ...prev,
            hasStoredCredentials: !!stored,
            connectionStatus: stored ? 'unknown' : 'unknown'
        }))
    }

    const updateConfig = (field: string, value: string | boolean) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }))
    }

    const saveConfiguration = async () => {
        try {
            // Update settings
            const updatedSettings = {
                ...settings,
                argoCDConfigurations: {
                    ...settings.argoCDConfigurations,
                    [currentEnvironment]: {
                        url: config.url,
                        authMethod: config.authMethod,
                        insecureSkipTLSVerify: config.insecureSkipTLSVerify
                    }
                }
            }
            onSettingsChange(updatedSettings)

            // Store credentials securely
            const credentials = {
                url: config.url,
                authMethod: config.authMethod,
                insecureSkipTLSVerify: config.insecureSkipTLSVerify,
                ...(config.authMethod === 'token' ? { token: config.token } : {}),
                ...(config.authMethod === 'username' ? { username: config.username, password: config.password } : {})
            }

            await argoCDCredManager.storeCredentials(currentEnvironment, credentials)

            updateConfig('hasStoredCredentials', true)
            toast({
                title: "Configuration Saved",
                description: `ArgoCD configuration for ${currentEnvironment} has been saved successfully.`
            })
        } catch (error: any) {
            console.error('Failed to save ArgoCD configuration:', error)
            toast({
                title: "Save Failed",
                description: error.message || "Failed to save ArgoCD configuration",
                variant: "destructive"
            })
        }
    }

    const connectionTest = useApiCall({
        apiFunction: () => ArgoCDApiService.testConnection(
            currentEnvironment,
            config.url,
            config.authMethod === 'token' ? config.token : '',
            config.insecureSkipTLSVerify
        ),
        onSuccess: (success: boolean) => {
            updateConfig('connectionStatus', success ? 'success' : 'error')
            toast({
                title: success ? "Connection Successful" : "Connection Failed",
                description: success
                    ? `Successfully connected to ArgoCD at ${config.url}`
                    : "Failed to connect to ArgoCD. Please check your configuration.",
                variant: success ? "default" : "destructive"
            })
        },
        onError: (error: any) => {
            updateConfig('connectionStatus', 'error')
            toast({
                title: "Connection Failed",
                description: error.message || "Failed to test ArgoCD connection",
                variant: "destructive"
            })
        }
    })

    const testConnection = async () => {
        if (!config.url || (!config.token && config.authMethod === 'token') ||
            (!config.username && !config.password && config.authMethod === 'username')) {
            toast({
                title: "Missing Information",
                description: "Please fill in all required fields before testing connection.",
                variant: "destructive"
            })
            return
        }

        updateConfig('connectionStatus', 'unknown')
        await connectionTest.execute()
    }

    const switchEnvironment = (env: Environment) => {
        if (onContextChange) {
            onContextChange({ ...context, environment: env })
        }
    }

    const getConnectionStatusIcon = () => {
        switch (config.connectionStatus) {
            case 'success':
                return <CheckCircle className="h-4 w-4 text-green-500" />
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />
            default:
                return null
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <GitBranch className="h-5 w-5" />
                        <CardTitle>ArgoCD Configuration</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">Environment:</span>
                        {onContextChange ? (
                            <div className="flex space-x-1">
                                {ENVIRONMENTS.map((env) => (
                                    <Badge
                                        key={env}
                                        variant={env === currentEnvironment ? "default" : "outline"}
                                        className="cursor-pointer"
                                        onClick={() => switchEnvironment(env)}
                                    >
                                        {env.toUpperCase()}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <Badge variant="default">{currentEnvironment.toUpperCase()}</Badge>
                        )}
                    </div>
                </div>
                <CardDescription>
                    Configure ArgoCD connection settings for the {currentEnvironment} environment.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor={`argocd-url-${currentEnvironment}`}>ArgoCD Server URL</Label>
                    <Input
                        id={`argocd-url-${currentEnvironment}`}
                        placeholder="https://argocd.example.com"
                        value={config.url}
                        onChange={(e) => updateConfig('url', e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor={`argocd-auth-method-${currentEnvironment}`}>Authentication Method</Label>
                    <Select value={config.authMethod} onValueChange={(value) => updateConfig('authMethod', value)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select authentication method" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="token">Bearer Token</SelectItem>
                            <SelectItem value="username">Username/Password</SelectItem>
                            <SelectItem value="sso">SSO (External)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {config.authMethod === 'token' && (
                    <div className="space-y-2">
                        <Label htmlFor={`argocd-token-${currentEnvironment}`}>Bearer Token</Label>
                        <Input
                            id={`argocd-token-${currentEnvironment}`}
                            type="password"
                            placeholder="Enter ArgoCD bearer token"
                            value={config.token}
                            onChange={(e) => updateConfig('token', e.target.value)}
                        />
                    </div>
                )}

                {config.authMethod === 'username' && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor={`argocd-username-${currentEnvironment}`}>Username</Label>
                            <Input
                                id={`argocd-username-${currentEnvironment}`}
                                placeholder="Enter username"
                                value={config.username}
                                onChange={(e) => updateConfig('username', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`argocd-password-${currentEnvironment}`}>Password</Label>
                            <Input
                                id={`argocd-password-${currentEnvironment}`}
                                type="password"
                                placeholder="Enter password"
                                value={config.password}
                                onChange={(e) => updateConfig('password', e.target.value)}
                            />
                        </div>
                    </>
                )}

                <div className="flex items-center space-x-2">
                    <Checkbox
                        id={`argocd-insecure-${currentEnvironment}`}
                        checked={config.insecureSkipTLSVerify}
                        onCheckedChange={(checked) => updateConfig('insecureSkipTLSVerify', checked)}
                    />
                    <Label htmlFor={`argocd-insecure-${currentEnvironment}`}>Skip TLS Verification (Insecure)</Label>
                </div>

                {config.hasStoredCredentials && (
                    <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                            Credentials are securely stored for this environment.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex space-x-2">
                    <Button
                        onClick={testConnection}
                        disabled={connectionTest.loading || !config.url}
                        variant="outline"
                    >
                        {connectionTest.loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            getConnectionStatusIcon()
                        )}
                        {connectionTest.loading ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button onClick={saveConfiguration}>
                        Save Configuration
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}