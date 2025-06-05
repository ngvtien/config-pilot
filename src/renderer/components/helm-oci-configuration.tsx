import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import { useToast } from '@/renderer/hooks/use-toast'
import { useApiCall } from '@/renderer/hooks/use-api-call'
import { HelmOCICredentialManager } from '@/renderer/services/helm-oci-credential-manager'
import { HelmOCIApiService } from '@/renderer/services/helm-oci-api-service'
import { Environment } from '@/shared/types/context-data'
import { SettingsData } from '@/shared/types/settings-data'
import { ContextData } from '@/shared/types/context-data'

interface HelmOCIConfigurationProps {
  context: ContextData
  settings: SettingsData
  onSettingsChange: (settings: SettingsData) => void
  onContextChange: (context: ContextData) => void
}

export function HelmOCIConfigurationSection({ context, settings, onSettingsChange, onContextChange }: HelmOCIConfigurationProps) {
  const { toast } = useToast()
  const currentEnvironment = context.environment

  const [config, setConfig] = useState({
    registryUrl: '',
    authMethod: 'anonymous' as 'token' | 'username' | 'anonymous' | 'aws' | 'gcp' | 'azure',
    username: '',
    password: '',
    token: '',
    insecureSkipTLSVerify: false,
    awsRegion: '',
    gcpProject: '',
    azureSubscription: '',
    hasStoredCredentials: false
  })

  // Load repositories using useApiCall
  const { data: repositories, loading: repositoriesLoading, error: repositoriesError, execute: loadRepositories } = useApiCall({
    apiFunction: () => HelmOCIApiService.getRepositories(currentEnvironment),
    onSuccess: (repos) => {
      console.log('Helm OCI repositories loaded:', repos)
    },
    onError: (error) => {
      console.error('Failed to load Helm OCI repositories:', error)
    }
  })

  useEffect(() => {
    loadConfiguration()
  }, [currentEnvironment])

  const loadConfiguration = async () => {
    try {
      const helmOCICredManager = HelmOCICredentialManager
      
      // Load settings for current environment
      const envConfig = settings.helmOCIConfigurations?.[currentEnvironment]
      if (envConfig) {
        setConfig(prev => ({
          ...prev,
          registryUrl: envConfig.registryUrl || '',
          authMethod: envConfig.authMethod || 'anonymous',
          insecureSkipTLSVerify: envConfig.insecureSkipTLSVerify || false,
          awsRegion: envConfig.awsRegion || '',
          gcpProject: envConfig.gcpProject || '',
          azureSubscription: envConfig.azureSubscription || ''
        }))
      }
      
      // Check for stored credentials
      const stored = await helmOCICredManager.getCredentials(currentEnvironment)
      setConfig(prev => ({
        ...prev,
        hasStoredCredentials: stored !== null,
        username: stored?.username || '',
        token: stored?.token || ''
      }))
    } catch (error) {
      console.error('Failed to load Helm OCI configuration:', error)
    }
  }

  const handleSaveConfiguration = async () => {
    try {
      // Update settings
      const updatedSettings = {
        ...settings,
        helmOCIConfigurations: {
          ...settings.helmOCIConfigurations,
          [currentEnvironment]: {
            registryUrl: config.registryUrl,
            authMethod: config.authMethod,
            insecureSkipTLSVerify: config.insecureSkipTLSVerify,
            awsRegion: config.awsRegion,
            gcpProject: config.gcpProject,
            azureSubscription: config.azureSubscription
          }
        }
      }
      onSettingsChange(updatedSettings)
      
      // Store credentials if provided
      if (config.authMethod !== 'anonymous' && (config.username || config.token)) {
        const credentials = {
          registryUrl: config.registryUrl,
          authMethod: config.authMethod,
          username: config.username,
          password: config.password,
          token: config.token,
          insecureSkipTLSVerify: config.insecureSkipTLSVerify,
          awsRegion: config.awsRegion,
          gcpProject: config.gcpProject,
          azureSubscription: config.azureSubscription
        }
        await HelmOCICredentialManager.storeCredentials(currentEnvironment, credentials)
      }
      
      toast({
        title: "Configuration Saved",
        description: `Helm OCI configuration for ${currentEnvironment} has been saved successfully.`
      })
      
      await loadConfiguration()
    } catch (error: any) {
      console.error('Failed to save Helm OCI configuration:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save Helm OCI configuration",
      })
    }
  }

  // Test connection using useApiCall
  const { loading: testLoading, execute: testConnection } = useApiCall({
    apiFunction: () => HelmOCIApiService.testConnection(
      currentEnvironment,
      config.registryUrl,
      config.authMethod,
      config.username,
      config.password,
      config.token,
      config.insecureSkipTLSVerify
    ),
    onSuccess: (success) => {
      toast({
        title: success ? "Connection Successful" : "Connection Failed",
        description: success 
          ? `Successfully connected to Helm OCI registry at ${config.registryUrl}`
          : "Failed to connect to Helm OCI registry. Please check your configuration.",
        variant: success ? "default" : "destructive"
      })
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Connection Test Failed",
        description: error.message || "Failed to test Helm OCI connection",
      })
    }
  })

  const handleInputChange = (field: string, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const renderAuthFields = () => {
    switch (config.authMethod) {
      case 'token':
        return (
          <div className="space-y-2">
            <Label htmlFor={`helm-oci-token-${currentEnvironment}`}>Bearer Token</Label>
            <Input
              id={`helm-oci-token-${currentEnvironment}`}
              type="password"
              placeholder="Enter Helm OCI bearer token"
              value={config.token}
              onChange={(e) => handleInputChange('token', e.target.value)}
            />
          </div>
        )
      case 'username':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor={`helm-oci-username-${currentEnvironment}`}>Username</Label>
              <Input
                id={`helm-oci-username-${currentEnvironment}`}
                placeholder="Enter username"
                value={config.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`helm-oci-password-${currentEnvironment}`}>Password</Label>
              <Input
                id={`helm-oci-password-${currentEnvironment}`}
                type="password"
                placeholder="Enter password"
                value={config.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
              />
            </div>
          </>
        )
      case 'aws':
        return (
          <div className="space-y-2">
            <Label htmlFor={`helm-oci-aws-region-${currentEnvironment}`}>AWS Region</Label>
            <Input
              id={`helm-oci-aws-region-${currentEnvironment}`}
              placeholder="e.g., us-west-2"
              value={config.awsRegion}
              onChange={(e) => handleInputChange('awsRegion', e.target.value)}
            />
          </div>
        )
      case 'gcp':
        return (
          <div className="space-y-2">
            <Label htmlFor={`helm-oci-gcp-project-${currentEnvironment}`}>GCP Project ID</Label>
            <Input
              id={`helm-oci-gcp-project-${currentEnvironment}`}
              placeholder="Enter GCP project ID"
              value={config.gcpProject}
              onChange={(e) => handleInputChange('gcpProject', e.target.value)}
            />
          </div>
        )
      case 'azure':
        return (
          <div className="space-y-2">
            <Label htmlFor={`helm-oci-azure-subscription-${currentEnvironment}`}>Azure Subscription ID</Label>
            <Input
              id={`helm-oci-azure-subscription-${currentEnvironment}`}
              placeholder="Enter Azure subscription ID"
              value={config.azureSubscription}
              onChange={(e) => handleInputChange('azureSubscription', e.target.value)}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Helm OCI Configuration</CardTitle>
        <CardDescription>
          Configure Helm OCI registry connection settings for the {currentEnvironment} environment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`helm-oci-registry-url-${currentEnvironment}`}>Registry URL</Label>
          <Input
            id={`helm-oci-registry-url-${currentEnvironment}`}
            placeholder="oci://registry.example.com"
            value={config.registryUrl}
            onChange={(e) => handleInputChange('registryUrl', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`helm-oci-auth-method-${currentEnvironment}`}>Authentication Method</Label>
          <Select value={config.authMethod} onValueChange={(value) => handleInputChange('authMethod', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select authentication method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anonymous">Anonymous</SelectItem>
              <SelectItem value="token">Bearer Token</SelectItem>
              <SelectItem value="username">Username/Password</SelectItem>
              <SelectItem value="aws">AWS ECR</SelectItem>
              <SelectItem value="gcp">Google Container Registry</SelectItem>
              <SelectItem value="azure">Azure Container Registry</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {renderAuthFields()}

        <div className="flex items-center space-x-2">
          <Checkbox
            id={`helm-oci-insecure-${currentEnvironment}`}
            checked={config.insecureSkipTLSVerify}
            onCheckedChange={(checked) => handleInputChange('insecureSkipTLSVerify', checked)}
          />
          <Label htmlFor={`helm-oci-insecure-${currentEnvironment}`}>Skip TLS Verification (Insecure)</Label>
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={testConnection} 
            disabled={testLoading || !config.registryUrl}
            variant="outline"
          >
            {testLoading ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button 
            onClick={handleSaveConfiguration}
            disabled={!config.registryUrl}
          >
            Save Configuration
          </Button>
        </div>

        {config.hasStoredCredentials && (
          <div className="text-sm text-green-600">
            ✓ Stored credentials found for {currentEnvironment}
          </div>
        )}
      </CardContent>
    </Card>
  )
}