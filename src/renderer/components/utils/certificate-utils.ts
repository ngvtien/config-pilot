import type { CertificateMetadata, CertificateAnalysisResult } from '../types/secrets'

/**
 * Parse certificate content and extract metadata
 */
export const analyzeCertificate = (content: string, fileName?: string): CertificateAnalysisResult => {
  try {
    const metadata = extractCertificateMetadata(content, fileName)
    return {
      isValid: true,
      metadata,
      warnings: []
    }
  } catch (error) {
    return {
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Unknown parsing error']
    }
  }
}

/**
 * Enhanced PKCS#12 metadata extraction with proper binary handling
 */
const extractPKCS12Metadata = (content: string, fileName?: string): Partial<CertificateMetadata> => {
  const metadata: Partial<CertificateMetadata> = {
    format: 'PKCS12',
    requiresPassword: true,
    hasPrivateKey: true,
    aliases: [],
    chainLength: 1
  }

  // Enhanced file extension detection
  if (fileName) {
    const ext = fileName.toLowerCase().split('.').pop()
    if (ext === 'pfx' || ext === 'p12') {
      metadata.format = 'PKCS12'
    }
  }

  try {
    // Convert content to proper binary data for analysis
    let binaryData: Uint8Array

    // Check if content is base64 encoded
    if (isPossibleBase64(content)) {
      try {
        const decoded = atob(content.replace(/\s/g, ''))
        binaryData = new Uint8Array(decoded.length)
        for (let i = 0; i < decoded.length; i++) {
          binaryData[i] = decoded.charCodeAt(i)
        }
      } catch {
        // If base64 decode fails, treat as binary string
        binaryData = new Uint8Array(content.length)
        for (let i = 0; i < content.length; i++) {
          binaryData[i] = content.charCodeAt(i)
        }
      }
    } else {
      // Treat as binary string
      binaryData = new Uint8Array(content.length)
      for (let i = 0; i < content.length; i++) {
        binaryData[i] = content.charCodeAt(i)
      }
    }

    // Enhanced PKCS#12 structure analysis
    const analysis = analyzePKCS12Structure(binaryData)
    Object.assign(metadata, analysis)

    // File size analysis
    metadata.fileSize = binaryData.length

    // Estimate certificate chain length based on structure
    if (binaryData.length > 10000) {
      metadata.chainLength = Math.max(1, Math.floor(binaryData.length / 3000))
    }

  } catch (error) {
    console.warn('PKCS#12 analysis limited without password:', error)
    // Provide basic metadata even on error
    metadata.chainLength = 1
    metadata.hasPrivateKey = true
    metadata.fileSize = new Blob([content]).size
  }

  return metadata
}

/**
 * Analyze PKCS#12 binary structure for metadata extraction
 */
const analyzePKCS12Structure = (data: Uint8Array): Partial<CertificateMetadata> => {
  const analysis: Partial<CertificateMetadata> = {}

  try {
    // Check for PKCS#12 magic bytes (ASN.1 SEQUENCE)
    if (data[0] === 0x30 && (data[1] === 0x82 || data[1] === 0x83)) {
      analysis.type = 'PKCS12'

      // Look for PKCS#12 OID: 1.2.840.113549.1.12.10.1.2
      const pkcs12OID = [0x06, 0x0B, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x0C, 0x0A, 0x01, 0x02]
      let hasValidOID = false

      for (let i = 0; i < data.length - pkcs12OID.length; i++) {
        let match = true
        for (let j = 0; j < pkcs12OID.length; j++) {
          if (data[i + j] !== pkcs12OID[j]) {
            match = false
            break
          }
        }
        if (match) {
          hasValidOID = true
          break
        }
      }

      if (hasValidOID) {
        analysis.format = 'PKCS12'
        analysis.hasPrivateKey = true

        // Count potential certificate entries (rough heuristic)
        let certCount = 0
        for (let i = 0; i < data.length - 20; i++) {
          // Look for certificate patterns in PKCS#12
          if (data[i] === 0x30 && data[i + 1] === 0x82 && data[i + 4] === 0x30) {
            certCount++
          }
        }
        analysis.chainLength = Math.max(1, Math.min(certCount, 10)) // Cap at reasonable number
      }
    }

    // Check for encrypted content indicators
    const encryptionIndicators = [
      [0x30, 0x1C, 0x06, 0x0A], // Common encryption OID prefix
      [0x04, 0x14], // Key identifier
      [0x02, 0x01, 0x03] // Version 3 indicator
    ]

    for (const indicator of encryptionIndicators) {
      for (let i = 0; i < data.length - indicator.length; i++) {
        let match = true
        for (let j = 0; j < indicator.length; j++) {
          if (data[i + j] !== indicator[j]) {
            match = false
            break
          }
        }
        if (match) {
          analysis.requiresPassword = true
          break
        }
      }
    }

  } catch (error) {
    console.warn('Error analyzing PKCS#12 structure:', error)
  }

  return analysis
}

