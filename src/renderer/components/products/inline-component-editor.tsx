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
import { ProductComponent, createNewProductComponent, validateProductComponent } from "@/shared/types/product-component"
import { typography } from "@/renderer/lib/typography"
import { cn } from "@/lib/utils"

interface InlineComponentEditorProps {
  component?: ProductComponent | null
  parentProduct: string
  onSave: (component: ProductComponent) => void
  onCancel: () => void
  className?: string
}

/**
 * Inline component editor that replaces ProductComponentModal
 * Provides seamless editing experience within the panel layout
 */
export function InlineComponentEditor({
  component,
  parentProduct,
  onSave,
  onCancel,
  className
}: InlineComponentEditorProps) {
  const [formData, setFormData] = useState<Partial<ProductComponent>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  const isEditing = !!component

  // Initialize form data
  useEffect(() => {
    if (component) {
      setFormData(component)
      setTags(component.metadata?.tags || [])
    } else {
      setFormData({ parentProduct })
      setTags([])
    }
    setErrors([])
    setNewTag('')
  }, [component, parentProduct])

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrors([])

    try {
      const componentData = {
        ...formData,
        parentProduct,
        metadata: {
          ...formData.metadata,
          tags
        }
      }

      const validation = validateProductComponent(componentData)
      if (!validation.isValid) {
        setErrors(validation.errors)
        setIsLoading(false)
        return
      }

      let savedComponent: ProductComponent
      if (isEditing && component) {
        savedComponent = {
          ...component,
          ...componentData,
          updatedAt: new Date().toISOString()
        } as ProductComponent
      } else {
        savedComponent = createNewProductComponent(
          componentData.name!,
          parentProduct,
          componentData.displayName,
          componentData.owner
        )
        savedComponent = {
          ...savedComponent,
          ...componentData
        }
      }

      onSave(savedComponent)
    } catch (error) {
      console.error('Error saving component:', error)
      setErrors(['Failed to save component. Please try again.'])
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
          {isEditing ? 'Edit Component' : 'Add New Component'}
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
              <Label htmlFor="name">Component Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., api-gateway"
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
                placeholder="e.g., API Gateway"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the component"
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
                placeholder="e.g., Backend Team"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Component Type</Label>
              <Select
                value={formData.metadata?.type || 'service'}
                onValueChange={(value) => setFormData({
                  ...formData,
                  metadata: { ...formData.metadata, type: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="frontend">Frontend</SelectItem>
                  <SelectItem value="gateway">Gateway</SelectItem>
                  <SelectItem value="worker">Worker</SelectItem>
                  <SelectItem value="storage">Storage</SelectItem>
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

          {/* Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={formData.metadata?.port || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  metadata: { ...formData.metadata, port: parseInt(e.target.value) || undefined }
                })}
                placeholder="8080"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="replicas">Replicas</Label>
              <Input
                id="replicas"
                type="number"
                value={formData.metadata?.replicas || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  metadata: { ...formData.metadata, replicas: parseInt(e.target.value) || undefined }
                })}
                placeholder="3"
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
              {isLoading ? 'Saving...' : (isEditing ? 'Update Component' : 'Create Component')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}