/**
 * Configuration for product repository base paths
 * This centralizes path management for transitioning from POC to production
 */
export interface ProductPathConfig {
  baseRepositoryPath: string
  products: Record<string, {
    repoPath: string
    components: Record<string, string>
  }>
}

/**
 * Hard-coded paths for product repositories
 * TODO: Move to environment configuration or settings file
 */
export const PRODUCT_PATHS: ProductPathConfig = {
  // Base path where all product repositories are located
  baseRepositoryPath: "C:\\repos\\products",
  
  // Individual product repository paths and their components
  products: {
    "cai": {
      repoPath: "C:\\repos\\products\\cai",
      components: {
        "cai-api": "components\\cai-api",
        "cai-auth": "components\\cai-auth", 
        "cai-database": "components\\cai-database"
      }
    },
    "esb": {
      repoPath: "C:\\repos\\products\\esb",
      components: {
        "esb-message-broker": "components\\esb-message-broker",
        "esb-transformer": "components\\esb-transformer"
      }
    },
    "portal": {
      repoPath: "C:\\repos\\products\\portal",
      components: {
        "portal-webapp": "components\\portal-webapp",
        "portal-backend": "components\\portal-backend"
      }
    },
    "analytics": {
      repoPath: "C:\\repos\\products\\analytics",
      components: {
        "analytics-spark": "components\\analytics-spark"
      }
    }
  }
}

/**
 * Helper functions for path resolution
 */
export const getProductRepoPath = (productName: string): string | undefined => {
  return PRODUCT_PATHS.products[productName]?.repoPath
}

export const getComponentFolderPath = (productName: string, componentName: string): string | undefined => {
  const product = PRODUCT_PATHS.products[productName]
  if (!product) return undefined
  
  const componentPath = product.components[componentName]
  if (!componentPath) return undefined
  
  return `${product.repoPath}\\${componentPath}`
}

export const getComponentResourcesPath = (productName: string, componentName: string): string | undefined => {
  const componentPath = getComponentFolderPath(productName, componentName)
  return componentPath ? `${componentPath}\\resources` : undefined
}