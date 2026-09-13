import { categoriesApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';

/** Categories are shared, admin-managed reference data fetched by both addItemModal and
 *  filterByModal — same queryKey + STATIC staleTime means opening one after the other in the same
 *  session (or even a later session) reuses the already-loaded pages instead of re-paginating. */
export function useCategories() {
  const { items: categories, loading, loadingMore, error, hasMore, loadMore } = usePaginatedListings(
    queryKeys.categories.listInfinite(),
    ({ page, limit }) => categoriesApi.getAllCategories({ page, limit }),
    true,
    STALE_TIME.STATIC
  );

  return { categories, loading, loadingMore, error, hasMore, loadMore };
}
