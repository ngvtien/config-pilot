"use client"

import * as React from "react"
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './button'
import { cn } from "@/lib/utils"

interface ConfirmProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

/**
 * Modal Confirm component to replace native confirm() dialogs
 * Uses shadcn/ui design system and prevents React state corruption
 */
export const Confirm: React.FC<ConfirmProps> = ({
  isOpen,
  title = 'Confirm Action',
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default'
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg border shadow-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-start mb-4">
          {variant === 'destructive' && (
            <AlertTriangle className="h-6 w-6 text-destructive mr-3 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h3 className={cn(
              "text-lg font-semibold mb-2",
              variant === 'destructive' ? "text-destructive" : "text-foreground"
            )}>
              {title}
            </h3>
            <p className="text-muted-foreground whitespace-pre-line">
              {message}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="ml-2 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-end space-x-2">
          <Button onClick={handleCancel} variant="outline">
            {cancelText}
          </Button>
          <Button 
            onClick={handleConfirm} 
            variant={variant === 'destructive' ? 'destructive' : 'default'}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};