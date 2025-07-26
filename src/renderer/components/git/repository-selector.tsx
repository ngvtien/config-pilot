import React, { useState } from 'react';
import { useGitRepository } from '../../contexts/git-repository-context';
import { GitRepository } from '../../../shared/types/git-repository';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Plus, CheckCircle, XCircle, Loader2, Key } from 'lucide-react';
import { RepositoryRegistrationDialog } from './repository-registration-dialog';

export interface RepositorySelectorProps {
  value?: string;
  onChange: (repositoryUrl: string) => void;
  allowNewRepository?: boolean;
  filterByPermission?: {
    role: 'developer' | 'devops' | 'operations';
    level: 'full' | 'read-only' | 'dev-only' | 'any';
  };
  placeholder?: string;
  className?: string;
}

/**
 * Reusable repository selector component with validation and registration
 */
export const RepositorySelector: React.FC<RepositorySelectorProps> = ({
  value,
  onChange,
  allowNewRepository = true,
  filterByPermission,
  placeholder = "Select repository",
  className
}) => {
  const { repositories, getRepositoriesByPermission } = useGitRepository();
  const [showRegistration, setShowRegistration] = useState(false);

  // Filter repositories based on permission requirements
  const filteredRepos = filterByPermission
    ? getRepositoriesByPermission(filterByPermission.role, filterByPermission.level)
    : repositories;

  /**
   * Get authentication status icon
   */
  const getAuthStatusIcon = (status?: string) => {
    switch (status) {
      case "checking":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Key className="h-4 w-4 text-gray-400" />;
    }
  };

  /**
   * Handle repository registration success
   */
  const handleRegistrationSuccess = (repo: GitRepository) => {
    onChange(repo.url);
    setShowRegistration(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {filteredRepos.map(repo => (
            <SelectItem key={repo.id} value={repo.url}>
              <div className="flex items-center gap-2 w-full">
                <span className="flex-1">{repo.name}</span>
                <Badge variant="outline" className="text-xs">
                  {repo.branch}
                </Badge>
                {getAuthStatusIcon(repo.authStatus)}
              </div>
            </SelectItem>
          ))}
          {filteredRepos.length === 0 && (
            <SelectItem value="" disabled>
              No repositories available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      
      {allowNewRepository && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRegistration(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Register New Repository
          </Button>
        </div>
      )}
      
      <RepositoryRegistrationDialog
        open={showRegistration}
        onOpenChange={setShowRegistration}
        onSuccess={handleRegistrationSuccess}
      />
    </div>
  );
};