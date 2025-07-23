"use client"
import { useState } from "react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { XCircle, Eye, EyeOff, Shield, Key } from "lucide-react"
import { credentialManager, type GitCredentials } from "@/renderer/services/credential-manager.service"
import { type GitServerCredentials } from '../services/credential-manager.service'

interface GitRepository {
  id: string
  name: string
  url: string
  branch: string
  description: string
}

interface AuthenticationModalProps {
  isOpen: boolean
  repository: GitRepository | null
  onClose: () => void
  onSuccess: (credentials: GitCredentials) => void
  context?: {
    environment?: string
    customer?: string
    product?: string
  }
}

export function AuthenticationModal({ isOpen, repository, onClose, onSuccess, context }: AuthenticationModalProps) {
  const [authMethod, setAuthMethod] = useState<"token" | "ssh" | "credentials">("token")
  const [authForm, setAuthForm] = useState({
    username: "",
    password: "",
    token: "",
    sshKeyPath: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [rememberCredentials, setRememberCredentials] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState("")

  if (!isOpen || !repository) return null

  const handleAuthSubmit = async () => {
    setError("")
    setIsAuthenticating(true)

    try {
      // Validate form based on auth method
      if (authMethod === "token" && !authForm.token) {
        setError("Personal access token is required")
        return
      }
      if (authMethod === "credentials" && (!authForm.username || !authForm.password)) {
        setError("Username and password are required")
        return
      }
      if (authMethod === "ssh" && !authForm.sshKeyPath) {
        setError("SSH key path is required")
        return
      }

      const serverUrl = new URL(repository.url)
      const serverId = `${serverUrl.hostname}-${authMethod}`

      // First, save the server configuration
      const serverConfig = {
        name: `${serverUrl.hostname} (${authMethod})`,
        baseUrl: serverUrl.origin,
        type: 'gitea' as const, // or detect based on URL
        description: `Auto-configured server for ${serverUrl.hostname}`
      }

      let savedServer
      try {
        savedServer = await window.electronAPI?.git?.saveServer(serverConfig)
        console.log('Server saved:', savedServer)
      } catch (error) {
        console.error('Failed to save server:', error)
        setError('Failed to configure server. Please try again.')
        return
      }

      // Create server credentials with the saved server ID
      const serverCredentials: GitServerCredentials = {
        method: authMethod,
        serverUrl: serverUrl.origin,
        serverId: savedServer.id, // Use the actual server ID from saved server
        ...(authMethod === "token" && { token: authForm.token }),
        ...(authMethod === "credentials" && {
          username: authForm.username,
          password: authForm.password,
        }),
        ...(authMethod === "ssh" && { sshKeyPath: authForm.sshKeyPath }),
      }

      console.log('Testing server credentials:', serverCredentials)

      // Test the credentials using the git-auth service
      let authSuccess = false
      if (window.electronAPI?.git?.authenticateToServer) {
        try {
          const result = await window.electronAPI.git.authenticateToServer(savedServer.id, serverCredentials)
          authSuccess = result.isValid
          console.log('Authentication result:', result)

          if (!authSuccess && result.error) {
            setError(`Authentication failed: ${result.error}`)
            return
          }
        } catch (error) {
          console.error('Authentication error:', error)
          setError('Authentication failed. Please check your credentials.')
          return
        }
      } else {
        // Fallback simulation for development
        await new Promise((resolve) => setTimeout(resolve, 1500))
        authSuccess = true // Simulate success for demo
      }

      if (authSuccess) {
        // Store server credentials if requested
        if (rememberCredentials) {
          await credentialManager.storeServerCredentials(serverCredentials, true)
        } else {
          // Store in session only
          await credentialManager.storeServerCredentials(serverCredentials, false)
        }

        onSuccess(serverCredentials)

        // Reset form
        setAuthForm({ username: "", password: "", token: "", sshKeyPath: "" })
      } else {
        setError("Authentication failed. Please check your credentials.")
      }
    } catch (error) {
      console.error("Authentication error:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleFileSelect = async () => {
    if (window.electronAPI?.selectFile) {
      try {
        const result = await window.electronAPI.selectFile({
          filters: [
            { name: "SSH Keys", extensions: ["", "rsa", "ed25519", "pem"] },
            { name: "All Files", extensions: ["*"] },
          ],
        })

        if (result && !result.canceled && result.filePaths.length > 0) {
          setAuthForm({ ...authForm, sshKeyPath: result.filePaths[0] })
        }
      } catch (error) {
        console.error("Error selecting SSH key file:", error)
      }
    } else {
      // Fallback for development/web environment
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".rsa,.ed25519,.pem,id_rsa,id_ed25519"
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files
        if (files && files.length > 0) {
          // In web environment, we can only get the file name, not the full path
          setAuthForm({ ...authForm, sshKeyPath: files[0].name })
        }
      }
      input.click()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center gap-2 mb-4">
          <XCircle className="h-5 w-5 text-red-500" />
          <h3 className="text-lg font-semibold">Authentication Required</h3>
        </div>

        <div className="space-y-2 mb-4">
          <p className="text-sm text-muted-foreground">
            Authentication failed for <span className="font-mono font-medium">{repository.name}</span>
          </p>
          {context && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
              <div className="flex gap-4">
                {context.environment && (
                  <span>
                    Environment: <strong>{context.environment}</strong>
                  </span>
                )}
                {context.customer && (
                  <span>
                    Customer: <strong>{context.customer}</strong>
                  </span>
                )}
                {context.product && (
                  <span>
                    Product: <strong>{context.product}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Please provide your credentials to access this repository.</p>
        </div>

        {/* Secure Storage Info */}
        {credentialManager.isSecureStorageAvailable() && (
          <Alert className="mb-4">
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Credentials will be stored securely in your system's credential manager (Keychain/Windows Credential
              Manager).
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Auth Method Selection */}
          <div>
            <Label className="text-sm font-medium">Authentication Method</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={authMethod === "token" ? "default" : "outline"}
                size="sm"
                onClick={() => setAuthMethod("token")}
              >
                <Key className="h-3 w-3 mr-1" />
                Token
              </Button>
              <Button
                variant={authMethod === "credentials" ? "default" : "outline"}
                size="sm"
                onClick={() => setAuthMethod("credentials")}
              >
                Username/Password
              </Button>
              <Button
                variant={authMethod === "ssh" ? "default" : "outline"}
                size="sm"
                onClick={() => setAuthMethod("ssh")}
              >
                SSH Key
              </Button>
            </div>
          </div>

          {/* Auth Forms */}
          {authMethod === "token" && (
            <div>
              <Label htmlFor="token" className="text-sm font-medium">
                Personal Access Token
              </Label>
              <div className="relative mt-1">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={authForm.token}
                  onChange={(e) => setAuthForm({ ...authForm, token: e.target.value })}
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Generate a token in your Git provider's settings with repository access permissions.
              </p>
            </div>
          )}

          {authMethod === "credentials" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="username" className="text-sm font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  placeholder="your-username"
                  value={authForm.username}
                  onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="your-password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {authMethod === "ssh" && (
            <div>
              <Label htmlFor="sshKey" className="text-sm font-medium">
                SSH Private Key Path
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="sshKey"
                  placeholder="~/.ssh/id_rsa"
                  value={authForm.sshKeyPath}
                  onChange={(e) => setAuthForm({ ...authForm, sshKeyPath: e.target.value })}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={handleFileSelect}>
                  Browse
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Path to your SSH private key file. Make sure the corresponding public key is added to your Git provider.
              </p>
            </div>
          )}

          {/* Remember Credentials Option */}
          {credentialManager.isSecureStorageAvailable() && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberCredentials}
                onChange={(e) => setRememberCredentials(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="remember" className="text-sm">
                Remember credentials securely
              </Label>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <Button variant="outline" onClick={onClose} disabled={isAuthenticating}>
            Cancel
          </Button>
          <Button onClick={handleAuthSubmit} disabled={isAuthenticating}>
            {isAuthenticating ? "Authenticating..." : "Authenticate"}
          </Button>
        </div>
      </div>
    </div>
  )
}
