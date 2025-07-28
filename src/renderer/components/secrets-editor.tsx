"use client"

import type React from "react"
import { useRef, useState, useEffect } from "react"
import yaml from "js-yaml"
import {
  Search,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  Loader2} from "lucide-react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Card, CardContent } from "@/renderer/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs"
import { useToast } from "@/renderer/hooks/use-toast"
import CodeMirror from "@uiw/react-codemirror"
import { yaml as yamlLanguage } from "@codemirror/lang-yaml"
import { readOnlyExtensions } from "@/renderer/lib/codemirror-themes"
import { buildConfigPath } from "@/renderer/lib/path-utils"
import type { ContextData } from "@/shared/types/context-data"

import { VaultCredentialManager } from "@/renderer/services/vault-credential-manager"
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { useDialog } from '@/renderer/hooks/useDialog'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable"
import { useTheme } from '@/renderer/components/theme-provider'
import { SecretsTable } from "./secrets/SecretsTable"
import { SecretEditModal } from "./secrets/SecretEditModal"

interface SecretEditorProps {
  initialValue?: string
  onChange?: (value: string) => void
  environment?: string
  context?: ContextData
  baseDirectory?: string
}

interface SecretItem {
  name: string
  vaultRef: {
    path: string
    key: string
  }
  value?: string
}

type TabType = "secrets" | "external-secrets"

