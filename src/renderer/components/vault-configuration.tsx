import { useState, useEffect } from "react"
import { toast } from "@/renderer/hooks/use-toast"
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { Badge } from "@/renderer/components/ui/badge"
import { Key, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { VaultCredentialManager } from "@/renderer/services/vault-credential-manager"
import type { ContextData, Environment } from "@/shared/types/context-data"
import type { SettingsData } from "@/shared/types/settings-data"
import { useApiCall } from "@/renderer/hooks/use-api-call"

interface VaultConfigurationProps {
  context: ContextData
  settings: SettingsData
  onSettingsChange: (settings: SettingsData) => void
  onContextChange?: (context: ContextData) => void
}

const ENVIRONMENTS: Environment[] = ['dev', 'sit', 'uat', 'prod']

export function VaultConfigurationSection({ context, settings, onSettingsChange, onContextChange }: VaultConfigurationProps) {
  // Use the environment from context directly
  const currentEnvironment = context.environment as Environment

  const [environmentConfigs, setEnvironmentConfigs] = useState<Record<Environment, {
    url: string
    token: string
    namespace: string
    connectionStatus: 'unknown' | 'success' | 'error'
    isTestingConnection: boolean
    hasStoredCredentials: boolean
  }>>({
    dev: { url: '', token: '', namespace: '', connectionStatus: 'unknown', isTestingConnection: false, hasStoredCredentials: false },
    sit: { url: '', token: '', namespace: '', connectionStatus: 'unknown', isTestingConnection: false, hasStoredCredentials: false },
    uat: { url: '', token: '', namespace: '', connectionStatus: 'unknown', isTestingConnection: false, hasStoredCredentials: false },
    prod: { url: '', token: '', namespace: '', connectionStatus: 'unknown', isTestingConnection: false, hasStoredCredentials: false }
  })

  const vaultCredManager = VaultCredentialManager

  useEffect(() => {
    loadEnvironmentConfigurations()
  }, [])

  // Reload configuration when environment changes
  useEffect(() => {
    loadCurrentEnvironmentConfiguration()
  }, [currentEnvironment])

  const loadEnvironmentConfigurations = async () => {
    const newConfigs = { ...environmentConfigs }

    for (const env of ENVIRONMENTS) {
      // ✅ Fix: Use correct property path
      const envConfig = settings.vaultConfigurations?.[env]
      if (envConfig?.url) {
        newConfigs[env].url = envConfig.url
        newConfigs[env].namespace = envConfig.namespace || ''
      }

      // Check for stored credentials
      const stored = await vaultCredManager.getCredentials(env)
      newConfigs[env].hasStoredCredentials = !!stored
    }

    setEnvironmentConfigs(newConfigs)
  }

  const loadCurrentEnvironmentConfiguration = async () => {
    // ✅ Fix: Use correct property path
    const envConfig = settings.vaultConfigurations?.[currentEnvironment]
    if (envConfig?.url) {
      updateEnvironmentConfig(currentEnvironment, 'url', envConfig.url)
      updateEnvironmentConfig(currentEnvironment, 'namespace', envConfig.namespace || '')
    }

    // Check for stored credentials
    const stored = await vaultCredManager.getCredentials(currentEnvironment)
    updateEnvironmentConfig(currentEnvironment, 'hasStoredCredentials', !!stored)
  }

  const updateEnvironmentConfig = (env: Environment, field: string, value: string | boolean) => {
    setEnvironmentConfigs(prev => ({
      ...prev,
      [env]: {
        ...prev[env],
        [field]: value
      }
    }))
  }

  const saveEnvironmentConfiguration = async (env: Environment) => {
    const config = environmentConfigs[env]

    try {
      // Check if URL changed from stored credentials
      const existingCreds = await vaultCredManager.getCredentials(env)
      if (existingCreds && existingCreds.url !== config.url) {
        // Clear old credentials if URL changed
        await vaultCredManager.deleteCredentials(env)
        console.log(`Cleared old credentials due to URL change: ${existingCreds.url} -> ${config.url}`)
      }

      // ✅ Fix: Update correct property structure
      const updatedSettings = {
        ...settings,
        vaultConfigurations: {
          ...settings.vaultConfigurations,
          [env]: {
            url: config.url,
            namespace: config.namespace || undefined,
            authMethod: 'token' as const
          }
        }
      }
      onSettingsChange(updatedSettings)

      // Store credentials securely if token provided
      if (config.token) {
        await vaultCredManager.storeCredentials(env, {
          url: config.url,
          token: config.token,
          authMethod: 'token',
          namespace: config.namespace
        })

        // Clear token from memory
        updateEnvironmentConfig(env, 'token', '')
        updateEnvironmentConfig(env, 'hasStoredCredentials', true)
      }

      toast({ title: `Vault configuration saved for ${env.toUpperCase()}` })
    } catch (error: any) {
      toast({
        title: `Failed to save Vault configuration for ${env.toUpperCase()}`,
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const connectionTest = useApiCall({
    apiFunction: async () => {
      const config = environmentConfigs[currentEnvironment]
      const token = config.token || await getStoredToken(currentEnvironment)
      if (!token) {
        throw new Error('No token available for testing')
      }
      return await window.electronAPI.vault.testConnection(
        currentEnvironment,
        config.url,
        token,
        config.namespace
      )
    },
    onSuccess: (result: { success: any; message: any }) => {
      updateEnvironmentConfig(currentEnvironment, 'connectionStatus', result.success ? 'success' : 'error')
      toast({
        title: result.success ? "Connection Successful" : "Connection Failed",
        description: result.success
          ? `Successfully connected to ${currentEnvironment.toUpperCase()} Vault at ${environmentConfigs[currentEnvironment].url}`
          : result.message || "Failed to connect to Vault. Please check your configuration.",
        variant: result.success ? "default" : "destructive"
      })
    },
    onError: (error: { message: any }) => {
      updateEnvironmentConfig(currentEnvironment, 'connectionStatus', 'error')
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to test Vault connection",
        variant: "destructive"
      })
    }
  })

  const getStoredToken = async (env: Environment): Promise<string | null> => {
    const stored = await vaultCredManager.getCredentials(env)
    return stored?.token || null
  }

  const clearEnvironmentCredentials = async (env: Environment) => {
    await vaultCredManager.deleteCredentials(env)
    updateEnvironmentConfig(env, 'hasStoredCredentials', false)
    toast({ title: `Vault credentials cleared for ${env.toUpperCase()}` })
  }

  const getEnvironmentDescription = (env: Environment) => {
    const descriptions = {
      dev: 'Development environment - typically uses shared Vault instance',
      sit: 'System Integration Testing - may share Vault with dev or have dedicated instance',
      uat: 'User Acceptance Testing - usually dedicated Vault instance with production-like setup',
      prod: 'Production - dedicated, highly secured Vault instance'
    }
    return descriptions[env]
  }

  const handleEnvironmentSwitch = (env: Environment) => {
    if (onContextChange) {
      onContextChange({ ...context, environment: env })
    }
  }

  const renderCurrentEnvironmentConfig = () => {
    const config = environmentConfigs[currentEnvironment]

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="default">
            {currentEnvironment.toUpperCase()}
          </Badge>
          <Badge variant="outline">Current Environment</Badge>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {getEnvironmentDescription(currentEnvironment)}
        </p>

        <div className="space-y-2">
          <Label htmlFor={`vault-url-${currentEnvironment}`}>Vault URL</Label>
          <Input
            id={`vault-url-${currentEnvironment}`}
            placeholder={`https://vault-${currentEnvironment}.company.com`}
            value={config.url}
            onChange={(e) => updateEnvironmentConfig(currentEnvironment, 'url', e.target.value)}
          />
          
          {/*
          <Input
            id={`vault-url-${currentEnvironment}`}
            placeholder={
              currentEnvironment === 'dev'
                ? 'http://localhost:9201 (API port, not 9200)'
                : `https://vault-${currentEnvironment}.company.com`
            }
            value={config.url}
            onChange={(e) => updateEnvironmentConfig(currentEnvironment, 'url', e.target.value)}
          />
          */}

          {currentEnvironment === 'dev' && (
            <p className="text-sm text-muted-foreground">
              💡 For local development: Use port <strong>9201</strong> for API calls, port 9200 is for the web UI
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`vault-namespace-${currentEnvironment}`}>Vault Namespace (Optional)</Label>
          <Input
            id={`vault-namespace-${currentEnvironment}`}
            placeholder={`${currentEnvironment}/secrets`}
            value={config.namespace}
            onChange={(e) => updateEnvironmentConfig(currentEnvironment, 'namespace', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`vault-token-${currentEnvironment}`}>Vault Token</Label>
          <Input
            id={`vault-token-${currentEnvironment}`}
            type="password"
            placeholder="hvs.XXXXXXXXXXXXXX"
            value={config.token}
            onChange={(e) => updateEnvironmentConfig(currentEnvironment, 'token', e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Token will be stored securely for this environment
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={connectionTest.execute}
            disabled={!config.url || connectionTest.loading}
          >
            {config.isTestingConnection ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Test Connection
          </Button>
          <Button onClick={() => saveEnvironmentConfiguration(currentEnvironment)}>
            Save {currentEnvironment.toUpperCase()} Config
          </Button>
        </div>

        {config.connectionStatus !== 'unknown' && (
          <Alert>
            <div className="flex items-center gap-2">
              {config.connectionStatus === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertDescription>
                {config.connectionStatus === 'success'
                  ? `Successfully connected to ${currentEnvironment.toUpperCase()} Vault`
                  : `Failed to connect to ${currentEnvironment.toUpperCase()} Vault. Check URL and token.`
                }
              </AlertDescription>
            </div>
          </Alert>
        )}

        {config.hasStoredCredentials && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Stored</Badge>
              <span className="text-sm">{currentEnvironment.toUpperCase()} Vault credentials are securely stored</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => clearEnvironmentCredentials(currentEnvironment)}>
              Clear Credentials
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Vault Configuration - {currentEnvironment.toUpperCase()}
        </CardTitle>
        <CardDescription>
          Configure HashiCorp Vault connection for the current environment ({currentEnvironment}).
          Switch environments using the context selector above.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderCurrentEnvironmentConfig()}

        {/* Environment Status Overview */}
        {onContextChange && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Other Environments</h4>
            <div className="flex gap-2 flex-wrap">
              {ENVIRONMENTS.filter(env => env !== currentEnvironment).map(env => (
                <Badge
                  key={env}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => handleEnvironmentSwitch(env)}
                >
                  {env.toUpperCase()}
                  {environmentConfigs[env].hasStoredCredentials && (
                    <div className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full" />
                  )}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Click to switch environment. Green dot indicates stored credentials.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}