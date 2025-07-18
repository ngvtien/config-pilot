"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from './button'

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
 * Modal Alert component to replace native alert() dialogs
 * Uses shadcn/ui design system and prevents React state corruption
 */
export const ModalAlert: React.FC<ModalAlertProps> = ({
  isOpen,
  title,
  message,
  onClose,
  variant = 'info'
}) => {
  if (!isOpen) return null;

  const getVariantConfig = (variant: string) => {
    switch (variant) {
      case 'error':
        return {
          icon: AlertCircle,
          iconColor: 'text-destructive',
          titleColor: 'text-destructive',
          borderColor: 'border-destructive/20',
          bgColor: 'bg-destructive/5'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: 'text-yellow-600',
          titleColor: 'text-yellow-800',
          borderColor: 'border-yellow-200',
          bgColor: 'bg-yellow-50'
        };
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: 'text-green-600',
          titleColor: 'text-green-800',
          borderColor: 'border-green-200',
          bgColor: 'bg-green-50'
        };
      default: // info
        return {
          icon: Info,
          iconColor: 'text-blue-600',
          titleColor: 'text-blue-800',
          borderColor: 'border-blue-200',
          bgColor: 'bg-blue-50'
        };
    }
  };

  const config = getVariantConfig(variant);
  const IconComponent = config.icon;

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={cn(
        "bg-background rounded-lg border shadow-lg p-6 max-w-md w-full mx-4",
        config.borderColor,
        config.bgColor
      )}>
        <div className="flex items-start mb-4">
          <IconComponent className={cn("h-6 w-6 mr-3 mt-0.5 flex-shrink-0", config.iconColor)} />
          <div className="flex-1">
            {title && (
              <h3 className={cn("text-lg font-semibold mb-2", config.titleColor)}>
                {title}
              </h3>
            )}
            <p className="text-muted-foreground whitespace-pre-line">
              {message}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="ml-2 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose} variant="default">
            OK
          </Button>
        </div>
      </div>
    </div>
  );
};

export { Alert, AlertTitle, AlertDescription }