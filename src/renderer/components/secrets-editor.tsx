"use client"

import type React from "react"
import { useRef, useState, useEffect, useCallback } from "react"
import yaml from "js-yaml"
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Lock,
  Copy,
  Download,
  Upload,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Loader2,
  Info,
  Shield,
  File,
  X
} from "lucide-react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Textarea } from "@/renderer/components/ui/textarea"
import { Label } from "@/renderer/components/ui/label"
import { Checkbox } from "@/renderer/components/ui/checkbox"
import { Badge } from "@/renderer/components/ui/badge"
import { Card, CardContent } from "@/renderer/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/renderer/components/ui/dialog"
import { useToast } from "@/renderer/hooks/use-toast"
import CodeMirror from "@uiw/react-codemirror"
import { yaml as yamlLanguage } from "@codemirror/lang-yaml"
import { readOnlyExtensions } from "@/renderer/lib/codemirror-themes"
import { buildConfigPath } from "@/renderer/lib/path-utils"
import type { ContextData } from "@/shared/types/context-data"

import { VaultCredentialManager } from "@/renderer/services/vault-credential-manager"
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/renderer/components/ui/tooltip"
import { useDialog } from '@/renderer/hooks/useDialog'
import { cn } from "@/lib/utils"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable"
import { useTheme } from '@/renderer/components/theme-provider'

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

  const certificateInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileType, setFileType] = useState<'text' | 'certificate' | 'binary'>('text')
  const [fileName, setFileName] = useState<string | null>(null)
  const secretValueRef = useRef<HTMLTextAreaElement>(null)

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
   * Remove a single secret with confirmation
   * Updates both localStorage, source file, and regenerates external-secret.yaml
   */
  const removeSecret = (index: number) => {
    const secret = formData.env[index]
    const secretName = secret?.name || 'Unnamed Secret'

    showConfirm({
      title: 'Delete Secret',
      message: `Are you sure you want to delete the secret "${secretName}"?\n\nThis action will:\n• Remove it from the secrets configuration\n• Update the secrets.yaml file\n• Regenerate the external-secret.yaml\n\nThis action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete Secret',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const newFormData = { ...formData }
          if (newFormData.env && Array.isArray(newFormData.env)) {
            const secretName = newFormData.env[index]?.name
            newFormData.env.splice(index, 1)

            const newYamlContent = yaml.dump(newFormData)
            setYamlContent(newYamlContent)
            localStorage.setItem(`secrets_editor_${env}`, newYamlContent)
            setFormData(newFormData)

            // Update the source secrets.yaml file
            await updateSecretsSourceFile(env, newYamlContent)

            // Regenerate external-secret.yaml
            generateExternalSecretsYaml(newFormData)

            setSelectedSecrets((prev) => prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)))

            if (secretName) {
              const newSecretValues = { ...secretValues }
              delete newSecretValues[secretName]
              setSecretValues(newSecretValues)
            }

            toast({
              title: "Secret deleted successfully",
              description: "The secret has been removed and files have been updated."
            })
          }
        } catch (error) {
          console.error('Error deleting secret:', error)
          toast({
            title: "Error deleting secret",
            description: "Failed to delete the secret. Please try again.",
            variant: "destructive"
          })
        }
      }
    })
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

  const getSortIndicator = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null
    }
    return sortConfig.direction === "ascending" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  const filteredSecrets = getSortedAndFilteredSecrets()

  /**
   * Handle drag and drop events for certificate files
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const file = files[0]
    const supportedExtensions = ['.crt', '.pem', '.pfx', '.p12', '.cer', '.der', '.key', '.pub', '.cert']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))

    if (supportedExtensions.includes(fileExtension)) {
      try {
        const content = await file.text()
        setSecretInputValue(content)
        setFileType('certificate')
        setFileName(file.name)
        toast({
          title: "Certificate loaded successfully",
          description: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`
        })
      } catch (error) {
        toast({
          title: "Error reading certificate",
          description: "Failed to read the certificate file",
          variant: "destructive"
        })
      }
    } else {
      toast({
        title: "Unsupported file type",
        description: "Please drop a certificate file (.crt, .pem, .pfx, etc.)",
        variant: "destructive"
      })
    }
  }, [setSecretInputValue, toast])

  /**
   * Handle file input for certificate upload
   */
  const handleCertificateUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      setSecretInputValue(content)
      setFileType('certificate')
      setFileName(file.name)
      toast({
        title: "Certificate uploaded successfully",
        description: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`
      })
    } catch (error) {
      toast({
        title: "Error reading certificate",
        description: "Failed to read the certificate file",
        variant: "destructive"
      })
    }

    // Reset file input
    e.target.value = ''
  }, [setSecretInputValue, toast])

  /**
   * Detect content type automatically
   */
  const detectContentType = useCallback((value: string) => {
    if (value.includes('-----BEGIN CERTIFICATE-----') ||
      value.includes('-----BEGIN PRIVATE KEY-----') ||
      value.includes('-----BEGIN PUBLIC KEY-----') ||
      value.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      setFileType('certificate')
    } else {
      setFileType('text')
    }
  }, [])

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
                      <div className="flex-1 overflow-auto border border-border rounded-lg bg-card">
                        <TooltipProvider>
                          <table className="w-full border-collapse">
                            <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                              <tr>
                                <th className="p-3 text-left border-b border-border">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2">
                                        <Checkbox
                                          checked={selectedSecrets.length === filteredSecrets.length && filteredSecrets.length > 0}
                                          onCheckedChange={toggleSelectAll}
                                        />
                                        <Info className="w-3 h-3 text-muted-foreground" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">Select/deselect all secrets</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </th>
                                <th
                                  className="p-3 text-left border-b border-border cursor-pointer hover:bg-muted/70 select-none transition-colors"
                                  onClick={() => requestSort("name")}
                                >
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                                        Secret Key Name
                                        {getSortIndicator("name")}
                                        <Info className="w-3 h-3 text-muted-foreground" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">The name of the secret key used in your application. Click to sort.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </th>
                                <th
                                  className="p-3 text-left border-b border-border cursor-pointer hover:bg-muted/70 select-none transition-colors"
                                  onClick={() => requestSort("path")}
                                >
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                                        Vault Path
                                        {getSortIndicator("path")}
                                        <Info className="w-3 h-3 text-muted-foreground" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">The path in Vault where this secret is stored. Click to sort.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </th>
                                <th
                                  className="p-3 text-left border-b border-border cursor-pointer hover:bg-muted/70 select-none transition-colors"
                                  onClick={() => requestSort("key")}
                                >
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                                        Vault Key
                                        {getSortIndicator("key")}
                                        <Info className="w-3 h-3 text-muted-foreground" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">The specific key within the Vault path for this secret. Click to sort.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </th>
                                <th className="p-3 text-left border-b border-border">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                                        Status
                                        <Info className="w-3 h-3 text-muted-foreground" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">Shows whether the secret has a value configured</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </th>
                                <th className="p-3 text-center border-b border-border">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center justify-center gap-2 font-semibold text-foreground text-sm">
                                        Actions
                                        <Info className="w-3 h-3 text-muted-foreground" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">Edit, save to Vault, or delete secrets</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredSecrets.length > 0 ? (
                                filteredSecrets.map((secret: SecretItem, index: number) => {
                                  const originalIndex = formData.env.findIndex(
                                    (s: SecretItem) =>
                                      s.name === secret.name &&
                                      s.vaultRef?.path === secret.vaultRef?.path &&
                                      s.vaultRef?.key === secret.vaultRef?.key,
                                  )

                                  return (
                                    <tr
                                      key={originalIndex}
                                      className={`border-b border-border hover:bg-muted/30 transition-colors ${selectedSecrets.includes(originalIndex)
                                        ? "bg-primary/10 border-l-4 border-l-primary"
                                        : index % 2 === 0
                                          ? "bg-muted/20"
                                          : "bg-card"
                                        }`}
                                    >
                                      <td className="p-3">
                                        <Checkbox
                                          checked={selectedSecrets.includes(originalIndex)}
                                          onCheckedChange={() => toggleSelectSecret(originalIndex)}
                                        />
                                      </td>
                                      <td className="p-3">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="text-foreground font-medium text-sm font-mono cursor-help">
                                              {secret.name || <span className="text-muted-foreground italic">No name</span>}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Secret key: {secret.name || 'Not defined'}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </td>
                                      <td className="p-3">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="text-foreground text-sm font-mono cursor-help">
                                              {secret.vaultRef?.path || (
                                                <span className="text-muted-foreground italic">No path</span>
                                              )}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Vault path: {secret.vaultRef?.path || 'Not configured'}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </td>
                                      <td className="p-3">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="text-foreground text-sm font-mono cursor-help">
                                              {secret.vaultRef?.key || <span className="text-muted-foreground italic">No key</span>}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Vault key: {secret.vaultRef?.key || 'Not configured'}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </td>

                                      {/* Enhance the existing status rendering*/}
                                      <td className="p-3">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="cursor-help">
                                              {(() => {
                                                const hasLocalValue = !!secretValues[secret.name]
                                                const vaultStatus = secretVaultStatuses[secret.name]

                                                // Keep existing logic as primary, add vault sync as secondary indicator
                                                if (hasLocalValue) {
                                                  if (vaultStatus === 'checking') {
                                                    return (
                                                      <div className="flex items-center gap-1">
                                                        <Badge className="bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 text-xs font-medium">
                                                          Has Value
                                                        </Badge>
                                                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                                      </div>
                                                    )
                                                  } else if (vaultStatus === 'synced') {
                                                    return (
                                                      <Badge className="bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 text-xs font-medium">
                                                        Has Value ✓
                                                      </Badge>
                                                    )
                                                  } else if (vaultStatus === 'out-of-sync') {
                                                    return (
                                                      <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400 text-xs font-medium">
                                                        Has Value ⚠
                                                      </Badge>
                                                    )
                                                  } else {
                                                    // Fallback to existing "Has Value" when vault status unknown
                                                    return (
                                                      <Badge className="bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 text-xs font-medium">
                                                        Has Value
                                                      </Badge>
                                                    )
                                                  }
                                                } else {
                                                  // Keep existing "No Value" logic unchanged
                                                  return (
                                                    <Badge
                                                      variant="destructive"
                                                      className="bg-red-500/10 text-red-700 border-red-500/20 dark:bg-red-500/20 dark:text-red-400 text-xs font-medium"
                                                    >
                                                      No Value
                                                    </Badge>
                                                  )
                                                }
                                              })()
                                              }
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <div className="text-xs space-y-1">
                                              <p>
                                                {secretValues[secret.name]
                                                  ? 'This secret has a configured value'
                                                  : 'This secret needs a value to be set'}
                                              </p>
                                              {secretVaultStatuses[secret.name] && (
                                                <p className="text-muted-foreground">
                                                  Vault: {(() => {
                                                    switch (secretVaultStatuses[secret.name]) {
                                                      case 'synced': return 'In sync with Vault'
                                                      case 'out-of-sync': return 'Different from Vault'
                                                      case 'checking': return 'Checking...'
                                                      case 'error': return 'Error checking Vault'
                                                      default: return 'Unknown'
                                                    }
                                                  })()}
                                                </p>
                                              )}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </td>

                                      {/*// Enhanced action buttons in table with consistent sizing */}
                                      <td className="p-3">
                                        <div className="flex justify-center gap-2">
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openSecretEditModal(originalIndex)}
                                                className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-all duration-200 hover:scale-110"
                                              >
                                                <Edit className="w-4 h-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-xs">Edit secret configuration</p>
                                            </TooltipContent>
                                          </Tooltip>

                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => saveSecretToVault(originalIndex)}
                                                disabled={!secretValues[secret.name]}
                                                className="h-9 w-9 hover:bg-green-500/10 hover:text-green-600 disabled:opacity-50 transition-all duration-200 hover:scale-110"
                                              >
                                                <Lock className="w-4 h-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-xs">
                                                {secretValues[secret.name]
                                                  ? 'Save secret to Vault'
                                                  : 'No value to save - edit first'}
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>

                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeSecret(originalIndex)}
                                                className="h-9 w-9 hover:bg-red-500/10 hover:text-red-600 transition-all duration-200 hover:scale-110"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-xs">Delete this secret</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                      </td>

                                    </tr>
                                  )
                                })
                              ) : (
                                <tr>
                                  <td colSpan={6} className="p-6 text-center text-muted-foreground italic bg-muted/20 text-sm">
                                    {searchTerm ? "No secrets match your search" : "No secrets defined yet"}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </TooltipProvider>
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
      <Dialog open={editingSecretIndex !== null} onOpenChange={() => closeSecretEditModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Secret</DialogTitle>
            <DialogDescription>
              Configure secret details and vault integration settings. Ensure your vault path and key are correct for proper secret management.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secretName">Secret Key Name</Label>
              <Input
                id="secretName"
                type="text"
                value={editSecretName}
                onChange={(e) => handleSecretNameChange(e.target.value)}
                placeholder="DB-PASSWORD"
                className="uppercase"
              />
              <p className="text-xs text-gray-500 italic">Secret names are automatically converted to uppercase</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vaultPath">Vault Path</Label>
              <Input
                id="vaultPath"
                type="text"
                value={editVaultPath}
                onChange={(e) => setEditVaultPath(e.target.value)}
                placeholder={`kv/${customer}/${env}/${editorContext.instance}/${product}`.toLowerCase()}
                className="lowercase"
              />
              <p className="text-xs text-gray-500 italic">
                Default: {`kv/${customer}/${env}/${editorContext.instance}/${product}`.toLowerCase()}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vaultKey">Vault Key</Label>
              <Input
                id="vaultKey"
                type="text"
                value={editVaultKey}
                onChange={(e) => handleVaultKeyChange(e.target.value)}
                placeholder="db_password"
                className="lowercase"
              />
              <p className="text-xs text-gray-500 italic">Keys are automatically converted to lowercase</p>
            </div>

            {/* Secret Value section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="secretValue" className="flex items-center gap-2">
                  Secret Value
                  {fileType === 'certificate' && (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Certificate
                    </Badge>
                  )}
                  {fileName && (
                    <Badge variant="outline" className="text-xs">
                      <File className="w-3 h-3 mr-1" />
                      {fileName}
                    </Badge>
                  )}
                </Label>
                <div className="flex items-center gap-2">
                  {/* Certificate Upload Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => certificateInputRef.current?.click()}
                    className="text-xs hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Upload Cert
                  </Button>

                  {/* Show/Hide Toggle */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleSecretValueVisibility}
                    className="text-xs"
                  >
                    {showSecretValue ? (
                      <>
                        <EyeOff className="w-3 h-3 mr-1" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3 mr-1" />
                        Show
                      </>
                    )}
                  </Button>

                  {/* Clear Button */}
                  {secretInputValue && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSecretInputValue('')
                        setFileType('text')
                        setFileName(null)
                      }}
                      className="text-xs hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Enhanced Textarea with Drag & Drop */}
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-lg transition-all duration-200",
                  isDragOver
                    ? "border-blue-400 bg-blue-50/50 shadow-lg scale-[1.02]"
                    : "border-gray-200 hover:border-gray-300",
                  fileType === 'certificate' && "border-green-200 bg-green-50/30"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Textarea
                  ref={secretValueRef}
                  id="secretValue"
                  value={secretInputValue}
                  onChange={(e) => {
                    try {
                      const newValue = e.target.value
                      if (newValue.length > 5000000) {
                        toast({ title: "Warning: Very large input detected. This may cause performance issues." })
                      }
                      requestAnimationFrame(() => {
                        try {
                          setSecretInputValue(newValue)
                          detectContentType(newValue)
                        } catch (error) {
                          console.error("Error updating secret value:", error)
                          toast({ title: "Error: The value is too large to process", variant: "destructive" })
                        }
                      })
                    } catch (error) {
                      console.error("Error in textarea change handler:", error)
                      toast({ title: "Error processing input", variant: "destructive" })
                    }
                  }}
                  placeholder={isDragOver
                    ? "Drop your certificate file here..."
                    : "Enter secret value here or drag & drop a certificate file (.crt, .pem, .pfx, etc.)"
                  }
                  rows={secretInputValue.length > 500 ? 8 : 5}
                  className={cn(
                    "min-h-[120px] resize-none transition-all duration-200",
                    showSecretValue ? "" : "font-mono",
                    isDragOver && "pointer-events-none",
                    fileType === 'certificate' && "font-mono text-sm"
                  )}
                  style={showSecretValue ? {} : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)}
                />

                {/* Drag Overlay */}
                {isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 rounded-lg pointer-events-none">
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-bounce" />
                      <p className="text-sm font-medium text-blue-700">Drop certificate file here</p>
                      <p className="text-xs text-blue-600">Supports .crt, .pem, .pfx, .p12, .cer, .der, .key</p>
                    </div>
                  </div>
                )}
              </div>

              {/* File Info & Actions */}
              {secretInputValue && (
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                  <div className="flex items-center gap-4">
                    <span>Size: {(secretInputValue.length / 1024).toFixed(1)} KB</span>
                    <span>Lines: {secretInputValue.split('\n').length}</span>
                    {fileType === 'certificate' && (
                      <span className="text-green-600 font-medium">✓ Certificate format detected</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(secretInputValue)}
                      className="h-6 px-2 text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([secretInputValue], { type: 'text/plain' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = fileName || `secret-${editSecretName.toLowerCase()}.txt`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              )}

              {/* Hidden file input for certificate upload */}
              <input
                ref={certificateInputRef}
                type="file"
                accept=".crt,.pem,.pfx,.p12,.cer,.der,.key,.pub,.cert"
                onChange={handleCertificateUpload}
                className="hidden"
              />
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeSecretEditModal}>
              Cancel
            </Button>
            <Button onClick={saveSecretChanges}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  )
}

export default SecretsEditor
