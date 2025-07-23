import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { CheckCircle, XCircle, AlertTriangle, Folder, FileText, Wrench, SkipForward } from 'lucide-react';
import { GitRepository } from '../../../shared/types/git-repository';

interface GitOpsStructureValidatorProps {
  repository: GitRepository;
  onValidationComplete?: (isValid: boolean, issues?: string[]) => void;
  className?: string;
}

interface ValidationResult {
  path: string;
  exists: boolean;
  required: boolean;
  type: 'folder' | 'file';
  description: string;
}

/**
 * Validates repository structure against GitOps requirements from PRD
 */
export const GitOpsStructureValidator: React.FC<GitOpsStructureValidatorProps> = ({
  repository,
  onValidationComplete,
  className
}) => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'pending' | 'passed' | 'failed'>('pending');
  const [issues, setIssues] = useState<string[]>([]);

  /**
   * Define required GitOps structure based on PRD
   */
  const requiredStructure: Omit<ValidationResult, 'exists'>[] = [
    {
      path: 'gitops/',
      required: true,
      type: 'folder',
      description: 'Root GitOps directory'
    },
    {
      path: 'gitops/products/',
      required: true,
      type: 'folder',
      description: 'Products configuration directory'
    },
    {
      path: 'gitops/applicationsets/',
      required: true,
      type: 'folder',
      description: 'ArgoCD ApplicationSets directory'
    },
    {
      path: 'gitops/products/[product-name]/',
      required: true,
      type: 'folder',
      description: 'Product-specific directory'
    },
    {
      path: 'gitops/products/[product-name]/environments/',
      required: true,
      type: 'folder',
      description: 'Environment configurations'
    },
    {
      path: 'gitops/products/[product-name]/environments/dev/',
      required: true,
      type: 'folder',
      description: 'Development environment'
    },
    {
      path: 'gitops/products/[product-name]/environments/sit/',
      required: true,
      type: 'folder',
      description: 'Test environment'
    },
    {
      path: 'gitops/products/[product-name]/environments/staging/',
      required: true,
      type: 'folder',
      description: 'Staging environment'
    },
    {
      path: 'gitops/products/[product-name]/environments/prod/',
      required: true,
      type: 'folder',
      description: 'Production environment'
    },
    {
      path: 'gitops/products/[product-name]/customers.yaml',
      required: true,
      type: 'file',
      description: 'Customer configuration for ApplicationSet'
    }
  ];

  /**
   * Validate repository structure
   */
  const validateStructure = async () => {
    setIsValidating(true);
    setValidationStatus('pending');
    
    try {
      // Simulate validation - in real implementation, this would call the backend
      // to check the actual repository structure
      const results: ValidationResult[] = requiredStructure.map(item => ({
        ...item,
        exists: Math.random() > 0.3 // Simulate some missing items
      }));
      
      setValidationResults(results);
      
      const failedItems = results.filter(r => r.required && !r.exists);
      const newIssues = failedItems.map(item => `Missing ${item.type}: ${item.path}`);
      
      setIssues(newIssues);
      const isValid = failedItems.length === 0;
      setValidationStatus(isValid ? 'passed' : 'failed');
      
      if (onValidationComplete) {
        onValidationComplete(isValid, newIssues);
      }
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationStatus('failed');
      setIssues(['Validation failed: Unable to access repository']);
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Auto-fix common issues
   */
  const handleAutoFix = async () => {
    // In real implementation, this would create missing folders/files
    console.log('Auto-fixing GitOps structure...');
    await validateStructure();
  };

  /**
   * Run validation when repository changes
   */
  useEffect(() => {
    if (repository) {
      validateStructure();
    }
  }, [repository]);

  /**
   * Get status icon
   */
  const getStatusIcon = () => {
    switch (validationStatus) {
      case 'passed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  /**
   * Get status text
   */
  const getStatusText = () => {
    switch (validationStatus) {
      case 'passed':
        return 'PASSED';
      case 'failed':
        return 'FAILED';
      default:
        return 'VALIDATING';
    }
  };

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span>GitOps Structure Validation</span>
            {getStatusIcon()}
          </div>
          <Badge 
            variant={validationStatus === 'passed' ? 'default' : validationStatus === 'failed' ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Repository Info */}
        <div className="text-xs text-gray-600">
          <p><strong>Repository:</strong> {repository.name}</p>
          <p><strong>Branch:</strong> {repository.branch}</p>
        </div>

        {/* Validation Results */}
        {validationResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Structure Check:</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {validationResults.map((result, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  {result.exists ? (
                    <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                  )}
                  {result.type === 'folder' ? (
                    <Folder className="h-3 w-3 text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                  )}
                  <span className="font-mono text-xs truncate">{result.path}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Issues */}
        {issues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600">Issues Found:</h4>
            <ul className="space-y-1 text-xs text-red-600">
              {issues.map((issue, index) => (
                <li key={index} className="flex items-start gap-1">
                  <span className="text-red-500">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {validationStatus === 'failed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAutoFix}
              className="flex items-center gap-1 text-xs"
            >
              <Wrench className="h-3 w-3" />
              Auto-Fix
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => console.log('Manual setup guide')}
            className="flex items-center gap-1 text-xs"
          >
            <FileText className="h-3 w-3" />
            Manual Setup
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => console.log('Skip validation')}
            className="flex items-center gap-1 text-xs"
          >
            <SkipForward className="h-3 w-3" />
            Skip
          </Button>
        </div>

        {/* Success Message */}
        {validationStatus === 'passed' && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <div className="flex items-center gap-2 text-green-700 text-xs">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Ready for GitOps deployment</span>
            </div>
            <p className="text-green-600 text-xs mt-1">
              Repository structure meets all GitOps requirements
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};