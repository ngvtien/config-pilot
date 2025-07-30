import { useState, useEffect, useCallback } from "react"
import yaml from "js-yaml"
import { useToast } from "@/renderer/hooks/use-toast"
import type { SecretItem, SortConfig } from "../types/secrets"
import { generateExternalSecretsYaml, updateSecretsSourceFile } from "../utils/secrets-utils"

/**
 * Custom hook for managing secrets state and operations
 */
export const useSecretsManager = (environment: string, initialValue: string) => {
  const { toast } = useToast()
  const [yamlContent, setYamlContent] = useState(initialValue)
  const [formData, setFormData] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const [secretValues, setSecretValues] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSecrets, setSelectedSecrets] = useState<number[]>([])
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [externalSecretsYaml, setExternalSecretsYaml] = useState("")

  /**
   * Load values from localStorage or file system
   */
  const loadValues = useCallback(async (env: string) => {
    try {
      setIsLoading(true)

      const savedValues = localStorage.getItem(`secrets_editor_${env}`)
      if (savedValues) {
        setYamlContent(savedValues)
        try {
          const parsedValues = yaml.load(savedValues) as any
          setFormData(parsedValues || {})
          setExternalSecretsYaml(generateExternalSecretsYaml(parsedValues || {}, "helm-secrets", "default", env))
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
            setExternalSecretsYaml(generateExternalSecretsYaml(parsedValues || {}, "helm-secrets", "default", env))
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
        setExternalSecretsYaml(generateExternalSecretsYaml(parsedValues || { env: [] }, "helm-secrets", "default", env))
      } catch (e) {
        console.error("Error parsing YAML:", e)
        setFormData({ env: [] })
        setExternalSecretsYaml(generateExternalSecretsYaml({ env: [] }, "helm-secrets", "default", env))
      }
      setIsLoading(false)
    } catch (error) {
      console.error("Error loading values:", error)
      setIsLoading(false)
    }
  }, [initialValue])

  /**
   * Add new secret (modified to not auto-persist)
   */
  const addNewSecret = useCallback(() => {
    const newSecret: SecretItem = {
      name: "",
      vaultRef: {
        path: "",
        key: ""
      }
    }

    // ✅ FIXED: Only update local state, don't persist until user saves
    const updatedFormData = {
      ...formData,
      env: [...(formData.env || []), newSecret]
    }

    setFormData(updatedFormData)
    // ✅ Don't update YAML content or persist until user explicitly saves
    // const updatedYamlContent = yaml.dump(updatedFormData)
    // setYamlContent(updatedYamlContent)

    toast({ title: "New secret template created", description: "Fill in details and save to persist" })
  }, [formData, toast])
  /**
   * Remove selected secrets
   */
  const removeSelectedSecrets = useCallback(async () => {
    if (selectedSecrets.length === 0) return

    const updatedSecrets = formData.env?.filter((_: any, index: number) => !selectedSecrets.includes(index)) || []
    const updatedFormData = { ...formData, env: updatedSecrets }

    setFormData(updatedFormData)
    const updatedYamlContent = yaml.dump(updatedFormData)
    setYamlContent(updatedYamlContent)
    localStorage.setItem(`secrets_editor_${environment}`, updatedYamlContent)
    await updateSecretsSourceFile(environment, updatedYamlContent)
    setSelectedSecrets([])

    toast({ title: `Removed ${selectedSecrets.length} secret(s)` })
  }, [selectedSecrets, formData, environment, toast])

  /**
   * Update a specific field of a secret
   */
  const updateSecretField = useCallback((index: number, field: string, value: string) => {
    if (!formData.env || !formData.env[index]) return

    const updatedSecrets = [...formData.env]
    if (field === "name") {
      updatedSecrets[index].name = value.toUpperCase()
    } else if (field === "path") {
      updatedSecrets[index].vaultRef.path = value.toLowerCase()
    } else if (field === "key") {
      updatedSecrets[index].vaultRef.key = value.toLowerCase()
    }

    const updatedFormData = { ...formData, env: updatedSecrets }
    setFormData(updatedFormData)
  }, [formData])

  // Load values when environment changes
  useEffect(() => {
    loadValues(environment)
  }, [environment, loadValues])

  return {
    // State
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

    // Actions
    loadValues,
    //addNewSecret,
    removeSelectedSecrets,
    updateSecretField
  }
}