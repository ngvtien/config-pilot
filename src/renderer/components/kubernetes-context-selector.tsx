"use client"

import { useState, useEffect, useRef } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/renderer/components/ui/select"
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { Label } from "@/renderer/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/renderer/components/ui/tooltip"

interface KubernetesContext {
  name: string
  cluster: string
  user: string
  namespace?: string
  active?: boolean
}

interface KubernetesContextSelectorProps {
  onContextChange: (contextName: string) => void
  className?: string
  showLabel?: boolean
  initialContext?: string
}

const KubernetesContextSelector: React.FC<KubernetesContextSelectorProps> = ({
  onContextChange,
  className = "",
  showLabel = true,
  initialContext = "",
}) => {
  const [contexts, setContexts] = useState<KubernetesContext[]>([])
  const [currentContext, setCurrentContext] = useState<string>(initialContext)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isSimulated, setIsSimulated] = useState<boolean>(false)
  const [isTextTruncated, setIsTextTruncated] = useState<boolean>(false)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const loadContexts = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        if (window.electronAPI) {
          const contexts = await window.electronAPI.invoke('k8s:getContexts')
          const currentContext = await window.electronAPI.invoke('k8s:getCurrentContext')
          
          setContexts(contexts)
          setCurrentContext(currentContext || '')
          setIsSimulated(false)
        } else {
          // Fallback for web environment
          setContexts([
            { name: "docker-desktop", cluster: "docker-desktop", user: "docker-desktop" },
            { name: "minikube", cluster: "minikube", user: "minikube" }
          ])
          setCurrentContext("docker-desktop")
          setIsSimulated(true)
        }
      } catch (err) {
        setError("Failed to load Kubernetes contexts")
      } finally {
        setIsLoading(false)
      }
    }

    loadContexts()
  }, [])

  useEffect(() => {
    if (initialContext && initialContext !== currentContext && !isLoading) {
      handleContextChange(initialContext)
    }
  }, [initialContext, isLoading])

  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        setIsTextTruncated(textRef.current.scrollWidth > textRef.current.clientWidth)
      }
    }

    const timeoutId = setTimeout(checkTruncation, 100)
    window.addEventListener("resize", checkTruncation)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("resize", checkTruncation)
    }
  }, [currentContext])

  const handleContextChange = async (contextName: string) => {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.invoke('k8s:switchContext', contextName)
        if (success) {
          setCurrentContext(contextName)
          onContextChange(contextName)
        } else {
          setError(`Failed to switch to context ${contextName}`)
        }
      } else {
        // Simulate success in web environment
        setCurrentContext(contextName)
        onContextChange(contextName)
      }
    } catch (err) {
      setError(`Failed to switch to context ${contextName}`)
    }
  }

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && <Label className="text-sm font-medium">K8s Context:</Label>}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading contexts...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <Alert variant="destructive" className="w-fit">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const SelectComponent = (
    <Select value={currentContext} onValueChange={handleContextChange}>
      <SelectTrigger className={`w-40 h-8 ${isSimulated ? "bg-amber-50 border-amber-200 text-amber-800" : ""}`}>
        <div className="flex items-center w-full overflow-hidden">
          <span ref={textRef} className="truncate text-left">
            {currentContext}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {isSimulated && (
          <div className="px-2 py-1.5 text-xs text-amber-600 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            Simulation Mode
          </div>
        )}
        {contexts.map((context) => (
          <SelectItem key={context.name} value={context.name}>
            <span className="truncate">{context.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && <Label className="text-sm font-medium whitespace-nowrap">K8s Context:</Label>}

        {isTextTruncated ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>{SelectComponent}</div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">{currentContext}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          SelectComponent
        )}
      </div>
    </TooltipProvider>
  )
}

export default KubernetesContextSelector