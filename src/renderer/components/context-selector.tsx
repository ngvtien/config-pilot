// "use client"

// import type React from "react"
// import { useState, useEffect } from "react"
// import { Button } from "@/renderer/components/ui/button"
// import { Input } from "@/renderer/components/ui/input"
// import { Label } from "@/renderer/components/ui/label"
// import { Badge } from "@/renderer/components/ui/badge"
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
//   SelectSeparator,
//   SelectLabel,
//   SelectGroup,
// } from "@/renderer/components/ui/select"

// import type { ContextData } from "@/shared/types/context-data" // Import ContextData type

// interface ContextSelectorProps {
//   context: ContextData
//   onContextChange: (context: ContextData) => void
// }

// export function ContextSelector({ context, onContextChange }: ContextSelectorProps) {
//   const [isEditing, setIsEditing] = useState(false)
//   const [formData, setFormData] = useState<ContextData>(context)

//   // Update form data when context prop changes
//   useEffect(() => {
//     setFormData(context)
//   }, [context])

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault()
//     onContextChange(formData)
//     console.log("Context changed:", formData)
//     setIsEditing(false)
//   }

//   const handleCancel = () => {
//     setFormData(context)
//     setIsEditing(false)
//   }

//   const getInstanceDisplay = (instanceValue: number) => {
//     switch (instanceValue) {
//       case 0:
//         return { label: "Single", color: "bg-blue-500" }
//       case 1:
//         return { label: "First", color: "bg-green-500" }
//       case 2:
//         return { label: "Second", color: "bg-amber-500" }
//       case 3:
//         return { label: "Third", color: "bg-orange-500" }
//       case 4:
//         return { label: "Fourth", color: "bg-red-500" }
//       default:
//         return { label: "Single", color: "bg-blue-500" }
//     }
//   }

//   if (isEditing) {
//     return (
//       <form onSubmit={handleSubmit} className="flex items-center gap-3">
//         <div className="flex items-center gap-2">
//           <Label htmlFor="env" className="text-xs font-medium">
//             Environment:
//           </Label>
//           <Select
//             value={formData.environment}
//             onValueChange={(value) => {
//               setFormData({ ...formData, environment: value })
//               console.log("Environment changed in context selector to:", value)
//             }}
//           >
//             <SelectTrigger className="h-8 w-32">
//               <SelectValue />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="dev">Development</SelectItem>
//               <SelectItem value="sit">System Integration</SelectItem>
//               <SelectItem value="uat">User Acceptance</SelectItem>
//               <SelectItem value="prod">Production</SelectItem>
//             </SelectContent>
//           </Select>
//         </div>

//         <div className="flex items-center gap-2">
//           <Label htmlFor="instance" className="text-xs font-medium">
//             Instance:
//           </Label>
//           <Select
//             value={formData.instance.toString()}
//             onValueChange={(value) => setFormData({ ...formData, instance: Number.parseInt(value) })}
//           >
//             <SelectTrigger className="h-8 w-40">
//               <SelectValue />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="0">
//                 <div className="flex items-center gap-2">
//                   <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
//                   <span>Single</span>
//                 </div>
//               </SelectItem>

//               <SelectSeparator />

//               <SelectGroup>
//                 <SelectLabel>Multiple</SelectLabel>
//                 <SelectItem value="1">
//                   <div className="flex items-center gap-2">
//                     <div className="w-2 h-2 bg-green-500 rounded-full"></div>
//                     <span>First</span>
//                   </div>
//                 </SelectItem>
//                 <SelectItem value="2">
//                   <div className="flex items-center gap-2">
//                     <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
//                     <span>Second</span>
//                   </div>
//                 </SelectItem>
//                 <SelectItem value="3">
//                   <div className="flex items-center gap-2">
//                     <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
//                     <span>Third</span>
//                   </div>
//                 </SelectItem>
//                 <SelectItem value="4">
//                   <div className="flex items-center gap-2">
//                     <div className="w-2 h-2 bg-red-500 rounded-full"></div>
//                     <span>Fourth</span>
//                   </div>
//                 </SelectItem>
//               </SelectGroup>
//             </SelectContent>
//           </Select>
//         </div>

//         <div className="flex items-center gap-2">
//           <Label htmlFor="product" className="text-xs font-medium">
//             Product:
//           </Label>
//           <Input
//             id="product"
//             type="text"
//             value={formData.product}
//             onChange={(e) => setFormData({ ...formData, product: e.target.value })}
//             className="h-8 w-20"
//           />
//         </div>

//         <div className="flex items-center gap-2">
//           <Label htmlFor="customer" className="text-xs font-medium">
//             Customer:
//           </Label>
//           <Input
//             id="customer"
//             type="text"
//             value={formData.customer}
//             onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
//             className="h-8 w-20"
//           />
//         </div>

//         <div className="flex items-center gap-2">
//           <Label htmlFor="version" className="text-xs font-medium">
//             Version:
//           </Label>
//           <Input
//             id="version"
//             type="text"
//             value={formData.version}
//             onChange={(e) => setFormData({ ...formData, version: e.target.value })}
//             className="h-8 w-20"
//           />
//         </div>

