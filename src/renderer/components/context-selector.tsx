"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Badge } from "@/renderer/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectLabel,
  SelectGroup,
} from "@/renderer/components/ui/select"

import { useDialog } from '@/renderer/hooks/useDialog';
import type { ContextData } from "@/shared/types/context-data"
import type { Customer } from "@/shared/types/customer"
import type { Product } from '@/shared/types/product'

interface ContextSelectorProps {
  context: ContextData
  onContextChange: (context: ContextData) => void
  onNavigateToCustomerManagement?: () => void
  onNavigateToProductManagement?: () => void
}

export function ContextSelector({
  context, onContextChange,
  onNavigateToCustomerManagement,
  onNavigateToProductManagement }
  : ContextSelectorProps) {

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<ContextData>(() => context)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const mountTimeRef = useRef(Date.now())
  const lastContextRef = useRef<ContextData>(context)
  const formDataInitializedRef = useRef(false)
  const isEditingRef = useRef(false)
  const [products, setProducts] = useState<Product[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)

  const {
    showAlert,
    AlertDialog
  } = useDialog();

  useEffect(() => {
    console.log("🔧 ContextSelector mounted with context:", context)
    console.log("🔧 Mount timestamp:", new Date(mountTimeRef.current).toISOString())
  }, [])

  // Keep isEditingRef synchronized with isEditing state
  useEffect(() => {
    isEditingRef.current = isEditing
  }, [isEditing])

  // Debug: Track context prop changes
  useEffect(() => {
    // Skip updates if we're currently editing
    if (isEditing) {
      console.log("⚠️ Skipping formData update - user is editing")
      return
    }

    // Only update if context actually changed
    if (JSON.stringify(context) !== JSON.stringify(lastContextRef.current)) {
      console.log("✅ Updating formData with new context")
      setFormData(context)
      formDataInitializedRef.current = true
      lastContextRef.current = context
    }
  }, [context])


  // Debug: Track formData changes
  useEffect(() => {
    console.log("📝 FormData changed:", formData)
  }, [formData])


  // Load customers when component mounts or when editing starts
  useEffect(() => {
    const loadCustomers = async () => {
      if (!isEditing) return

      setIsLoadingCustomers(true)
      try {
        const response = await window.electronAPI?.customer?.getAllCustomers()
        if (response?.customers) {
          setCustomers(response.customers)
        }
      } catch (error) {
        console.error('Failed to load customers:', error)
      } finally {
        setIsLoadingCustomers(false)
      }
    }

    loadCustomers()
  }, [isEditing])

  useEffect(() => {
    const loadProducts = async () => {
      if (!isEditing) return

      setIsLoadingProducts(true)
      try {
        const response = await window.electronAPI?.product?.getAllProducts()
        if (response?.products) {
          setProducts(response.products)
        }
      } catch (error) {
        console.error('Failed to load products:', error)
      } finally {
        setIsLoadingProducts(false)
      }
    }

    loadProducts()
  }, [isEditing])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    console.log("💾 Submitting context change:", {
      oldContext: context,
      newContext: formData,
      timestamp: new Date().toISOString(),
    })

    // Validate required fields
    const requiredFields = ["environment", "product", "customer", "version"]
    const missingFields = requiredFields.filter((field) => !formData[field as keyof ContextData])

    if (missingFields.length > 0) {
      console.error("❌ Missing required fields:", missingFields)
      showAlert({
        title: "Validation Error",
        message: `Please fill in required fields: ${missingFields.join(", ")}`,
        variant: "error"
      })
      return
    }

    // Validate instance is a valid number
    if (typeof formData.instance !== "number" || formData.instance < 0) {
      console.error("❌ Invalid instance value:", formData.instance)
      showAlert({
        title: "Validation Error",
        message: "Instance must be a valid number",
        variant: "error"
      })
      return
    }

    try {
      onContextChange(formData)
      console.log("✅ Context change callback completed successfully")
      setIsEditing(false)
    } catch (error) {
      console.error("❌ Error in onContextChange callback:", error)
      showAlert({
        title: "Save Error",
        message: "Failed to save context changes",
        variant: "error"
      })
    }
  }


  const handleCancel = () => {
    console.log("🚫 Canceling context edit, reverting to:", context)
    setFormData(context)
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    console.log("✏️ Starting context edit with current context:", context)
    setFormData(context) // Ensure we start with the latest context
    setIsEditing(true)
  }

  const handleFieldChange = (field: keyof ContextData, value: string | number) => {
    // Handle customer management navigation
    if (field === 'customer' && value === '__manage__') {
      if (onNavigateToCustomerManagement) {
        onNavigateToCustomerManagement()
      }
      return
    }

    // Handle product management navigation
    if (field === 'product' && value === '__manage__') {
      if (onNavigateToProductManagement) {
        onNavigateToProductManagement()
      }
      return
    }

    const oldValue = formData[field]
    console.log(`🔧 Field '${field}' changed:`, { from: oldValue, to: value })

    setFormData((prev: any) => {
      const updated = { ...prev, [field]: value }
      console.log("📝 Updated formData:", updated)
      return updated
    })
  }

  const getInstanceDisplay = (instanceValue: number) => {
    switch (instanceValue) {
      case 0:
        return { label: "Single", color: "bg-blue-500" }
      case 1:
        return { label: "First", color: "bg-green-500" }
      case 2:
        return { label: "Second", color: "bg-amber-500" }
      case 3:
        return { label: "Third", color: "bg-orange-500" }
      case 4:
        return { label: "Fourth", color: "bg-red-500" }
      default:
        return { label: "Single", color: "bg-blue-500" }
    }
  }

  if (isEditing) {
    return (
      <>
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          {/* Environment Select */}
          <div className="flex items-center gap-2">
            <Label htmlFor="env" className="text-xs font-medium">
              Environment:
            </Label>
            <Select value={formData.environment} onValueChange={(value: string) => handleFieldChange("environment", value)}>
              <SelectTrigger id="env" className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dev">Development</SelectItem>
                <SelectItem value="sit">System Integration</SelectItem>
                <SelectItem value="uat">User Acceptance</SelectItem>
                <SelectItem value="prod">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Instance Select */}
          <div className="flex items-center gap-2">
            <Label htmlFor="instance" className="text-xs font-medium">
              Instance:
            </Label>
            <Select
              value={formData.instance.toString()}
              onValueChange={(value: any) => handleFieldChange("instance", Number(value))}
            >
              <SelectTrigger id="instance" className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Single</span>
                  </div>
                </SelectItem>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Multiple</SelectLabel>
                  <SelectItem value="1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>First</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <span>Second</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span>Third</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span>Fourth</span>
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Product Select - Updated to use dropdown */}
          <div className="flex items-center gap-2">
            <Label htmlFor="product" className="text-xs font-medium">
              Product:
            </Label>
            <Select
              value={formData.product}
              onValueChange={(value: string) => handleFieldChange("product", value)}
              disabled={isLoadingProducts}
            >
              <SelectTrigger id="product" className="h-8 w-32">
                <SelectValue placeholder={isLoadingProducts ? "Loading..." : "Select product"} />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 && !isLoadingProducts && (
                  <SelectItem value="" disabled>
                    No products available
                  </SelectItem>
                )}
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.name}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${product.metadata?.category === 'frontend' ? 'bg-blue-500' :
                        product.metadata?.category === 'backend' ? 'bg-green-500' :
                          product.metadata?.category === 'database' ? 'bg-purple-500' :
                            product.metadata?.category === 'infrastructure' ? 'bg-orange-500' : 'bg-gray-500'
                        }`}></div>
                      <span>{product.displayName || product.name}</span>
                    </div>
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value="__manage__" className="text-blue-600">
                  <div className="flex items-center gap-2">
                    <span>+ Manage Products</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customer Select - Updated to use dropdown */}
          <div className="flex items-center gap-2">
            <Label htmlFor="customer" className="text-xs font-medium">
              Customer:
            </Label>
            <Select
              value={formData.customer}
              onValueChange={(value: string) => handleFieldChange("customer", value)}
              disabled={isLoadingCustomers}
            >
              <SelectTrigger id="customer" className="h-8 w-32">
                <SelectValue placeholder={isLoadingCustomers ? "Loading..." : "Select customer"} />
              </SelectTrigger>
              <SelectContent>
                {customers.length === 0 && !isLoadingCustomers && (
                  <SelectItem value="" disabled>
                    No customers available
                  </SelectItem>
                )}
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.name}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${customer.metadata?.tier === 'enterprise' ? 'bg-purple-500' :
                        customer.metadata?.tier === 'premium' ? 'bg-gold-500' : 'bg-gray-500'
                        }`}></div>
                      <span>{customer.displayName || customer.name}</span>
                    </div>
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value="__manage__" className="text-blue-600">
                  <div className="flex items-center gap-2">
                    <span>+ Manage Customers</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Version Input */}
          <div className="flex items-center gap-2">
            <Label htmlFor="version" className="text-xs font-medium">
              Version:
            </Label>
            <Input
              id="version"
              type="text"
              value={formData.version}
              onChange={(e: { target: { value: string | number } }) => handleFieldChange("version", e.target.value)}
              className="h-8 w-20"
            />
          </div>

          <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Save
          </Button>
        </form>

        <AlertDialog />
      </>
    )
  }

  const instanceDisplay = getInstanceDisplay(context.instance)

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Environment:</span>
        <Badge variant="secondary">{context.environment}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Instance:</span>
        <Badge variant={context.instance === 0 ? "default" : "outline"} className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${instanceDisplay.color}`}></div>
          {instanceDisplay.label}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Product:</span>
        <Badge variant="outline">{context.product}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Customer:</span>
        <Badge variant="outline">{context.customer}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Version:</span>
        <Badge variant="outline">{context.version}</Badge>
      </div>
      <Button variant="ghost" size="sm" onClick={handleStartEdit}>
        Edit Context
      </Button>
    </div>
  )
}
