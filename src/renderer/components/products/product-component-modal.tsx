"use client"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/renderer/components/ui/dialog"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Textarea } from "@/renderer/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/renderer/components/ui/select"
import { Badge } from "@/renderer/components/ui/badge"
import { X } from "lucide-react"
import { ProductComponent, createNewProductComponent, validateProductComponent } from "@/shared/types/product-component"
import { typography } from "@/renderer/lib/typography"

interface ProductComponentModalProps {
  isOpen: boolean
  onClose: () => void
  component?: ProductComponent | null
  parentProduct: string
  onSave: (component: ProductComponent) => void
}

/**
 * Modal for adding or editing product components
 * Based on existing modal patterns in the codebase
 */
export function ProductComponentModal({
  isOpen,
  onClose,
  component,
  parentProduct,
  onSave
}: ProductComponentModalProps) {
  const [formData, setFormData] = useState<Partial<ProductComponent>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  const isEditing = !!component

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (component) {
        setFormData(component)
        setTags(component.metadata?.tags || [])
      } else {
        setFormData({ parentProduct })
        setTags([])
      }
      setErrors([])
      setNewTag('')
    }
  }, [isOpen, component, parentProduct])

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrors([])

    try {
      // Validate form data
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

      // Create or update component
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className={typography.tile.title}>
            {isEditing ? 'Edit Component' : 'Add New Component'}
          </DialogTitle>
          <p className={typography.card.subtitle}>
            Parent Product: {parentProduct}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Component Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., cai-frontend"
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
                placeholder="e.g., CAI Frontend"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                value={formData.owner || ''}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                placeholder="e.g., Frontend Team"
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
                  <SelectItem value="job">Job/Worker</SelectItem>
                  <SelectItem value="gateway">Gateway</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
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
              <Button type="button" onClick={handleAddTag} variant="outline">
                Add
              </Button>
            </div>
          </div>

          {/* GitOps Configuration */}
          <div className="space-y-4">
            <Label className={typography.card.title}>GitOps Configuration</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="repositoryUrl">Repository URL</Label>
                <Input
                  id="repositoryUrl"
                  value={formData.metadata?.gitOps?.repositoryUrl || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    metadata: {
                      ...formData.metadata,
                      gitOps: {
                        ...formData.metadata?.gitOps,
                        repositoryUrl: e.target.value
                      }
                    }
                  })}
                  placeholder="https://github.com/org/component-repo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultBranch">Default Branch</Label>
                <Input
                  id="defaultBranch"
                  value={formData.metadata?.gitOps?.defaultBranch || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    metadata: {
                      ...formData.metadata,
                      gitOps: {
                        ...formData.metadata?.gitOps,
                        defaultBranch: e.target.value
                      }
                    }
                  })}
                  placeholder="main"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (isEditing ? 'Update Component' : 'Create Component')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}