import React, { useState } from 'react';
import { GitRepository, PermissionFilter } from '../../../shared/types/git-repository';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Search, Plus, GitBranch, Globe, Lock, TestTube } from 'lucide-react';
import { GitOpsStructureValidator } from './gitops-structure-validator';
import { BranchManagementDialog } from './branch-management-dialog';
import { RepositoryRegistrationDialog } from './repository-registration-dialog';

export interface EnhancedRepositorySelectorProps {
  // Repository data
  repositories: GitRepository[];
  
  // Repository functions
  getRepositoriesByPermission: (role: string, level: string) => GitRepository[];
  testConnection: (url: string, credentials?: any) => Promise<boolean>;
  
  // Component props
  value?: string;
  onChange?: (repositoryUrl: string) => void;
  onCreateBranch?: (repositoryUrl: string, branchName: string) => void;
  filterByPermission?: PermissionFilter;
  showGitOpsValidation?: boolean;
  className?: string;
}

export const EnhancedRepositorySelector: React.FC<EnhancedRepositorySelectorProps> = ({
  repositories,
  getRepositoriesByPermission,
  testConnection,
  value,
  onChange,
  onCreateBranch,
  filterByPermission,
  showGitOpsValidation = true,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showBranchCreation, setShowBranchCreation] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // Filter repositories based on permission requirements and search term
  const filteredRepos = React.useMemo(() => {
    let repos = filterByPermission
      ? getRepositoriesByPermission(filterByPermission.role, filterByPermission.level)
      : repositories;

    if (searchTerm) {
      repos = repos.filter(repo => 
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.url.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return repos;
  }, [repositories, filterByPermission, searchTerm, getRepositoriesByPermission]);

  React.useEffect(() => {
    if (value) {
      const repo = repositories.find(r => r.url === value);
      setSelectedRepo(repo || null);
    } else {
      setSelectedRepo(null);
    }
  }, [value, repositories]);

  /**
   * Get authentication status icon with color coding
   */
  const getAuthStatusIcon = (status?: string) => {
    switch (status) {
      case "checking":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Lock className="h-4 w-4 text-gray-400" />;
    }
  };

  /**
   * Get authentication status text
   */
  const getAuthStatusText = (status?: string) => {
    switch (status) {
      case "checking":
        return "Checking...";
      case "success":
        return "Authenticated";
      case "failed":
        return "Auth Required";
      default:
        return "Not Configured";
    }
  };

  /**
   * Handle repository selection
   */
  const handleRepositorySelect = (repo: GitRepository) => {
    setSelectedRepo(repo);
    onChange(repo.url);
  };

  /**
   * Handle connection testing
   */
  const handleTestConnection = async (repo: GitRepository, event: React.MouseEvent) => {
    event.stopPropagation();
    setTestingConnection(repo.id);
    
    try {
      const isConnected = await testConnection(repo.url);
      // Update repository auth status based on test result
      console.log(`Connection test for ${repo.name}: ${isConnected ? 'Success' : 'Failed'}`);
    } catch (error) {
      console.error('Connection test failed:', error);
    } finally {
      setTestingConnection(null);
    }
  };

  /**
   * Handle branch creation
   */
  const handleCreateBranch = (repo: GitRepository, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedRepo(repo);
    setShowBranchCreation(true);
  };

  /**
   * Handle repository registration success
   */
  const handleRegistrationSuccess = (repo: GitRepository) => {
    onChange(repo.url);
    setShowRegistration(false);
  };

  /**
   * Handle branch creation success
   */
  const handleBranchCreationSuccess = (repoUrl: string, branchName: string) => {
    if (onCreateBranch) {
      onCreateBranch(repoUrl, branchName);
    }
    setShowBranchCreation(false);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Add Repository Header */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowRegistration(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add New
        </Button>
      </div>

      {/* Repository Cards */}
      <div className="grid gap-3 max-h-96 overflow-y-auto">
        {filteredRepos.map(repo => (
          <Card 
            key={repo.id} 
            className={`cursor-pointer transition-all hover:shadow-md border-2 ${
              value === repo.url ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleRepositorySelect(repo)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Repository Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-sm truncate">{repo.name}</h4>
                    <div className="flex items-center gap-1">
                      {getAuthStatusIcon(repo.authStatus)}
                      <span className="text-xs text-gray-600">
                        {getAuthStatusText(repo.authStatus)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Repository Details */}
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {repo.description || 'No description available'}
                  </p>
                  
                  {/* Repository Metadata */}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span className="truncate max-w-32">
                        {new URL(repo.url).hostname}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {repo.branch}
                      </Badge>
                    </div>
                    {repo.metadata?.lastSync && (
                      <span className="text-xs">
                        Last sync: {new Date(repo.metadata.lastSync).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col gap-1 ml-4">
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={testingConnection === repo.id}
                    onClick={(e) => handleTestConnection(repo, e)}
                    className="text-xs px-2 py-1 h-7"
                  >
                    {testingConnection === repo.id ? (
                      <AlertTriangle className="h-3 w-3 animate-spin" />
                    ) : (
                      <TestTube className="h-3 w-3" />
                    )}
                    Test
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={(e) => handleCreateBranch(repo, e)}
                    className="text-xs px-2 py-1 h-7"
                  >
                    <GitBranch className="h-3 w-3" />
                    Branch
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredRepos.length === 0 && (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="p-8 text-center">
              <div className="text-gray-500">
                <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchTerm ? 'No repositories match your search' : 'No repositories configured'}
                </p>
                <Button
                  variant="link"
                  onClick={() => setShowRegistration(true)}
                  className="mt-2 text-xs"
                >
                  Register your first repository
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* GitOps Structure Validation */}
      {showGitOpsValidation && selectedRepo && (
        <GitOpsStructureValidator 
          repository={selectedRepo}
          onValidationComplete={(isValid) => {
            console.log(`GitOps validation for ${selectedRepo.name}: ${isValid ? 'PASSED' : 'FAILED'}`);
          }}
        />
      )}

      {/* Dialogs */}
      <RepositoryRegistrationDialog
        open={showRegistration}
        onOpenChange={setShowRegistration}
        onSuccess={handleRegistrationSuccess}
      />
      
      <BranchManagementDialog
        open={showBranchCreation}
        onOpenChange={setShowBranchCreation}
        repository={selectedRepo}
        onSuccess={handleBranchCreationSuccess}
      />
    </div>
  );
};