//         <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
//           Cancel
//         </Button>
//         <Button type="submit" size="sm">
//           Save
//         </Button>
//       </form>
//     )
//   }

//   const instanceDisplay = getInstanceDisplay(context.instance)

//   return (
//     <div className="flex items-center gap-4">
//       <div className="flex items-center gap-2">
//         <span className="text-sm font-medium">Environment:</span>
//         <Badge variant="secondary">{context.environment}</Badge>
//       </div>
//       <div className="flex items-center gap-2">
//         <span className="text-sm font-medium">Instance:</span>
//         <Badge variant={context.instance === 0 ? "default" : "outline"} className="flex items-center gap-1">
//           <div className={`w-2 h-2 rounded-full ${instanceDisplay.color}`}></div>
//           {instanceDisplay.label}
//         </Badge>
//       </div>
//       <div className="flex items-center gap-2">
//         <span className="text-sm font-medium">Product:</span>
//         <Badge variant="outline">{context.product}</Badge>
//       </div>
//       <div className="flex items-center gap-2">
//         <span className="text-sm font-medium">Customer:</span>
//         <Badge variant="outline">{context.customer}</Badge>
//       </div>
//       <div className="flex items-center gap-2">
//         <span className="text-sm font-medium">Version:</span>
//         <Badge variant="outline">{context.version}</Badge>
//       </div>
//       <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
//         Edit Context
//       </Button>
//     </div>
//   )
// }

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

import type { ContextData } from "@/shared/types/context-data"

interface ContextSelectorProps {
  context: ContextData
  onContextChange: (context: ContextData) => void
}

export function ContextSelector({ context, onContextChange }: ContextSelectorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<ContextData>(context)
  const mountTimeRef = useRef(Date.now())
  const lastContextRef = useRef<ContextData>(context)
  const formDataInitializedRef = useRef(false)

  // Debug: Log when component mounts
  useEffect(() => {
    console.log("🔧 ContextSelector mounted with context:", context)
    console.log("🔧 Mount timestamp:", new Date(mountTimeRef.current).toISOString())
  }, [])

  // Debug: Track context prop changes
  useEffect(() => {
    const timeSinceMount = Date.now() - mountTimeRef.current
    const contextChanged = JSON.stringify(context) !== JSON.stringify(lastContextRef.current)

    if (contextChanged) {
      console.log("🔄 Context prop changed:", {
        timeSinceMount: `${timeSinceMount}ms`,
        from: lastContextRef.current,
        to: context,
        isEditing,
        formDataInitialized: formDataInitializedRef.current,
      })

      // Only update formData if we're not editing or if this is the initial load
      if (!isEditing || !formDataInitializedRef.current) {
        console.log("✅ Updating formData with new context")
        setFormData(context)
        formDataInitializedRef.current = true
      } else {
        console.log("⚠️ Skipping formData update - user is editing")
      }

      lastContextRef.current = context
    }
  }, [context, isEditing])

  // Debug: Track formData changes
  useEffect(() => {
    console.log("📝 FormData changed:", formData)
  }, [formData])

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
      alert(`Please fill in required fields: ${missingFields.join(", ")}`)
      return
    }

    // Validate instance is a valid number
    if (typeof formData.instance !== "number" || formData.instance < 0) {
      console.error("❌ Invalid instance value:", formData.instance)
      alert("Instance must be a valid number")
      return
    }

    try {
      onContextChange(formData)
      console.log("✅ Context change callback completed successfully")
      setIsEditing(false)
    } catch (error) {
      console.error("❌ Error in onContextChange callback:", error)
      alert("Failed to save context changes")
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
    const oldValue = formData[field]
    console.log(`🔧 Field '${field}' changed:`, { from: oldValue, to: value })

    setFormData((prev) => {
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
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="env" className="text-xs font-medium">
            Environment:
          </Label>
          <Select value={formData.environment} onValueChange={(value) => handleFieldChange("environment", value)}>
            <SelectTrigger className="h-8 w-32">
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

        <div className="flex items-center gap-2">
          <Label htmlFor="instance" className="text-xs font-medium">
            Instance:
          </Label>
          <Select
            value={formData.instance.toString()}
            onValueChange={(value) => handleFieldChange("instance", Number(value))}
          >
            <SelectTrigger className="h-8 w-40">
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

        <div className="flex items-center gap-2">
          <Label htmlFor="product" className="text-xs font-medium">
            Product:
          </Label>
          <Input
            id="product"
            type="text"
            value={formData.product}
            onChange={(e) => handleFieldChange("product", e.target.value)}
            className="h-8 w-20"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="customer" className="text-xs font-medium">
            Customer:
          </Label>
          <Input
            id="customer"
            type="text"
            value={formData.customer}
            onChange={(e) => handleFieldChange("customer", e.target.value)}
            className="h-8 w-20"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="version" className="text-xs font-medium">
            Version:
          </Label>
          <Input
            id="version"
            type="text"
            value={formData.version}
            onChange={(e) => handleFieldChange("version", e.target.value)}
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
