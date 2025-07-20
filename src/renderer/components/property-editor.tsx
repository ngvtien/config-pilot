"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Textarea } from "@/renderer/components/ui/textarea"
import { Label } from "@/renderer/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/renderer/components/ui/select"
import { Badge } from "@/renderer/components/ui/badge"
import { Trash2, Save } from "lucide-react"
import { useDialog } from "@/renderer/hooks/useDialog"

interface PropertyEditorProps {
  propertyId: string
  propertyData: any
  onSave: (propertyId: string, newValue: any) => void
  onDelete?: (propertyId: string) => void
}

export function PropertyEditor({ propertyId, propertyData, onSave, onDelete }: PropertyEditorProps) {
  const [formData, setFormData] = useState({
    type: "string",
    title: "",
    description: "",
    format: "",
    default: "",
    ...propertyData,
  })

  // Initialize useDialog hook
  const { showConfirm, ConfirmDialog } = useDialog()

  useEffect(() => {
    setFormData({
      type: "string",
      title: "",
      description: "",
      format: "",
      default: "",
      ...propertyData,
    })
  }, [propertyData, propertyId])

  /**
   * Handle save operation
   */
  const handleSave = () => {
    onSave(propertyId, formData)
  }

  /**
   * Handle delete operation with confirmation dialog
   */
  const handleDelete = () => {
    if (onDelete) {
      showConfirm({
        title: "Delete Property",
        message: "Are you sure you want to delete this property? This action cannot be undone.",
        variant: "destructive",
        confirmText: "Delete",
        cancelText: "Cancel",
        onConfirm: () => onDelete(propertyId)
      })
    }
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Property Editor</CardTitle>
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline">{propertyId}</Badge>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="property-type">Type</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="integer">Integer</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                  <SelectItem value="array">Array</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="property-title">Title</Label>
              <Input
                id="property-title"
                value={formData.title}
                onChange={(e: { target: { value: any } }) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Property title"
              />
            </div>

            <div>
              <Label htmlFor="property-description">Description</Label>
              <Textarea
                id="property-description"
                value={formData.description}
                onChange={(e: { target: { value: any } }) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Property description"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="property-format">Format</Label>
              <Input
                id="property-format"
                value={formData.format}
                onChange={(e: { target: { value: any } }) => setFormData({ ...formData, format: e.target.value })}
                placeholder="e.g., email, date, uri"
              />
            </div>

            <div>
              <Label htmlFor="property-default">Default Value</Label>
              <Input
                id="property-default"
                value={formData.default}
                onChange={(e: { target: { value: any } }) => setFormData({ ...formData, default: e.target.value })}
                placeholder="Default value"
              />
            </div>

            <Button onClick={handleSave} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Render the confirm dialog */}
      <ConfirmDialog />
    </>
  )
}