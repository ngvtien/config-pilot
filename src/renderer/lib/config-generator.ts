import yaml from "js-yaml"

export interface ConfigMapData {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    namespace?: string
  }
  data: Record<string, string>
}

export interface ConfigJsonData {
  [key: string]: any
}

/**
 * Generates a Kubernetes ConfigMap from key-value pairs
 */
export function generateConfigMap(values: Record<string, string>, namespace = "default", name = "app-config"): string {
  if (!values || Object.keys(values).length === 0) {
    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}
  namespace: ${namespace}
data: {}`
  }

  const configMap: ConfigMapData = {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      name,
      namespace,
    },
    data: values,
  }

  // Convert to YAML format
  const yamlOutput = `apiVersion: ${configMap.apiVersion}
kind: ${configMap.kind}
metadata:
  name: ${configMap.metadata.name}
  namespace: ${configMap.metadata.namespace}
data:
${Object.entries(configMap.data)
  .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
  .join("\n")}`

  return yamlOutput
}

/**
 * Generates a JSON configuration from key-value pairs
 */
export function generateConfigJson(values: Record<string, string>): string {
  if (!values || Object.keys(values).length === 0) {
    return "{}"
  }

  try {
    const config: ConfigJsonData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        type: "configuration",
      },
      configuration: values,
    }

    return JSON.stringify(config, null, 2)
  } catch (error) {
    console.error("Error generating JSON config:", error)
    return JSON.stringify(
      {
        error: "Failed to generate configuration",
        values: values,
      },
      null,
      2,
    )
  }
}

/**
 * Copies content to clipboard with error handling
 */
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(content)
      return true
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement("textarea")
      textArea.value = content
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const success = document.execCommand("copy")
      textArea.remove()
      return success
    }
  } catch (error) {
    console.error("Failed to copy to clipboard:", error)
    return false
  }
}

/**
 * Formats YAML content with proper indentation
 */
export function formatYaml(content: string): string {
  try {
    const parsed = yaml.load(content)
    return yaml.dump(parsed, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
  } catch (error) {
    console.error("Error formatting YAML:", error)
    return content
  }
}

/**
 * Validates YAML content
 */
export function validateYaml(content: string): { isValid: boolean; error?: string } {
  try {
    yaml.load(content)
    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown YAML parsing error",
    }
  }
}

/**
 * Converts key-value pairs to YAML format
 */
export function convertToYaml(values: Record<string, string>): string {
  try {
    return yaml.dump(values, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
  } catch (error) {
    console.error("Error converting to YAML:", error)
    return ""
  }
}
