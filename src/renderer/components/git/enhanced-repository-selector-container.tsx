import React from 'react';
import { EnhancedRepositorySelector, EnhancedRepositorySelectorProps } from './enhanced-repository-selector';
import { useGitRepository } from '../../contexts/git-repository-context';

type ContainerProps = Omit<EnhancedRepositorySelectorProps, 'repositories' | 'getRepositoriesByPermission' | 'testConnection'>;

export const EnhancedRepositorySelectorContainer: React.FC<ContainerProps> = (props) => {
  const { repositories, getRepositoriesByPermission, testConnection } = useGitRepository();

  return (
    <EnhancedRepositorySelector
      {...props}
      repositories={repositories}
      getRepositoriesByPermission={getRepositoriesByPermission}
      testConnection={testConnection}
    />
  );
};