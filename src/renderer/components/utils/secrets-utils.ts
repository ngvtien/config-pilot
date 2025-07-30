import yaml from "js-yaml"
import type { SecretItem, SortConfig } from "../types/secrets"

/**
 * Generate external secrets YAML configuration
 */
export const generateExternalSecretsYaml = (data: any, product: string, customer: string, env: string): string => {
  if (!data || !data.env || !Array.isArray(data.env)) {
    return ""
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
        kind: "VaultStore",
      },
      target: {
        name: `${product}-secrets`,
        creationPolicy: "Owner",
      },
      data: secretsData,
    },
  }

  return yaml.dump(externalSecretTemplate)
}

/**
 * Sort and filter secrets based on search term and sort configuration
 */
export const getSortedAndFilteredSecrets = (
  secrets: SecretItem[],
  searchTerm: string,
  sortConfig: SortConfig | null
): SecretItem[] => {
  if (!secrets || !Array.isArray(secrets)) return []

  const filteredSecrets = secrets.filter((secret: SecretItem) => {
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

/**
 * Detect content type from string content
 */
export const detectContentType = (value: string): 'text' | 'certificate' | 'binary' => {
  if (value.includes('-----BEGIN CERTIFICATE-----') ||
    value.includes('-----BEGIN PRIVATE KEY-----') ||
    value.includes('-----BEGIN PUBLIC KEY-----') ||
    value.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    return 'certificate'
  }
  return 'text'
}

/**
 * Update secrets source file
 */
export const updateSecretsSourceFile = async (env: string, yamlContent: string): Promise<void> => {
  try {
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