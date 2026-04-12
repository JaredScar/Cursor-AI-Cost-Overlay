import { useState, useEffect, useCallback } from 'react';
import { FALLBACK_PRICING } from '../config/defaults.js';

export function usePricing() {
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch current cached pricing immediately
    window.electronAPI.getPricing().then((data) => {
      if (data) setPricing(data);
      setLoading(false);
    });

    // Subscribe to live updates pushed from main process
    const unsub = window.electronAPI.onPricingUpdate((data) => {
      setPricing(data);
      setLoading(false);
    });

    return unsub;
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    window.electronAPI.refreshPricing();
  }, []);

  return {
    pricing: pricing || FALLBACK_PRICING,
    loading,
    refresh,
    isStale: pricing?.stale === true,
    source: pricing?.source || 'fallback',
    lastUpdated: pricing?.lastUpdated || null,
  };
}
