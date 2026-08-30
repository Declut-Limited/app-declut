import { useCallback, useEffect, useRef, useState } from 'react';
import { extractErrorMessage } from '@/api/client';
import type { Listing, PaginatedResponse } from '@/api/types';

const PAGE_LIMIT = 20;

type FetchPage = (params: { page: number; limit: number }) => Promise<PaginatedResponse<Listing>>;
type LoadMode = 'initial' | 'refresh' | 'more';

/**
 * Drives a paginated, infinite-scroll listing screen: initial load, pull-to-refresh, and
 * load-more-on-scroll, all backed by a single `page`/`limit` fetch function.
 *
 * `enabled` gates the initial load for screens that need to resolve something (e.g. device
 * location) before the first fetch can run — flipping it to true triggers that first load.
 */
export function usePaginatedListings(fetchPage: FetchPage, enabled = true) {
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

  useEffect(() => {
    if (!enabled) return;
    load(1, 'initial');
  }, [enabled, load]);

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
