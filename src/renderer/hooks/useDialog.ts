import { useState, useCallback } from 'react';

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

  // Show alert dialog
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

  // Show confirm dialog
  const showConfirm = useCallback(({
    title,
    message,
    variant = 'default',
    confirmText,
    cancelText,
    onConfirm
  }: {
    title?: string;
    message: string;
    variant?: 'default' | 'destructive';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
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

  // Close alert
  const closeAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Close confirm
  const closeConfirm = useCallback(() => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Handle confirm action
  const handleConfirm = useCallback(() => {
    if (confirmState.onConfirm) {
      confirmState.onConfirm();
    }
    closeConfirm();
  }, [confirmState.onConfirm, closeConfirm]);

  return {
    // Alert
    alertState,
    showAlert,
    closeAlert,
    
    // Confirm
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm
  };
};