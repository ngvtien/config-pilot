// export interface GitRepository {
//   id: string
//   name: string
//   url: string
//   branch: string
//   description: string
//   permissions: GitRepositoryPermissions
//   authStatus?: GitAuthStatus
//   lastAuthCheck?: string
//   tags?: string[]
//   metadata?: GitRepositoryMetadata
// }

export interface GitRepository {
  id: string
  name: string
  url: string
  branch: string
  description: string
  permissions: GitRepositoryPermissions
  // Unified server integration
  serverId: string // Required - links to GitServerConfig
  serverName?: string // Display name for UI
  authStatus?: GitAuthStatus
  lastAuthCheck?: string
  accessStatus?: GitRepositoryAccessStatus
  tags?: string[]
  metadata?: GitRepositoryMetadata
}

export interface GitRepositoryPermissions {
  developer: GitPermissionLevel
  devops: GitPermissionLevel
  operations: GitPermissionLevel
}

export type GitPermissionLevel = "full" | "read-only" | "dev-only" | "none"

export type GitAuthStatus = "unknown" | "checking" | "success" | "failed"

export interface GitRepositoryMetadata {
  createdAt?: string
  updatedAt?: string
  lastSync?: string
  size?: number
  language?: string
  topics?: string[]
  isPrivate?: boolean
  defaultBranch?: string
  cloneUrl?: string
  sshUrl?: string
}

export interface GitCredentials {
  method: "token" | "ssh" | "credentials"
  token?: string
  username?: string
  password?: string
  sshKeyPath?: string
  url: string
  repoId: string
}

export interface GitOperationResult {
  success: boolean
  message: string
  data?: any
  error?: string
  timestamp: string
}

export interface GitBranch {
  name: string
  commit: string
  protected: boolean
  isDefault: boolean
}

export interface GitCommit {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
  committer: {
    name: string
    email: string
    date: string
  }
  url: string
}

export interface GitFileChange {
  path: string
  status: "added" | "modified" | "deleted" | "renamed"
  additions?: number
  deletions?: number
  changes?: number
}

export interface GitDiffResult {
  files: GitFileChange[]
  totalAdditions: number
  totalDeletions: number
  totalChanges: number
}

// Git operation types
export type GitOperation = "clone" | "pull" | "push" | "diff" | "status" | "log"

export interface GitOperationOptions {
  operation: GitOperation
  repository: GitRepository
  credentials?: GitCredentials
  branch?: string
  force?: boolean
  dryRun?: boolean
}

export interface GitValidationResult {
  isValid: boolean
  authStatus?: GitAuthStatus
  error?: string
  canConnect: boolean
  requiresAuth: boolean
  repositoryInfo?: RepositoryInfo
}


export interface RepositoryInfo {
  name: string
  description?: string
  defaultBranch: string
  isPrivate: boolean
  size: number
  language?: string
  topics: string[]
}

export interface GitServerConfig {
  id: string
  name: string
  provider: 'github' | 'gitlab' | 'gitea' | 'bitbucket'
  baseUrl: string // e.g., "https://github.com", "https://git.company.com"
  isDefault?: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

export interface GitServerCredentials {
  serverId: string
  method: "token" | "ssh" | "credentials"
  token?: string
  username?: string
  password?: string
  sshKeyPath?: string
  sshPassphrase?: string
  // Remove url and repoId as these are server-level, not repo-specific
}

export interface GitServerAuthStatus {
  serverId: string
  status: GitAuthStatus
  lastCheck: string
  error?: string
  userInfo?: {
    username: string
    email?: string
    name?: string
  }
}

export interface GitRepositoryAccessStatus {
  repositoryUrl: string
  serverId: string
  hasAccess: boolean
  permissions: GitRepositoryPermissions
  lastCheck: string
  error?: string
  accessLevel?: 'none' | 'read' | 'write' | 'admin' // Add missing property
}

export interface PermissionFilter {
  role: 'developer' | 'devops' | 'operations';
  level: 'full' | 'read-only' | 'dev-only' | 'any';
}

// Enhanced repository interface to include server association
// export interface GitRepositoryEnhanced extends GitRepository {
//   serverId?: string // Associate repository with a Git server
//   serverName?: string // Display name for UI
//   accessStatus?: GitRepositoryAccessStatus
// }
export interface GitRepositoryEnhanced extends Omit<GitRepository, 'serverId'> {
  serverId?: string // Optional for enhanced version
  serverName?: string // Display name for UI
  accessStatus?: GitRepositoryAccessStatus
}

// Server validation result
export interface GitServerValidationResult {
  isValid: boolean
  authStatus: GitAuthStatus
  error?: string
  canConnect: boolean
  serverInfo?: {
    version?: string
    features?: string[]
    userInfo?: {
      username: string
      email?: string
      name?: string
    }
  }
  userInfo?: { // Add for backward compatibility
    username: string
    email?: string
    name?: string
  }
}