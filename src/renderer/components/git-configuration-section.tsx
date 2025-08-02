"use client"
import { useState, useEffect } from "react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import {
    CheckCircle,
    Loader2,
    Key,
    RefreshCw,
    Eye,
    EyeOff,
    Search,
    Plus,
    ChevronDown,
    ChevronUp
} from "lucide-react"
import { gitCredentialManager } from "@/renderer/services/git-credential-manager"
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/renderer/components/ui/select"
import { GitRepositoryService } from "@/renderer/services/git-repository.service"
import type { ContextData } from "@/shared/types/context-data"
import type { GitRepository } from "@/shared/types/git-repository"
import { GitServerConfig } from "../../shared/types/git-repository"
import { GitServerCard } from "./git-server-card"
import { GitServerForm } from "./git-server-form"
import { GitServerTile } from "./git-server-tile"

interface GitConfigurationSectionProps {
    context: ContextData
    onContextChange: (context: ContextData) => void
    authModalRepo: GitRepository | null
    setAuthModalRepo: (repo: GitRepository | null) => void
    setAuthModalOpen: (open: boolean) => void
}

export function GitConfigurationSection({
    context,
    onContextChange,
    authModalRepo,
    setAuthModalRepo,
    setAuthModalOpen
}: GitConfigurationSectionProps) {
    // Move all Git-related state here
    const [gitProvider, setGitProvider] = useState("")
    const [gitServerConfig, setGitServerConfig] = useState({
        provider: "",
        baseUrl: "",
        authStatus: "unknown" as const,
        authMethod: "" as const,
        lastConfigured: null as string | null
    })
    const [authMethod, setAuthMethod] = useState<"token" | "credentials" | "ssh">("token")
    const [authForm, setAuthForm] = useState({
        token: "",
        username: "",
        password: "",
        sshKeyPath: ""
    })
    const [showToken, setShowToken] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [rememberCredentials, setRememberCredentials] = useState(false)
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [error, setError] = useState("")

    const [localContext, setLocalContext] = useState<ContextData>(context)

    const [servers, setServers] = useState<GitServerConfig[]>([])
    const [selectedServer, setSelectedServer] = useState<GitServerConfig | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [showAddForm, setShowAddForm] = useState(false)
    const [currentServerId, setCurrentServerId] = useState<string | null>(null)
    const [showAuthSection, setShowAuthSection] = useState(false)

    useEffect(() => {
        setLocalContext(context)
    }, [context])

    // Load Git server configuration from localStorage on mount
    useEffect(() => {
        const savedGitConfig = localStorage.getItem("configpilot_git_server_config")
        if (savedGitConfig) {
            try {
                const configData = JSON.parse(savedGitConfig)
                setGitProvider(configData.provider || "")
                setGitServerConfig(configData)

                // Also restore the base URL to context if it exists
                if (configData.baseUrl && configData.baseUrl !== localContext.baseHostUrl) {
                    handleContextChange("baseHostUrl", configData.baseUrl)
                }
            } catch (e) {
                console.error("Error parsing saved Git config:", e)
            }
        }
        
        // Load the selected server ID from localStorage
        const savedCurrentServerId = localStorage.getItem("configpilot_current_server_id")
        if (savedCurrentServerId) {
            setCurrentServerId(savedCurrentServerId)
        }
    }, [])

    useEffect(() => {
        loadServers()
    }, [])

    // Add this new useEffect to sync selected server with form fields
    useEffect(() => {
        if (currentServerId) {
            const selectedServer = servers.find(server => server.id === currentServerId)
            if (selectedServer) {
                // Update form fields with selected server's data
                setGitProvider(selectedServer.provider || "")
                setGitServerConfig({
                    provider: selectedServer.provider || "",
                    baseUrl: selectedServer.baseUrl || "",
                    authStatus: "unknown" as const,
                    authMethod: "" as const,
                    lastConfigured: null as string | null
                })
                
                // Update the context baseHostUrl to match selected server
                if (selectedServer.baseUrl && selectedServer.baseUrl !== localContext.baseHostUrl) {
                    handleContextChange("baseHostUrl", selectedServer.baseUrl)
                }
            }
        }
    }, [currentServerId, servers])

    // Update the useEffect that saves Git server configuration
    useEffect(() => {
        if (gitProvider && localContext.baseHostUrl && authModalRepo?.authStatus === 'authenticated') {
            const serverConfig = {
                id: localContext.baseHostUrl,
                serverId: localContext.baseHostUrl,
                provider: gitProvider,
                baseUrl: localContext.baseHostUrl,
                description: `${gitProvider} server configuration`
            }

            console.log('💾 Saving server with explicit provider:', gitProvider);

            // Use GitRepositoryService directly instead of addServer hook
            GitRepositoryService.saveServer(serverConfig).catch((error: any) => {
                console.error('Failed to save server to backend:', error)
            })
        }
    }, [gitProvider, localContext.baseHostUrl, authModalRepo?.authStatus, authMethod])

    // Add persistence for currentServerId changes
    useEffect(() => {
        if (currentServerId) {
            localStorage.setItem("configpilot_current_server_id", currentServerId)
        } else {
            localStorage.removeItem("configpilot_current_server_id")
        }
    }, [currentServerId])
        
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
        }
    }

    const isFormValid = () => {
        if (authMethod === "token") return authForm.token.trim() !== ""
        if (authMethod === "credentials") return authForm.username.trim() !== "" && authForm.password.trim() !== ""
        if (authMethod === "ssh") return authForm.sshKeyPath.trim() !== ""
        return false
    }

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

            const serverUrl = new URL(localContext.baseHostUrl)

            // Create server credentials
            const serverCredentials = {
                method: authMethod,
                serverUrl: serverUrl.origin,
                serverId: "server-auth",
                ...(authMethod === "token" && { token: authForm.token }),
                ...(authMethod === "credentials" && {
                    username: authForm.username,
                    password: authForm.password,
                }),
                ...(authMethod === "ssh" && { sshKeyPath: authForm.sshKeyPath }),
            }

            // Simulate authentication (replace with actual implementation)
            // await new Promise((resolve) => setTimeout(resolve, 1500))

            // Update auth status
            const updatedRepo = {
                id: "server-auth",
                name: "Server Authentication",
                url: localContext.baseHostUrl,
                branch: "main",
                description: "Server authentication setup",
                authStatus: "authenticated" as const
            }
            setAuthModalRepo(updatedRepo)

            // Store credentials if requested
            if (rememberCredentials && gitCredentialManager.isSecureStorageAvailable()) {
                await gitCredentialManager.storeServerCredentials(serverCredentials, true)
            }

            // Reset form
            setAuthForm({ username: "", password: "", token: "", sshKeyPath: "" })
            setError("")
        } catch (error) {
            console.error("Authentication error:", error)
            setError("An unexpected error occurred. Please try again.")
        } finally {
            setIsAuthenticating(false)
        }
    }

    const handleContextChange = (field: keyof ContextData, value: any) => {
        onContextChange({ ...context, [field]: value })
    }

    const loadServers = async () => {
        try {
            const serverList = await GitRepositoryService.getServers()
            setServers(serverList)
        } catch (error) {
            console.error('Failed to load servers:', error)
        }
    }

    const handleEditServer = (server: GitServerConfig) => {
        setSelectedServer(server)
        setIsEditing(true)
        setShowAddForm(true)
    }

    const handleDeleteServer = async (serverId: string) => {
        try {
            await GitRepositoryService.removeServer(serverId)
            await loadServers()
        } catch (error) {
            console.error('Failed to delete server:', error)
        }
    }

    const handleSaveServer = async (serverData: Omit<GitServerConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            if (isEditing && selectedServer) {
                await GitRepositoryService.updateServer(selectedServer.id, serverData)
            } else {
                await GitRepositoryService.saveServer(serverData)
            }
            await loadServers()
            setShowAddForm(false)
            setIsEditing(false)
            setSelectedServer(null)
        } catch (error) {
            console.error('Failed to save server:', error)
        }
    }

    // Filter servers based on search
    const filteredServers = servers.filter(server =>
        server.name?.toLowerCase().includes(searchTerm?.toLowerCase()) ||
        server.baseUrl?.toLowerCase().includes(searchTerm?.toLowerCase()) ||
        server.provider?.toLowerCase().includes(searchTerm?.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Git Server Configuration</h3>
            </div>
            <p className="text-sm text-muted-foreground -mt-2">
                Configure your Git server provider and authentication
            </p>

            {/* Git Servers Management Section */}
            <div className="border rounded-lg p-6 space-y-4 bg-card">
                <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium">Configured Git Servers</h4>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(true)}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Server
                    </Button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        placeholder="Search servers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Server List */}
                {/* <div className="space-y-2">
        {filteredServers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
                {servers.length === 0 ? "No Git servers configured" : "No servers match your search"}
            </div>
        ) : (
            filteredServers.map((server) => (
                <GitServerCard
                    key={server.id}
                    server={server}
                    onEdit={handleEditServer}
                    onDelete={handleDeleteServer}
                    isDefault={server.isDefault}
                />
            ))
        )}
    </div> */}

{/* Server List - Updated to horizontal tile grid */}
<div className="space-y-2">
    {filteredServers.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
            {servers.length === 0 ? "No Git servers configured" : "No servers match your search"}
        </div>
    ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredServers.map((server) => (
                <GitServerTile
                    key={server.id}
                    server={server}
                    onEdit={handleEditServer}
                    onDelete={handleDeleteServer}
                    onSetCurrent={setCurrentServerId}
                    isDefault={server.isDefault}
                    isCurrent={currentServerId === server.id}
                />
            ))}
        </div>
    )}
