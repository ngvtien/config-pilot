"use client"

import type React from "react"
import { useRef, useState, useEffect } from "react"
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
} from "lucide-react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Textarea } from "@/renderer/components/ui/textarea"
import { Label } from "@/renderer/components/ui/label"
import { Checkbox } from "@/renderer/components/ui/checkbox"
import { Badge } from "@/renderer/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/renderer/components/ui/dialog"
import { useToast } from "@/renderer/hooks/use-toast"
import CodeMirror from "@uiw/react-codemirror"
import { yaml as yamlLanguage } from "@codemirror/lang-yaml"
import { json as jsonLanguage } from "@codemirror/lang-json"
import { oneDark } from "@codemirror/theme-one-dark"
import { jsonTheme, readOnlyExtensions, jsonReadOnlyExtensions } from "@/renderer/lib/codemirror-themes"
import { buildConfigPath } from "@/renderer/lib/path-utils"
import type { ContextData } from "@/shared/types/context-data"

interface SecretEditorProps {
  initialValue?: string
  onChange?: (value: string) => void
  environment?: string
  schemaPath?: string
  layout?: "side-by-side" | "stacked"
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

type TabType = "schema" | "secrets" | "external-secrets"

const SecretsEditor: React.FC<SecretEditorProps> = ({
  initialValue = "",
  onChange,
  environment = "dev",
  schemaPath = "/src/mock/schema/secrets.schema.json",
  layout = "side-by-side",
  context,
  baseDirectory = "/opt/config-pilot/configs",
}) => {
  const { toast } = useToast()
  const [yamlContent, setYamlContent] = useState(initialValue)
  const [formData, setFormData] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showYamlEditor, setShowYamlEditor] = useState(false)
  const [editorHeight, setEditorHeight] = useState("300px")
  const monacoEditorRef = useRef<any>(null)
  const [schema, setSchema] = useState<any>(null)
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
  const [activeTab, setActiveTab] = useState<TabType>("schema")
  const [externalSecretsYaml, setExternalSecretsYaml] = useState("")

  // State for the edit modal
  const [editSecretName, setEditSecretName] = useState("")
  const [editVaultPath, setEditVaultPath] = useState("")
  const [editVaultKey, setEditVaultKey] = useState("")

  // State for splitter
  const [isResizing, setIsResizing] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(66.67) // Default 2/3 (66.67%)

  // Load schema when component mounts
  useEffect(() => {
    loadSchema()
  }, [])

  // Load values when component mounts or environment changes
  useEffect(() => {
    loadValues(environment)
  }, [environment])

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

  const loadSchema = async () => {
    try {
      const savedSchema = localStorage.getItem(`schema_${schemaPath}`)
      if (savedSchema) {
        try {
          const schemaData = JSON.parse(savedSchema)
          setSchema({ ...schemaData })
          toast({ title: "Schema refreshed!" })
          return
        } catch (error) {
          console.error("Error parsing saved schema:", error)
        }
      }

      const res = await fetch(schemaPath)
      if (!res.ok) {
        console.error(`Failed to fetch schema: ${res.status} ${res.statusText}`)
        return
      }

      const schemaData = await res.json()
      setSchema({ ...schemaData })
      localStorage.setItem(`schema_${schemaPath}`, JSON.stringify(schemaData))
    } catch (error) {
      console.error("Error loading schema:", error)
    }
  }

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

  const handleYamlChange = (value: string | undefined) => {
    if (value === undefined) return
    setYamlContent(value)
    try {
      const parsedValues = yaml.load(value) as any
      setFormData(parsedValues || {})
      generateExternalSecretsYaml(parsedValues || {})
    } catch (e) {
      console.error("Error parsing YAML:", e)
    }
  }

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

  const copyEditorContent = () => {
    if (monacoEditorRef.current) {
      const editorValue = monacoEditorRef.current.getValue()
      copyToClipboard(editorValue)
    }
  }

