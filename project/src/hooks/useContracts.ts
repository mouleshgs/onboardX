import { useState, useEffect, useCallback } from 'react';
import type { Contract } from '../types';

export function useContracts(vendorEmail: string) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    if (!vendorEmail) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({ vendorEmail });
      const api = (await import('../api')).default;
      const response = await api.getVendorContracts(params.toString());
      
      if (!response.ok) {
        throw new Error('Failed to fetch contracts');
      }
      
      const data = await response.json();
      setContracts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [vendorEmail]);

  useEffect(() => {
    // fetch once on mount; callers can use the returned refetch to manually reload
    fetchContracts();
    return () => { /* no interval to clear */ };
  }, [fetchContracts]);

  return {
    contracts,
    loading,
    error,
    refetch: fetchContracts
  };
}