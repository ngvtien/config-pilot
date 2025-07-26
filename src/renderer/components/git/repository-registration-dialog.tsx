import React, { useState, useEffect } from 'react'
import { useGitRepository } from '../../contexts/git-repository-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { GitRepository } from '../../../shared/types/git-repository'
import { GitRepositoryService } from '../../services/git-repository.service'

interface RepositoryRegistrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (repository: GitRepository) => void
}

export function RepositoryRegistrationDialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: RepositoryRegistrationDialogProps) {
  const { addRepository, servers, refreshServers } = useGitRepository();
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    branch: 'main',
    description: '',
    serverId: '', // Add server selection
    permissions: {
      developer: 'read-only' as const,
      devops: 'full' as const,
      operations: 'read-only' as const
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      refreshServers();
    }
  }, [open, refreshServers]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.url) {
      setError('Name and URL are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const repoData = {
        ...formData,
        serverId: formData.serverId || undefined
      };
      
      const newRepo = await addRepository(repoData, formData.serverId);
      
      // Reset form
      setFormData({
        name: '',
        url: '',
        branch: 'main',
        description: '',
        serverId: '',
        permissions: {
          developer: 'read-only' as const,
          devops: 'full' as const,
          operations: 'read-only' as const
        }
      });
      
      onSuccess?.(newRepo);
      onOpenChange(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add repository');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="registration-dialog">
        <DialogHeader>
          <DialogTitle>Register New Repository</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          {/* Server Selection */}
          <div className="space-y-2">
            <Label htmlFor="server">Git Server (Optional)</Label>
            <Select value={formData.serverId} onValueChange={(value) => setFormData({ ...formData, serverId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a Git server or leave empty for direct access" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Direct Access (No Server)</SelectItem>
                {servers.map((server) => (
                  <SelectItem key={server.id} value={server.id}>
                    {server.name} ({server.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Repository Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., product-configs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Default Branch</Label>
              <Input
                id="branch"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                placeholder="main"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="url">Repository URL *</Label>
            <Input
              id="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://github.com/org/repo.git"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the repository"
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Registering...' : 'Register Repository'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}