</div>
            </div>

            {/* Add/Edit Server Form Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background border rounded-lg p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">
                                {isEditing ? 'Edit Server' : 'Add New Server'}
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setShowAddForm(false)
                                    setIsEditing(false)
                                    setSelectedServer(null)
                                }}
                            >
                                ×
                            </Button>
                        </div>

                        <GitServerForm
                            server={selectedServer}
                            onSave={handleSaveServer}
                            onCancel={() => {
                                setShowAddForm(false)
                                setIsEditing(false)
                                setSelectedServer(null)
                            }}
                        />
                    </div>
                </div>
            )}

            <div className="border rounded-lg p-6 space-y-6 bg-card">
                {/* Combined Provider and Server URL Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Provider Selection */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            Git Provider
                        </Label>
                        <Select value={gitProvider} onValueChange={setGitProvider}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Select your Git provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="github">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-gray-900"></div>
                                        <div>
                                            <div className="font-medium">GitHub</div>
                                            <div className="text-xs text-muted-foreground">github.com</div>
                                        </div>
                                    </div>
                                </SelectItem>
                                <SelectItem value="gitlab">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                        <div>
                                            <div className="font-medium">GitLab</div>
                                            <div className="text-xs text-muted-foreground">gitlab.com</div>
                                        </div>
                                    </div>
                                </SelectItem>
                                <SelectItem value="gitea">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-green-600"></div>
                                        <div>
                                            <div className="font-medium">Gitea</div>
                                            <div className="text-xs text-muted-foreground">Self-hosted</div>
                                        </div>
                                    </div>
                                </SelectItem>
                                <SelectItem value="bitbucket">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                                        <div>
                                            <div className="font-medium">Bitbucket</div>
                                            <div className="text-xs text-muted-foreground">bitbucket.org</div>
                                        </div>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Server URL */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            Server URL
                        </Label>
                        <div className="relative">
                            <Input
                                id="baseHostUrl"
                                value={localContext.baseHostUrl}
                                onChange={(e) => {
                                    const lowercaseValue = e.target.value.toLowerCase()
                                    handleContextChange("baseHostUrl", lowercaseValue)
                                }}
                                placeholder={`https://github.com/${context.customer}`}
                                className="h-10 pr-10"
                            />
                            {localContext.baseHostUrl && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Authentication Toggle Button - Seamless Control */}
                {gitProvider && localContext.baseHostUrl && (
                    <div className="pt-2 border-t">
                        <Button
                            variant="ghost"
                            onClick={() => setShowAuthSection(!showAuthSection)}
                            className="w-full flex items-center justify-between p-3 h-auto hover:bg-muted/50 rounded-lg border border-transparent hover:border-border transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="text-sm font-medium">Authentication Setup</span>
                                {showAuthSection ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                                {authModalRepo && authModalRepo.authStatus === 'authenticated' && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                        <CheckCircle className="h-3 w-3" />
                                        Authenticated
                                    </div>
                                )}
                            </div>
                        </Button>
                    </div>
                )}

                {/* Collapsible Authentication Section */}
                {gitProvider && localContext.baseHostUrl && showAuthSection && (
                    <div className="space-y-4 pt-4 border-t bg-muted/20 rounded-lg p-4">
                        {/* Authentication Method Selection */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Authentication Method</Label>
                            <div className="flex gap-2">
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

                        {/* Authentication Forms */}
                        {authMethod === "token" && (
                            <div className="space-y-2">
                                <Label htmlFor="auth-token" className="text-sm font-medium">
                                    Personal Access Token
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="auth-token"
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
                                <p className="text-xs text-muted-foreground">
                                    Generate a token in your Git provider's settings with repository access permissions.
                                </p>
                            </div>
                        )}

                        {authMethod === "credentials" && (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label htmlFor="auth-username" className="text-sm font-medium">
                                        Username
                                    </Label>
                                    <Input
                                        id="auth-username"
                                        placeholder="your-username"
                                        value={authForm.username}
                                        onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="auth-password" className="text-sm font-medium">
                                        Password
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="auth-password"
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
                            <div className="space-y-2">
                                <Label htmlFor="auth-ssh" className="text-sm font-medium">
                                    SSH Private Key Path
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="auth-ssh"
                                        placeholder="~/.ssh/id_rsa"
                                        value={authForm.sshKeyPath}
                                        onChange={(e) => setAuthForm({ ...authForm, sshKeyPath: e.target.value })}
                                        className="flex-1"
                                    />
                                    <Button variant="outline" size="sm" onClick={handleFileSelect}>
                                        Browse
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Path to your SSH private key file. Make sure the corresponding public key is added to your Git provider.
                                </p>
                            </div>
                        )}

                        {/* Remember Credentials Option */}
                        {gitCredentialManager.isSecureStorageAvailable() && (
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="remember-creds"
                                    checked={rememberCredentials}
                                    onChange={(e) => setRememberCredentials(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <Label htmlFor="remember-creds" className="text-sm">
                                    Remember credentials securely
                                </Label>
                            </div>
                        )}

                        {/* Error Display */}
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription className="text-xs">{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Authentication Button */}
                        <Button
                            variant="default"
                            onClick={handleAuthSubmit}
                            disabled={isAuthenticating || !isFormValid()}
                            className="w-full h-10 flex items-center justify-center gap-2 transition-all duration-200"
                        >
                            {isAuthenticating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Authenticating...
                                </>
                            ) : authModalRepo && authModalRepo.authStatus === 'authenticated' ? (
                                <>
                                    <CheckCircle className="h-4 w-4" />
                                    Update Authentication
                                </>
                            ) : (
                                <>
                                    <Key className="h-4 w-4" />
                                    Authenticate
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>

            {/* Enhanced Status Display */}
            {/* Enhanced Status Display - Updated to reflect selected server */}
            {(() => {
                const selectedServer = servers.find(s => s.id === currentServerId)
                if (selectedServer || (localContext.baseHostUrl && gitProvider)) {
                    const displayServer = selectedServer || {
                        provider: gitProvider,
                        baseUrl: localContext.baseHostUrl,
                        name: 'Current Server'
                    }
                    
                    return (
                        <div className="border rounded-lg p-4 bg-muted/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${
                                            selectedServer ? 'bg-green-500' : 'bg-blue-500 animate-pulse'
                                        }`}></div>
                                        <span className="text-sm font-medium">
                                            {selectedServer ? 'Selected Server' : 'Server Status'}
                                        </span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                                        selectedServer 
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                    }`}>
                                        <CheckCircle className="h-3 w-3" />
                                        {selectedServer ? 'Active' : 'Connected'}
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" className="h-7 px-2">
                                    <RefreshCw className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="mt-2 space-y-1">
                                {selectedServer && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>Server:</span>
                                        <code className="px-1.5 py-0.5 bg-background rounded font-mono">
                                            {selectedServer.name}
                                        </code>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Provider:</span>
                                    <code className="px-1.5 py-0.5 bg-background rounded font-mono capitalize">
                                        {displayServer.provider}
                                    </code>
                                    <span>•</span>
                                    <span>URL:</span>
                                    <code className="px-1.5 py-0.5 bg-background rounded font-mono">
                                        {displayServer.baseUrl}
                                    </code>
                                </div>
                            </div>
                        </div>
                    )
                }
                return null
            })()
            }
        </div>
    )
}