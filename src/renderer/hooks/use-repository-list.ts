import { useState, useEffect, useCallback } from 'react';
import { GitRepository } from '../../shared/types/git-repository';
import { GitRepositoryService } from '../services/git-repository.service';

/**
 * Hook for managing repository list in settings page
 * Provides CRUD operations with local state management
 */
export const useRepositoryList = () => {
  const [repositories, setRepositories] = useState<GitRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load repositories from service
   */
  const loadRepositories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const repos = await GitRepositoryService.getRepositories();
      setRepositories(repos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Add new repository
   */
  const addRepository = useCallback(async (repo: Omit<GitRepository, 'id'>) => {
    try {
      setError(null);
      const newRepo = await GitRepositoryService.createRepository(repo);
      setRepositories(prev => [...prev, newRepo]);
      return newRepo;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Update existing repository
   */
  const updateRepository = useCallback(async (id: string, updates: Partial<GitRepository>) => {
    try {
      setError(null);
      const updatedRepo = await GitRepositoryService.updateRepository(id, updates);
      setRepositories(prev => prev.map(r => r.id === id ? updatedRepo : r));
      return updatedRepo;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Remove repository
   */
  const removeRepository = useCallback(async (id: string) => {
    try {
      setError(null);
      await GitRepositoryService.removeRepository(id);
      setRepositories(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load repositories on mount
  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  return {
    repositories,
    loading,
    error,
    addRepository,
    updateRepository,
    removeRepository,
    refresh: loadRepositories,
    clearError
  };
};