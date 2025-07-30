import React, { useRef, useEffect, useState } from "react"
import { Upload, Eye, EyeOff, X, Shield, File, Copy, Download, Calendar, User, Hash, AlertTriangle, CheckCircle, Link } from "lucide-react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Textarea } from "@/renderer/components/ui/textarea"
import { Label } from "@/renderer/components/ui/label"
import { Badge } from "@/renderer/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/renderer/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useCertificateAnalysis } from "../hooks/useCertificateAnalysis"
import { DialogDescription } from "@radix-ui/react-dialog"
import type { CertificateAnalysisResult, CertificateMetadata, SecretItem } from "../types/secrets"
import { CertificateLinkingModal } from "./CertificateLinkingModal"
import { detectContentType } from "@/renderer/components/utils/secrets-utils"

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
  existingSecrets?: SecretItem[]
  certificateMetadata?: CertificateMetadata | null,
  analysisResult?: CertificateAnalysisResult | null,
  onClose: () => void
  onSave: () => void
  onSecretNameChange: (value: string) => void
  onVaultPathChange: (value: string) => void
  onVaultKeyChange: (value: string) => void
  onSecretValueChange: (value: string) => void
  onToggleVisibility: () => void
  onCreateLinkedSecrets?: (linkedSecrets: any[]) => void
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
  existingSecrets = [],
  certificateMetadata: externalCertificateMetadata,
  analysisResult: externalAnalysisResult,
  onClose,
  onSave,
  onSecretNameChange,
  onVaultPathChange,
  onVaultKeyChange,
  onSecretValueChange,
  onToggleVisibility,
  onCreateLinkedSecrets
}) => {
  const certificateInputRef = useRef<HTMLInputElement>(null)
  const secretValueRef = useRef<HTMLTextAreaElement>(null)
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false)

  const {
    isDragOver,
    fileType,
    fileName,
    certificateMetadata: internalCertificateMetadata,
    analysisResult: internalAnalysisResult,
    isAnalyzing,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleCertificateUpload,
    analyzeCertificateContent,
    resetCertificateState
  } = useCertificateAnalysis()

    // 🆕 ADD: Use external metadata if provided, otherwise use internal
  const certificateMetadata = externalCertificateMetadata || internalCertificateMetadata
  const analysisResult = externalAnalysisResult || internalAnalysisResult

  /**
   * Analyze certificate content when secret value changes and contains certificate data
   */
  useEffect(() => {
    // Only analyze if content actually looks like a certificate
    if (secretValue && detectContentType(secretValue) === 'certificate') {
      analyzeCertificateContent(secretValue, fileName || undefined)
    } else {
      // Reset certificate state for non-certificate content
      resetCertificateState()
    }
  }, [secretValue, fileName, analyzeCertificateContent, resetCertificateState])
  
  /**
   * Handle clear button click
   */
  const handleClear = () => {
    onSecretValueChange('')
    resetCertificateState()
  }

  /**
   * Handle file drop
   */
  const handleFileDrop = (e: React.DragEvent) => {
    handleDrop(e, onSecretValueChange)
  }

  /**
   * Format date for display
   */
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'Invalid Date'
    }
  }

  /**
   * Check if certificate is expiring soon (within 30 days)
   */
  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false
    const expiryDate = new Date(expiresAt)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    return expiryDate <= thirtyDaysFromNow
  }

  /**
   * Handle opening certificate linking modal
   */
  const handleOpenLinkingModal = () => {
    if (certificateMetadata) {
      setIsLinkingModalOpen(true)
    }
  }

  /**
   * Handle linking secrets
   */
  const handleLinkSecrets = (linkedSecrets: any[]) => {
    if (onCreateLinkedSecrets) {
      onCreateLinkedSecrets(linkedSecrets)
    }
    setIsLinkingModalOpen(false)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Secret</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Configure secret details and upload certificate files with automatic metadata detection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secretName">Secret Key Name</Label>
            <Input
              id="secretName"
              type="text"
              value={secretName}
              onChange={(e) => onSecretNameChange(e.target.value.toUpperCase())}
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
              onChange={(e) => onVaultKeyChange(e.target.value.toLowerCase())}
              placeholder="db_password"
              className="lowercase"
            />
            <p className="text-xs text-gray-500 italic">Keys are automatically converted to lowercase</p>
          </div>


          {/* Certificate Metadata Panel - Only show when certificate is detected */}
          {certificateMetadata && detectContentType(secretValue) === 'certificate' && (
            <div className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-blue-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  <h3 className="font-medium text-sm">Certificate Metadata</h3>
                  {isAnalyzing && (
                    <Badge variant="secondary" className="text-xs animate-pulse">
                      Analyzing...
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {certificateMetadata.expiresAt && (
                    <Badge
                      variant={isExpiringSoon(certificateMetadata.expiresAt) ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {isExpiringSoon(certificateMetadata.expiresAt) ? (
                        <AlertTriangle className="w-3 h-3 mr-1" />
                      ) : (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      )}
                      {isExpiringSoon(certificateMetadata.expiresAt) ? 'Expiring Soon' : 'Valid'}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Compact metadata grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {certificateMetadata.type}
                    </Badge>
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {certificateMetadata.format}
                    </Badge>
                  </div>

                  {certificateMetadata.subject && (
                    <div className="flex items-start gap-1">
                      <User className="w-3 h-3 mt-0.5 text-gray-500 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-700">Subject:</div>
                        <div className="text-gray-600 break-all">{certificateMetadata.subject}</div>
                      </div>
                    </div>
                  )}

                  {certificateMetadata.issuer && (
                    <div className="flex items-start gap-1">
                      <Shield className="w-3 h-3 mt-0.5 text-gray-500 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-700">Issuer:</div>
                        <div className="text-gray-600 break-all">{certificateMetadata.issuer}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {certificateMetadata.expiresAt && (
                    <div className="flex items-start gap-1">
                      <Calendar className="w-3 h-3 mt-0.5 text-gray-500 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-700">Expires:</div>
                        <div className={cn(
                          "text-gray-600",
                          isExpiringSoon(certificateMetadata.expiresAt) && "text-red-600 font-medium"
                        )}>
                          {formatDate(certificateMetadata.expiresAt)}
                        </div>
                      </div>
                    </div>
                  )}

                  {certificateMetadata.fingerprint && (
                    <div className="flex items-start gap-1">
                      <Hash className="w-3 h-3 mt-0.5 text-gray-500 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-700">Fingerprint:</div>
                        <div className="text-gray-600 font-mono text-xs break-all">
                          {certificateMetadata.fingerprint.substring(0, 16)}...
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs">
                    {certificateMetadata.hasPrivateKey && (
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="w-3 h-3 mr-1" />
                        Has Private Key
                      </Badge>
                    )}
                    {certificateMetadata.isCA && (
                      <Badge variant="secondary" className="text-xs">
                        CA Certificate
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick actions for certificate linking */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={handleOpenLinkingModal}
                >
                  <Link className="w-3 h-3 mr-1" />
                  Link Secrets
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => {
                    if (certificateMetadata.fingerprint) {
                      navigator.clipboard.writeText(certificateMetadata.fingerprint)
                    }
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy Fingerprint
                </Button>
              </div>
              
            </div>
          )}

          {/* Analysis Results - Show warnings/errors only for certificate content */}
          {analysisResult && detectContentType(secretValue) === 'certificate' && !analysisResult.isValid && (
            <div className="border border-red-200 rounded-lg p-3 bg-red-50">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h4 className="font-medium text-sm text-red-800">Certificate Analysis Issues</h4>
              </div>
              <ul className="text-xs text-red-700 space-y-1">
                {analysisResult.errors?.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {analysisResult && detectContentType(secretValue) === 'certificate' && analysisResult.isValid && analysisResult.warnings && analysisResult.warnings.length > 0 && (
            <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <h4 className="font-medium text-sm text-yellow-800">Certificate Warnings</h4>
              </div>
              <ul className="text-xs text-yellow-700 space-y-1">
                {analysisResult.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

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

            {/* Enhanced textarea with drag & drop */}
            <div
              className={cn(
                "relative border-2 border-dashed rounded-lg transition-all duration-200",
                isDragOver ? "border-blue-400 bg-blue-50/50" : "border-gray-200",
                fileType === 'certificate' && "border-green-200 bg-green-50/30"
              )}
              onDragEnter={handleDragEnter}
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
              onChange={(e) => handleCertificateUpload(e, onSecretValueChange)}
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

      {/* Certificate Linking Modal */}
      {certificateMetadata && (
        <CertificateLinkingModal
          isOpen={isLinkingModalOpen}
          onClose={() => setIsLinkingModalOpen(false)}
          certificateMetadata={certificateMetadata}
          certificateName={secretName}
          certificateVaultPath={vaultPath}
          existingSecrets={existingSecrets}
          customer={customer}
          env={env}
          instance={instance}
          product={product}
          onLinkSecrets={handleLinkSecrets}
        />
      )}
    </>
  )
}