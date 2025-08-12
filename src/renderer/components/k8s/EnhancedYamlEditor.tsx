import { useState, useEffect, useCallback } from 'react';
import yaml from 'js-yaml';
import CodeMirror from '@uiw/react-codemirror';
import { yaml as yamlLanguage } from '@codemirror/lang-yaml';
import { linter, lintGutter } from '@codemirror/lint';
import { Button } from '@/renderer/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { Badge } from '@/renderer/components/ui/badge';
import { Alert, AlertDescription } from '@/renderer/components/ui/alert';
import { Save, Play, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { useEditorTheme } from '@/renderer/hooks/useEditorTheme';
import { ResourceFileManager } from '@/renderer/services/ResourceFileManager';
import { typography } from '@/renderer/lib/typography';

interface ValidationError {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

interface EnhancedYamlEditorProps {
  initialContent?: string;
  productName: string;
  componentName: string;
  resourceName?: string;
  onSave?: (content: string, filePath: string) => void;
  onDryRun?: (content: string) => Promise<{ success: boolean; message: string }>;
  readOnly?: boolean;
}

/**
 * Enhanced YAML editor with real-time validation, syntax highlighting, and Kubernetes-specific features
 */
export function EnhancedYamlEditor({
  initialContent = '',
  productName,
  componentName,
  resourceName,
  onSave,
  onDryRun,
  readOnly = false
}: EnhancedYamlEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const { codeMirrorTheme, yamlExtensions } = useEditorTheme();
  const fileManager = new ResourceFileManager(process.cwd());

  /**
   * Validate YAML content for syntax and Kubernetes structure
   */
  const validateYaml = useCallback((yamlContent: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    if (!yamlContent.trim()) {
      return errors;
    }
    
    try {
      const parsed = yaml.load(yamlContent) as any;
      
      if (!parsed) {
        return errors;
      }
      
      // Basic Kubernetes structure validation
      if (!parsed.apiVersion) {
        errors.push({
          line: 1,
          message: 'Missing required field: apiVersion',
          severity: 'error'
        });
      }
      
      if (!parsed.kind) {
        errors.push({
          line: 1,
          message: 'Missing required field: kind',
          severity: 'error'
        });
      }
      
      if (!parsed.metadata?.name) {
        errors.push({
          line: 1,
          message: 'Missing required field: metadata.name',
          severity: 'error'
        });
      }
      
      // Resource-specific validations
      if (parsed.kind === 'Deployment') {
        if (!parsed.spec?.selector) {
          errors.push({
            line: 1,
            message: 'Deployment missing required field: spec.selector',
            severity: 'error'
          });
        }
        
        if (!parsed.spec?.template) {
          errors.push({
            line: 1,
            message: 'Deployment missing required field: spec.template',
            severity: 'error'
          });
        }
      }
      
      if (parsed.kind === 'Service') {
        if (!parsed.spec?.selector) {
          errors.push({
            line: 1,
            message: 'Service missing required field: spec.selector',
            severity: 'warning'
          });
        }
      }
      
    } catch (error) {
      errors.push({
        line: 1,
        message: `YAML syntax error: ${error instanceof Error ? error.message : 'Invalid YAML'}`,
        severity: 'error'
      });
    }
    
    return errors;
  }, []);

  /**
   * Handle content changes with real-time validation
   */
  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    const errors = validateYaml(value);
    setValidationErrors(errors);
    setDryRunResult(null); // Clear previous dry run results
  }, [validateYaml]);

  /**
   * Save YAML content to file system
   */
  const handleSave = async () => {
    if (!content.trim()) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Parse YAML to get resource kind and name
      const parsed = yaml.load(content) as any;
      const resourceKind = parsed?.kind || 'resource';
      const resourceFileName = resourceName || parsed?.metadata?.name || resourceKind.toLowerCase();
      
      const filePath = await fileManager.saveResource(
        productName,
        componentName,
        resourceKind,
        content,
        resourceFileName
      );
      
      setLastSavedPath(filePath);
      onSave?.(content, filePath);
      
    } catch (error) {
      console.error('Failed to save resource:', error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Perform dry run validation
   */
  const handleDryRun = async () => {
    if (!content.trim() || !onDryRun) {
      return;
    }
    
    setIsDryRunning(true);
    
    try {
      const result = await onDryRun(content);
      setDryRunResult(result);
    } catch (error) {
      setDryRunResult({
        success: false,
        message: `Dry run failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsDryRunning(false);
    }
  };

  /**
   * Create CodeMirror linter extension
   */
  const yamlLinter = linter((view) => {
    const diagnostics = validationErrors.map(error => ({
      from: 0,
      to: view.state.doc.length,
      severity: error.severity,
      message: error.message
    }));
    
    return diagnostics;
  });

  // Validate initial content
  useEffect(() => {
    if (initialContent) {
      const errors = validateYaml(initialContent);
      setValidationErrors(errors);
    }
  }, [initialContent, validateYaml]);

  const hasErrors = validationErrors.some(error => error.severity === 'error');
  const hasWarnings = validationErrors.some(error => error.severity === 'warning');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <CardTitle className={typography.card.title}>
              YAML Editor
            </CardTitle>
            {hasErrors && (
              <Badge variant="destructive" className={typography.card.badge}>
                {validationErrors.filter(e => e.severity === 'error').length} errors
              </Badge>
            )}
            {hasWarnings && (
              <Badge variant="secondary" className={typography.card.badge}>
                {validationErrors.filter(e => e.severity === 'warning').length} warnings
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {onDryRun && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDryRun}
                disabled={isDryRunning || hasErrors || !content.trim()}
              >
                <Play className="h-3 w-3 mr-1" />
                {isDryRunning ? 'Running...' : 'Dry Run'}
              </Button>
            )}
            
            {!readOnly && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || hasErrors || !content.trim()}
              >
                <Save className="h-3 w-3 mr-1" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
        </div>
        
        {lastSavedPath && (
          <p className={typography.card.metadata}>
            Saved to: {lastSavedPath}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-3 p-4">
        {/* Validation Results */}
        {dryRunResult && (
          <Alert variant={dryRunResult.success ? "default" : "destructive"}>
            {dryRunResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription className={typography.utils.body}>
              {dryRunResult.message}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="space-y-1">
            {validationErrors.map((error, index) => (
              <Alert key={index} variant={error.severity === 'error' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className={typography.utils.body}>
                  {error.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
        
        {/* YAML Editor */}
        <div className="flex-1 border rounded-md overflow-hidden">
          <CodeMirror
            value={content}
            onChange={handleContentChange}
            theme={codeMirrorTheme}
            extensions={[
              yamlLanguage,
              yamlLinter,
              lintGutter(),
              ...yamlExtensions
            ]}
            editable={!readOnly}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              dropCursor: false,
              allowMultipleSelections: false,
              indentOnInput: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              highlightSelectionMatches: false
            }}
            className="h-full"
          />
        </div>
      </CardContent>
    </Card>
  );
}