import { useState, useCallback } from "react"
import { useToast } from "@/renderer/hooks/use-toast"
import type { FileType, CertificateMetadata, CertificateAnalysisResult } from "../types/secrets"
import { detectContentType } from "../utils/secrets-utils"
import { analyzeCertificate, generateCertificateFingerprint } from "../utils/certificate-utils"

/**
 * Custom hook for certificate file handling and analysis with enhanced metadata
 */
export const useCertificateAnalysis = () => {
  const { toast } = useToast()
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileType, setFileType] = useState<FileType>('text')
  const [fileName, setFileName] = useState<string | null>(null)
  const [certificateMetadata, setCertificateMetadata] = useState<CertificateMetadata | null>(null)
  const [analysisResult, setAnalysisResult] = useState<CertificateAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  /**
   * Handle drag over events
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  /**
   * Handle drag leave events - improved to prevent flickering
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Only set isDragOver to false if we're actually leaving the drop zone
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return
    }

    setIsDragOver(false)
  }, [])

  /**
   * Handle drag enter events
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  /**
   * Analyze certificate content and extract metadata
   */
  const analyzeCertificateContent = useCallback(async (content: string, fileName?: string) => {
    // Pre-check: Only analyze if content looks like a certificate
    if (detectContentType(content) !== 'certificate') {
      // Silently skip analysis for non-certificate content
      return
    }

    setIsAnalyzing(true)
    try {
      const result = analyzeCertificate(content, fileName)
      setAnalysisResult(result)

      if (result.isValid && result.metadata) {
        // Generate fingerprint asynchronously
        const fingerprint = await generateCertificateFingerprint(content)
        const enhancedMetadata = { ...result.metadata, fingerprint }
        setCertificateMetadata(enhancedMetadata)
        setFileType('certificate')

        toast({
          title: "Certificate analyzed successfully",
          description: `Type: ${enhancedMetadata.type}, Format: ${enhancedMetadata.format}`
        })
      } else {
        // Only show error toast if content was expected to be a certificate
        toast({
          title: "Certificate analysis failed",
          description: result.errors?.join(', ') || 'Unknown error',
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Analysis error",
        description: "Failed to analyze certificate content",
        variant: "destructive"
      })
    } finally {
      setIsAnalyzing(false)
    }
  }, [toast])
  
  /**
   * Handle file drop events
   */
  const handleDrop = useCallback(async (e: React.DragEvent, onContentChange: (content: string) => void) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const file = files[0]
    const supportedExtensions = ['.crt', '.pem', '.pfx', '.p12', '.cer', '.der', '.key', '.pub', '.cert']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))

    if (supportedExtensions.includes(fileExtension)) {
      try {
        const content = await file.text()
        onContentChange(content)
        setFileName(file.name)

        // Analyze certificate content
        await analyzeCertificateContent(content, file.name)

        toast({
          title: "Certificate loaded successfully",
          description: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`
        })
      } catch (error) {
        toast({
          title: "Error reading certificate",
          description: "Failed to read the certificate file",
          variant: "destructive"
        })
      }
    } else {
      toast({
        title: "Unsupported file type",
        description: "Please drop a certificate file (.crt, .pem, .pfx, etc.)",
        variant: "destructive"
      })
    }
  }, [toast, analyzeCertificateContent])

  /**
   * Handle file input upload
   */
  const handleCertificateUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, onContentChange: (content: string) => void) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      onContentChange(content)
      setFileName(file.name)

      // Analyze certificate content
      await analyzeCertificateContent(content, file.name)

      toast({
        title: "Certificate uploaded successfully",
        description: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`
      })
    } catch (error) {
      toast({
        title: "Error reading certificate",
        description: "Failed to read the certificate file",
        variant: "destructive"
      })
    }

    // Reset file input
    e.target.value = ''
  }, [toast, analyzeCertificateContent])

  /**
   * Analyze content and update file type
   */
  const analyzeContent = useCallback(async (content: string) => {
    const detectedType = detectContentType(content)
    setFileType(detectedType)

    if (detectedType === 'certificate') {
      await analyzeCertificateContent(content)
    }
  }, [analyzeCertificateContent])

  /**
   * Reset certificate state
   */
  const resetCertificateState = useCallback(() => {
    setFileType('text')
    setFileName(null)
    setCertificateMetadata(null)
    setAnalysisResult(null)
    setIsDragOver(false)
    setIsAnalyzing(false)
  }, [])

  /**
   * Set external certificate metadata (for loaded certificates)
   */
  const setExternalCertificateMetadata = useCallback((metadata: CertificateMetadata | null) => {
    setCertificateMetadata(metadata)
  }, [])

  /**
   * Set external analysis result (for loaded certificates)
   */
  const setExternalAnalysisResult = useCallback((result: CertificateAnalysisResult | null) => {
    setAnalysisResult(result)
  }, [])

  return {
    // State
    isDragOver,
    fileType,
    fileName,
    certificateMetadata,
    analysisResult,
    isAnalyzing,

    // Actions
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleCertificateUpload,
    analyzeContent,
    analyzeCertificateContent,
    resetCertificateState,
    setCertificateMetadata: setExternalCertificateMetadata,
    setAnalysisResult: setExternalAnalysisResult    
  }
}