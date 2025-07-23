interface GitCredentials {
  method: "token" | "ssh" | "credentials"
  token?: string
  username?: string
  password?: string
  sshKeyPath?: string
  url: string
  repoId: string
}

interface GitServerCredentials {
  method: "token" | "ssh" | "credentials"
  token?: string
  username?: string
  password?: string
  sshKeyPath?: string
  serverUrl: string
  serverId: string
}

class CredentialManager {
  private static instance: CredentialManager
  private sessionCredentials = new Map<string, GitCredentials>()
  private sessionServerCredentials = new Map<string, GitServerCredentials>()

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
        // Create a unique key for the repository credentials
        const credentialKey = `configpilot-git:${credentials.repoId}`

        // Convert credentials to JSON string as expected by the IPC handler
        const credentialData = JSON.stringify(credentials)

        // Use Electron's secure storage with correct parameters
        await window.electronAPI.storeSecureCredentials(credentialKey, credentialData)
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
        const credentialKey = `configpilot-git:${repoId}`
        const storedData = await window.electronAPI.getSecureCredentials(credentialKey)

        if (storedData) {
          const credentials = JSON.parse(storedData) as GitCredentials
          // Cache in session for performance
          this.sessionCredentials.set(repoId, credentials)
          return credentials
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
        const credentialKey = `configpilot-git:${repoId}`
        await window.electronAPI.removeSecureCredentials(credentialKey)
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

  /**
   * Store server-level credentials for Git authentication
   * @param credentials Server credentials to store
   * @param remember Whether to persist credentials beyond session
   */
  async storeServerCredentials(credentials: GitServerCredentials, remember = false): Promise<void> {
    // Always store in session
    this.sessionServerCredentials.set(credentials.serverId, credentials)

    if (remember && window.electronAPI?.storeSecureCredentials) {
      try {
        // Create a unique key for the server credentials
        const credentialKey = `configpilot-git-server:${credentials.serverId}`

        // Convert credentials to JSON string as expected by the IPC handler
        const credentialData = JSON.stringify(credentials)

        // Use Electron's secure storage with correct parameters
        await window.electronAPI.storeSecureCredentials(credentialKey, credentialData)
        console.log(`Server credentials stored securely for ${credentials.serverId}`)
      } catch (error) {
        console.error("Failed to store server credentials in system keychain:", error)
        throw new Error("Failed to store server credentials securely")
      }
    }
  }

  /**
   * Retrieve server-level credentials
   * @param serverId Server identifier
   * @returns Server credentials or null if not found
   */
  async getServerCredentials(serverId: string): Promise<GitServerCredentials | null> {
    // First check session cache
    const sessionCreds = this.sessionServerCredentials.get(serverId)
    if (sessionCreds) {
      return sessionCreds
    }

    // Then check system secure storage
    if (window.electronAPI?.getSecureCredentials) {
      try {
        const credentialKey = `configpilot-git-server:${serverId}`
        const storedData = await window.electronAPI.getSecureCredentials(credentialKey)

        if (storedData) {
          const credentials = JSON.parse(storedData) as GitServerCredentials
          // Cache in session for performance
          this.sessionServerCredentials.set(serverId, credentials)
          return credentials
        }
      } catch (error) {
        console.error("Failed to retrieve server credentials from system keychain:", error)
      }
    }

    return null
  }

  /**
   * Remove server-level credentials
   * @param serverId Server identifier
   */
  async removeServerCredentials(serverId: string): Promise<void> {
    // Remove from session
    this.sessionServerCredentials.delete(serverId)

    // Remove from system secure storage
    if (window.electronAPI?.removeSecureCredentials) {
      try {
        const credentialKey = `configpilot-git-server:${serverId}`
        await window.electronAPI.removeSecureCredentials(credentialKey)
        console.log(`Server credentials removed for ${serverId}`)
      } catch (error) {
        console.error("Failed to remove server credentials from system keychain:", error)
      }
    }
  }


  clearSession(): void {
    this.sessionCredentials.clear()
    this.sessionServerCredentials.clear()
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
