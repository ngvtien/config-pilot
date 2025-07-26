import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GitRepository, GitValidationResult, GitCredentials } from '../../shared/types/git-repository';
import { GitRepositoryService } from '../services/git-repository.service';

export interface GitRepositoryContextType {
  repositories: GitRepository[];
  servers: any[];
  loading: boolean;
  error: string | null;
  
  // Repository management
  addRepository: (repo: Omit<GitRepository, 'id'>, serverId?: string) => Promise<GitRepository>;
  updateRepository: (id: string, updates: Partial<GitRepository>) => Promise<void>;
  removeRepository: (id: string) => Promise<void>;
  
  // Server management
  addServer: (server: any) => Promise<void>;
  authenticateServer: (serverId: string, credentials: any) => Promise<void>;
  
  // Repository operations
  validateRepository: (url: string, serverId?: string) => Promise<GitValidationResult>;
  testConnection: (url: string, serverId?: string) => Promise<boolean>;
  getRepositoryByUrl: (url: string) => GitRepository | undefined;
  getRepositoriesByPermission: (permission: string, level: string) => GitRepository[];
  
  // Health and utility functions
  checkHealth: () => Promise<any>;
  refreshRepositories: () => Promise<void>;
  refreshServers: () => Promise<void>;
  clearError: () => void;
}

const GitRepositoryContext = createContext<GitRepositoryContextType | undefined>(undefined);

export interface GitRepositoryProviderProps {
  children: ReactNode;
}

/**
 * Provider for centralized Git repository state management
 */
export const GitRepositoryProvider: React.FC<GitRepositoryProviderProps> = ({ children }) => {
  const [repositories, setRepositories] = useState<GitRepository[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRepositories();
    loadServers();
  }, []);

  /**
   * Load repositories from electron store
   */
  const loadRepositories = async () => {
    try {
      setLoading(true);
      const repos = await GitRepositoryService.getRepositories();
      setRepositories(repos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadServers = async () => {
    try {
      const serverList = await GitRepositoryService.getServers();
      setServers(serverList);
    } catch (err: any) {
      setError(err.message);
    }
  };

  /**
   * Add a new repository with validation
   */
  const addRepository = async (repoData: Omit<GitRepository, 'id'>, serverId?: string): Promise<GitRepository> => {
    try {
      setError(null);
      const newRepo = await GitRepositoryService.createRepository(repoData, serverId);
      setRepositories(prev => [...prev, newRepo]);
      return newRepo;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const addServer = async (server: any) => {
    try {
      setError(null);
      await GitRepositoryService.saveServer(server);
      await loadServers();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const authenticateServer = async (serverId: string, credentials: any) => {
    try {
      setError(null);
      await GitRepositoryService.authenticateServer(serverId, credentials);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Update existing repository
   */
  const updateRepository = async (id: string, updates: Partial<GitRepository>) => {
    try {
      setError(null);
      
      const updatedRepo = repositories.find(r => r.id === id);
      if (!updatedRepo) {
        throw new Error('Repository not found');
      }
      
      const newRepo = { ...updatedRepo, ...updates };
      
      // If URL changed, revalidate
      if (updates.url && updates.url !== updatedRepo.url) {
        const validation = await validateRepository(updates.url);
        newRepo.authStatus = validation.authStatus;
        newRepo.lastAuthCheck = new Date().toISOString();
      }
      
      await window.electronAPI?.git?.saveRepository(newRepo);
      
      setRepositories(prev => prev.map(r => r.id === id ? newRepo : r));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Remove repository
   */
  const removeRepository = async (id: string) => {
    try {
      setError(null);
      await window.electronAPI?.git?.removeRepository(id);
      setRepositories(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Validate repository URL and authentication
   */
  const validateRepository = async (url: string, serverId?: string): Promise<GitValidationResult> => {
    return await GitRepositoryService.validateRepository(url, serverId);
  };

  /**
   * Test connection to repository
   */
  const testConnection = async (url: string, serverId?: string): Promise<boolean> => {
    return await GitRepositoryService.testConnection(url, serverId);
  };

  const checkHealth = async () => {
    try {
      return await GitRepositoryService.checkHealth();
    } catch (err: any) {
      setError(err.message);
      return { status: 'error', error: err.message };
    }
  };

  const refreshServers = async () => {
    await loadServers();
  };

  /**
   * Get repository by URL
   */
  const getRepositoryByUrl = (url: string): GitRepository | undefined => {
    return repositories.find(repo => repo.url === url);
  };

  /**
   * Get repositories filtered by permission level
   */
  const getRepositoriesByPermission = (role: string, level: string): GitRepository[] => {
    return repositories.filter(repo => {
      const permission = repo.permissions[role as keyof typeof repo.permissions];
      return permission === level || (level === 'any' && permission !== 'none');
    });
  };

  /**
   * Refresh repositories from store
   */
  const refreshRepositories = async () => {
    await loadRepositories();
  };

  /**
   * Clear error state
   */
  const clearError = () => {
    setError(null);
  };

  const value: GitRepositoryContextType = {
    repositories,
    servers,
    loading,
    error,
    addRepository,
    updateRepository,
    removeRepository,
    addServer,
    authenticateServer,
    validateRepository,
    testConnection,
    getRepositoryByUrl,
    getRepositoriesByPermission,
    checkHealth,
    refreshRepositories,
    refreshServers,
    clearError
  };

  return (
    <GitRepositoryContext.Provider value={value}>
      {children}
    </GitRepositoryContext.Provider>
  );
};

/**
 * Hook to use Git repository context
 */
export const useGitRepository = (): GitRepositoryContextType => {
  const context = useContext(GitRepositoryContext);
  if (context === undefined) {
    throw new Error('useGitRepository must be used within a GitRepositoryProvider');
  }
  return context;
};