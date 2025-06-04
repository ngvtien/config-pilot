import { useState, useEffect } from "react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { Badge } from "@/renderer/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs"
import { Key, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { VaultCredentialManager } from "@/renderer/services/vault-credential-manager"
import type { ContextData } from "@/shared/types/context-data"
import type { SettingsData, EnvironmentConfig } from "@/shared/types/settings-data"

interface VaultConfigurationProps {
  context: ContextData
  settings: SettingsData
  onSettingsChange: (settings: SettingsData) => void
}

const ENVIRONMENTS = ['dev', 'sit', 'uat', 'prod'] as const
type Environment = typeof ENVIRONMENTS[number]

export function VaultConfigurationSection({ context, settings, onSettingsChange }: VaultConfigurationProps) {
  const [activeEnvironment, setActiveEnvironment] = useState<Environment>(context.environment as Environment)
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
  
  const vaultCredManager = VaultCredentialManager.getInstance()

  useEffect(() => {
    loadEnvironmentConfigurations()
  }, [])

  const loadEnvironmentConfigurations = async () => {
    const newConfigs = { ...environmentConfigs }
    
    for (const env of ENVIRONMENTS) {
      // Load URL from settings
      const envConfig = settings.environments?.[env]
      if (envConfig?.vault?.url) {
        newConfigs[env].url = envConfig.vault.url
        newConfigs[env].namespace = envConfig.vault.namespace || ''
      }
      
      // Check for stored credentials
      const stored = await vaultCredManager.getVaultCredentials(env)
      newConfigs[env].hasStoredCredentials = !!stored
    }
    
    setEnvironmentConfigs(newConfigs)
  }

  const updateEnvironmentConfig = (env: Environment, field: string, value: string) => {
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
      // Update settings
      const updatedSettings = {
        ...settings,
        environments: {
          ...settings.environments,
          [env]: {
            ...settings.environments?.[env],
            vault: {
              url: config.url,
              namespace: config.namespace || undefined,
              authMethod: 'token' as const
            }
          }
        }
      }
      onSettingsChange(updatedSettings)

      // Store credentials securely if token provided
      if (config.token) {
        await vaultCredManager.storeVaultCredentials({
          url: config.url,
          token: config.token,
          authMethod: 'token',
          namespace: config.namespace
        }, env)
        
        // Clear token from memory
        updateEnvironmentConfig(env, 'token', '')
        updateEnvironmentConfig(env, 'hasStoredCredentials', true)
      }

      toast({ title: `Vault configuration saved for ${env.toUpperCase()}` })
    } catch (error) {
      toast({ 
        title: `Failed to save Vault configuration for ${env.toUpperCase()}`, 
        description: error.message,
        variant: "destructive" 
      })
    }
  }

  const testEnvironmentConnection = async (env: Environment) => {
    const config = environmentConfigs[env]
    updateEnvironmentConfig(env, 'isTestingConnection', true)
    
    try {
      const isConnected = await window.electronAPI.testVaultConnection(
        config.url, 
        config.token || await getStoredToken(env)
      )
      updateEnvironmentConfig(env, 'connectionStatus', isConnected ? 'success' : 'error')
    } catch (error) {
      updateEnvironmentConfig(env, 'connectionStatus', 'error')
    } finally {
      updateEnvironmentConfig(env, 'isTestingConnection', false)
    }
  }

  const getStoredToken = async (env: Environment): Promise<string | null> => {
    const stored = await vaultCredManager.getVaultCredentials(env)
    return stored?.token || null
  }

  const clearEnvironmentCredentials = async (env: Environment) => {
    await vaultCredManager.removeVaultCredentials(env)
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

  const renderEnvironmentTab = (env: Environment) => {
    const config = environmentConfigs[env]
    const isCurrentEnvironment = context.environment === env
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant={isCurrentEnvironment ? "default" : "secondary"}>
            {env.toUpperCase()}
          </Badge>
          {isCurrentEnvironment && (
            <Badge variant="outline">Current Environment</Badge>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          {getEnvironmentDescription(env)}
        </p>

        <div className="space-y-2">
          <Label htmlFor={`vault-url-${env}`}>Vault URL</Label>
          <Input
            id={`vault-url-${env}`}
            placeholder={`https://vault-${env}.company.com`}
            value={config.url}
            onChange={(e) => updateEnvironmentConfig(env, 'url', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`vault-namespace-${env}`}>Vault Namespace (Optional)</Label>
          <Input
            id={`vault-namespace-${env}`}
            placeholder={`${env}/secrets`}
            value={config.namespace}
            onChange={(e) => updateEnvironmentConfig(env, 'namespace', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`vault-token-${env}`}>Vault Token</Label>
          <Input
            id={`vault-token-${env}`}
            type="password"
            placeholder="hvs.XXXXXXXXXXXXXX"
            value={config.token}
            onChange={(e) => updateEnvironmentConfig(env, 'token', e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Token will be stored securely per environment
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => saveEnvironmentConfiguration(env)}>
            Save {env.toUpperCase()} Config
          </Button>
          <Button 
            variant="outline" 
            onClick={() => testEnvironmentConnection(env)}
            disabled={!config.url || config.isTestingConnection}
          >
            {config.isTestingConnection ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Test Connection
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
                  ? `Successfully connected to ${env.toUpperCase()} Vault`
                  : `Failed to connect to ${env.toUpperCase()} Vault. Check URL and token.`
                }
              </AlertDescription>
            </div>
          </Alert>
        )}

        {config.hasStoredCredentials && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Stored</Badge>
              <span className="text-sm">{env.toUpperCase()} Vault credentials are securely stored</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => clearEnvironmentCredentials(env)}>
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
          Environment-Aware Vault Configuration
        </CardTitle>
        <CardDescription>
          Configure HashiCorp Vault connections per environment. Each environment can have different Vault instances, namespaces, and credentials.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeEnvironment} onValueChange={(value) => setActiveEnvironment(value as Environment)}>
          <TabsList className="grid w-full grid-cols-4">
            {ENVIRONMENTS.map(env => (
              <TabsTrigger key={env} value={env} className="relative">
                {env.toUpperCase()}
                {environmentConfigs[env].hasStoredCredentials && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {ENVIRONMENTS.map(env => (
            <TabsContent key={env} value={env}>
              {renderEnvironmentTab(env)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}