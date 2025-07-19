import { useState, useCallback } from 'react';
import { ModalAlert } from '@/renderer/components/ui/alert';
import { Confirm } from '@/renderer/components/ui/Confirm';

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
 * Custom hook for managing alert and confirm dialogs
 * Provides a clean API to replace native browser dialogs
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
   * Handle confirm action - executes callback and closes dialog
   */
  const handleConfirm = useCallback(() => {
    if (confirmState.onConfirm) {
      confirmState.onConfirm();
    }
    closeConfirm();
  }, [confirmState.onConfirm, closeConfirm]);

  /**
   * Alert Dialog Component
   */
  const AlertDialog = useCallback(() => (
    <ModalAlert 
      isOpen={alertState.isOpen}
      title={alertState.title}
      message={alertState.message}
      variant={alertState.variant}
      onClose={closeAlert}
    />
  ), [alertState, closeAlert]);

  /**
   * Confirm Dialog Component
   */
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
    // Alert functionality
    alertState,
    showAlert,
    closeAlert,
    
    // Confirm functionality
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
    
    // Dialog Components
    AlertDialog,
    ConfirmDialog
  };
};