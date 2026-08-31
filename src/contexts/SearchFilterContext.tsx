import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ListingSearchParams } from '@/api/types';

export interface SearchFilters {
  categoryId?: string;
  useMyLocation: boolean;
  lat?: number;
  lng?: number;
  /** Only meaningful when useMyLocation is true. Omitted = unlimited distance, still proximity-sorted. */
  searchWithin?: number;
  state?: string;
  city?: string;
  area?: string;
  conditionNew: boolean;
  conditionNeatlyUsed: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  useMyLocation: false,
  conditionNew: true,
  conditionNeatlyUsed: true,
};

function computeHasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.categoryId !== undefined ||
    filters.useMyLocation ||
    filters.state !== undefined ||
    filters.city !== undefined ||
    filters.area !== undefined ||
    !filters.conditionNew ||
    !filters.conditionNeatlyUsed ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined
  );
}

/**
 * Both fields default "on" — sending them as itemCondition[new]=true&itemCondition[neatlyUsed]=true
 * would actually *restrict* results to just those two conditions, excluding e.g. "fairly used".
 * Only send them once the user has deviated from the neutral "show everything" default.
 */
function conditionParams(filters: SearchFilters): Pick<ListingSearchParams, 'conditionNew' | 'conditionNeatlyUsed'> {
  const bothDefault = filters.conditionNew && filters.conditionNeatlyUsed;
  if (bothDefault) return {};
  return {
    conditionNew: filters.conditionNew || undefined,
    conditionNeatlyUsed: filters.conditionNeatlyUsed || undefined,
  };
}

/** Maps the shared filter state + the active keyword into the GET /listings query shape. */
export function toListingSearchParams(filters: SearchFilters, keyword: string): Omit<ListingSearchParams, 'page' | 'limit'> {
  return {
    categoryId: filters.categoryId,
    useMyLocation: filters.useMyLocation || undefined,
    lat: filters.useMyLocation ? filters.lat : undefined,
    lng: filters.useMyLocation ? filters.lng : undefined,
    searchWithin: filters.useMyLocation ? filters.searchWithin : undefined,
    state: !filters.useMyLocation ? filters.state : undefined,
    city: !filters.useMyLocation ? filters.city : undefined,
    area: !filters.useMyLocation ? filters.area : undefined,
    ...conditionParams(filters),
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    search: keyword.trim() || undefined,
  };
}

interface SearchFilterContextValue {
  /** The currently active/committed search term — shared so Search and Filter By agree on it. */
  keyword: string;
  setKeyword: (keyword: string) => void;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
}

const SearchFilterContext = createContext<SearchFilterContextValue | null>(null);

export function SearchFilterProvider({ children }: { children: ReactNode }) {
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);

  const value = useMemo<SearchFilterContextValue>(
    () => ({
      keyword,
      setKeyword,
      filters,
      setFilters,
      resetFilters: () => setFilters(DEFAULT_SEARCH_FILTERS),
      hasActiveFilters: computeHasActiveFilters(filters),
    }),
    [keyword, filters]
  );

  return <SearchFilterContext.Provider value={value}>{children}</SearchFilterContext.Provider>;
}

export function useSearchFilter(): SearchFilterContextValue {
  const ctx = useContext(SearchFilterContext);
  if (!ctx) throw new Error('useSearchFilter must be used within a SearchFilterProvider');
  return ctx;
}
