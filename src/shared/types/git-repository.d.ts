export interface GitRepository {
    id: string;
    name: string;
    url: string;
    branch: string;
    description: string;
    permissions: GitRepositoryPermissions;
    authStatus?: GitAuthStatus;
    lastAuthCheck?: string;
    tags?: string[];
    metadata?: GitRepositoryMetadata;
}
export interface GitRepositoryPermissions {
    developer: GitPermissionLevel;
    devops: GitPermissionLevel;
    operations: GitPermissionLevel;
}
export type GitPermissionLevel = "full" | "read-only" | "dev-only" | "none";
export type GitAuthStatus = "unknown" | "checking" | "success" | "failed";
export interface GitRepositoryMetadata {
    createdAt?: string;
    updatedAt?: string;
    lastSync?: string;
    size?: number;
    language?: string;
    topics?: string[];
    isPrivate?: boolean;
    defaultBranch?: string;
    cloneUrl?: string;
    sshUrl?: string;
}
export interface GitCredentials {
    method: "token" | "ssh" | "credentials";
    token?: string;
    username?: string;
    password?: string;
    sshKeyPath?: string;
    url: string;
    repoId: string;
}
export interface GitOperationResult {
    success: boolean;
    message: string;
    data?: any;
    error?: string;
    timestamp: string;
}
export interface GitBranch {
    name: string;
    commit: string;
    protected: boolean;
    isDefault: boolean;
}
export interface GitCommit {
    sha: string;
    message: string;
    author: {
        name: string;
        email: string;
        date: string;
    };
    committer: {
        name: string;
        email: string;
        date: string;
    };
    url: string;
}
export interface GitFileChange {
    path: string;
    status: "added" | "modified" | "deleted" | "renamed";
    additions?: number;
    deletions?: number;
    changes?: number;
}
export interface GitDiffResult {
    files: GitFileChange[];
    totalAdditions: number;
    totalDeletions: number;
    totalChanges: number;
}
export type GitOperation = "clone" | "pull" | "push" | "diff" | "status" | "log";
export interface GitOperationOptions {
    operation: GitOperation;
    repository: GitRepository;
    credentials?: GitCredentials;
    branch?: string;
    force?: boolean;
    dryRun?: boolean;
}
