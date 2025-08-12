/**
 * Enhanced mock data for comprehensive 3-panel layout testing
 */
import { mockDataService } from '@/renderer/services/mock-data.service'

/**
 * Test scenarios for different data states
 */
export const testScenarios = {
  // Empty state
  empty: {
    products: [],
    components: {},
    resources: {}
  },
  
  // Single product with components
  singleProduct: {
    products: [mockDataService.getProducts()[0]],
    components: {
      "product-cai": mockDataService.getProductComponents("product-cai")
    },
    resources: {
      "comp-cai-api": mockDataService.getComponentResources("comp-cai-api")
    }
  },
  
  // Full dataset
  full: {
    products: mockDataService.getProducts(),
    components: {
      "product-cai": mockDataService.getProductComponents("product-cai"),
      "product-esb": mockDataService.getProductComponents("product-esb"),
      "product-portal": mockDataService.getProductComponents("product-portal"),
      "product-analytics": mockDataService.getProductComponents("product-analytics")
    },
    resources: {
      "comp-cai-api": mockDataService.getComponentResources("comp-cai-api"),
      "comp-cai-auth": mockDataService.getComponentResources("comp-cai-auth")
    }
  }
}

/**
 * Generate random test data for stress testing
 */
export const generateTestData = (productCount: number = 10, componentsPerProduct: number = 5) => {
  // Implementation for generating large datasets for performance testing
  // ... implementation details
}