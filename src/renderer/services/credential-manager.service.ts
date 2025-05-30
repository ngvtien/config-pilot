interface GitCredentials {
  method: "token" | "ssh" | "credentials"
  token?: string
  username?: string
  password?: string
  sshKeyPath?: string
  url: string
  repoId: string
}

class CredentialManager {
  private static instance: CredentialManager
  private sessionCredentials = new Map<string, GitCredentials>()

  static getInstance(): CredentialManager {
    if (!CredentialManager.instance) {
      CredentialManager.instance = new CredentialManager()
    }
    return CredentialManager.instance
  }

  async storeCredentials(credentials: GitCredentials, remember = false): Promise<void> {
    // Always store in session
    this.sessionCredentials.set(credentials.repoId, credentials)

    if (remember && window.electronAPI?.storeSecureCredentials) {
      try {
        // Use Electron's secure storage (system keychain/credential manager)
        await window.electronAPI.storeSecureCredentials({
          service: "configpilot-git",
          account: credentials.repoId,
          credentials: credentials,
        })
        console.log(`Credentials stored securely for ${credentials.repoId}`)
      } catch (error) {
        console.error("Failed to store credentials in system keychain:", error)
        throw new Error("Failed to store credentials securely")
      }
    }
  }

  async getCredentials(repoId: string): Promise<GitCredentials | null> {
    // First check session cache
    const sessionCreds = this.sessionCredentials.get(repoId)
    if (sessionCreds) {
      return sessionCreds
    }

    // Then check system secure storage
    if (window.electronAPI?.getSecureCredentials) {
      try {
        const stored = await window.electronAPI.getSecureCredentials({
          service: "configpilot-git",
          account: repoId,
        })

        if (stored) {
          // Cache in session for performance
          this.sessionCredentials.set(repoId, stored)
          return stored
        }
      } catch (error) {
        console.error("Failed to retrieve credentials from system keychain:", error)
      }
    }

    return null
  }

  async removeCredentials(repoId: string): Promise<void> {
    // Remove from session
    this.sessionCredentials.delete(repoId)

    // Remove from system secure storage
    if (window.electronAPI?.removeSecureCredentials) {
      try {
        await window.electronAPI.removeSecureCredentials({
          service: "configpilot-git",
          account: repoId,
        })
        console.log(`Credentials removed for ${repoId}`)
      } catch (error) {
        console.error("Failed to remove credentials from system keychain:", error)
      }
    }
  }

  async listStoredCredentials(): Promise<string[]> {
    if (window.electronAPI?.listSecureCredentials) {
      try {
        return await window.electronAPI.listSecureCredentials("configpilot-git")
      } catch (error) {
        console.error("Failed to list stored credentials:", error)
      }
    }
    return []
  }

  clearSession(): void {
    this.sessionCredentials.clear()
  }

  async useCredentialsForGitOperation(
    repoId: string,
    operation: "clone" | "pull" | "push" | "diff",
  ): Promise<GitCredentials | null> {
    const credentials = await this.getCredentials(repoId)

    if (credentials && window.electronAPI?.updateCredentialUsage) {
      try {
        // Update last used timestamp in secure storage
        await window.electronAPI.updateCredentialUsage({
          service: "configpilot-git",
          account: repoId,
          operation: operation,
        })
      } catch (error) {
        console.error("Failed to update credential usage:", error)
      }
    }

    return credentials
  }

  // New method for checking if secure storage is available
  isSecureStorageAvailable(): boolean {
    return !!(
      window.electronAPI?.storeSecureCredentials &&
      window.electronAPI?.getSecureCredentials &&
      window.electronAPI?.removeSecureCredentials
    )
  }

  // Method to migrate from old storage (if needed)
  async migrateFromLegacyStorage(): Promise<void> {
    if (!this.isSecureStorageAvailable()) return

    try {
      // Check for old localStorage credentials and migrate them
      const legacyKeys = Object.keys(localStorage).filter((key) => key.startsWith("configpilot-creds-"))

      for (const key of legacyKeys) {
        const repoId = key.replace("configpilot-creds-", "")
        const legacyData = localStorage.getItem(key)

        if (legacyData) {
          try {
            const credentials = JSON.parse(legacyData)
            await this.storeCredentials(credentials, true)
            localStorage.removeItem(key) // Remove old storage
            console.log(`Migrated credentials for ${repoId} to secure storage`)
          } catch (error) {
            console.error(`Failed to migrate credentials for ${repoId}:`, error)
          }
        }
      }
    } catch (error) {
      console.error("Failed to migrate legacy credentials:", error)
    }
  }
}

export const credentialManager = CredentialManager.getInstance()
export type { GitCredentials }
