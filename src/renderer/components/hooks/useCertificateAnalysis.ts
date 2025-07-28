import { useState, useCallback } from "react"
import { useToast } from "@/renderer/hooks/use-toast"
import type { FileType } from "../types/secrets"
import { detectContentType } from "../utils/secrets-utils"

/**
 * Custom hook for certificate file handling and analysis
 */
export const useCertificateAnalysis = () => {
  const { toast } = useToast()
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileType, setFileType] = useState<FileType>('text')
  const [fileName, setFileName] = useState<string | null>(null)

  /**
   * Handle drag over events
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  /**
   * Handle drag leave events
   */
  // const handleDragLeave = useCallback((e: React.DragEvent) => {
  //   e.preventDefault()
  //   e.stopPropagation()
  //   setIsDragOver(false)
  // }, [])
  /**
   * Handle drag leave events - improved to prevent flickering
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only set isDragOver to false if we're actually leaving the drop zone
    // Check if the related target is outside the current target
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    // If the mouse is still within the bounds of the drop zone, don't hide the overlay
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return
    }
    
    setIsDragOver(false)
  }, [])  

  /**
   * Handle drag enter events - add this new handler
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

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
        setFileType('certificate')
        setFileName(file.name)
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
  }, [toast])

  /**
   * Handle file input upload
   */
  const handleCertificateUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, onContentChange: (content: string) => void) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      onContentChange(content)
      setFileType('certificate')
      setFileName(file.name)
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
  }, [toast])

  /**
   * Analyze content and update file type
   */
  const analyzeContent = useCallback((content: string) => {
    const detectedType = detectContentType(content)
    setFileType(detectedType)
  }, [])

  /**
   * Reset certificate state
   */
  const resetCertificateState = useCallback(() => {
    setFileType('text')
    setFileName(null)
    setIsDragOver(false)
  }, [])

  return {
    // State
    isDragOver,
    fileType,
    fileName,
    
    // Actions
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleCertificateUpload,
    analyzeContent,
    resetCertificateState
  }
}