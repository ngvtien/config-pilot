import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApiCall } from '../../../../src/renderer/hooks/use-api-call';

describe('useApiCall', () => {
  it('should handle successful API calls', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue({ data: 'test' });
    
    const { result } = renderHook(() => useApiCall({ 
      apiFunction: mockApiFunction 
    }));
    
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    
    await act(async () => {
      await result.current.execute();
    });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ data: 'test' });
    });
    
    expect(mockApiFunction).toHaveBeenCalledTimes(1);
  });

  it('should handle API call errors', async () => {
    const mockApiFunction = vi.fn().mockRejectedValue(new Error('API Error'));
    
    const { result } = renderHook(() => useApiCall({ 
      apiFunction: mockApiFunction 
    }));
    
    await act(async () => {
      try {
        await result.current.execute();
      } catch (error) {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toEqual(new Error('API Error'));
    });
  });

  it('should set loading state correctly during execution', async () => {
    const mockApiFunction = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: 'test' }), 100))
    );
    
    const { result } = renderHook(() => useApiCall({ 
      apiFunction: mockApiFunction 
    }));
    
    expect(result.current.loading).toBe(false);
    
    // Start the execution and immediately check loading state
    let executePromise;
    await act(async () => {
      executePromise = result.current.execute();
    });
    
    // Wait for loading state to be set to true
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });
    
    // Wait for execution to complete
    await act(async () => {
      await executePromise;
    });
    
    // Verify loading is false after completion
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should call success callback on successful execution', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue({ data: 'test' });
    const mockOnSuccess = vi.fn();
    
    const { result } = renderHook(() => useApiCall({ 
      apiFunction: mockApiFunction,
      onSuccess: mockOnSuccess
    }));
    
    await act(async () => {
      await result.current.execute();
    });
    
    expect(mockOnSuccess).toHaveBeenCalledWith({ data: 'test' });
  });

  it('should call error callback on failed execution', async () => {
    const mockApiFunction = vi.fn().mockRejectedValue(new Error('API Error'));
    const mockOnError = vi.fn();
    
    const { result } = renderHook(() => useApiCall({ 
      apiFunction: mockApiFunction,
      onError: mockOnError
    }));
    
    await act(async () => {
      try {
        await result.current.execute();
      } catch (error) {
        // Expected to throw
      }
    });
    
    expect(mockOnError).toHaveBeenCalledWith(new Error('API Error'));
  });
});