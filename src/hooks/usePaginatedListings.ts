import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { extractErrorMessage } from '@/api/client';
import type { Listing, PaginatedResponse } from '@/api/types';

const PAGE_LIMIT = 20;

type FetchPage = (params: { page: number; limit: number }) => Promise<PaginatedResponse<Listing>>;
type LoadMode = 'initial' | 'refresh' | 'more';


export function usePaginatedListings(fetchPage: FetchPage, enabled = true, resetKey?: string | number) {
  const [items, setItems] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always call the latest closure (e.g. once device location resolves) without re-running the effect below.
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const load = useCallback(async (targetPage: number, mode: LoadMode) => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'more') setLoadingMore(true);
    setError(null);

    try {
      const result = await fetchPageRef.current({ page: targetPage, limit: PAGE_LIMIT });
      const nextItems = result.results ?? [];
      setItems((prev) => (mode === 'more' ? [...prev, ...nextItems] : nextItems));
      setPage(targetPage);
      setTotal(result.total ?? null);
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not load listings.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useLayoutEffect(() => {
    if (!enabled) return;
    load(1, 'initial');
  }, [enabled, resetKey, load]);

  const hasMore = total === null ? true : items.length < total;

  function loadMore() {
    if (loading || loadingMore || refreshing || !hasMore) return;
    load(page + 1, 'more');
  }

  function refresh() {
    load(1, 'refresh');
  }

  return { items, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh };
}
