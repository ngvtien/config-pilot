import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { Product, ProductListResponse } from '../../shared/types/product'

/**
 * Product service for managing product data with file-based storage
 */
export class ProductService {
    private static readonly PRODUCTS_FILE = join(app.getPath('userData'), 'products.json')
    private static productsCache: Product[] | null = null

    /**
     * Initialize product service and ensure data file exists
     */
    static async initialize(): Promise<void> {
        console.log('=== ProductService.initialize called ===')
        console.log('Products file path:', this.PRODUCTS_FILE)

        try {
            await fs.access(this.PRODUCTS_FILE)
            console.log('Products file exists, loading...')

            // Load existing products into cache
            const content = await fs.readFile(this.PRODUCTS_FILE, 'utf-8')
            console.log('File content loaded:', content)

            this.productsCache = JSON.parse(content) as Product[]
            console.log('Products loaded into cache:', this.productsCache.length, 'products')
            console.log('Products:', this.productsCache.map(p => ({ id: p.id, name: p.name, isActive: p.isActive })))
        } catch (error) {
            console.log('Products file does not exist, creating default...')

            // File doesn't exist, create with default products
            const defaultProducts: Product[] = [
                {
                    id: 'product-default',
                    name: 'default',
                    displayName: 'Default Product',
                    description: 'Default product for development',
                    owner: 'Development Team',
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    metadata: {
                        category: 'development',
                        tags: ['default']
                    }
                }
            ]

            console.log('Creating default products:', defaultProducts)
            await this.saveProducts(defaultProducts)
            console.log('Default products saved')
        }
    }

    /**
     * Get all products
     */
    static async getAllProducts(): Promise<ProductListResponse> {
        try {
            console.log('=== getAllProducts called ===')
            console.log('Cache state:', this.productsCache ? 'EXISTS' : 'NULL')
            console.log('Products file path:', this.PRODUCTS_FILE)

            if (!this.productsCache) {
                console.log('Loading products from file...')
                const content = await fs.readFile(this.PRODUCTS_FILE, 'utf-8')
                console.log('Raw file content:', content)

                this.productsCache = JSON.parse(content) as Product[]
                console.log('Parsed products cache:', this.productsCache)
                console.log('Total products in cache:', this.productsCache.length)
            } else {
                console.log('Using existing cache with', this.productsCache.length, 'products')
            }

            console.log('All products in cache:', this.productsCache.map(p => ({ id: p.id, name: p.name, isActive: p.isActive })))

            // const activeProducts = this.productsCache.filter(p => p.isActive)
            // console.log('Active products:', activeProducts.map(p => ({ id: p.id, name: p.name, isActive: p.isActive })))
            // console.log('Returning', activeProducts.length, 'active products')

            return {
                products: this.productsCache.sort((a, b) => a.displayName?.localeCompare(b.displayName || '') || 0),
                total: this.productsCache.length
            }
        } catch (error: any) {
            console.error('Failed to load products:', error)
            console.error('Error details:', error.stack)
            throw new Error(`Failed to load products: ${error.message}`)
        }
    }

    /**
     * Get product by ID
     */
    static async getProductById(id: string): Promise<Product | null> {
        const { products } = await this.getAllProducts()
        return products.find(p => p.id === id) || null
    }

    /**
     * Create new product
     */
    static async createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
        // Ensure cache is loaded
        await this.getAllProducts()

        // Work with ALL products (including inactive ones)
        const allProducts = this.productsCache || []

        // Check for duplicate names among ALL products
        if (allProducts.some(p => p.name === product.name)) {
            throw new Error(`Product with name '${product.name}' already exists`)
        }

        const newProduct: Product = {
            ...product,
            isActive: product.isActive !== undefined ? product.isActive : true, // Default to true
            id: `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        // Add to ALL products and save ALL products
        allProducts.push(newProduct)
        await this.saveProducts(allProducts)

        return newProduct
    }

    /**
     * Update existing product
     */
    static async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
        // Ensure cache is loaded
        await this.getAllProducts()

        // Work with ALL products (including inactive ones)
        const allProducts = this.productsCache || []
        const index = allProducts.findIndex(p => p.id === id)

        if (index === -1) {
            throw new Error(`Product with ID '${id}' not found`)
        }

        // Check for duplicate names among ALL products (excluding current product)
        if (updates.name && allProducts.some(p => p.id !== id && p.name === updates.name)) {
            throw new Error(`Product with name '${updates.name}' already exists`)
        }

        const updatedProduct: Product = {
            ...allProducts[index],
            ...updates,
            id, // Ensure ID cannot be changed
            updatedAt: new Date().toISOString()
        }

        allProducts[index] = updatedProduct
        await this.saveProducts(allProducts)

        return updatedProduct
    }

    /**
     * Delete product (hard delete - removes from array)
     */
    static async deleteProduct(id: string): Promise<void> {
        // Ensure cache is loaded
        await this.getAllProducts()

        // Work with ALL products (including inactive ones)
        const allProducts = this.productsCache || []
        const index = allProducts.findIndex(p => p.id === id)

        if (index === -1) {
            throw new Error(`Product with ID '${id}' not found`)
        }

        // ACTUALLY REMOVE the product from the array
        allProducts.splice(index, 1)

        // Save the updated array
        await this.saveProducts(allProducts)
    }
    /**
     * Export products data
     */
    static async exportProducts(filePath: string): Promise<void> {
        const { products } = await this.getAllProducts()
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            products
        }
        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8')
    }

    /**
     * Import products data
     */
    static async importProducts(filePath: string, mergeMode: 'replace' | 'merge' = 'merge'): Promise<void> {
        const content = await fs.readFile(filePath, 'utf-8')
        const importData = JSON.parse(content)

        if (!importData.products || !Array.isArray(importData.products)) {
            throw new Error('Invalid import file format')
        }

        const existingProducts = mergeMode === 'replace' ? [] : (await this.getAllProducts()).products
        const importedProducts = importData.products as Product[]

        // Merge or replace products
        const finalProducts = mergeMode === 'replace'
            ? importedProducts
            : this.mergeProducts(existingProducts, importedProducts)

        await this.saveProducts(finalProducts)
    }

    /**
     * Save products to file and clear cache
     */
    private static async saveProducts(products: Product[]): Promise<void> {
        await fs.writeFile(this.PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8')
        this.productsCache = products // Update cache
    }

    /**
     * Merge imported products with existing ones
     */
    private static mergeProducts(existing: Product[], imported: Product[]): Product[] {
        const merged = [...existing]

        for (const importedProduct of imported) {
            const existingIndex = merged.findIndex(p => p.name === importedProduct.name)
            if (existingIndex >= 0) {
                // Update existing product
                merged[existingIndex] = {
                    ...importedProduct,
                    id: merged[existingIndex].id, // Keep existing ID
                    updatedAt: new Date().toISOString()
                }
            } else {
                // Add new product
                merged.push({
                    ...importedProduct,
                    id: `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    updatedAt: new Date().toISOString()
                })
            }
        }

        return merged
    }
}