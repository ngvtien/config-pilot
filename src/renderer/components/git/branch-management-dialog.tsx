import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { GitBranch, Settings, GitCommit } from 'lucide-react';
import { GitRepository } from '../../../shared/types/git-repository';

interface BranchManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repository: GitRepository | null;
  onSuccess?: (repoUrl: string, branchName: string) => void;
}

type BranchType = 'feature' | 'environment' | 'customer';

/**
 * Dialog for creating and managing Git branches with GitOps-specific options
 */
export const BranchManagementDialog: React.FC<BranchManagementDialogProps> = ({
  open,
  onOpenChange,
  repository,
  onSuccess
}) => {
  const [branchType, setBranchType] = useState<BranchType>('feature');
  const [branchName, setBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState('main');
  const [description, setDescription] = useState('');
  const [createPR, setCreatePR] = useState(false);
  const [initGitOps, setInitGitOps] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Generate branch name based on type and input
   */
  const generateBranchName = (type: BranchType, input: string) => {
    if (!input) return '';
    
    const sanitized = input.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    
    switch (type) {
      case 'feature':
        return `feature/${sanitized}`;
      case 'environment':
        return `env/${sanitized}`;
      case 'customer':
        return `customer/${sanitized}`;
      default:
        return sanitized;
    }
  };

  /**
   * Handle branch type change
   */
  const handleBranchTypeChange = (type: BranchType) => {
    setBranchType(type);
    // Auto-generate branch name if there's input
    const input = branchName.split('/').pop() || '';
    if (input) {
      setBranchName(generateBranchName(type, input));
    }
  };

  /**
   * Handle branch name input change
   */
  const handleBranchNameChange = (value: string) => {
    const generatedName = generateBranchName(branchType, value);
    setBranchName(generatedName);
  };

  /**
   * Handle branch creation
   */
  const handleCreateBranch = async () => {
    if (!repository || !branchName) return;
    
    setIsCreating(true);
    
    try {
      // Simulate branch creation - in real implementation, this would call the backend
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Creating branch:', {
        repository: repository.name,
        branchName,
        baseBranch,
        type: branchType,
        options: {
          createPR,
          initGitOps,
          setAsDefault
        }
      });
      
      if (onSuccess) {
        onSuccess(repository.url, branchName);
      }
      
      // Reset form
      setBranchName('');
      setDescription('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create branch:', error);
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Reset form when dialog closes
   */
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setBranchName('');
      setDescription('');
      setBranchType('feature');
      setBaseBranch('main');
    }
    onOpenChange(open);
  };

  if (!repository) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Create New Branch
          </DialogTitle>
          <DialogDescription>
            Create a new branch in {repository.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Repository Info */}
          <div className="bg-gray-50 rounded-md p-3 text-sm">
            <p><strong>Repository:</strong> {repository.name}</p>
            <p><strong>Current Branch:</strong> {repository.branch}</p>
          </div>

          {/* Branch Type */}
          <div className="space-y-2">
            <Label>Branch Type</Label>
            <RadioGroup
              value={branchType}
              onValueChange={(value) => handleBranchTypeChange(value as BranchType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="feature" id="feature" />
                <Label htmlFor="feature" className="text-sm">Feature</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="environment" id="environment" />
                <Label htmlFor="environment" className="text-sm">Environment</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="customer" id="customer" />
                <Label htmlFor="customer" className="text-sm">Customer</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Branch Name */}
          <div className="space-y-2">
            <Label htmlFor="branchName">Branch Name</Label>
            <Input
              id="branchName"
              placeholder={`Enter ${branchType} name...`}
              value={branchName.split('/').pop() || ''}
              onChange={(e) => handleBranchNameChange(e.target.value)}
            />
            {branchName && (
              <p className="text-xs text-gray-600">
                Full name: <code className="bg-gray-100 px-1 rounded">{branchName}</code>
              </p>
            )}
          </div>

          {/* Base Branch */}
          <div className="space-y-2">
            <Label htmlFor="baseBranch">Base Branch</Label>
            <Select value={baseBranch} onValueChange={setBaseBranch}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">main</SelectItem>
                <SelectItem value="develop">develop</SelectItem>
                <SelectItem value="staging">staging</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this branch..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Advanced Options */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-gray-500" />
              <Label className="text-sm font-medium">Advanced Options</Label>
            </div>
            
            <div className="space-y-2 pl-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createPR"
                  checked={createPR}
                  onCheckedChange={(checked) => setCreatePR(checked as boolean)}
                />
                <Label htmlFor="createPR" className="text-sm">
                  Create pull request template
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="initGitOps"
                  checked={initGitOps}
                  onCheckedChange={(checked) => setInitGitOps(checked as boolean)}
                />
                <Label htmlFor="initGitOps" className="text-sm">
                  Initialize with GitOps structure
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="setAsDefault"
                  checked={setAsDefault}
                  onCheckedChange={(checked) => setSetAsDefault(checked as boolean)}
                />
                <Label htmlFor="setAsDefault" className="text-sm">
                  Set as default branch for this product
                </Label>
              </div>
            </div>
          </div>

          {/* Preview */}
          {branchName && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Preview:</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Branch: <code>{branchName}</code></li>
                <li>• Will be created from: <code>{baseBranch}</code></li>
                <li>• GitOps structure will be {initGitOps ? 'initialized' : 'skipped'}</li>
                {createPR && <li>• Pull request template will be created</li>}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateBranch}
            disabled={!branchName || isCreating}
          >
            {isCreating ? (
              <>
                <GitCommit className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4 mr-2" />
                Create Branch
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};