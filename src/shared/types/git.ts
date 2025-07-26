export interface GitRepository {
  url: string;
  branch: string;
  localPath: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
}

export interface GitOperationResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface GitStatus {
  current: string;
  tracking: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: string[];
  conflicted: string[];
}

export interface MergeOptions {
  noFf?: boolean;  // Force create merge commit even for fast-forward
  squash?: boolean; // Squash commits into single commit
}

export interface MergeConflictInfo {
  hasConflicts: boolean;
  conflicts?: string[];
}

export interface MergeRequestInfo {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description?: string;
}