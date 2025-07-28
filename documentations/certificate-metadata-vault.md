## 🎯 Current Storage Approach
Storing just the certificate content in Vault as a secret value is sufficient for most use cases , but there are important considerations:

## 📋 Certificate Reconstruction Requirements
### 1. PEM Format Certificates (.pem, .crt, .cer)

```bash
# Content stored in vault is complete and self-contained
-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/OvD...
-----END CERTIFICATE-----
```

✅ No additional metadata needed - PEM format is text-based and contains all necessary information.

2. Private Keys (.key, .pem)

```bash
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEF...
-----END PRIVATE KEY-----
```
✅ Self-contained - Can be reconstructed directly from vault content.

### 3. PKCS#12 Format (.pfx, .p12)
⚠️ Requires additional metadata:

- Password/Passphrase (if encrypted)
- Alias names (for multiple certificates)
- Certificate chain order

## 🔧 Enhanced Storage Strategy
For comprehensive certificate management, consider storing additional metadata:

```typescript
// Enhanced certificate metadata structure
interface CertificateMetadata {
  content: string           // The actual certificate content
  format: 'pem' | 'der' | 'pkcs12' | 'pkcs8'
  type: 'certificate' | 'private_key' | 'public_key' | 'certificate_chain'
  fileName?: string         // Original filename
  encoding: 'base64' | 'text'
  password?: string         // For encrypted certificates (store separately!)
  expiryDate?: string      // Certificate expiration
  issuer?: string          // Certificate issuer
  subject?: string         // Certificate subject
  fingerprint?: string     // SHA-256 fingerprint
  keyUsage?: string[]      // Key usage extensions
  createdAt: string        // When stored in vault
  updatedAt: string        // Last updated
}

/**
 * Enhanced certificate storage with metadata
 */
const storeCertificateWithMetadata = async (certContent: string, metadata: Partial<CertificateMetadata>) => {
  // Parse certificate to extract metadata
  const parsedMetadata = await parseCertificateMetadata(certContent)
  
  const fullMetadata: CertificateMetadata = {
    content: certContent,
    format: detectCertificateFormat(certContent),
    type: detectCertificateType(certContent),
    encoding: 'text',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...parsedMetadata,
    ...metadata
  }
  
  // Store in vault with structured data
  const vaultData = {
    certificate: certContent,
    metadata: JSON.stringify(fullMetadata)
  }
  
  return vaultData
}

/**
 * Parse certificate content to extract metadata
 */
const parseCertificateMetadata = async (content: string): Promise<Partial<CertificateMetadata>> => {
  try {
    // For PEM certificates, we can extract some metadata
    if (content.includes('-----BEGIN CERTIFICATE-----')) {
      // Use Web Crypto API or a library to parse certificate
      // This is a simplified example - you'd need a proper certificate parser
      return {
        type: 'certificate',
        format: 'pem',
        // Extract more metadata using certificate parsing library
      }
    }
    
    if (content.includes('-----BEGIN PRIVATE KEY-----')) {
      return {
        type: 'private_key',
        format: 'pem'
      }
    }
    
    return {}
  } catch (error) {
    console.error('Error parsing certificate metadata:', error)
    return {}
  }
}
```

## 🏗️ Recommended Vault Storage Structure
### Option 1: Single Secret with Metadata

```json
{
  "certificate": "-----BEGIN CERTIFICATE-----\nMIIDXT...",
  "metadata": {
    "format": "pem",
    "type": "certificate",
    "fileName": "server.crt",
    "expiryDate": "2025-12-31T23:59:59Z",
    "issuer": "CN=Example CA",
    "subject": "CN=example.com"
  }
}
```

Option 2: Separate Secrets for Content and Metadata
```bash
# Vault paths:
# /secret/certificates/server-cert/content
# /secret/certificates/server-cert/metadata
```

Option 3: Certificate Bundle (Recommended)
```json
{
  "certificate": "-----BEGIN CERTIFICATE-----...",
  "private_key": "-----BEGIN PRIVATE KEY-----...",
  "ca_chain": "-----BEGIN CERTIFICATE-----...",
  "metadata": {
    "bundle_type": "tls_server",
    "domain": "example.com",
    "created_at": "2024-01-15T10:30:00Z",
    "expires_at": "2025-01-15T10:30:00Z"
  }
}
```

