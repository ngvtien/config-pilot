/**
 * Constants for secrets management
 */
export const SUPPORTED_CERTIFICATE_EXTENSIONS = [
  '.crt', '.pem', '.pfx', '.p12', '.cer', '.der', '.key', '.pub', '.cert'
] as const

export const CERTIFICATE_PATTERNS = {
  BEGIN_CERTIFICATE: '-----BEGIN CERTIFICATE-----',
  BEGIN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----',
  BEGIN_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----',
  BEGIN_RSA_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----'
} as const

export const DEFAULT_VAULT_PATHS = {
  getDefaultPath: (customer: string, env: string, instance: number, product: string) => 
    `kv/${customer}/${env}/${instance}/${product}`.toLowerCase()
} as const

export const FILE_SIZE_LIMITS = {
  WARNING_THRESHOLD: 5000000, // 5MB
  MAX_DISPLAY_LINES: 8
} as const