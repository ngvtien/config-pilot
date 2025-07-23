import { useState, useEffect } from 'react';
import { GitRepository } from '../../shared/types/git-repository';
import { GitRepositoryService } from '../services/git-repository.service';

/**
 * Hook for selecting repositories in product forms
 * Provides filtered repository list based on permissions
 */
export const useRepositorySelector = (permission?: string) => {
  const [repositories, setRepositories] = useState<GitRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load and filter repositories based on permission
   */
  useEffect(() => {
    const loadRepositories = async () => {
      try {
        setLoading(true);
        setError(null);
        const allRepos = await GitRepositoryService.getRepositories();
        
        // Filter by permission if specified
        const filteredRepos = permission 
          ? allRepos.filter(repo => {
              const userPermission = repo.permissions[permission as keyof typeof repo.permissions];
              return userPermission && userPermission !== 'none';
            })
          : allRepos;
        
        setRepositories(filteredRepos);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadRepositories();
  }, [permission]);

  /**
   * Get repository by URL
   */
  const getRepositoryByUrl = (url: string): GitRepository | undefined => {
    return repositories.find(repo => repo.url === url);
  };

  /**
   * Refresh repository list
   */
  const refresh = async () => {
    try {
      setLoading(true);
      const allRepos = await GitRepositoryService.getRepositories();
      const filteredRepos = permission 
        ? allRepos.filter(repo => repo.permissions[permission as keyof typeof repo.permissions] !== 'none')
        : allRepos;
      setRepositories(filteredRepos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    repositories,
    loading,
    error,
    getRepositoryByUrl,
    refresh
  };
};