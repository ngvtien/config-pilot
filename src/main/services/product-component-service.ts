import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { ProductComponent, ProductComponentListResponse } from '../../shared/types/product-component'

export class ProductComponentService {
    private static readonly COMPONENTS_FILE = join(app.getPath('userData'), 'product-components.json')
    private static componentsCache: ProductComponent[] | null = null

    static async initialize(): Promise<void> {
        try {
            await fs.access(this.COMPONENTS_FILE)
            const content = await fs.readFile(this.COMPONENTS_FILE, 'utf-8')
            this.componentsCache = JSON.parse(content) as ProductComponent[]
        } catch {
            this.componentsCache = []
            await this.saveComponents(this.componentsCache)
        }
    }

    static async getAllComponents(): Promise<ProductComponentListResponse> {
        if (!this.componentsCache) {
            await this.initialize()
        }
        return {
            components: this.componentsCache || [],
            total: (this.componentsCache || []).length
        }
    }

    static async getComponentsByProduct(productName: string): Promise<ProductComponentListResponse> {
        const { components } = await this.getAllComponents()
        const filteredComponents = components.filter(c => c.parentProduct === productName)
        return {
            components: filteredComponents,
            total: filteredComponents.length
        }
    }

    static async createComponent(component: Omit<ProductComponent, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductComponent> {
        await this.getAllComponents()
        const allComponents = this.componentsCache || []

        if (allComponents.some(c => c.name === component.name && c.parentProduct === component.parentProduct)) {
            throw new Error(`Component with name '${component.name}' already exists in product '${component.parentProduct}'`)
        }

        const newComponent: ProductComponent = {
            ...component,
            id: `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        allComponents.push(newComponent)
        await this.saveComponents(allComponents)
        return newComponent
    }

    static async updateComponent(id: string, updates: Partial<ProductComponent>): Promise<ProductComponent> {
        await this.getAllComponents()
        const allComponents = this.componentsCache || []
        const index = allComponents.findIndex(c => c.id === id)
        
        if (index === -1) {
            throw new Error(`Component with id '${id}' not found`)
        }

        const updatedComponent = {
            ...allComponents[index],
            ...updates,
            id, // Ensure ID doesn't change
            updatedAt: new Date().toISOString()
        }

        allComponents[index] = updatedComponent
        await this.saveComponents(allComponents)
        return updatedComponent
    }

    static async deleteComponent(id: string): Promise<void> {
        await this.getAllComponents()
        const allComponents = this.componentsCache || []
        const index = allComponents.findIndex(c => c.id === id)
        
        if (index === -1) {
            throw new Error(`Component with id '${id}' not found`)
        }

        allComponents.splice(index, 1)
        await this.saveComponents(allComponents)
    }

    private static async saveComponents(components: ProductComponent[]): Promise<void> {
        await fs.writeFile(this.COMPONENTS_FILE, JSON.stringify(components, null, 2), 'utf-8')
        this.componentsCache = components
    }
}