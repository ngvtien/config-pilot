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
 * Extract certificate metadata from content
 */
const extractCertificateMetadata = (content: string, fileName?: string): CertificateMetadata => {
  const metadata: CertificateMetadata = {
    type: detectCertificateType(content),
    format: detectCertificateFormat(content),
    fileName,
    fileSize: new Blob([content]).size,
    uploadedAt: new Date().toISOString(),
    hasPrivateKey: detectPrivateKey(content),
    isCA: false, // Will be enhanced with actual parsing
    requiresPassword: detectPasswordRequirement(content),
    //aliases: []
  }

  // Extract certificate details for PEM format
  if (metadata.type === 'PEM') {
    const certDetails = parsePEMCertificate(content)
    Object.assign(metadata, certDetails)
  }

  return metadata
}

/**
 * Detect certificate type from content
 */
const detectCertificateType = (content: string): CertificateMetadata['type'] => {
  if (content.includes('-----BEGIN CERTIFICATE-----') || 
      content.includes('-----BEGIN PRIVATE KEY-----') ||
      content.includes('-----BEGIN PUBLIC KEY-----')) {
    return 'PEM'
  }
  
  // Check for PKCS#12 binary indicators
  if (content.includes('\u0030\u0082') || content.startsWith('MII')) {
    return 'PKCS12'
  }
  
  // Check for DER format (binary)
  if (content.charCodeAt(0) === 0x30 && content.charCodeAt(1) === 0x82) {
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
