"use client"
import { useState, useEffect } from "react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Textarea } from "@/renderer/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/renderer/components/ui/select"
import { Badge } from "@/renderer/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { X, Save, X as Cancel } from "lucide-react"
import { Product, createNewProduct, validateProduct } from "@/shared/types/product"
import { typography } from "@/renderer/lib/typography"
import { cn } from "@/lib/utils"

interface InlineProductEditorProps {
  product?: Product | null
  onSave: (product: Product) => void
  onCancel: () => void
  className?: string
}

/**
 * Inline product editor component that replaces ProductModal
 * Provides seamless editing experience within the panel layout
 */
export function InlineProductEditor({
  product,
  onSave,
  onCancel,
  className
}: InlineProductEditorProps) {
  const [formData, setFormData] = useState<Partial<Product>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  const isEditing = !!product

  // Initialize form data
  useEffect(() => {
    if (product) {
      setFormData(product)
      setTags(product.metadata?.tags || [])
    } else {
      setFormData({})
      setTags([])
    }
    setErrors([])
    setNewTag('')
  }, [product])

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrors([])

    try {
      const productData = {
        ...formData,
        metadata: {
          ...formData.metadata,
          tags
        }
      }

      const validation = validateProduct(productData)
      if (!validation.isValid) {
        setErrors(validation.errors)
        setIsLoading(false)
        return
      }

      let savedProduct: Product
      if (isEditing && product) {
        savedProduct = {
          ...product,
          ...productData,
          updatedAt: new Date().toISOString()
        } as Product
      } else {
        savedProduct = createNewProduct(
          productData.name!,
          productData.displayName,
          productData.owner
        )
        savedProduct = {
          ...savedProduct,
          ...productData
        }
      }

      onSave(savedProduct)
    } catch (error) {
      console.error('Error saving product:', error)
      setErrors(['Failed to save product. Please try again.'])
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Add a new tag
   */
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  /**
   * Remove a tag
   */
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  /**
   * Handle tag input key press
   */
  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <CardTitle className={typography.tile.title}>
          {isEditing ? 'Edit Product' : 'Add New Product'}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Display */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <ul className="text-sm text-red-600 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., cai"
                required
              />
              <p className={typography.card.caption}>
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={formData.displayName || ''}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g., CAI"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the product"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                value={formData.owner || ''}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                placeholder="e.g., Platform Team"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.metadata?.category || 'general'}
                onValueChange={(value) => setFormData({
                  ...formData,
                  metadata: { ...formData.metadata, category: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="frontend">Frontend</SelectItem>
                  <SelectItem value="backend">Backend</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleTagKeyPress}
                placeholder="Add a tag"
                className="flex-1"
              />
              <Button type="button" onClick={handleAddTag} variant="outline" size="sm">
                Add
              </Button>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="repository">Repository URL</Label>
              <Input
                id="repository"
                value={formData.metadata?.repository || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  metadata: { ...formData.metadata, repository: e.target.value }
                })}
                placeholder="https://github.com/org/repo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentation">Documentation URL</Label>
              <Input
                id="documentation"
                value={formData.metadata?.documentation || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  metadata: { ...formData.metadata, documentation: e.target.value }
                })}
                placeholder="https://docs.example.com"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              <Cancel className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : (isEditing ? 'Update Product' : 'Create Product')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}