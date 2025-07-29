"use client"

import type React from "react"
import { useRef, useState, useEffect, useMemo, useCallback } from "react"
import yaml from "js-yaml"
import {
  Search,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle
} from "lucide-react"
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
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { useDialog } from '@/renderer/hooks/useDialog'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable"
import { useTheme } from '@/renderer/components/theme-provider'
import { SecretsTable } from "./secrets/SecretsTable"
import { SecretEditModal } from "./secrets/SecretEditModal"

// Import custom hooks
import { useSecretsManager } from "./hooks/useSecretsManager"
import { useVaultIntegration } from "./hooks/useVaultIntegration"
import { useCertificateAnalysis } from "./hooks/useCertificateAnalysis"
import type { SecretEditorProps, SecretItem, TabType } from "./types/secrets"
import { generateExternalSecretsYaml, updateSecretsSourceFile } from "./utils/secrets-utils"

/**
 * SecretsEditor component with integrated custom hooks for managing secrets,
 * Vault integration, and certificate analysis while preserving all existing functionality
 */
const SecretsEditor: React.FC<SecretEditorProps> = ({
  initialValue = "",
  onChange,
  environment = "dev",
  context,
  baseDirectory = "/opt/config-pilot/configs",
}) => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showConfirm, ConfirmDialog } = useDialog()
  const { theme } = useTheme()

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

  // Initialize custom hooks
  const {
    yamlContent,
    setYamlContent,
    formData,
    setFormData,
    isLoading,
    secretValues,
    setSecretValues,
    searchTerm,
    setSearchTerm,
    selectedSecrets,
    setSelectedSecrets,
    sortConfig,
    setSortConfig,
    externalSecretsYaml,
    setExternalSecretsYaml,
    loadValues,
    addNewSecret,
    removeSelectedSecrets,
    updateSecretField
  } = useSecretsManager(env, initialValue)

  const {
    vaultConnectionStatus,
    vaultError,
    hasVaultCredentials,
    secretVaultStatuses,
    checkVaultConnection,
    loadSecretValuesFromVault,
    saveSecretToVault,
    saveSecretToVaultWithMetadata,
    loadSecretWithMetadata,
    checkVaultSync
  } = useVaultIntegration(env)

  const {
    resetCertificateState,
    certificateMetadata,
    analysisResult,
    analyzeContent,
    setCertificateMetadata
  } = useCertificateAnalysis()

  // State for the edit modal (preserved from original)
  const [editingSecretIndex, setEditingSecretIndex] = useState<number | null>(null)
  const [secretInputValue, setSecretInputValue] = useState("")
  const [showSecretValue, setShowSecretValue] = useState(false)
  const [editSecretName, setEditSecretName] = useState("")
  const [editVaultPath, setEditVaultPath] = useState("")
  const [editVaultKey, setEditVaultKey] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("secrets")

  // ✅ NEW: Add state for draft (unsaved) secrets
  const [draftSecrets, setDraftSecrets] = useState<SecretItem[]>([])
  const [isDraftMode, setIsDraftMode] = useState(false)

  // ✅ Add timeout ref for debouncing saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ✅ Debounced formData for Vault operations
  const [debouncedFormData, setDebouncedFormData] = useState(formData)

  // ✅ Debounce formData changes to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFormData(formData)
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [formData])

  // ✅ Memoize secrets array to prevent unnecessary re-renders
  const secretsArray = useMemo(() => {
    return debouncedFormData?.env || []
  }, [debouncedFormData])

  // Load initial values using the hook's loadValues function
  useEffect(() => {
    if (formData?.env) {
      loadValues(formData?.env)
    }
  }, [loadValues])

  // ✅ Auto-load secret values from Vault when debounced formData is ready and Vault is connected
  useEffect(() => {
    if (secretsArray.length > 0 && vaultConnectionStatus === 'success') {
      loadSecretValuesFromVault(secretsArray).then(values => {
        setSecretValues(prev => ({ ...prev, ...values }))
      })
    }
  }, [secretsArray, vaultConnectionStatus, loadSecretValuesFromVault, setSecretValues])

  // ✅ Auto-check sync status when secrets and vault connection are ready (debounced)
  useEffect(() => {
    if (secretsArray.length > 0 && vaultConnectionStatus === 'success' && Object.keys(secretValues).length > 0) {
      checkVaultSync(secretsArray, secretValues)
    }
  }, [secretsArray, vaultConnectionStatus, secretValues, checkVaultSync])

  // ✅ Generate external secrets YAML when debounced formData changes
  useEffect(() => {
    if (debouncedFormData) {
      const externalYaml = generateExternalSecretsYaml(debouncedFormData, product, customer, env)
      setExternalSecretsYaml(externalYaml)
    }
  }, [debouncedFormData, product, customer, env, setExternalSecretsYaml])

  // ✅ Call onChange when yamlContent changes (keep immediate for UI responsiveness)
  useEffect(() => {
    if (onChange) {
      onChange(yamlContent)
    }
  }, [yamlContent, onChange])

  /**
   * Handle file upload (using hook's loadValues)
   */
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
        // Analyze the content type
        analyzeContent(content)
      } catch (e) {
        console.error("Error parsing YAML:", e)
      }
    }
    reader.readAsText(file)
  }

  /**
   * Trigger file input (preserved from original)
   */
  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  /**
   * Copy to clipboard (preserved from original)
   */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard!" })
  }

  /**
   * Copy right panel content (preserved from original)
   */
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

  /**
   * Download YAML (preserved from original)
   */
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

  /**
   * Download external secrets YAML (preserved from original)
   */
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

  /**
   * Add secret (completely rewritten to prevent backend calls)
   */
  const addSecret = () => {
    // ✅ Create draft secret without touching formData
    const draftSecret: SecretItem = {
      name: "",
      vaultRef: {
        path: `secret/${customer}/${env}/${editorContext.instance}/${product}`.toLowerCase(),
        key: ""
      }
    }

    // ✅ Add to draft state only
    setDraftSecrets(prev => [...prev, draftSecret])
    setIsDraftMode(true)

    // ✅ Set editing state for the draft secret
    const draftIndex = draftSecrets.length
    setEditingSecretIndex(-1) // Use -1 to indicate draft mode
    setSecretInputValue("")
    setShowSecretValue(false)
    setEditSecretName("")
    setEditVaultPath(draftSecret.vaultRef.path)
    setEditVaultKey("")

    toast({
      title: "New secret draft created",
      description: "Fill in details and save to add to configuration"
    })
  }

  /**
   * Remove selected secrets with confirmation (using hook but preserving original behavior)
   */
  const removeSelectedSecretsWithConfirm = () => {
    if (selectedSecrets.length === 0) return

    const secretNames = selectedSecrets
      .map(index => formData.env[index]?.name)
      .filter(Boolean)
      .join('", "')

    const secretCount = selectedSecrets.length
    const secretText = secretCount === 1 ? 'secret' : 'secrets'

    showConfirm({
      title: `Remove ${secretCount} ${secretText}?`,
      description: `Are you sure you want to remove the following ${secretText}: "${secretNames}"? This action cannot be undone.`,
      onConfirm: () => {
        removeSelectedSecrets()
      }
    })
  }

  /**
   * Handle secret name change (using hook's updateSecretField)
   */
  const handleSecretNameChange = (index: number, value: string) => {
    updateSecretField(index, "name", value)

    // Update YAML content and localStorage
    const updatedFormData = { ...formData }
    if (updatedFormData.env && updatedFormData.env[index]) {
      updatedFormData.env[index].name = value.toUpperCase()
    }
    const updatedYamlContent = yaml.dump(updatedFormData)
    setYamlContent(updatedYamlContent)
    localStorage.setItem(`secrets_editor_${env}`, updatedYamlContent)
    updateSecretsSourceFile(env, updatedYamlContent)
  }

  /**
   * Handle vault key change (optimized to reduce redundant operations)
   */
  const handleVaultKeyChange = useCallback((index: number, field: string, value: string) => {
    // ✅ Only update if the value actually changed
    const currentValue = field === "path"
      ? formData?.env?.[index]?.vaultRef?.path
      : formData?.env?.[index]?.vaultRef?.key

    if (currentValue === value.toLowerCase()) {
      return // No change, skip update
    }

    updateSecretField(index, field, value)

    // ✅ Batch YAML and localStorage updates
    const updatedFormData = { ...formData }
    if (updatedFormData.env && updatedFormData.env[index]) {
      if (field === "path") {
        updatedFormData.env[index].vaultRef.path = value.toLowerCase()
      } else if (field === "key") {
        updatedFormData.env[index].vaultRef.key = value.toLowerCase()
      }
    }

    const updatedYamlContent = yaml.dump(updatedFormData)
    setYamlContent(updatedYamlContent)

    // ✅ Debounce localStorage and file updates
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(`secrets_editor_${env}`, updatedYamlContent)
      updateSecretsSourceFile(env, updatedYamlContent)
    }, 300)
  }, [formData, updateSecretField, env])

  // ✅ Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  /**
   * Enhanced save secret changes (rewritten to handle drafts properly)
   */
  const saveSecretChanges = async () => {
    if (editingSecretIndex === null) return

    const isNewSecret = editingSecretIndex === -1
    let newFormData = { ...formData }

    // ✅ FIXED: Handle draft secrets properly
    if (isNewSecret && isDraftMode) {
      // ✅ This is a draft secret being saved for the first time
      const newSecret: SecretItem = {
        name: editSecretName.toUpperCase(),
        vaultRef: {
          path: editVaultPath.toLowerCase(),
          key: editVaultKey.toLowerCase()
        }
      }
      
      // ✅ Add to real formData (this will trigger effects, but that's expected for saved secrets)
      if (!newFormData.env) newFormData.env = []
      newFormData.env.push(newSecret)
      
      // ✅ Clear draft state
      setDraftSecrets([])
      setIsDraftMode(false)
      
    } else if (!isNewSecret) {
      // ✅ Existing secret being updated
      if (newFormData.env && newFormData.env[editingSecretIndex]) {
        newFormData.env[editingSecretIndex] = {
          ...newFormData.env[editingSecretIndex],
          name: editSecretName.toUpperCase(),
          vaultRef: {
            path: editVaultPath.toLowerCase(),
            key: editVaultKey.toLowerCase()
          }
        }
      }
    }

    // ✅ Now persist everything (only for actually saved secrets)
    setFormData(newFormData)
    const updatedYamlContent = yaml.dump(newFormData)
    setYamlContent(updatedYamlContent)
    
    // ✅ Persist to localStorage and file
    localStorage.setItem(`secrets_editor_${env}`, updatedYamlContent)
    await updateSecretsSourceFile(env, updatedYamlContent)

    // ✅ Update secretValues state
    if (secretInputValue && editSecretName) {
      setSecretValues(prev => ({
        ...prev,
        [editSecretName.toUpperCase()]: secretInputValue
      }))
    }

    // ✅ Save to Vault
    if (secretInputValue && editVaultPath && editVaultKey) {
      const secretToSave: SecretItem = {
        name: editSecretName.toUpperCase(),
        vaultRef: {
          path: editVaultPath.toLowerCase(),
          key: editVaultKey.toLowerCase()
        }
      }

      if (certificateMetadata) {
        await saveSecretToVaultWithMetadata(secretToSave, secretInputValue, certificateMetadata)
      } else {
        await saveSecretToVault(secretToSave, secretInputValue)
      }
    }

    closeSecretEditModal()
    toast({ title: "Secret saved successfully" })
  }

  /**
   * Enhanced open secret edit modal with metadata loading
   */
  const openSecretEditModal = async (index: number) => {
    const secret = formData.env[index];
    if (!secret) return;

    setEditingSecretIndex(index);
    setEditSecretName(secret.name || "");
    setEditVaultPath(secret.vaultRef?.path || `kv/${customer}/${env}/${editorContext.instance}/${product}`.toLowerCase());
    setEditVaultKey(secret.vaultRef?.key || "");

    // Load secret value and metadata from Vault
    if (secret.vaultRef?.path && secret.vaultRef?.key) {
      const { value, metadata } = await loadSecretWithMetadata(secret);
      setSecretInputValue(value || secretValues[secret.name] || "");

      // If metadata exists and it's a certificate, analyze it
      if (metadata && value) {
        // Use the existing analyzeContent function from the hook
        analyzeContent(value, metadata.fileName);
      }
    } else {
      setSecretInputValue(secretValues[secret.name] || "");
    }

    setShowSecretValue(false);
  };
  /**
   * Save secret to vault (using hook but preserving original behavior)
   */
  const saveSecretToVaultHandler = async (index: number) => {
    const secret = formData.env[index]
    if (!secret) return

    const secretValue = secretValues[secret.name]
    if (!secretValue) {
      toast({ title: "Please update the secret value first", variant: "destructive" })
      return
    }

    await saveSecretToVault(secret, secretValue)
  }

  /**
   * Render vault status (preserved from original)
   */
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

  /**
   * Close secret edit modal (enhanced to handle draft cleanup)
   */
  const closeSecretEditModal = () => {
    // ✅ Clean up draft state if canceling a new secret
    if (editingSecretIndex === -1 && isDraftMode) {
      setDraftSecrets([])
      setIsDraftMode(false)
      toast({ 
        title: "Draft discarded", 
        description: "New secret was not saved" 
      })
    }
    
    setEditingSecretIndex(null)
    setSecretInputValue("")
    setShowSecretValue(false)
    setEditSecretName("")
    setEditVaultPath("")
    setEditVaultKey("")
    setCertificateMetadata(null)
  }

  /**
   * Handle sync check manually
   */
  const handleSyncCheck = () => {
    if (formData?.env && vaultConnectionStatus === 'success') {
      checkVaultSync(formData.env, secretValues)
      toast({ title: "Checking sync status with Vault..." })
    }
  }

  /**
   * Toggle secret value visibility (preserved from original)
   */
  const toggleSecretValueVisibility = () => {
    setShowSecretValue(!showSecretValue)
  }

  /**
   * Toggle select all (preserved from original)
   */
  const toggleSelectAll = () => {
    if (selectedSecrets.length === (formData.env?.length || 0)) {
      setSelectedSecrets([])
    } else {
      setSelectedSecrets(formData.env ? Array.from({ length: formData.env.length }, (_, i) => i) : [])
    }
  }

  /**
   * Toggle select secret (preserved from original)
   */
  const toggleSelectSecret = (index: number) => {
    setSelectedSecrets((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))
  }

  /**
   * Request sort (preserved from original)
   */
  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending"

    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending"
    }

    setSortConfig({ key, direction })
  }

  /**
   * Get sorted and filtered secrets including drafts
   */
  const getSortedAndFilteredSecrets = () => {
    // ✅ Combine real secrets with draft secrets
    const realSecrets = formData.env || []
    const allSecrets = isDraftMode ? [...realSecrets, ...draftSecrets] : realSecrets
    
    if (!Array.isArray(allSecrets)) return []

    const filteredSecrets = allSecrets.filter((secret: SecretItem) => {
      // ✅ Add null checks to prevent TypeError
      if (!secret || !searchTerm) return !!secret
      
      const nameMatch = secret.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false
      const pathMatch = secret.vaultRef?.path?.toLowerCase().includes(searchTerm.toLowerCase()) || false
      const keyMatch = secret.vaultRef?.key?.toLowerCase().includes(searchTerm.toLowerCase()) || false
      
      return nameMatch || pathMatch || keyMatch
    })

    // ✅ Add null check for sortConfig before accessing its properties
    if (!sortConfig || !sortConfig.key) return filteredSecrets

    return [...filteredSecrets].sort((a, b) => {
      let aValue: string
      let bValue: string

      switch (sortConfig.key) {
        case 'name':
          aValue = a?.name || ''
          bValue = b?.name || ''
          break
        case 'path':
          aValue = a?.vaultRef?.path || ''
          bValue = b?.vaultRef?.path || ''
          break
        case 'key':
          aValue = a?.vaultRef?.key || ''
          bValue = b?.vaultRef?.key || ''
          break
        default:
          return 0
      }

      const comparison = aValue.localeCompare(bValue)
      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
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
                  className="p-0 h-auto text-red-700 underline"
                  onClick={() => window.electronAPI.openSettings?.()}
                >
                  Configure vault credentials in settings
                </Button>
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}


      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Secrets Editor - {env.toUpperCase()}</h2>
          {renderVaultStatus()}
        </div>
        <div className="flex items-center gap-2">
          {vaultConnectionStatus === 'success' && formData?.env && (
            <Button variant="outline" size="sm" onClick={handleSyncCheck}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Sync Check
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={triggerFileInput}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Secrets Management */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="h-full flex flex-col">
              {/* Search and Actions */}
              <div className="p-4 border-b space-y-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search secrets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={addSecret} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Secret
                  </Button>
                  {selectedSecrets.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={removeSelectedSecretsWithConfirm}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete ({selectedSecrets.length})
                    </Button>
                  )}
                </div>
              </div>

              {/* Secrets Table */}
              <div className="flex-1 overflow-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <SecretsTable
                    secrets={filteredSecrets}
                    secretValues={secretValues}
                    selectedSecrets={selectedSecrets}
                    sortConfig={sortConfig}
                    secretVaultStatuses={secretVaultStatuses}
                    onSelectSecret={toggleSelectSecret}
                    onSelectAll={toggleSelectAll}
                    onSort={requestSort}
                    onEditSecret={openSecretEditModal}
                    onSaveToVault={saveSecretToVaultHandler}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel - YAML Preview */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="border-b">
                <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value as TabType)}>
                  <div className="flex items-center justify-between px-4 py-2">
                    <TabsList>
                      <TabsTrigger value="secrets">Secrets YAML</TabsTrigger>
                      <TabsTrigger value="external-secrets">External Secret</TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={copyRightPanelContent}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={activeTab === "secrets" ? downloadYaml : downloadExternalSecretsYaml}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>

                  <TabsContent value="secrets" className="mt-0 h-full">
                    <Card className="h-full border-0 rounded-none">
                      <CardContent className="p-0 h-full">
                        <CodeMirror
                          value={formData && formData.env ? `env:\n${yaml.dump({ env: formData.env }).substring(5)}` : "env: []"}
                          height="100%"
                          extensions={[yamlLanguage(), ...readOnlyExtensions]}
                          theme={theme === 'dark' ? 'dark' : 'light'}
                          readOnly
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="external-secrets" className="mt-0 h-full">
                    <Card className="h-full border-0 rounded-none">
                      <CardContent className="p-0 h-full">
                        <CodeMirror
                          value={externalSecretsYaml}
                          height="100%"
                          extensions={[yamlLanguage(), ...readOnlyExtensions]}
                          theme={theme === 'dark' ? 'dark' : 'light'}
                          readOnly
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Secret Edit Modal */}
      <SecretEditModal
        isOpen={editingSecretIndex !== null}
        onClose={closeSecretEditModal}
        secretName={editSecretName}
        vaultPath={editVaultPath}
        vaultKey={editVaultKey}
        secretValue={secretInputValue}
        showSecretValue={showSecretValue}
        certificateMetadata={certificateMetadata}
        analysisResult={analysisResult}
        onSecretNameChange={(value) => {
          setEditSecretName(value)
          // Call the hook-based function if editing existing secret
          if (editingSecretIndex !== null && editingSecretIndex !== -1) {
            handleSecretNameChange(editingSecretIndex, value)
          }
        }}
        onVaultPathChange={(value) => {
          setEditVaultPath(value)
          // Call the hook-based function if editing existing secret
          if (editingSecretIndex !== null && editingSecretIndex !== -1) {
            handleVaultKeyChange(editingSecretIndex, "path", value)
          }
        }}
        onVaultKeyChange={(value) => {
          setEditVaultKey(value)
          // Call the hook-based function if editing existing secret
          if (editingSecretIndex !== null && editingSecretIndex !== -1) {
            handleVaultKeyChange(editingSecretIndex, "key", value)
          }
        }}
        onSecretValueChange={(value) => {
          setSecretInputValue(value)
          // Analyze content when it changes
          analyzeContent(value)
        }}
        onToggleVisibility={toggleSecretValueVisibility}
        onSave={saveSecretChanges}
        env={env}
        customer={customer}
        product={product}
        instance={editorContext.instance}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  )
}

export default SecretsEditor