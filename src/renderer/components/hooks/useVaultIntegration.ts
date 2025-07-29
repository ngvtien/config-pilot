import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/renderer/hooks/use-toast"
import { VaultCredentialManager } from "@/renderer/services/vault-credential-manager"
import type { VaultConnectionStatus, SecretVaultStatus, SecretItem } from "../types/secrets"

/**
 * Custom hook for Vault integration and secret synchronization
 */
export const useVaultIntegration = (environment: string) => {
  const { toast } = useToast()
  const [vaultConnectionStatus, setVaultConnectionStatus] = useState<VaultConnectionStatus>('unknown')
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [hasVaultCredentials, setHasVaultCredentials] = useState(false)
  const [secretVaultStatuses, setSecretVaultStatuses] = useState<Record<string, SecretVaultStatus>>({})

  /**
   * Check Vault connection status
   */
  const checkVaultConnection = useCallback(async () => {
    try {
      setVaultConnectionStatus('checking')
      setVaultError(null)

      const credentials = await VaultCredentialManager.getCredentials(environment as any)
      setHasVaultCredentials(!!credentials)

      if (!credentials) {
        setVaultConnectionStatus('error')
        setVaultError('No vault credentials configured. Please configure vault in settings.')
        return
      }

      const result = await window.electronAPI.vault.testConnection(
        environment,
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
  }, [environment])

  /**
   * Load secret values from Vault
   */
  const loadSecretValuesFromVault = useCallback(async (secrets: SecretItem[]) => {
    if (vaultConnectionStatus !== 'success') return {}

    const newSecretValues: Record<string, string> = {}

    for (const secret of secrets) {
      if (secret.vaultRef?.path && secret.vaultRef?.key && secret.name) {
        try {
          // Try the new method first to handle structured data
          const structuredResult = await window.electronAPI.vault.readSecretWithMetadata(
            environment,
            secret.vaultRef.path,
            secret.vaultRef.key
          )

          if (structuredResult.value) {
            newSecretValues[secret.name] = structuredResult.value
            console.log(`✅ Loaded secret value for ${secret.name} from Vault (structured format)`)
          } else {
            // Fallback to old method for backwards compatibility
            const result = await window.electronAPI.vault.readSecret(
              environment,
              secret.vaultRef.path,
              secret.vaultRef.key
            )

            if (result.success && result.value) {
              newSecretValues[secret.name] = result.value
              console.log(`✅ Loaded secret value for ${secret.name} from Vault (legacy format)`)
            } else {
              console.log(`ℹ️ No value found in Vault for ${secret.name}`)
            }
          }
        } catch (error: any) {
          console.error(`❌ Failed to load secret ${secret.name} from Vault:`, error)
        }
      }
    }

    if (Object.keys(newSecretValues).length > 0) {
      toast({
        title: `Loaded ${Object.keys(newSecretValues).length} secret value(s) from Vault`,
        description: "Secret values are now available in the editor"
      })
    }

    return newSecretValues
  }, [environment, vaultConnectionStatus, toast])

  /**
   * Save secret to Vault
   */
  const saveSecretToVault = useCallback(async (secret: SecretItem, secretValue: string) => {
    if (vaultConnectionStatus !== 'success') {
      toast({
        title: "Vault connection required",
        description: "Please configure vault connection in settings first",
        variant: "destructive"
      })
      return false
    }

    if (!secret.vaultRef.path || !secret.vaultRef.key) {
      toast({ title: "Please provide both Vault Path and Vault Key", variant: "destructive" })
      return false
    }

    try {
      const result = await window.electronAPI.vault.writeSecret(
        environment,
        secret.vaultRef.path,
        secret.vaultRef.key,
        secretValue
      )

      if (result.success) {
        toast({ title: `Secret "${secret.name}" saved to vault successfully` })
        return true
      } else {
        toast({
          title: "Failed to save secret to vault",
          variant: "destructive"
        })
        return false
      }
    } catch (error: any) {
      toast({
        title: "Failed to save secret to vault",
        description: error.message,
        variant: "destructive"
      })
      return false
    }
  }, [environment, vaultConnectionStatus, toast])

  /**
   * Check sync status between local and Vault values
   */
  const checkVaultSync = useCallback(async (secrets: SecretItem[], localSecretValues: Record<string, string>) => {
    if (vaultConnectionStatus !== 'success') return

    const statusUpdates: Record<string, SecretVaultStatus> = {}

    for (const secret of secrets) {
      if (secret.name && secret.vaultRef?.path && secret.vaultRef?.key) {
        statusUpdates[secret.name] = 'checking'
      }
    }
    setSecretVaultStatuses(prev => ({ ...prev, ...statusUpdates }))

    for (const secret of secrets) {
      if (secret.name && secret.vaultRef?.path && secret.vaultRef?.key) {
        try {
          // Use the new method to handle structured data
          const structuredResult = await window.electronAPI.vault.readSecretWithMetadata(
            environment,
            secret.vaultRef.path,
            secret.vaultRef.key
          )

          let vaultValue = structuredResult.value

          // Fallback to old method if no structured data found
          if (!vaultValue) {
            const result = await window.electronAPI.vault.readSecret(
              environment,
              secret.vaultRef.path,
              secret.vaultRef.key
            )
            vaultValue = result.success ? result.value : null
          }

          const localValue = localSecretValues[secret.name]

          if (localValue && vaultValue && localValue === vaultValue) {
            statusUpdates[secret.name] = 'synced'
          } else if (localValue || vaultValue) {
            statusUpdates[secret.name] = 'out-of-sync'
          } else {
            delete statusUpdates[secret.name]
          }
        } catch (error: any) {
          statusUpdates[secret.name] = 'error'
        }
      }
    }

    setSecretVaultStatuses(prev => ({ ...prev, ...statusUpdates }))
  }, [environment, vaultConnectionStatus])


  // Check vault connection on mount and environment change
  useEffect(() => {
    checkVaultConnection()
  }, [checkVaultConnection])

  /**
   * Save secret to Vault with certificate metadata support
   */
  const saveSecretToVaultWithMetadata = async (
    secret: SecretItem,
    secretValue: string,
    certificateMetadata?: any
  ) => {
    if (!secret.vaultRef?.path || !secret.vaultRef?.key || secret.vaultRef.path.trim() === '') {
      toast({
        title: "Vault Configuration Missing",
        description: "Please configure a valid Vault path and key before saving.",
        variant: "destructive"
      });
      return;
    }


    try {
      const success = await window.electronAPI.vault.writeSecretWithMetadata(
        environment,
        secret.vaultRef.path,
        secret.vaultRef.key,
        secretValue,
        certificateMetadata
      );

      if (success) {
        toast({
          title: "Secret Saved to Vault",
          description: `Successfully saved ${secret.name} with ${certificateMetadata ? 'metadata' : 'content only'}`
        });

        // Update vault status
        setSecretVaultStatuses(prev => ({
          ...prev,
          [secret.name]: 'synced'  // ✅ CORRECT! Use 'synced' instead of 'success'
        }));
      }

    } catch (error: any) {
      console.error('Failed to save secret with metadata:', error);
      toast({
        title: "Failed to Save Secret",
        description: error.message || "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  /**
   * Load secret with metadata from Vault
   */
  const loadSecretWithMetadata = async (secret: SecretItem) => {
    if (!secret.vaultRef?.path) return { value: null, metadata: null };

    try {
      // Use the new readSecretWithMetadata method
      const result = await window.electronAPI.vault.readSecretWithMetadata(
        environment,
        secret.vaultRef.path,
        secret.vaultRef.key
      );

      return {
        value: result.value,
        metadata: result.metadata || null
      };
    } catch (error) {
      console.error('Failed to load secret with metadata:', error);
      return { value: null, metadata: null };
    }
  };

  return {
    // State
    vaultConnectionStatus,
    vaultError,
    hasVaultCredentials,
    secretVaultStatuses,

    // Actions
    checkVaultConnection,
    loadSecretValuesFromVault,
    saveSecretToVault,
    checkVaultSync,
    saveSecretToVaultWithMetadata,
    loadSecretWithMetadata,
  }
}