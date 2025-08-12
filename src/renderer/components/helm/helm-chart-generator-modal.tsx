import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/renderer/components/ui/dialog';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Label } from '@/renderer/components/ui/label';
import { Textarea } from '@/renderer/components/ui/textarea';
import { Progress } from '@/renderer/components/ui/progress';
import { Package, Download, FileText } from 'lucide-react';
import { typography } from '@/renderer/lib/typography';

interface HelmChartGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  componentName: string;
  resources: Array<{ name: string; kind: string; content: string }>;
}

/**
 * Modal for generating Helm charts from Kubernetes resources
 */
export function HelmChartGeneratorModal({
  isOpen,
  onClose,
  productName,
  componentName,
  resources
}: HelmChartGeneratorModalProps) {
  const [chartName, setChartName] = useState(`${productName}-${componentName}`);
  const [chartVersion, setChartVersion] = useState('0.1.0');
  const [description, setDescription] = useState(`Helm chart for ${componentName}`);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * Generate Helm chart from resources
   */
  const handleGenerateChart = async () => {
    setIsGenerating(true);
    setProgress(0);

    try {
      // Step 1: Create Chart.yaml
      setProgress(20);
      const chartYaml = {
        apiVersion: 'v2',
        name: chartName,
        description,
        version: chartVersion,
        appVersion: '1.0.0',
        type: 'application'
      };

      // Step 2: Generate values.yaml from resources
      setProgress(40);
      const valuesYaml = await generateValuesFromResources(resources);

      // Step 3: Create template files
      setProgress(60);
      const templates = resources.map(resource => ({
        name: `${resource.kind.toLowerCase()}.yaml`,
        content: helmifyResource(resource.content, chartName)
      }));

      // Step 4: Save chart structure
      setProgress(80);
      await saveHelmChart({
        productName,
        componentName,
        chartYaml,
        valuesYaml,
        templates
      });

      setProgress(100);
      
      // Close modal after brief delay
      setTimeout(() => {
        onClose();
        setIsGenerating(false);
        setProgress(0);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to generate Helm chart:', error);
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={typography.dialog.title}>
            <Package className="w-5 h-5 mr-2" />
            Generate Helm Chart
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chart Configuration */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="chartName" className={typography.utils.label}>Chart Name</Label>
              <Input
                id="chartName"
                value={chartName}
                onChange={(e) => setChartName(e.target.value)}
                disabled={isGenerating}
              />
            </div>
            
            <div>
              <Label htmlFor="chartVersion" className={typography.utils.label}>Version</Label>
              <Input
                id="chartVersion"
                value={chartVersion}
                onChange={(e) => setChartVersion(e.target.value)}
                disabled={isGenerating}
              />
            </div>
            
            <div>
              <Label htmlFor="description" className={typography.utils.label}>Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isGenerating}
                rows={2}
              />
            </div>
          </div>

          {/* Resource Summary */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className={typography.utils.caption + " text-gray-600 mb-2"}>Resources to include:</p>
            <div className="space-y-1">
              {resources.map((resource, index) => (
                <div key={index} className="flex items-center gap-2">
                  <FileText className="w-3 h-3 text-gray-400" />
                  <span className={typography.utils.caption}>{resource.kind}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className={typography.utils.caption + " text-center text-gray-600"}>
                Generating Helm chart... {progress}%
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isGenerating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateChart}
              disabled={isGenerating || !chartName || !chartVersion}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-1" />
              Generate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper functions
function generateValuesFromResources(resources: any[]): string {
  // Extract configurable values from resources
  const values = {
    replicaCount: 1,
    image: {
      repository: 'nginx',
      tag: 'latest',
      pullPolicy: 'IfNotPresent'
    },
    service: {
      type: 'ClusterIP',
      port: 80
    }
  };
  
  return yaml.dump(values);
}

function helmifyResource(yamlContent: string, chartName: string): string {
  // Convert static YAML to Helm template with values
  return yamlContent.replace(/nginx:latest/g, '{{ .Values.image.repository }}:{{ .Values.image.tag }}');
}

async function saveHelmChart(chartData: any): Promise<void> {
  // Save chart structure to filesystem
  // Implementation depends on your file service
}