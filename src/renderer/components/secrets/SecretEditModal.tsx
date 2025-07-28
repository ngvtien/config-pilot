import React, { useRef } from "react"
import { Upload, Eye, EyeOff, X, Shield, File, Copy, Download } from "lucide-react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Textarea } from "@/renderer/components/ui/textarea"
import { Label } from "@/renderer/components/ui/label"
import { Badge } from "@/renderer/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/renderer/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useCertificateAnalysis } from "../hooks/useCertificateAnalysis"
import type { FileType } from "../types/secrets"

interface SecretEditModalProps {
  isOpen: boolean
  secretName: string
  vaultPath: string
  vaultKey: string
  secretValue: string
  showSecretValue: boolean
  customer: string
  env: string
  instance: number
  product: string
  onClose: () => void
  onSave: () => void
  onSecretNameChange: (value: string) => void
  onVaultPathChange: (value: string) => void
  onVaultKeyChange: (value: string) => void
  onSecretValueChange: (value: string) => void
  onToggleVisibility: () => void
}

/**
 * Modal component for editing secret details and values
 */
export const SecretEditModal: React.FC<SecretEditModalProps> = ({
  isOpen,
  secretName,
  vaultPath,
  vaultKey,
  secretValue,
  showSecretValue,
  customer,
  env,
  instance,
  product,
  onClose,
  onSave,
  onSecretNameChange,
  onVaultPathChange,
  onVaultKeyChange,
  onSecretValueChange,
  onToggleVisibility
}) => {
  const certificateInputRef = useRef<HTMLInputElement>(null)
  const secretValueRef = useRef<HTMLTextAreaElement>(null)
  
  const {
    isDragOver,
    fileType,
    fileName,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleCertificateUpload,
    resetCertificateState
  } = useCertificateAnalysis()

  /**
   * Handle secret name change with uppercase conversion
   */
  const handleSecretNameChange = (value: string) => {
    onSecretNameChange(value.toUpperCase())
  }

  /**
   * Handle vault key change with lowercase conversion
   */
  const handleVaultKeyChange = (value: string) => {
    onVaultKeyChange(value.toLowerCase())
  }

  /**
   * Handle clear button click
   */
  const handleClear = () => {
    onSecretValueChange('')
    resetCertificateState()
  }

  /**
   * Handle certificate file upload
   */
  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleCertificateUpload(e, onSecretValueChange)
  }

  /**
   * Handle file drop
   */
  const handleFileDrop = (e: React.DragEvent) => {
    handleDrop(e, onSecretValueChange)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Secret</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secretName">Secret Key Name</Label>
            <Input
              id="secretName"
              type="text"
              value={secretName}
              onChange={(e) => handleSecretNameChange(e.target.value)}
              placeholder="DB-PASSWORD"
              className="uppercase"
            />
            <p className="text-xs text-gray-500 italic">Secret names are automatically converted to uppercase</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vaultPath">Vault Path</Label>
            <Input
              id="vaultPath"
              type="text"
              value={vaultPath}
              onChange={(e) => onVaultPathChange(e.target.value)}
              placeholder={`kv/${customer}/${env}/${instance}/${product}`.toLowerCase()}
              className="lowercase"
            />
            <p className="text-xs text-gray-500 italic">
              Default: {`kv/${customer}/${env}/${instance}/${product}`.toLowerCase()}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vaultKey">Vault Key</Label>
            <Input
              id="vaultKey"
              type="text"
              value={vaultKey}
              onChange={(e) => handleVaultKeyChange(e.target.value)}
              placeholder="db_password"
              className="lowercase"
            />
            <p className="text-xs text-gray-500 italic">Keys are automatically converted to lowercase</p>
          </div>

          {/* Secret Value section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="secretValue" className="flex items-center gap-2">
                Secret Value
                {fileType === 'certificate' && (
                  <Badge variant="secondary" className="text-xs">
                    <Shield className="w-3 h-3 mr-1" />
                    Certificate
                  </Badge>
                )}
                {fileName && (
                  <Badge variant="outline" className="text-xs">
                    <File className="w-3 h-3 mr-1" />
                    {fileName}
                  </Badge>
                )}
              </Label>
              <div className="flex items-center gap-2">
                {/* Certificate Upload Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => certificateInputRef.current?.click()}
                  className="text-xs hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Upload Cert
                </Button>

                {/* Show/Hide Toggle */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onToggleVisibility}
                  className="text-xs"
                >
                  {showSecretValue ? (
                    <>
                      <EyeOff className="w-3 h-3 mr-1" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 mr-1" />
                      Show
                    </>
                  )}
                </Button>

                {/* Clear Button */}
                {secretValue && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="text-xs hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Enhanced Textarea with Drag & Drop */}
            <div
              className={cn(
                "relative border-2 border-dashed rounded-lg transition-all duration-200",
                isDragOver
                  ? "border-blue-400 bg-blue-50/50 shadow-lg scale-[1.02]"
                  : "border-gray-200 hover:border-gray-300",
                fileType === 'certificate' && "border-green-200 bg-green-50/30"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
            >
              <Textarea
                ref={secretValueRef}
                id="secretValue"
                value={secretValue}
                onChange={(e) => onSecretValueChange(e.target.value)}
                placeholder={isDragOver
                  ? "Drop your certificate file here..."
                  : "Enter secret value here or drag & drop a certificate file (.crt, .pem, .pfx, etc.)"
                }
                rows={secretValue.length > 500 ? 8 : 5}
                className={cn(
                  "min-h-[120px] resize-none transition-all duration-200",
                  showSecretValue ? "" : "font-mono",
                  isDragOver && "pointer-events-none",
                  fileType === 'certificate' && "font-mono text-sm"
                )}
                style={showSecretValue ? {} : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)}
              />

              {/* Drag Overlay */}
              {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 rounded-lg pointer-events-none">
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-bounce" />
                    <p className="text-sm font-medium text-blue-700">Drop certificate file here</p>
                    <p className="text-xs text-blue-600">Supports .crt, .pem, .pfx, .p12, .cer, .der, .key</p>
                  </div>
                </div>
              )}
            </div>

            {/* File Info & Actions */}
            {secretValue && (
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                <div className="flex items-center gap-4">
                  <span>Size: {(secretValue.length / 1024).toFixed(1)} KB</span>
                  <span>Lines: {secretValue.split('\n').length}</span>
                  {fileType === 'certificate' && (
                    <span className="text-green-600 font-medium">✓ Certificate format detected</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(secretValue)}
                    className="h-6 px-2 text-xs"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([secretValue], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = fileName || `secret-${secretName.toLowerCase()}.txt`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            )}

            {/* Hidden file input for certificate upload */}
            <input
              ref={certificateInputRef}
              type="file"
              accept=".crt,.pem,.pfx,.p12,.cer,.der,.key,.pub,.cert"
              onChange={handleCertUpload}
              className="hidden"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}