  const copyRightPanelContent = () => {
    let contentToCopy = ""

    switch (activeTab) {
      case "schema":
        contentToCopy = JSON.stringify(schema, null, 2)
        break
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

  const toggleYamlEditor = () => {
    setShowYamlEditor(!showYamlEditor)
    if (!showYamlEditor) {
      setEditorHeight("300px")
    }
  }

  const handleEditorResize = () => {
    setEditorHeight(editorHeight === "300px" ? "500px" : "300px")
  }

  const addSecret = () => {
    setEditingSecretIndex(-1)
    setSecretInputValue("")
    setShowSecretValue(false)
    setEditSecretName("")
    setEditVaultPath(`kv/${customer}/${env}/${editorContext.instance}/${product}`.toLowerCase())
    setEditVaultKey("")
  }

  const removeSecret = (index: number) => {
    const newFormData = { ...formData }
    if (newFormData.env && Array.isArray(newFormData.env)) {
      const secretName = newFormData.env[index]?.name
      newFormData.env.splice(index, 1)

      const newYamlContent = yaml.dump(newFormData)
      setYamlContent(newYamlContent)
      localStorage.setItem(`secrets_editor_${env}`, newYamlContent)
      setFormData(newFormData)
      generateExternalSecretsYaml(newFormData)

      setSelectedSecrets((prev) => prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)))

      if (secretName) {
        const newSecretValues = { ...secretValues }
        delete newSecretValues[secretName]
        setSecretValues(newSecretValues)
      }
    }
  }

