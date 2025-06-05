import { useState } from "react"

interface ApiCallConfig<T> {
  apiFunction: () => Promise<T>;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useApiCall<T>({ apiFunction, onSuccess, onError }: ApiCallConfig<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction();
      setData(result);
      onSuccess?.(result);
      return result;  // Add this line
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      onError?.(err as Error);
      throw err;  // Re-throw to maintain error handling in Promise.all
    } finally {
      setLoading(false);
    }
  }; 
  
  return { data, loading, error, execute };
}