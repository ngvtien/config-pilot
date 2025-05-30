export interface ContextData {
  environment: string
  instance: number
  product: string
  customer: string
  version: string
  baseHostUrl: string
}

export type Environment = "dev" | "sit" | "uat" | "prod"

export interface ContextMetadata {
  lastUpdated?: string
  createdAt?: string
  updatedBy?: string
}

export interface ExtendedContextData extends ContextData, ContextMetadata {
  // Additional context properties
  region?: string
  cluster?: string
  namespace?: string
  tags?: Record<string, string>
}

// Helper type for context validation
export interface ContextValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// Context change event
export interface ContextChangeEvent {
  previous: ContextData
  current: ContextData
  timestamp: string
  source: "user" | "system" | "import"
}
