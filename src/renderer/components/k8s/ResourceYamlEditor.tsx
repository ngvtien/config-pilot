import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/renderer/components/ui/dialog';
import { Button } from '@/renderer/components/ui/button';
import { Badge } from '@/renderer/components/ui/badge';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';
import { useEditorTheme } from '@/renderer/hooks/useEditorTheme';
import { Save, X, Eye, Code } from 'lucide-react';
import { typography } from '@/renderer/lib/typography';

interface ResourceYamlEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (yamlContent: string) => void;
  initialContent: string;
  resourceKind: string;
  resourceName: string;
}

/**
 * Lightweight YAML editor for resource editing
 */
export function ResourceYamlEditor({
  isOpen,
  onClose,
  onSave,
  initialContent,
  resourceKind,
  resourceName
}: ResourceYamlEditorProps) {
  const [yamlContent, setYamlContent] = useState(initialContent);
  const [hasChanges, setHasChanges] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const { codeMirrorTheme } = useEditorTheme();

  useEffect(() => {
    setYamlContent(initialContent);
    setHasChanges(false);
  }, [initialContent]);

  const handleContentChange = (value: string) => {
    setYamlContent(value);
    setHasChanges(value !== initialContent);
  };

  const handleSave = () => {
    onSave(yamlContent);
    setHasChanges(false);
  };

  const extensions = [
    yaml(),
    EditorView.theme({
      '&': { height: '400px' },
      '.cm-scroller': { fontFamily: 'JetBrains Mono, Consolas, monospace' }
    })
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className={typography.tile.title}>
                Edit {resourceKind}
              </DialogTitle>
              <p className={typography.card.subtitle}>{resourceName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={hasChanges ? 'destructive' : 'secondary'}>
                {hasChanges ? 'Modified' : 'Saved'}
              </Badge>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'edit' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('edit')}
                  className="rounded-r-none"
                >
                  <Code className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant={viewMode === 'preview' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('preview')}
                  className="rounded-l-none"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {viewMode === 'edit' ? (
            <CodeMirror
              value={yamlContent}
              onChange={handleContentChange}
              extensions={extensions}
              theme={codeMirrorTheme}
              className="border rounded-md"
            />
          ) : (
            <pre className="text-xs p-4 overflow-auto h-full bg-muted/50 rounded border">
              <code>{yamlContent}</code>
            </pre>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}