  const removeSelectedSecrets = () => {
    if (selectedSecrets.length === 0) return

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
    generateExternalSecretsYaml(newFormData)
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

  const saveSecretChanges = () => {
    try {
      if (secretInputValue && secretInputValue.length > 1000000) {
        toast({ title: "Processing large secret value..." })
      }

      setTimeout(() => {
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
              localStorage.setItem(`secrets_editor_${env}`, newYamlContent)
              generateExternalSecretsYaml(newFormData)

              if (secretInputValue) {
                try {
                  setSecretValues({
                    ...secretValues,
                    [editSecretName]: secretInputValue,
                  })
                  toast({ title: "Secret value updated locally" })
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

            if (secretInputValue) {
              try {
                setSecretValues({
                  ...secretValues,
                  [editSecretName]: secretInputValue,
                })
                toast({ title: "Secret value updated locally" })
              } catch (error) {
                console.error("Error saving secret value:", error)
                toast({
                  title: "Error: Could not save the secret value. It might be too large.",
                  variant: "destructive",
                })
              }
            }
          }

          closeSecretEditModal()
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

  const saveSecretToVault = (index: number) => {
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

    setTimeout(() => {
      toast({ title: `Secret "${secretName}" saved to vault at ${secret.vaultRef.path}` })
    }, 500)
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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return

    const container = document.querySelector(".splitter-container") as HTMLElement
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

    // Constrain between 20% and 80%
    const constrainedWidth = Math.min(Math.max(newLeftWidth, 20), 80)
    setLeftPanelWidth(constrainedWidth)
  }

  const handleMouseUp = () => {
    setIsResizing(false)
  }

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    } else {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing])

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-card p-4 rounded-t-lg">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Helm Secrets Editor</h2>
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
          <Button variant="outline" onClick={toggleYamlEditor}>
            {showYamlEditor ? "Hide YAML" : "Show YAML"}
          </Button>
          <Button variant="outline" onClick={downloadYaml} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download YAML
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden gap-0 p-4 splitter-container">
        {/* Main content */}
        <div className="flex flex-col gap-4 overflow-hidden min-w-0 pr-2" style={{ width: `${leftPanelWidth}%` }}>
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
                    <div className="flex gap-2">
                      <Button onClick={addSecret} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
                        <Plus className="w-4 h-4" />
                        Add Secret
                      </Button>
                      {selectedSecrets.length > 0 && (
                        <Button
                          variant="destructive"
                          onClick={removeSelectedSecrets}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Selected ({selectedSecrets.length})
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Secrets Table */}
                  <div className="flex-1 overflow-auto border border-border rounded-lg bg-card">
                    <table className="w-full border-collapse">
                      <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="p-3 text-left border-b border-border">
                            <Checkbox
                              checked={selectedSecrets.length === filteredSecrets.length && filteredSecrets.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </th>
                          <th
                            className="p-3 text-left border-b border-border cursor-pointer hover:bg-muted/70 select-none transition-colors"
                            onClick={() => requestSort("name")}
                          >
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                              Secret Key Name
                              {getSortIndicator("name")}
                            </div>
                          </th>
                          <th
                            className="p-3 text-left border-b border-border cursor-pointer hover:bg-muted/70 select-none transition-colors"
                            onClick={() => requestSort("path")}
                          >
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                              Vault Path
                              {getSortIndicator("path")}
                            </div>
                          </th>
                          <th
                            className="p-3 text-left border-b border-border cursor-pointer hover:bg-muted/70 select-none transition-colors"
                            onClick={() => requestSort("key")}
                          >
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                              Vault Key
                              {getSortIndicator("key")}
                            </div>
                          </th>
                          <th className="p-3 text-left border-b border-border font-semibold text-foreground">Status</th>
                          <th className="p-3 text-center border-b border-border font-semibold text-foreground">
                            Actions
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
                                className={`border-b border-border hover:bg-muted/30 transition-colors ${
                                  selectedSecrets.includes(originalIndex)
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
                                <td className="p-3 text-foreground font-medium">
                                  {secret.name || <span className="text-muted-foreground italic">No name</span>}
                                </td>
                                <td className="p-3 text-foreground">
                                  {secret.vaultRef?.path || (
                                    <span className="text-muted-foreground italic">No path</span>
                                  )}
                                </td>
                                <td className="p-3 text-foreground">
                                  {secret.vaultRef?.key || <span className="text-muted-foreground italic">No key</span>}
                                </td>
                                <td className="p-3">
                                  {secretValues[secret.name] ? (
                                    <Badge className="bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/20 dark:text-green-400">
                                      Has Value
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="destructive"
                                      className="bg-red-500/10 text-red-700 border-red-500/20 dark:bg-red-500/20 dark:text-red-400"
                                    >
                                      No Value
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="flex justify-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openSecretEditModal(originalIndex)}
                                      className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => saveSecretToVault(originalIndex)}
                                      disabled={!secretValues[secret.name]}
                                      className="h-8 w-8 p-0 hover:bg-green-500/10 hover:text-green-600 disabled:opacity-50"
                                    >
                                      <Lock className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeSecret(originalIndex)}
                                      className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-muted-foreground italic bg-muted/20">
                              {searchTerm ? "No secrets match your search" : "No secrets defined yet"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* YAML Editor */}
          {showYamlEditor && (
            <Card className="bg-card border border-border overflow-hidden" style={{ height: editorHeight }}>
              <CardHeader className="bg-muted border-b border-border p-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base text-foreground">YAML Editor</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={copyEditorContent} className="hover:bg-muted">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleEditorResize} className="hover:bg-muted">
                      {editorHeight === "300px" ? "Expand" : "Collapse"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <div className="h-full overflow-hidden">
                <Textarea
                  value={yamlContent}
                  onChange={(e) => handleYamlChange(e.target.value)}
                  className="h-full w-full bg-muted/30 text-foreground font-mono border-none resize-none"
                  style={{ minHeight: "100%" }}
                />
              </div>
            </Card>
          )}
        </div>

        {/* Splitter */}
        <div
          className={`w-1 cursor-col-resize transition-all duration-200 hover:bg-border/50 ${
            isResizing ? "bg-border" : "bg-transparent"
          }`}
          onMouseDown={handleMouseDown}
        />

        {/* Right Panel - Tabbed View */}
        <div className="overflow-hidden pl-2" style={{ width: `${100 - leftPanelWidth}%` }}>
          <Card className="h-full overflow-hidden border border-border">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as TabType)}
              className="h-full flex flex-col"
            >
              <div className="flex justify-between items-center p-3 border-b border-border bg-muted/30">
                <TabsList className="grid w-auto grid-cols-3">
                  <TabsTrigger value="schema">Schema</TabsTrigger>
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
                <TabsContent value="schema" className="h-full m-0">
                  <div className="h-full overflow-hidden">
                    <CodeMirror
                      value={schema ? JSON.stringify(schema, null, 2) : "No schema loaded"}
                      height="100%"
                      theme={jsonTheme}
                      extensions={[jsonLanguage(), ...jsonReadOnlyExtensions]}
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
                <TabsContent value="secrets" className="h-full m-0">
                  <div className="h-full overflow-hidden">
                    <CodeMirror
                      value={
                        formData && formData.env ? `env:\n${yaml.dump({ env: formData.env }).substring(5)}` : "env: []"
                      }
                      height="100%"
                      theme={oneDark}
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
                      theme={oneDark}
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
      </div>

      {/* Secret Edit Modal */}
      <Dialog open={editingSecretIndex !== null} onOpenChange={() => closeSecretEditModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Secret</DialogTitle>
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

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="secretValue">Secret Value</Label>
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
              </div>
              <Textarea
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
                placeholder="Enter secret value here..."
                rows={5}
                className={showSecretValue ? "" : "font-mono"}
                style={showSecretValue ? {} : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)}
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
    </div>
  )
}

export default SecretsEditor