/**
 * Helper function to check if content might be base64
 */
const isPossibleBase64 = (content: string): boolean => {
  // Remove whitespace and check if it's valid base64
  const cleaned = content.replace(/\s/g, '')
  return /^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) && cleaned.length % 4 === 0
}

/**
 * Extract certificate metadata from content
 */
const extractCertificateMetadata = (content: string, fileName?: string): CertificateMetadata => {
  const type = detectCertificateType(content)
  const metadata: CertificateMetadata = {
    type,
    format: detectCertificateFormat(content),
    fileName,
    fileSize: new Blob([content]).size,
    uploadedAt: new Date().toISOString(),
    hasPrivateKey: detectPrivateKey(content),
    isCA: false, // Will be enhanced with actual parsing
    requiresPassword: detectPasswordRequirement(content),
    aliases: []
  }

  // ✅ FIXED: Enhanced handling for different certificate types
  if (type === 'PEM') {
    const certDetails = parsePEMCertificate(content)
    Object.assign(metadata, certDetails)
  } else if (type === 'PKCS12') {
    const pkcs12Details = extractPKCS12Metadata(content, fileName)
    Object.assign(metadata, pkcs12Details)
  }

  return metadata
}

/**
 * Detect certificate type from content (enhanced for PFX/PKCS#12)
 */
const detectCertificateType = (content: string): CertificateMetadata['type'] => {
  // PEM format detection
  if (content.includes('-----BEGIN CERTIFICATE-----') ||
    content.includes('-----BEGIN PRIVATE KEY-----') ||
    content.includes('-----BEGIN PUBLIC KEY-----') ||
    content.includes('-----BEGIN RSA PRIVATE KEY-----') ||
    content.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----')) {
    return 'PEM'
  }

  // ✅ FIXED: Enhanced PKCS#12/PFX detection
  // Check for PKCS#12 magic bytes and common patterns
  const bytes = new Uint8Array(content.length)
  for (let i = 0; i < content.length; i++) {
    bytes[i] = content.charCodeAt(i)
  }

  // PKCS#12 starts with ASN.1 SEQUENCE (0x30) followed by length
  if (bytes[0] === 0x30 && (bytes[1] === 0x82 || bytes[1] === 0x83)) {
    // Check for PKCS#12 OID: 1.2.840.113549.1.12.10.1.2
    const pkcs12Pattern = [0x06, 0x0B, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x0C, 0x0A, 0x01, 0x02]
    for (let i = 0; i < bytes.length - pkcs12Pattern.length; i++) {
      let match = true
      for (let j = 0; j < pkcs12Pattern.length; j++) {
        if (bytes[i + j] !== pkcs12Pattern[j]) {
          match = false
          break
        }
      }
      if (match) return 'PKCS12'
    }
  }

  // ✅ Base64 encoded PKCS#12 detection
  if (content.startsWith('MII') || content.startsWith('MIIE') || content.startsWith('MIIF')) {
    try {
      const decoded = atob(content.replace(/\s/g, ''))
      const decodedBytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) {
        decodedBytes[i] = decoded.charCodeAt(i)
      }
      if (decodedBytes[0] === 0x30 && (decodedBytes[1] === 0x82 || decodedBytes[1] === 0x83)) {
        return 'PKCS12'
      }
    } catch (e) {
      // Not valid base64, continue
    }
  }

  // DER format detection
  if (bytes[0] === 0x30 && bytes[1] === 0x82) {
    return 'DER'
  }

  return 'UNKNOWN'
}

