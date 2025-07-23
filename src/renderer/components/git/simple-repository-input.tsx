import React, { useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { AlertCircle, CheckCircle, GitBranch, Loader2, Plus } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import type { SettingsData } from '@/shared/types/settings-data';

export interface SimpleRepositoryInputProps {
    value?: string;
    onChange?: (repositoryUrl: string) => void;
    onCreateEnvironmentBranches?: (repositoryUrl: string) => Promise<void>;
    settings?: SettingsData; 
    className?: string;
}

/**
 * Enhanced repository input component for component creation
 * - Repository URL input with validation
 * - Repository creation if it doesn't exist
 * - Auto-create environment branches
 * - GitOps structure initialization
 */
export const SimpleRepositoryInput: React.FC<SimpleRepositoryInputProps> = ({
    value,
    onChange,
    onCreateEnvironmentBranches,
    settings,
    className
}) => {
    const [isValidating, setIsValidating] = useState(false);
    const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
    const [isCreatingRepo, setIsCreatingRepo] = useState(false);
    const [isCreatingBranches, setIsCreatingBranches] = useState(false);
    const [createdBranches, setCreatedBranches] = useState<string[]>([]);
    const [validationError, setValidationError] = useState<string>('');

    /**
     * Validate repository URL format and accessibility
     */
    const validateRepository = async (url: string) => {
        if (!url) {
            setValidationStatus('idle');
            setValidationError('');
            return;
        }

        // Basic URL format validation
        try {
            new URL(url);
        } catch {
            setValidationStatus('invalid');
            setValidationError('Invalid URL format');
            return;
        }

        setIsValidating(true);
        setValidationStatus('idle');
        setValidationError('');

        try {
            // Use the electron API for validation
            const result = await window.electronAPI?.git?.validateRepository(url);
            if (result?.isValid) {
                setValidationStatus('valid');
            } else {
                setValidationStatus('invalid');
                setValidationError(result?.error || 'Repository not accessible');
            }
        } catch (error: any) {
            setValidationStatus('invalid');
            setValidationError(error.message || 'Validation failed');
        } finally {
            setIsValidating(false);
        }
    };

    /**
     * Handle repository URL change with debounced validation
     */
    const handleUrlChange = (newUrl: string) => {
        onChange?.(newUrl);
        setCreatedBranches([]); // Reset branch status when URL changes

        // Debounced validation
        const timeoutId = setTimeout(() => {
            validateRepository(newUrl);
        }, 500);

        return () => clearTimeout(timeoutId);
    };

    /**
     * Create repository if it doesn't exist
     */
    const handleCreateRepository = async () => {
        if (!value) return;

        setIsCreatingRepo(true);

        try {
            // Extract repository name from URL
            const url = new URL(value);
            const pathParts = url.pathname.split('/').filter(Boolean);
            const repoName = pathParts[pathParts.length - 1]?.replace('.git', '') || 'new-repo';

            // Create repository configuration
            const config = {
                name: repoName,
                description: `Repository for component deployment`,
                isPrivate: false,
                autoInit: true,
                provider: 'gitea', // Default to Gitea for your setup
                baseUrl: `${url.protocol}//${url.host}`
            };

            // Create the repository
            await window.electronAPI?.git?.createRepository(config);

            // Re-validate after creation
            await validateRepository(value);

        } catch (error: any) {
            console.error('Failed to create repository:', error);
            setValidationError(`Failed to create repository: ${error.message}`);
        } finally {
            setIsCreatingRepo(false);
        }
    };

    /**
     * Create repository and environment branches workflow
     */
    const handleCreateBranches = async () => {
        if (!value) return;

        setIsCreatingBranches(true);
        setCreatedBranches([]);

        try {
            const environments = ['dev', 'sit', 'uat', 'prod'];

            // Step 1: Check if repository exists, if not create it
            if (validationStatus !== 'valid') {
                console.log('Repository does not exist, creating it first...');
                await handleCreateRepository();

                // Wait a moment for repository creation to complete
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Re-validate the repository
                await validateRepository(value);
            }

            // Step 2: Create environment branches
            const result = await window.electronAPI?.git?.createEnvironmentBranches(value, environments);

            if (result?.success) {
                setCreatedBranches(result.createdBranches || environments);

                // Call the optional callback
                await onCreateEnvironmentBranches?.(value);
            } else {
                console.error('Failed to create some branches:', result?.errors);
                // Still show partial success
                setCreatedBranches(result?.createdBranches || []);
            }
        } catch (error: any) {
            console.error('Failed to create environment branches:', error);
            setValidationError(`Failed to create branches: ${error.message}`);
        } finally {
            setIsCreatingBranches(false);
        }
    };

    /**
     * Get validation status icon
     */
    const getStatusIcon = () => {
        if (isValidating) {
            return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
        }

        switch (validationStatus) {
            case 'valid':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'invalid':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return null;
        }
    };

    /**
     * Generate dynamic placeholder based on settings
     */
    const getPlaceholder = () => {
        const baseUrl = settings?.gitConfig?.baseUrl || 'http://localhost:9080';
        return `${baseUrl}/your-org/your-repo.git`;
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Repository URL Input */}
            <div className="space-y-2">
                <Label htmlFor="repositoryUrl">Repository URL *</Label>
                <div className="relative">
                    <Input
                        id="repositoryUrl"
                        type="url"
                        value={value || getPlaceholder()}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder={getPlaceholder()}
                        className="pr-10"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {getStatusIcon()}
                    </div>
                </div>

                {/* Validation Messages */}
                {validationStatus === 'invalid' && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {validationError}
                        </AlertDescription>
                    </Alert>
                )}
                {validationStatus === 'valid' && (
                    <p className="text-sm text-green-600">✓ Repository accessible</p>
                )}
            </div>

            {/* Repository Creation */}
            {validationStatus === 'invalid' && value && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h4 className="font-medium text-sm">Repository Not Found</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                Would you like to create this repository?
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={handleCreateRepository}
                            disabled={isCreatingRepo}
                        >
                            {isCreatingRepo ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Repository
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* Environment Branches Creation */}
            {validationStatus === 'valid' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h4 className="font-medium text-sm">Environment Setup</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                Create branches and GitOps structure for all environments
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={handleCreateBranches}
                            disabled={isCreatingBranches || createdBranches.length > 0}
                        >
                            {isCreatingBranches ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <GitBranch className="h-4 w-4 mr-2" />
                                    Setup Environments
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Created Branches Status */}
                    {createdBranches.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-green-700 dark:text-green-300">
                                ✓ Environment branches created:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {createdBranches.map((branch) => (
                                    <Badge key={branch} variant="outline" className="text-xs">
                                        {branch}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};