const SecretsEditor: React.FC<SecretEditorProps> = ({
  initialValue = "",
  onChange,
  environment = "dev",
  context,
  baseDirectory = "/opt/config-pilot/configs",
}) => {
  const { toast } = useToast()
  const [yamlContent, setYamlContent] = useState(initialValue)
  const [formData, setFormData] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [secretValues, setSecretValues] = useState<Record<string, string>>({})
  const [editingSecretIndex, setEditingSecretIndex] = useState<number | null>(null)
  const [secretInputValue, setSecretInputValue] = useState("")
  const [showSecretValue, setShowSecretValue] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSecrets, setSelectedSecrets] = useState<number[]>([])
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: "ascending" | "descending"
  } | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("secrets")
  const [externalSecretsYaml, setExternalSecretsYaml] = useState("")

  // State for the edit modal
  const [editSecretName, setEditSecretName] = useState("")
  const [editVaultPath, setEditVaultPath] = useState("")
  const [editVaultKey, setEditVaultKey] = useState("")

  const [vaultConnectionStatus, setVaultConnectionStatus] = useState<'unknown' | 'success' | 'error' | 'checking'>('unknown')
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [hasVaultCredentials, setHasVaultCredentials] = useState(false)
  const [secretVaultStatuses, setSecretVaultStatuses] = useState<Record<string, 'checking' | 'synced' | 'out-of-sync' | 'error'>>({})

  const { showConfirm, ConfirmDialog } = useDialog()

  const { theme } = useTheme()
  
  // Load values when component mounts or environment changes
  useEffect(() => {
    loadValues(environment)
  }, [environment])

  // Check vault connection status on mount and environment change
  useEffect(() => {
    checkVaultConnection()
  }, [environment])

  // Auto-load secret values from Vault when formData is ready and Vault is connected
  useEffect(() => {
    if (formData?.env && vaultConnectionStatus === 'success') {
      loadSecretValuesFromVault()
    }
  }, [formData, vaultConnectionStatus])

  const checkVaultConnection = async () => {
    try {
      setVaultConnectionStatus('checking')
      setVaultError(null)

      // Check if credentials are stored - use env instead of environment
      const credentials = await VaultCredentialManager.getCredentials(env as any)
      setHasVaultCredentials(!!credentials)

      if (!credentials) {
        setVaultConnectionStatus('error')
        setVaultError('No vault credentials configured. Please configure vault in settings.')
        return
      }

      // Test connection - use env instead of environment
      const result = await window.electronAPI.vault.testConnection(
        env,
        credentials.url,
        credentials.token,
        credentials.namespace
      )

      if (result.success) {
        setVaultConnectionStatus('success')
      } else {
        setVaultConnectionStatus('error')
        setVaultError(result.error || 'Failed to connect to vault')
      }
    } catch (error: any) {
      setVaultConnectionStatus('error')
      setVaultError(error.message || 'Failed to check vault connection')
    }
  }

  /**
   * Enhanced function to check if local values match vault values
   * This extends the existing loadSecretValuesFromVault pattern
   */
  const checkVaultSync = async () => {
    if (!formData?.env || vaultConnectionStatus !== 'success') {
      return
    }

    const statusUpdates: Record<string, 'checking' | 'synced' | 'out-of-sync' | 'error'> = {}

    for (const secret of formData.env) {
      if (secret.name && secret.vaultRef?.path && secret.vaultRef?.key) {
        statusUpdates[secret.name] = 'checking'
      }
    }
    setSecretVaultStatuses(prev => ({ ...prev, ...statusUpdates }))

    for (const secret of formData.env) {
      if (secret.name && secret.vaultRef?.path && secret.vaultRef?.key) {
        try {
          const result = await window.electronAPI.vault.readSecret(
            env,
            secret.vaultRef.path,
            secret.vaultRef.key
          )

          const localValue = secretValues[secret.name]
          const vaultValue = result.success ? result.value : null

          if (localValue && vaultValue && localValue === vaultValue) {
            statusUpdates[secret.name] = 'synced'
          } else if (localValue || vaultValue) {
            statusUpdates[secret.name] = 'out-of-sync'
          } else {
            // Both are empty - keep existing "No Value" logic
            delete statusUpdates[secret.name]
          }
        } catch (error: any) {
          statusUpdates[secret.name] = 'error'
        }
      }
    }

    setSecretVaultStatuses(prev => ({ ...prev, ...statusUpdates }))
  }

  /**
   * Load actual secret values from Vault for all configured secrets
   */
  const loadSecretValuesFromVault = async () => {
    if (!formData?.env || vaultConnectionStatus !== 'success') {
      return
    }

    const newSecretValues: Record<string, string> = {}

    for (const secret of formData.env) {
      if (secret.vaultRef?.path && secret.vaultRef?.key && secret.name) {
        try {
          const result = await window.electronAPI.vault.readSecret(
            env,
            secret.vaultRef.path,
            secret.vaultRef.key
          )

          if (result.success && result.value) {
            newSecretValues[secret.name] = result.value
            console.log(`✅ Loaded secret value for ${secret.name} from Vault`)
          } else {
            console.log(`ℹ️ No value found in Vault for ${secret.name}`)
          }
        } catch (error: any) {
          console.error(`❌ Failed to load secret ${secret.name} from Vault:`, error)
        }
      }
    }

    if (Object.keys(newSecretValues).length > 0) {
      setSecretValues(prev => ({ ...prev, ...newSecretValues }))
      toast({
        title: `Loaded ${Object.keys(newSecretValues).length} secret value(s) from Vault`,
        description: "Secret values are now available in the editor"
      })
    }
  }

  // Use provided context or create one from environment prop for backward compatibility
  const editorContext: ContextData = context || {
    environment: environment as any,
    instance: 0,
    product: "helm-secrets",
    customer: "default",
    version: "1.0.0",
    baseHostUrl: "",
  }

  // Build the file path using the path utility
  const filePath = buildConfigPath(
    baseDirectory,
    editorContext.customer,
    editorContext.environment,
    editorContext.instance,
    editorContext.product,
    "secrets.yaml",
  )

  // Extract values from context for easier use
  const { environment: env, product, customer } = editorContext

  const loadValues = async (env: string) => {
    try {
      setIsLoading(true)

      const savedValues = localStorage.getItem(`secrets_editor_${env}`)
      if (savedValues) {
        setYamlContent(savedValues)
        try {
          const parsedValues = yaml.load(savedValues) as any
          setFormData(parsedValues || {})
          generateExternalSecretsYaml(parsedValues || {})
        } catch (e) {
          console.error("Error parsing YAML:", e)
        }
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/src/mock/${env}/secrets.yaml`)
        if (response.ok) {
          const content = await response.text()
          setYamlContent(content)
          try {
            const parsedValues = yaml.load(content) as any
            setFormData(parsedValues || {})
            generateExternalSecretsYaml(parsedValues || {})
          } catch (e) {
            console.error("Error parsing YAML:", e)
          }
          localStorage.setItem(`secrets_editor_${env}`, content)
          setIsLoading(false)
          return
        }
      } catch (e) {
        console.error("Error loading from file:", e)
      }

      const defaultValue = initialValue || "env: []"
      setYamlContent(defaultValue)
      try {
        const parsedValues = yaml.load(defaultValue) as any
        setFormData(parsedValues || { env: [] })
        generateExternalSecretsYaml(parsedValues || { env: [] })
      } catch (e) {
        console.error("Error parsing YAML:", e)
        setFormData({ env: [] })
        generateExternalSecretsYaml({ env: [] })
      }
      setIsLoading(false)
    } catch (error) {
      console.error("Error loading values:", error)
      setIsLoading(false)
    }
  }

  const generateExternalSecretsYaml = (data: any) => {
    if (!data || !data.env || !Array.isArray(data.env)) {
      setExternalSecretsYaml("")
      return
    }

    const secretsData = data.env
      .filter((secret: SecretItem) => secret.name && secret.vaultRef?.path && secret.vaultRef?.key)
      .map((secret: SecretItem) => ({
        secretKey: secret.name,
        remoteRef: {
          key: secret.vaultRef.path,
          property: secret.vaultRef.key,
        },
      }))

    const externalSecretTemplate = {
      apiVersion: "external-secrets.io/v1beta1",
      kind: "ExternalSecret",
      metadata: {
        name: `${product}-secrets`,
        namespace: `${customer}-${env}`,
      },
      spec: {
        refreshInterval: "1h",
        secretStoreRef: {
          name: "vault-backend",
          kind: "ClusterSecretStore",
        },
        target: {
          name: `${product}-secret`,
          creationPolicy: "Owner",
        },
        data: secretsData,
      },
    }

    setExternalSecretsYaml(yaml.dump(externalSecretTemplate, { lineWidth: -1 }))
  }

  useEffect(() => {
    if (onChange) {
      onChange(yamlContent)
    }
  }, [yamlContent, onChange])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setYamlContent(content)
      try {
        const parsedValues = yaml.load(content) as any
        setFormData(parsedValues || {})
        generateExternalSecretsYaml(parsedValues || {})
      } catch (e) {
        console.error("Error parsing YAML:", e)
      }
    }
    reader.readAsText(file)
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard!" })
  }

  const copyRightPanelContent = () => {
    let contentToCopy = ""

    switch (activeTab) {
      case "secrets":
        contentToCopy = yamlContent
        break
      case "external-secrets":
        contentToCopy = externalSecretsYaml
        break
    }

    if (contentToCopy) {
      copyToClipboard(contentToCopy)
    }
  }

  const downloadYaml = () => {
    const blob = new Blob([yamlContent], { type: "text/yaml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `secrets-${env}.yaml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadExternalSecretsYaml = () => {
    const blob = new Blob([externalSecretsYaml], { type: "text/yaml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `external-secret-${env}.yaml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const addSecret = () => {
    setEditingSecretIndex(-1)
    setSecretInputValue("")
    setShowSecretValue(false)
    setEditSecretName("")
    setEditVaultPath(`kv/${customer}/${env}/${editorContext.instance}/${product}`.toLowerCase())
    setEditVaultKey("")
  }


  /**
   * Remove multiple selected secrets with confirmation
   * Updates both localStorage, source file, and regenerates external-secret.yaml
   */
  const removeSelectedSecrets = () => {
    if (selectedSecrets.length === 0) return

    const secretNames = selectedSecrets
      .map(index => formData.env[index]?.name)
      .filter(Boolean)
      .join('", "')

    const secretCount = selectedSecrets.length
    const secretText = secretCount === 1 ? 'secret' : 'secrets'

    showConfirm({
      title: `Delete ${secretCount} ${secretText.charAt(0).toUpperCase() + secretText.slice(1)}`,
      message: `Are you sure you want to delete ${secretCount} ${secretText}?\n\n${secretNames ? `Secrets to be deleted: "${secretNames}"\n\n` : ''}This action will:\n• Remove them from the secrets configuration\n• Update the secrets.yaml file\n• Regenerate the external-secret.yaml\n\nThis action cannot be undone.`,
      variant: 'destructive',
      confirmText: `Delete ${secretCount} ${secretText.charAt(0).toUpperCase() + secretText.slice(1)}`,
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const newFormData = { ...formData }
          const newSecretValues = { ...secretValues }

          const sortedIndices = [...selectedSecrets].sort((a, b) => b - a)

          sortedIndices.forEach((index) => {
            if (newFormData.env && Array.isArray(newFormData.env)) {
              const secretName = newFormData.env[index]?.name
              if (secretName && newSecretValues[secretName]) {
                delete newSecretValues[secretName]
              }
              newFormData.env.splice(index, 1)
            }
          })

          const newYamlContent = yaml.dump(newFormData)
          setYamlContent(newYamlContent)
          localStorage.setItem(`secrets_editor_${env}`, newYamlContent)
          setFormData(newFormData)
          setSecretValues(newSecretValues)
          setSelectedSecrets([])

          // Update the source secrets.yaml file
          await updateSecretsSourceFile(env, newYamlContent)

          // Regenerate external-secret.yaml
          generateExternalSecretsYaml(newFormData)

          toast({
            title: `${secretCount} ${secretText} deleted successfully`,
            description: "The secrets have been removed and files have been updated."
          })
        } catch (error) {
          console.error('Error deleting selected secrets:', error)
          toast({
            title: "Error deleting secrets",
            description: "Failed to delete the selected secrets. Please try again.",
            variant: "destructive"
          })
        }
      }
    })
  }

  const updateSecretField = (index: number, field: string, value: string) => {
    const newFormData = { ...formData }
    if (newFormData.env && Array.isArray(newFormData.env)) {
      if (field === "name") {
        const oldName = newFormData.env[index].name
        if (oldName && secretValues[oldName]) {
          const newSecretValues = { ...secretValues }
          newSecretValues[value] = newSecretValues[oldName]
          delete newSecretValues[oldName]
          setSecretValues(newSecretValues)
        }
        newFormData.env[index].name = value
      } else if (field === "path") {
        if (!newFormData.env[index].vaultRef) {
          newFormData.env[index].vaultRef = { path: "", key: "" }
        }
        newFormData.env[index].vaultRef.path = value
      } else if (field === "key") {
        if (!newFormData.env[index].vaultRef) {
          newFormData.env[index].vaultRef = { path: "", key: "" }
        }
        newFormData.env[index].vaultRef.key = value
      }

      const newYamlContent = yaml.dump(newFormData)
      setYamlContent(newYamlContent)
      localStorage.setItem(`secrets_editor_${env}`, newYamlContent)
      setFormData(newFormData)
      generateExternalSecretsYaml(newFormData)
    }
  }

  const openSecretEditModal = (index: number) => {
    const secret = formData.env[index]
    if (!secret) return

    setEditingSecretIndex(index)
    setSecretInputValue(secretValues[secret.name] || "")
    setShowSecretValue(false)
    setEditSecretName(secret.name || "")

    if (!secret.vaultRef?.path) {
      setEditVaultPath(`kv/${customer}/${env}/${editorContext.instance}/${product}`.toLowerCase())
    } else {
      setEditVaultPath(secret.vaultRef.path)
    }

    if (!secret.vaultRef?.key) {
      if (secret.name) {
        setEditVaultKey(secret.name.toLowerCase().replace(/-/g, "_"))
      } else {
        setEditVaultKey("")
      }
    } else {
      setEditVaultKey(secret.vaultRef.key)
    }
  }

  const handleSecretNameChange = (value: string) => {
    const uppercasedValue = value.toUpperCase()
    setEditSecretName(uppercasedValue)

    if (!editVaultKey || editVaultKey === editSecretName.toLowerCase().replace(/-/g, "_")) {
      setEditVaultKey(uppercasedValue.toLowerCase().replace(/-/g, "_"))
    }
  }

  const handleVaultKeyChange = (value: string) => {
    setEditVaultKey(value.toLowerCase())
  }

  const saveSecretChanges = async () => {
    try {
      if (secretInputValue && secretInputValue.length > 1000000) {
        toast({ title: "Processing large secret value..." })
      }

      setTimeout(async () => {
        try {
          if (editingSecretIndex === -1) {
            if (editSecretName) {
              const newFormData = { ...formData }
              if (!newFormData.env) {
                newFormData.env = []
              }

              const newSecret: SecretItem = {
                name: editSecretName,
                vaultRef: {
                  path: editVaultPath,
                  key: editVaultKey,
                },
              }

              newFormData.env.push(newSecret)
              setFormData(newFormData)

              const newYamlContent = yaml.dump(newFormData)
              setYamlContent(newYamlContent)

              // Update both localStorage and the source file
              localStorage.setItem(`secrets_editor_${env}`, newYamlContent)
              await updateSecretsSourceFile(env, newYamlContent)

              generateExternalSecretsYaml(newFormData)

              if (secretInputValue) {
                try {
                  setSecretValues({
                    ...secretValues,
                    [editSecretName]: secretInputValue,
                  })

                  // Also save to vault if connected
                  if (vaultConnectionStatus === 'success' && editVaultPath && editVaultKey) {
                    try {
                      const result = await window.electronAPI.vault.writeSecret(
                        env,
                        editVaultPath,
                        editVaultKey,
                        secretInputValue
                      )

                      if (result.success) {
                        toast({ title: "Secret saved locally, to file, and to vault successfully" })
                      } else {
                        toast({ title: "Secret saved locally and to file, but failed to save to vault", variant: "destructive" })
                      }
                    } catch (vaultError: any) {
                      toast({ title: "Secret saved locally and to file, but vault write failed", description: vaultError.message, variant: "destructive" })
                    }
                  } else {
                    toast({ title: "Secret configuration updated and saved to file" })
                  }
                } catch (error) {
                  console.error("Error saving secret value:", error)
                  toast({
                    title: "Error: Could not save the secret value. It might be too large.",
                    variant: "destructive",
                  })
                }
              }
            }
          } else if (editingSecretIndex !== null) {
            updateSecretField(editingSecretIndex, "name", editSecretName)
            updateSecretField(editingSecretIndex, "path", editVaultPath)
            updateSecretField(editingSecretIndex, "key", editVaultKey)

            // Update the source file after field updates
            const updatedYamlContent = yaml.dump(formData)
            setYamlContent(updatedYamlContent)
            localStorage.setItem(`secrets_editor_${env}`, updatedYamlContent)
            await updateSecretsSourceFile(env, updatedYamlContent)

            if (secretInputValue) {
              try {
                setSecretValues({
                  ...secretValues,
                  [editSecretName]: secretInputValue,
                })

                // Also save to vault if connected
                if (vaultConnectionStatus === 'success' && editVaultPath && editVaultKey) {
                  try {
                    const result = await window.electronAPI.vault.writeSecret(
                      env,
                      editVaultPath,
                      editVaultKey,
                      secretInputValue
                    )

                    if (result.success) {
                      toast({ title: "Secret updated locally, in file, and in vault successfully" })
                    } else {
                      toast({ title: "Secret updated locally and in file, but failed to update in vault", variant: "destructive" })
                    }
                  } catch (vaultError: any) {
                    toast({ title: "Secret updated locally and in file, but vault write failed", description: vaultError.message, variant: "destructive" })
                  }
                } else {
                  toast({ title: "Secret configuration updated and saved to file" })
                }
              } catch (error) {
                console.error("Error saving secret value:", error)
                toast({
                  title: "Error: Could not save the secret value. It might be too large.",
                  variant: "destructive",
                })
              }
            }
          }

          setEditingSecretIndex(null)
        } catch (error) {
          console.error("Error in saveSecretChanges:", error)
          toast({
            title: "Error: Could not save changes. Please try again with smaller values.",
            variant: "destructive",
          })
        }
      }, 0)
    } catch (error) {
      console.error("Error in saveSecretChanges outer block:", error)
      toast({ title: "Error: Could not save changes. Please try again with smaller values.", variant: "destructive" })
    }
  }

  /**
   * Update the source secrets.yaml file to persist changes
   */
  const updateSecretsSourceFile = async (env: string, yamlContent: string) => {
    try {
      // Use the file service to write the updated secrets.yaml
      await window.electronAPI.writeFile(
        `src/mock/${env}/secrets.yaml`,
        yamlContent
      )
      console.log(`✅ Updated secrets.yaml file for ${env} environment`)
    } catch (error) {
      console.error(`❌ Failed to update secrets.yaml file for ${env}:`, error)
      // Don't throw - this is a nice-to-have feature
    }
  }

  const saveSecretToVault = async (index: number) => {
    const secret = formData.env[index]
    if (!secret) return

    const secretName = secret.name
    const secretValue = secretValues[secretName]

    if (!secretValue) {
      toast({ title: "Please update the secret value first", variant: "destructive" })
      return
    }

    if (!secret.vaultRef.path || !secret.vaultRef.key) {
      toast({ title: "Please provide both Vault Path and Vault Key", variant: "destructive" })
      return
    }

    if (vaultConnectionStatus !== 'success') {
      toast({
        title: "Vault connection required",
        description: "Please configure vault connection in settings first",
        variant: "destructive"
      })
      return
    }

    try {
      const result = await window.electronAPI.vault.writeSecret(
        env, // Use env instead of environment
        secret.vaultRef.path,
        secret.vaultRef.key,
        secretValue
      )

      if (result.success) {
        toast({ title: `Secret "${secretName}" saved to vault successfully` })
      } else {
        toast({
          title: "Failed to save secret to vault",
          variant: "destructive"
        })
      }
    } catch (error: any) {
      toast({
        title: "Failed to save secret to vault",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const renderVaultStatus = () => {
    const getStatusIcon = () => {
      switch (vaultConnectionStatus) {
        case 'success':
          return <CheckCircle className="h-4 w-4 text-green-500" />
        case 'error':
          return <XCircle className="h-4 w-4 text-red-500" />
        case 'checking':
          return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        default:
          return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      }
    }

    const getStatusText = () => {
      switch (vaultConnectionStatus) {
        case 'success':
          return 'Vault Connected'
        case 'error':
          return 'Vault Disconnected'
        case 'checking':
          return 'Checking Vault...'
        default:
          return 'Vault Status Unknown'
      }
    }

    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
        {vaultConnectionStatus !== 'success' && (
          <Button
            variant="outline"
            size="sm"
            onClick={checkVaultConnection}
            disabled={vaultConnectionStatus === 'checking'}
          >
            Retry
          </Button>
        )}
      </div>
    )
  }

  const closeSecretEditModal = () => {
    setEditingSecretIndex(null)
    setSecretInputValue("")
    setShowSecretValue(false)
    setEditSecretName("")
    setEditVaultPath("")
    setEditVaultKey("")
  }

  const toggleSecretValueVisibility = () => {
    setShowSecretValue(!showSecretValue)
  }

  const toggleSelectAll = () => {
    if (selectedSecrets.length === (formData.env?.length || 0)) {
      setSelectedSecrets([])
    } else {
      setSelectedSecrets(formData.env ? Array.from({ length: formData.env.length }, (_, i) => i) : [])
    }
  }

  const toggleSelectSecret = (index: number) => {
    setSelectedSecrets((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))
  }

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending"

    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending"
    }

    setSortConfig({ key, direction })
  }

  const getSortedAndFilteredSecrets = () => {
    if (!formData.env || !Array.isArray(formData.env)) return []

    const filteredSecrets = formData.env.filter((secret: SecretItem) => {
      if (!searchTerm) return true

      const searchLower = searchTerm.toLowerCase()
      return (
        (secret.name && secret.name.toLowerCase().includes(searchLower)) ||
        (secret.vaultRef?.path && secret.vaultRef.path.toLowerCase().includes(searchLower)) ||
        (secret.vaultRef?.key && secret.vaultRef.key.toLowerCase().includes(searchLower))
      )
    })

    if (sortConfig) {
      filteredSecrets.sort((a: any, b: any) => {
        let aValue, bValue

        if (sortConfig.key === "name") {
          aValue = a.name || ""
          bValue = b.name || ""
        } else if (sortConfig.key === "path") {
          aValue = a.vaultRef?.path || ""
          bValue = b.vaultRef?.path || ""
        } else if (sortConfig.key === "key") {
          aValue = a.vaultRef?.key || ""
          bValue = b.vaultRef?.key || ""
        } else {
          return 0
        }

        if (aValue < bValue) {
          return sortConfig.direction === "ascending" ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === "ascending" ? 1 : -1
        }
        return 0
      })
    }

    return filteredSecrets
  }


  const filteredSecrets = getSortedAndFilteredSecrets()






  return (
    <div className="h-full flex flex-col">
      {/* Show vault error alert if needed */}
      {vaultConnectionStatus === 'error' && vaultError && (
        <Alert className="m-4 border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-700">
            {vaultError}
            {!hasVaultCredentials && (
              <span className="block mt-1">
                <Button
                  variant="link"
                  className="p-0 h-auto text-red-600 underline"
                  onClick={() => {
                    // Navigate to settings - you might need to implement this
                    window.electronAPI?.openSettings?.()
                  }}
                >
                  Configure Vault in Settings
                </Button>
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center bg-card p-4 rounded-t-lg">
        <div>
          {/* <h2 className="text-2xl font-bold text-foreground">Secrets Editor</h2> */}
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Secrets Editor - {env.toUpperCase()}</h2>
            {renderVaultStatus()}
          </div>

          <p className="text-muted-foreground">
            Editing for{" "}
            <span className="font-medium font-mono text-sm">
              {filePath}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={triggerFileInput} className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Load File
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".yaml,.yml" onChange={handleFileUpload} />
          <Button variant="outline" onClick={downloadYaml} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download YAML
          </Button>
        </div>
      </div>

      {/* Replace the custom splitter implementation with ResizablePanelGroup */}
      <div className="flex-1 overflow-hidden p-4">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Main content */}
          <ResizablePanel defaultSize={67} minSize={20} maxSize={80}>
            <div className="flex flex-col gap-4 overflow-hidden min-w-0 pr-2 h-full">
              <Card className="flex-1 overflow-hidden">
                <CardContent className="p-4 h-full flex flex-col">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full text-gray-500">Loading...</div>
                  ) : (
                    <>
                      {/* Toolbar */}
                      <div className="flex justify-between items-center mb-4 p-4 bg-muted/50 rounded-lg">
                        <div className="flex-1 max-w-md">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                              type="text"
                              placeholder="Search secrets..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3 items-center">
                          <Button
                            variant="outline"
                            size="default"
                            onClick={checkVaultSync}
                            disabled={vaultConnectionStatus !== 'success'}
                            className="flex items-center gap-2 min-w-[120px] h-10 transition-all duration-200 hover:scale-105 hover:shadow-md"
                          >
                            {Object.values(secretVaultStatuses).some(s => s === 'checking') ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Check Sync
                          </Button>

                          <Button
                            onClick={addSecret}
                            size="default"
                            className="flex items-center gap-2 min-w-[130px] h-10 bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105 hover:shadow-lg font-semibold"
                          >
                            <Plus className="w-4 h-4" />
                            Add Secret
                          </Button>

                          {selectedSecrets.length > 0 && (
                            <Button
                              variant="destructive"
                              size="default"
                              onClick={removeSelectedSecrets}
                              className="flex items-center gap-2 min-w-[140px] h-10 transition-all duration-200 hover:scale-105 hover:shadow-lg animate-in slide-in-from-right-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Selected ({selectedSecrets.length})
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Secrets Table */}
                      <div className="flex-1 overflow-auto">
                        <SecretsTable
                          secrets={filteredSecrets}
                          selectedSecrets={selectedSecrets}
                          sortConfig={sortConfig}
                          secretValues={secretValues}
                          secretVaultStatuses={secretVaultStatuses}
                          onSelectSecret={(index: number) => {
                            const originalIndex = formData.env.findIndex(
                              (s: SecretItem) => {
                                const secret = filteredSecrets[index]
                                return s.name === secret.name &&
                                       s.vaultRef?.path === secret.vaultRef?.path &&
                                       s.vaultRef?.key === secret.vaultRef?.key
                              }
                            )
                            toggleSelectSecret(originalIndex)
                          }}
                          onSelectAll={toggleSelectAll}
                          onSort={requestSort}
                          onEditSecret={(index: number) => {
                            const originalIndex = formData.env.findIndex(
                              (s: SecretItem) => {
                                const secret = filteredSecrets[index]
                                return s.name === secret.name &&
                                       s.vaultRef?.path === secret.vaultRef?.path &&
                                       s.vaultRef?.key === secret.vaultRef?.key
                              }
                            )
                            openSecretEditModal(originalIndex)
                          }}
                          onSaveToVault={(index: number) => {
                            const originalIndex = formData.env.findIndex(
                              (s: SecretItem) => {
                                const secret = filteredSecrets[index]
                                return s.name === secret.name &&
                                       s.vaultRef?.path === secret.vaultRef?.path &&
                                       s.vaultRef?.key === secret.vaultRef?.key
                              }
                            )
                            saveSecretToVault(originalIndex)
                          }}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

            </div>
          </ResizablePanel>

          {/* Resizable Handle */}
          <ResizableHandle withHandle />

          {/* Right Panel - Tabbed View */}
          <ResizablePanel defaultSize={33} minSize={20} maxSize={80}>
            <div className="overflow-hidden pl-2 h-full">
              <Card className="h-full overflow-hidden border border-border">
                <Tabs
                  value={activeTab}
                  onValueChange={(value: any) => setActiveTab(value as TabType)}
                  className="h-full flex flex-col"
                >
                  <div className="flex justify-between items-center p-3 border-b border-border bg-muted/30">
                    <TabsList className="grid w-auto grid-cols-2">
                      <TabsTrigger value="secrets">secrets.yaml</TabsTrigger>
                      <TabsTrigger value="external-secrets">external-secret.yaml</TabsTrigger>
                    </TabsList>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={copyRightPanelContent} className="hover:bg-muted">
                        <Copy className="w-4 h-4" />
                      </Button>
                      {activeTab === "external-secrets" && (
                        <Button variant="ghost" size="sm" onClick={downloadExternalSecretsYaml} className="hover:bg-muted">
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <TabsContent value="secrets" className="h-full m-0">
                      <div className="h-full overflow-hidden">
                        <CodeMirror
                          value={
                            formData && formData.env ? `env:\n${yaml.dump({ env: formData.env }).substring(5)}` : "env: []"
                          }
                          height="100%"
                          theme={theme}
                          extensions={[yamlLanguage(), ...readOnlyExtensions]}
                          basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            dropCursor: false,
                            allowMultipleSelections: false,
                            indentOnInput: false,
                            bracketMatching: true,
                            closeBrackets: false,
                            autocompletion: false,
                            highlightSelectionMatches: false,
                          }}
                          className="text-sm"
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="external-secrets" className="h-full m-0">
                      <div className="h-full overflow-hidden">
                        <CodeMirror
                          value={externalSecretsYaml || "No external secrets defined"}
                          height="100%"
                          theme={theme}
                          extensions={[yamlLanguage(), ...readOnlyExtensions]}
                          basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            dropCursor: false,
                            allowMultipleSelections: false,
                            indentOnInput: false,
                            bracketMatching: true,
                            closeBrackets: false,
                            autocompletion: false,
                            highlightSelectionMatches: false,
                          }}
                          className="text-sm"
                        />
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </Card>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Secret Edit Modal */}
      <SecretEditModal
        isOpen={editingSecretIndex !== null}
        secretName={editSecretName}
        vaultPath={editVaultPath}
        vaultKey={editVaultKey}
        secretValue={secretInputValue}
        showSecretValue={showSecretValue}
        customer={customer}
        env={env}
        instance={editorContext.instance}
        product={product}
        onClose={closeSecretEditModal}
        onSave={saveSecretChanges}
        onSecretNameChange={handleSecretNameChange}
        onVaultPathChange={setEditVaultPath}
        onVaultKeyChange={handleVaultKeyChange}
        onSecretValueChange={setSecretInputValue}
        onToggleVisibility={toggleSecretValueVisibility}
      />

      <ConfirmDialog />
    </div>
  )
}

export default SecretsEditor