/**
 * Detect certificate format
 */
const detectCertificateFormat = (content: string): CertificateMetadata['format'] => {
  if (content.includes('-----BEGIN CERTIFICATE-----')) {
    return 'X.509'
  }
  if (content.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    return 'PKCS#1'
  }
  if (content.includes('-----BEGIN PRIVATE KEY-----')) {
    return 'PKCS#8'
  }

  // Check for PKCS#12 format
  const bytes = new Uint8Array(content.length)
  for (let i = 0; i < content.length; i++) {
    bytes[i] = content.charCodeAt(i)
  }

  if (bytes[0] === 0x30 && (bytes[1] === 0x82 || bytes[1] === 0x83)) {
    return 'PKCS12'
  }

  return 'UNKNOWN'
}

/**
 * Detect if content contains private key
 */
const detectPrivateKey = (content: string): boolean => {
  return content.includes('-----BEGIN PRIVATE KEY-----') ||
    content.includes('-----BEGIN RSA PRIVATE KEY-----') ||
    content.includes('-----BEGIN EC PRIVATE KEY-----') ||
    content.includes('-----BEGIN DSA PRIVATE KEY-----')
}

/**
 * Detect if certificate requires password
 */
const detectPasswordRequirement = (content: string): boolean => {
  return content.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----') ||
    content.includes('Proc-Type: 4,ENCRYPTED')
}

/**
 * Parse PEM certificate details (simplified version)
 * In a real implementation, you'd use a proper ASN.1 parser
 */
const parsePEMCertificate = (content: string): Partial<CertificateMetadata> => {
  const details: Partial<CertificateMetadata> = {}

  // Extract subject and issuer using regex (simplified)
  const subjectMatch = content.match(/Subject:(.+?)(?=\n|$)/)
  if (subjectMatch) {
    details.subject = subjectMatch[1].trim()
  }

  const issuerMatch = content.match(/Issuer:(.+?)(?=\n|$)/)
  if (issuerMatch) {
    details.issuer = issuerMatch[1].trim()
  }

  // Extract serial number
  const serialMatch = content.match(/Serial Number:(.+?)(?=\n|$)/)
  if (serialMatch) {
    details.serialNumber = serialMatch[1].trim()
  }

  // Extract validity dates
  const validityMatch = content.match(/Not After\s*:\s*(.+?)(?=\n|$)/)
  if (validityMatch) {
    try {
      details.expiresAt = new Date(validityMatch[1].trim()).toISOString()
    } catch {
      // Invalid date format
    }
  }

  return details
}

/**
 * Generate certificate fingerprint (simplified SHA-256)
 */
export const generateCertificateFingerprint = async (content: string): Promise<string> => {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join(':')
  } catch {
    return 'unknown'
  }
}

/**
 * Generate smart suggestions for related secret names based on certificate name and filename
 */
export const suggestRelatedSecretNames = (certificateName: string, fileName?: string): {
  privateKey: string
  password: string
  caBundle: string
  intermediateBundle: string
} => {
  // Clean the base name from certificate name or filename
  const baseName = (fileName || certificateName)
    .replace(/\.(crt|pem|cert|cer|der|p12|pfx)$/i, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toUpperCase()

  // Generate suggestions based on common naming patterns
  return {
    privateKey: `${baseName}_PRIVATE_KEY`,
    password: `${baseName}_PASSWORD`,
    caBundle: `${baseName}_CA_BUNDLE`,
    intermediateBundle: `${baseName}_INTERMEDIATE_CERT`
  }
}
