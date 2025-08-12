"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X, Info, AlertTriangle, AlertCircle, CheckCircle, Copy, Check } from 'lucide-react'
import { Button } from './button'
import { typography } from "@/renderer/lib/typography"

import { cn } from "@/lib/utils"

// Original shadcn/ui Alert components
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  ),
)
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  ),
)
AlertDescription.displayName = "AlertDescription"

// Modal Alert Dialog Component
interface ModalAlertProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  variant?: 'info' | 'warning' | 'error' | 'success';
}

/**
 * Premium Modal Alert component with advanced styling and micro-interactions
 * Features copy functionality, enhanced animations, and professional design
 */
export const ModalAlert: React.FC<ModalAlertProps> = ({
  isOpen,
  title,
  message,
  onClose,
  variant = 'info'
}) => {
  const [copied, setCopied] = React.useState(false)
  const [isClosing, setIsClosing] = React.useState(false)

  if (!isOpen && !isClosing) return null;

  /**
   * Get variant-specific styling configuration
   */
  const getVariantConfig = (variant: string) => {
    switch (variant) {
      case 'error':
        return {
          icon: AlertCircle,
          iconColor: 'text-red-500',
          iconBg: 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/50 dark:to-red-800/50',
          titleColor: 'text-red-900 dark:text-red-100',
          messageColor: 'text-red-800/90 dark:text-red-200/90',
          borderColor: 'border-red-200/60 dark:border-red-800/60',
          bgColor: 'bg-gradient-to-br from-red-50/80 to-red-100/40 dark:from-red-950/60 dark:to-red-900/30',
          buttonVariant: 'destructive' as const,
          glowColor: 'shadow-red-500/20'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: 'text-amber-600',
          iconBg: 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/50 dark:to-amber-800/50',
          titleColor: 'text-amber-900 dark:text-amber-100',
          messageColor: 'text-amber-800/90 dark:text-amber-200/90',
          borderColor: 'border-amber-200/60 dark:border-amber-800/60',
          bgColor: 'bg-gradient-to-br from-amber-50/80 to-amber-100/40 dark:from-amber-950/60 dark:to-amber-900/30',
          buttonVariant: 'default' as const,
          glowColor: 'shadow-amber-500/20'
        };
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: 'text-green-600',
          iconBg: 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/50 dark:to-green-800/50',
          titleColor: 'text-green-900 dark:text-green-100',
          messageColor: 'text-green-800/90 dark:text-green-200/90',
          borderColor: 'border-green-200/60 dark:border-green-800/60',
          bgColor: 'bg-gradient-to-br from-green-50/80 to-green-100/40 dark:from-green-950/60 dark:to-green-900/30',
          buttonVariant: 'default' as const,
          glowColor: 'shadow-green-500/20'
        };
      default: // info
        return {
          icon: Info,
          iconColor: 'text-blue-600',
          iconBg: 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50',
          titleColor: 'text-blue-900 dark:text-blue-100',
          messageColor: 'text-blue-800/90 dark:text-blue-200/90',
          borderColor: 'border-blue-200/60 dark:border-blue-800/60',
          bgColor: 'bg-gradient-to-br from-blue-50/80 to-blue-100/40 dark:from-blue-950/60 dark:to-blue-900/30',
          buttonVariant: 'default' as const,
          glowColor: 'shadow-blue-500/20'
        };
    }
  };

  const config = getVariantConfig(variant);
  const IconComponent = config.icon;

  /**
   * Handle copying error message to clipboard
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  /**
   * Handle dialog close with animation
   */
  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  return (
    <div className={cn(
      "fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4",
      "transition-all duration-300 ease-out",
      isClosing ? "opacity-0" : "opacity-100"
    )}>
      <div className={cn(
        "bg-background/95 backdrop-blur-sm rounded-2xl border-2 max-w-lg w-full mx-4 overflow-hidden",
        "shadow-2xl transition-all duration-300 ease-out transform",
        config.borderColor,
        config.glowColor,
        isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100 animate-in fade-in-0 zoom-in-95"
      )}>
        {/* Enhanced Header with gradient background */}
        <div className={cn(
          "relative px-6 py-5 border-b backdrop-blur-sm",
          config.bgColor,
          config.borderColor
        )}>
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)] pointer-events-none" />
          
          <div className="relative flex items-start gap-4">
            {/* Enhanced icon with gradient background and subtle animation */}
            <div className={cn(
              "flex-shrink-0 p-3 rounded-xl border transition-all duration-300 hover:scale-105",
              config.iconBg,
              "border-white/20 shadow-lg"
            )}>
              <IconComponent className={cn("h-6 w-6 transition-colors duration-300", config.iconColor)} />
            </div>
            
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className={cn(
                  typography.utils.heading,
                  "text-xl mb-2 leading-tight",
                  config.titleColor
                )}>
                  {title}
                </h3>
              )}
              <div className={cn(
                typography.utils.body,
                "leading-relaxed",
                config.messageColor
              )}>
                <pre className="whitespace-pre-wrap font-sans break-words">
                  {message}
                </pre>
              </div>
            </div>
            
            {/* Enhanced close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="flex-shrink-0 h-9 w-9 p-0 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-105"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Enhanced Footer with better button layout */}
        <div className="px-6 py-5 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            {/* Copy button for error messages */}
            {variant === 'error' && (
              <Button 
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className={cn(
                  "transition-all duration-200 hover:scale-105",
                  copied ? "bg-green-50 border-green-200 text-green-700" : ""
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Error
                  </>
                )}
              </Button>
            )}
            
            <div className="flex-1" />
            
            {/* Enhanced primary button */}
            <Button 
              onClick={handleClose} 
              variant={config.buttonVariant}
              className="min-w-[100px] transition-all duration-200 hover:scale-105 shadow-lg"
            >
              OK
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Alert, AlertTitle, AlertDescription }
