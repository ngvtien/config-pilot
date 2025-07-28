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
    checkVaultSync
  } = useVaultIntegration(env)

  // const {
  //   isDragOver,
  //   fileType,
  //   fileName,
  //   handleDragOver,
  //   handleDragLeave,
  //   handleDrop,
  //   handleCertificateUpload,
  //   analyzeContent,
  //   resetCertificateState
  // } = useCertificateAnalysis()

  // State for the edit modal (preserved from original)
  const [editingSecretIndex, setEditingSecretIndex] = useState<number | null>(null)
  const [secretInputValue, setSecretInputValue] = useState("")
  const [showSecretValue, setShowSecretValue] = useState(false)
  const [editSecretName, setEditSecretName] = useState("")
  const [editVaultPath, setEditVaultPath] = useState("")
  const [editVaultKey, setEditVaultKey] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("secrets")

  // Load initial values using the hook's loadValues function
  useEffect(() => {
    if (formData?.env)
      { 
        loadValues(formData?.env)
      }
  }, [loadValues])

  // Auto-load secret values from Vault when formData is ready and Vault is connected
  useEffect(() => {
    if (formData?.env && vaultConnectionStatus === 'success') {
      loadSecretValuesFromVault(formData.env).then(values => {
        setSecretValues(prev => ({ ...prev, ...values }))
      })
    }
  }, [formData, vaultConnectionStatus, loadSecretValuesFromVault, setSecretValues])

  // Auto-check sync status when secrets and vault connection are ready
  useEffect(() => {
    if (formData?.env && vaultConnectionStatus === 'success' && Object.keys(secretValues).length > 0) {
      checkVaultSync(formData.env, secretValues)
    }
  }, [formData, vaultConnectionStatus, secretValues, checkVaultSync])

  // Generate external secrets YAML when formData changes
  useEffect(() => {
    if (formData) {
      const externalYaml = generateExternalSecretsYaml(formData, product, customer, env)
      setExternalSecretsYaml(externalYaml)
    }
  }, [formData, product, customer, env, setExternalSecretsYaml])

  // Call onChange when yamlContent changes
  useEffect(() => {
    if (onChange) {
      onChange(yamlContent)
    }
  }, [yamlContent, onChange])

  // // Auto-analyze content when secret value changes
  // useEffect(() => {
  //   if (secretInputValue) {
  //     analyzeContent(secretInputValue)
  //   }
  // }, [secretInputValue, analyzeContent])

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
        //analyzeContent(content)
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
   * Add secret (using hook's addNewSecret)
   */
  const addSecret = () => {
    // Use the hook's addNewSecret function
    addNewSecret()
    
    // Then open the edit modal for the new secret
    const newIndex = formData.env ? formData.env.length : 0
    setEditingSecretIndex(newIndex)
    setSecretInputValue("")
    setShowSecretValue(false)
    setEditSecretName("")
    setEditVaultPath(`secret/${customer}/${env}/${editorContext.instance}/${product}`.toLowerCase())
    setEditVaultKey("")
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
   * Handle vault key change (using hook's updateSecretField)
   */
  const handleVaultKeyChange = (index: number, field: string, value: string) => {
    updateSecretField(index, field, value)
    
    // Update YAML content and localStorage
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
    localStorage.setItem(`secrets_editor_${env}`, updatedYamlContent)
    updateSecretsSourceFile(env, updatedYamlContent)
  }

  /**
   * Open secret edit modal (preserved from original)
   */
  const openSecretEditModal = (index: number) => {
    const secret = formData.env[index]
    if (!secret) return

    setEditingSecretIndex(index)
    setEditSecretName(secret.name || "")
    setEditVaultPath(secret.vaultRef?.path || `kv/${customer}/${env}/${editorContext.instance}/${product}`.toLowerCase())
    setEditVaultKey(secret.vaultRef?.key || "")
    setSecretInputValue(secretValues[secret.name] || "")
    setShowSecretValue(false)
  }

  /**
   * Save secret changes (enhanced with content analysis)
   */
  const saveSecretChanges = async () => {
    if (editingSecretIndex === null) return

    const isNewSecret = editingSecretIndex === -1
    let newFormData = { ...formData }

    if (isNewSecret) {
      if (!newFormData.env) {
        newFormData.env = []
      }

      const newSecret: SecretItem = {
        name: editSecretName.toUpperCase(),
        vaultRef: {
          path: editVaultPath.toLowerCase(),
          key: editVaultKey.toLowerCase()
        }
      }

      newFormData.env.push(newSecret)
    } else {
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

    setFormData(newFormData)
    const newYamlContent = yaml.dump(newFormData)
    setYamlContent(newYamlContent)
    localStorage.setItem(`secrets_editor_${env}`, newYamlContent)
    await updateSecretsSourceFile(env, newYamlContent)

    if (secretInputValue) {
      // Analyze the secret content before saving
      //analyzeContent(secretInputValue)
      
      setSecretValues(prev => ({
        ...prev,
        [editSecretName.toUpperCase()]: secretInputValue
      }))
    }

    closeSecretEditModal()
    toast({ title: isNewSecret ? "Secret added successfully" : "Secret updated successfully" })
  }
  
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
   * Close secret edit modal (preserved from original)
   */
  const closeSecretEditModal = () => {
    setEditingSecretIndex(null)
    setSecretInputValue("")
    setShowSecretValue(false)
    setEditSecretName("")
    setEditVaultPath("")
    setEditVaultKey("")
    resetCertificateState()
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
   * Get sorted and filtered secrets (preserved from original)
   */
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
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
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
          //analyzeContent(value)
        }}
        onToggleVisibility={toggleSecretValueVisibility}
        onSave={saveSecretChanges}
        env={env}
        customer={customer}
        product={product}
        instance={editorContext.instance}
        // isDragOver={isDragOver}
        // fileType={fileType}
        // fileName={fileName}
        // onDragOver={handleDragOver}
        // onDragLeave={handleDragLeave}
        // onDrop={(e) => handleDrop(e, (content) => {
        //   setSecretInputValue(content)
        //   analyzeContent(content)
        // })}
        // // Pass the certificate upload handler from the hook
        // onCertificateUpload={handleCertificateUpload}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  )
}

export default SecretsEditor