import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSubgraphOptions {
  skip?: boolean;
  pollInterval?: number;
}

export interface UseSubgraphResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const CACHE_TTL = 30000; // 30 seconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry<any>>();

export function useSubgraph<T>(
  queryFn: () => Promise<T>,
  cacheKey: string,
  options: UseSubgraphOptions = {}
): UseSubgraphResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState<Error | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (options.skip) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const cached = queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setData(cached.data);
        setLoading(false);
        return;
      }

      // Fetch fresh data
      const result = await queryFn();
      queryCache.set(cacheKey, { data: result, timestamp: Date.now() });
      setData(result);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setLoading(false);
    }
  }, [queryFn, cacheKey, options.skip]);

  useEffect(() => {
    fetchData();

    // Set up polling if interval is specified
    if (options.pollInterval && options.pollInterval > 0) {
      pollIntervalRef.current = setInterval(fetchData, options.pollInterval);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchData, options.pollInterval]);

  const refetch = useCallback(async () => {
    queryCache.delete(cacheKey);
    await fetchData();
  }, [cacheKey, fetchData]);

  return { data, loading, error, refetch };
}
