import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { useState, useEffect } from "react";

interface UseOfflineQueryOptions<TData> {
  queryKey: unknown[];
  queryFn: () => Promise<TData>;
  offlineFn: () => Promise<TData>;
  enabled?: boolean;
}

/**
 * Hook that tries fetching from server (React Query) and falls back to Dexie when offline or on error.
 * Returns `isOfflineData` flag to show visual indicator.
 */
export function useOfflineQuery<TData>({
  queryKey,
  queryFn,
  offlineFn,
  enabled = true,
}: UseOfflineQueryOptions<TData>) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<TData | undefined>(undefined);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineRefetchKey, setOfflineRefetchKey] = useState(0);

  const refetchOffline = () => setOfflineRefetchKey(prev => prev + 1);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const query = useQuery<TData>({
    queryKey,
    queryFn,
    enabled: enabled && isOnline,
    retry: 1,
    staleTime: 30000,
  });

  const shouldFallback = enabled && (!isOnline || (query.isError && !query.isLoading));

  // When offline or query fails, load from Dexie
  useEffect(() => {
    if (shouldFallback) {
      setOfflineLoading(true);
      offlineFn()
        .then((data) => {
          setOfflineData(data);
          setIsOfflineData(true);
        })
        .catch((err) => {
          console.error("Offline fallback error:", err);
        })
        .finally(() => {
          setOfflineLoading(false);
        });
    } else if (isOnline && query.data !== undefined) {
      setIsOfflineData(false);
    }
  }, [isOnline, query.isError, query.isLoading, enabled, offlineRefetchKey]);

  // If online and query succeeded, use that data
  if (isOnline && query.data !== undefined && !query.isError) {
    return {
      data: query.data,
      isLoading: query.isLoading,
      isOfflineData: false,
      isOnline,
      refetchOffline,
    };
  }

  // Otherwise use offline data
  return {
    data: offlineData,
    isLoading: offlineLoading || (shouldFallback && offlineData === undefined) || (isOnline && query.isLoading),
    isOfflineData,
    isOnline,
    refetchOffline,
  };
}
