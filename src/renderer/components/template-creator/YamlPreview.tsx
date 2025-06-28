import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/renderer/components/ui/dialog'
import { Button } from '@/renderer/components/ui/button'
import { ScrollArea } from '@/renderer/components/ui/scroll-area'
import { Copy, Check } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface YamlPreviewProps {
  isOpen: boolean
  onClose: () => void
  yamlContent: string
  title?: string
  resourceKind?: string
}

/**
 * Reusable YAML Preview component with syntax highlighting, line numbers, and copy functionality
 * Used across the application for displaying YAML content in a modal
 */
export function YamlPreview({ isOpen, onClose, yamlContent, title, resourceKind }: YamlPreviewProps) {
  const [copied, setCopied] = useState(false)

  /**
   * Copy YAML content to clipboard with user feedback
   */
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(yamlContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = yamlContent
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const displayTitle = title || `YAML Preview${resourceKind ? ` - ${resourceKind}` : ''}`

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{displayTitle}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              className="ml-4"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy YAML
                </>
              )}
            </Button>
          </DialogTitle>
    <DialogDescription>
      Preview of the generated YAML configuration for {resourceKind || 'the selected resource'}.
    </DialogDescription>          
        </DialogHeader>
        
        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
          <ScrollArea className="h-full">
            <SyntaxHighlighter
              language="yaml"
              style={oneDark}
              showLineNumbers={true}
              lineNumberStyle={{
                minWidth: '3em',
                paddingRight: '1em',
                color: '#6b7280',
                borderRight: '1px solid #374151',
                marginRight: '1em'
              }}
              customStyle={{
                margin: 0,
                padding: '1rem',
                background: '#1f2937',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
              wrapLongLines={true}
            >
              {yamlContent}
            </SyntaxHighlighter>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}