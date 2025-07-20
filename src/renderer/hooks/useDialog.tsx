import { useState, useCallback } from 'react';
import { ModalAlert } from '@/renderer/components/ui/alert';
import { Confirm } from '@/renderer/components/ui/Confirm';
import { toast } from '@/renderer/hooks/use-toast';

interface AlertState {
  isOpen: boolean;
  title?: string;
  message: string;
  variant?: 'info' | 'warning' | 'error' | 'success';
}

interface ConfirmState {
  isOpen: boolean;
  title?: string;
  message: string;
  variant?: 'default' | 'destructive';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

/**
 * Custom hook for managing alert and confirm dialogs with toast notifications
 * Provides a clean API to replace native browser dialogs with modern UX patterns
 */
export const useDialog = () => {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    message: ''
  });

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    message: ''
  });

  /**
   * Show alert dialog with specified configuration
   */
  const showAlert = useCallback(({
    title,
    message,
    variant = 'info'
  }: {
    title?: string;
    message: string;
    variant?: 'info' | 'warning' | 'error' | 'success';
  }) => {
    setAlertState({
      isOpen: true,
      title,
      message,
      variant
    });
  }, []);

  /**
   * Show toast notification for non-critical feedback
   */
  const showToast = useCallback(({
    title,
    description,
    variant = 'default'
  }: {
    title?: string;
    description: string;
    variant?: 'default' | 'destructive';
  }) => {
    toast({
      title,
      description,
      variant
    });
  }, []);

  /**
   * Show success toast - convenience method
   */
  const showSuccessToast = useCallback((message: string, title?: string) => {
    showToast({
      title: title || 'Success',
      description: message,
      variant: 'default'
    });
  }, [showToast]);

  /**
   * Show error toast - convenience method
   */
  const showErrorToast = useCallback((message: string, title?: string) => {
    showToast({
      title: title || 'Error',
      description: message,
      variant: 'destructive'
    });
  }, [showToast]);

  /**
   * Show confirm dialog with specified configuration
   */
  const showConfirm = useCallback(({
    title,
    message,
    variant = 'default',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm
  }: {
    title?: string;
    message: string;
    variant?: 'default' | 'destructive';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      variant,
      confirmText,
      cancelText,
      onConfirm
    });
  }, []);

  /**
   * Close alert dialog
   */
  const closeAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
  }, []);

  /**
   * Close confirm dialog
   */
  const closeConfirm = useCallback(() => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, []);

  /**
   * Handle confirm action and close dialog
   */
  const handleConfirm = useCallback(() => {
    if (confirmState.onConfirm) {
      confirmState.onConfirm();
    }
    closeConfirm();
  }, [confirmState.onConfirm, closeConfirm]);

  // Alert Dialog Component
  const AlertDialog = useCallback(() => (
    <ModalAlert
      isOpen={alertState.isOpen}
      title={alertState.title}
      message={alertState.message}
      variant={alertState.variant}
      onClose={closeAlert}
    />
  ), [alertState, closeAlert]);

  // Confirm Dialog Component
  const ConfirmDialog = useCallback(() => (
    <Confirm
      isOpen={confirmState.isOpen}
      title={confirmState.title}
      message={confirmState.message}
      variant={confirmState.variant}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      onConfirm={handleConfirm}
      onCancel={closeConfirm}
    />
  ), [confirmState, handleConfirm, closeConfirm]);

  return {
    // State
    alertState,
    confirmState,
    
    // Modal Alert Functions
    showAlert,
    closeAlert,
    
    // Toast Functions
    showToast,
    showSuccessToast,
    showErrorToast,
    
    // Confirm Functions
    showConfirm,
    closeConfirm,
    handleConfirm,
    
    // Components
    AlertDialog,
    ConfirmDialog
  };
};