## Proposed Enhancement: Certificate Metadata Management
### 1. Enhanced Data Structures
```typescript
// Enhanced interfaces for certificate management
interface CertificateMetadata {
  type: 'x509' | 'pkcs12' | 'private-key' | 'public-key' | 'ca-bundle' | 'unknown'
  format: 'pem' | 'der' | 'pkcs12' | 'jks' | 'unknown'
  fileName: string
  fileSize: number
  uploadedAt: string
  expiresAt?: string
  issuer?: string
  subject?: string
  serialNumber?: string
  fingerprint?: string
  keyUsage?: string[]
  hasPrivateKey: boolean
  isCA: boolean
  chainLength?: number
  // PKCS#12 specific
  requiresPassword?: boolean
  aliases?: string[]
  // Security metadata
  keySize?: number
  signatureAlgorithm?: string
}

interface EnhancedSecretItem extends SecretItem {
  // ... existing code ...
  certificateMetadata?: CertificateMetadata
  secretType: 'text' | 'certificate' | 'binary'
}
```
### 2. Certificate Analysis Functions
Add certificate parsing and analysis capabilities:
```typescript
/**
 * Parse and analyze certificate content to extract metadata
 */
const analyzeCertificate = useCallback(async (content: string, fileName: string): Promise<CertificateMetadata> => {
  const metadata: CertificateMetadata = {
    type: 'unknown',
    format: 'unknown',
    fileName,
    fileSize: content.length,
    uploadedAt: new Date().toISOString(),
    hasPrivateKey: false,
    isCA: false
  }

  try {
    // Detect certificate type and format
    if (content.includes('-----BEGIN CERTIFICATE-----')) {
      metadata.type = 'x509'
      metadata.format = 'pem'
    } else if (content.includes('-----BEGIN PRIVATE KEY-----') || content.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      metadata.type = 'private-key'
      metadata.format = 'pem'
      metadata.hasPrivateKey = true
    } else if (content.includes('-----BEGIN PUBLIC KEY-----')) {
      metadata.type = 'public-key'
      metadata.format = 'pem'
    } else if (fileName.toLowerCase().endsWith('.p12') || fileName.toLowerCase().endsWith('.pfx')) {
      metadata.type = 'pkcs12'
      metadata.format = 'pkcs12'
      metadata.requiresPassword = true
    }

    // For PEM certificates, try to extract basic information
    if (metadata.format === 'pem' && metadata.type === 'x509') {
      // Use electron main process to parse certificate details
      const certDetails = await window.electronAPI.certificate?.parsePEM?.(content)
      if (certDetails) {
        metadata.expiresAt = certDetails.validTo
        metadata.issuer = certDetails.issuer
        metadata.subject = certDetails.subject
        metadata.serialNumber = certDetails.serialNumber
        metadata.fingerprint = certDetails.fingerprint
        metadata.isCA = certDetails.isCA
        metadata.keyUsage = certDetails.keyUsage
        metadata.keySize = certDetails.keySize
        metadata.signatureAlgorithm = certDetails.signatureAlgorithm
      }
    }

  } catch (error) {
    console.warn('Certificate analysis failed:', error)
  }

  return metadata
}, [])

/**
 * Enhanced certificate upload handler with metadata extraction
 */
const handleEnhancedCertificateUpload = useCallback(async (file: File) => {
  try {
    const content = await file.text()
    const metadata = await analyzeCertificate(content, file.name)
    
    setSecretInputValue(content)
    setFileType('certificate')
    setFileName(file.name)
    setCertificateMetadata(metadata)
    
    toast({
      title: "Certificate analyzed successfully",
      description: `${metadata.type.toUpperCase()} certificate (${metadata.format.toUpperCase()}) - ${(file.size / 1024).toFixed(1)} KB`
    })
  } catch (error) {
    toast({
      title: "Error analyzing certificate",
      description: "Failed to analyze the certificate file",
      variant: "destructive"
    })
  }
}, [analyzeCertificate, toast])
```

### 3. Enhanced Vault Storage Strategy
Modify the save function to store both content and metadata:
```typescript
/**
 * Enhanced secret saving with certificate metadata
 */
const saveEnhancedSecretChanges = async () => {
  try {
    // ... existing code ...
    
    if (vaultConnectionStatus === 'success' && editVaultPath && editVaultKey) {
      const vaultData: any = {
        value: secretInputValue
      }
      
      // Add certificate metadata if it's a certificate
      if (fileType === 'certificate' && certificateMetadata) {
        vaultData.metadata = {
          ...certificateMetadata,
          storedAt: new Date().toISOString(),
          version: '1.0'
        }
        
        // Store metadata in a separate vault path for easy querying
        const metadataPath = `${editVaultPath}/metadata`
        await window.electronAPI.vault.writeSecret(
          env,
          metadataPath,
          editVaultKey,
          JSON.stringify(vaultData.metadata)
        )
      }
      
      // Store the main secret with embedded metadata
      const result = await window.electronAPI.vault.writeSecret(
        env,
        editVaultPath,
        editVaultKey,
        JSON.stringify(vaultData)
      )
      
      if (result.success) {
        toast({ 
          title: fileType === 'certificate' 
            ? "Certificate and metadata saved to vault successfully" 
            : "Secret saved to vault successfully" 
        })
      }
    }
    
    // ... existing code ...
  } catch (error) {
    // ... existing error handling ...
  }
}
```

