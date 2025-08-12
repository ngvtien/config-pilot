import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/renderer/components/ui/dialog';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Badge } from '@/renderer/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import { Search, Settings, FileText, Trash2 } from 'lucide-react';
import yaml from 'js-yaml';
import { KUBERNETES_RESOURCE_TEMPLATES } from '@/shared/types/kubernetes';
import { generateResourceYamlPreview } from '@/renderer/utils/helm-template-generator';
import { typography } from '@/renderer/lib/typography';
import { EnhancedYamlEditor } from './EnhancedYamlEditor';
import { HelmChartGeneratorModal } from '../helm/helm-chart-generator-modal';
import { ResourceFileManager } from '@/renderer/services/ResourceFileManager';
import type { ContextData } from '@/shared/types/context-data';

// interface ResourceSelectionModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   context: ContextData;
// }

interface ResourceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: ContextData;
  onSelectResource?: (resource: any) => void;
  existingResources?: string[];
  productName?: string;
  componentName?: string;
}

interface SavedResource {
  name: string;
  kind: string;
  path: string;
}

/**
 * Enhanced resource selection modal with YAML editor, validation, persistent storage, and Helm chart generation
 */
export function ResourceSelectionModal({
  isOpen,
  onClose,
  context
}: ResourceSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<'selection' | 'configuration' | 'editor'>('selection');
  const [yamlContent, setYamlContent] = useState('');
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [savedResources, setSavedResources] = useState<SavedResource[]>([]);
  const [showHelmGenerator, setShowHelmGenerator] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [userDataPath, setUserDataPath] = useState<string>('');
  
    // Get user data path on component mount
  useEffect(() => {
    const getUserDataPath = async () => {
      try {
        const path = await window.electronAPI.getUserDataPath();
        setUserDataPath(path);
      } catch (error) {
        console.error('Failed to get user data path:', error);
        // Fallback to a default path or handle error appropriately
        setUserDataPath('');
      }
    };
    
    if (isOpen) {
      getUserDataPath();
    }
  }, [isOpen]);

  // Create file manager only when we have the path
  const fileManager = useMemo(() => {
    return userDataPath ? new ResourceFileManager(userDataPath) : null;
  }, [userDataPath]);

  /**
   * Filter and group available resources
   */
  const filteredResources = useMemo(() => {
    const existingKinds = savedResources.map(r => r.kind);
    
    const filtered = KUBERNETES_RESOURCE_TEMPLATES.filter(resource => {
      const matchesSearch = resource.kind.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           resource.description.toLowerCase().includes(searchTerm.toLowerCase());
      const notDuplicate = !existingKinds.includes(resource.kind);
      return matchesSearch && notDuplicate;
    });

    // Group by category
    const grouped = filtered.reduce((acc, resource) => {
      const category = resource.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(resource);
      return acc;
    }, {} as Record<string, any[]>);

    return Object.entries(grouped).map(([category, resources]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      resources
    }));
  }, [searchTerm, savedResources]);

  /**
   * Generate informative YAML sample with selected fields
   */
  const generateInformativeYaml = (): string => {
    if (!selectedResource) return '';
    
    const baseYaml = {
      apiVersion: selectedResource.apiVersion,
      kind: selectedResource.kind,
      metadata: {
        name: `${context.component}-${selectedResource.kind.toLowerCase()}`,
        namespace: context.product.toLowerCase(),
        labels: {
          'app.kubernetes.io/name': context.component,
          'app.kubernetes.io/instance': `${context.product}-${context.component}`,
          'app.kubernetes.io/component': selectedResource.kind.toLowerCase(),
          'app.kubernetes.io/part-of': context.product
        }
      },
      ...selectedResource.defaultSpec && { spec: selectedResource.defaultSpec }
    };

    return generateResourceYamlPreview(
      selectedResource,
      selectedFields.length > 0 ? selectedFields : (selectedResource.requiredFields || [])
    );
  };

  /**
   * Handle resource selection from the first panel
   */
  const handleResourceSelect = (resource: any) => {
    setSelectedResource(resource);
    setSelectedFields(resource.requiredFields || []);
    setActivePanel('configuration');
  };

  /**
   * Handle field selection changes in configuration panel
   */
  const handleFieldToggle = (fieldPath: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldPath)
        ? prev.filter(f => f !== fieldPath)
        : [...prev, fieldPath]
    );
  };

  /**
   * Move to YAML editor panel
   */
  const handleConfigureYaml = () => {
    const yaml = generateInformativeYaml();
    setYamlContent(yaml);
    setActivePanel('editor');
  };

  /**
   * Handle dry run for Kubernetes resources
   */
  const handleDryRun = async (yamlContent: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Parse YAML to validate structure
      const parsed = yaml.load(yamlContent) as any;
      
      if (!parsed) {
        return { success: false, message: 'Invalid YAML content' };
      }
      
      // Simulate Kubernetes dry run validation
      const requiredFields = ['apiVersion', 'kind', 'metadata'];
      const missingFields = requiredFields.filter(field => !parsed[field]);
      
      if (missingFields.length > 0) {
        return {
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`
        };
      }
      
      // Additional validation based on resource kind
      if (parsed.kind === 'Deployment' && !parsed.spec?.selector) {
        return {
          success: false,
          message: 'Deployment must have spec.selector'
        };
      }
      
      if (parsed.kind === 'Service' && !parsed.spec?.ports) {
        return {
          success: false,
          message: 'Service must have spec.ports'
        };
      }
      
      return {
        success: true,
        message: 'Resource validation passed. Ready for deployment.'
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  };

  /**
   * Handle saving resources and updating the list
   */
  const handleResourceSave = async (content: string, filePath: string) => {
    // Refresh the saved resources list
    await loadSavedResources();
  };

  /**
   * Load saved resources from file system
   */
  const loadSavedResources = async () => {
    try {
      const resources = await fileManager.listResources(context.product, context.component);
      setSavedResources(resources);
    } catch (error) {
      console.error('Failed to load saved resources:', error);
      setSavedResources([]);
    }
  };

  /**
   * Delete a saved resource
   */
  const handleDeleteResource = async (resource: SavedResource) => {
    try {
      await fileManager.deleteResource(context.product, context.component, resource.name);
      await loadSavedResources();
    } catch (error) {
      console.error('Failed to delete resource:', error);
    }
  };

  /**
   * Copy YAML to clipboard
   */
  const copyYamlToClipboard = async () => {
    await navigator.clipboard.writeText(yamlContent);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  /**
   * Reset modal state when closed
   */
  const handleClose = () => {
    setActivePanel('selection');
    setSelectedResource(null);
    setYamlContent('');
    setSelectedFields([]);
    setSearchTerm('');
    onClose();
  };

  /**
   * Load saved resources when modal opens
   */
  useEffect(() => {
    if (isOpen) {
      loadSavedResources();
    }
  }, [isOpen, context.product, context.component]);

  /**
   * Update YAML content when selected fields change
   */
  useEffect(() => {
    if (selectedResource && activePanel === 'editor') {
      const yaml = generateInformativeYaml();
      setYamlContent(yaml);
    }
  }, [selectedFields, selectedResource, activePanel]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className={typography.card.title}>
              Kubernetes Resource Designer
            </DialogTitle>
            <DialogDescription className={typography.card.subtitle}>
              Design and configure Kubernetes resources for {context.product} → {context.component}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
            {/* Panel 1: Resource Selection */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className={typography.card.title}>Available Resources</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search resources..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="space-y-4">
                    {filteredResources.map(({ category, resources }) => (
                      <div key={category}>
                        <h3 className={`${typography.card.subtitle} mb-2`}>{category}</h3>
                        <div className="space-y-2">
                          {resources.map((resource) => (
                            <Card
                              key={resource.kind}
                              className={`cursor-pointer transition-colors hover:bg-accent ${
                                selectedResource?.kind === resource.kind ? 'ring-2 ring-primary' : ''
                              }`}
                              onClick={() => handleResourceSelect(resource)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className={typography.utils.label}>{resource.kind}</h4>
                                    <p className={typography.card.metadata}>
                                      {resource.description}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className={typography.card.badge}>
                                    {resource.apiVersion}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            {/* Panel 2: Configuration */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <CardTitle className={typography.card.title}>Configuration</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {selectedResource ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className={typography.utils.label}>{selectedResource.kind}</h3>
                      <p className={typography.card.metadata}>{selectedResource.description}</p>
                    </div>
                    
                    {selectedResource.requiredFields && selectedResource.requiredFields.length > 0 && (
                      <div>
                        <h4 className={typography.utils.label}>Required Fields</h4>
                        <div className="space-y-2 mt-2">
                          {selectedResource.requiredFields.map((field: string) => (
                            <label key={field} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={selectedFields.includes(field)}
                                onChange={() => handleFieldToggle(field)}
                                className="rounded"
                              />
                              <span className={typography.utils.body}>{field}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedResource.optionalFields && selectedResource.optionalFields.length > 0 && (
                      <div>
                        <h4 className={typography.utils.label}>Optional Fields</h4>
                        <div className="space-y-2 mt-2">
                          {selectedResource.optionalFields.map((field: string) => (
                            <label key={field} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={selectedFields.includes(field)}
                                onChange={() => handleFieldToggle(field)}
                                className="rounded"
                              />
                              <span className={typography.utils.body}>{field}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <Button onClick={handleConfigureYaml} className="w-full">
                      Configure YAML
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className={typography.card.metadata}>Select a resource to configure</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Panel 3: Enhanced YAML Editor */}
            <div className="flex flex-col gap-4">
              {activePanel === 'editor' && selectedResource ? (
                <EnhancedYamlEditor
                  initialContent={yamlContent}
                  productName={context.product}
                  componentName={context.component}
                  resourceName={selectedResource.kind.toLowerCase()}
                  onSave={handleResourceSave}
                  onDryRun={handleDryRun}
                />
              ) : (
                <Card className="flex-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <CardTitle className={typography.card.title}>YAML Editor</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex items-center justify-center">
                    <p className={typography.card.metadata}>Configure a resource to edit YAML</p>
                  </CardContent>
                </Card>
              )}
              
              {/* Saved Resources List */}
              {savedResources.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className={typography.card.title}>Saved Resources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-48">
                      <div className="space-y-2">
                        {savedResources.map((resource, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <div>
                              <p className={typography.utils.body}>{resource.name}</p>
                              <p className={typography.card.metadata}>{resource.kind}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={typography.card.badge}>
                                {resource.kind}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteResource(resource)}
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={() => setShowHelmGenerator(true)}
              disabled={savedResources.length === 0}
            >
              Generate Helm Chart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Helm Chart Generator Modal */}
      <HelmChartGeneratorModal
        isOpen={showHelmGenerator}
        onClose={() => setShowHelmGenerator(false)}
        context={context}
        resources={savedResources}
      />
    </>
  );
}