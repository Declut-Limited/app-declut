import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ListingSearchParams } from '@/api/types';
import { formatCurrency } from '@/utils/helpers';

export interface SearchFilters {
  categoryId?: string;
  /** Display-only — categoryId is what's sent to the API, this is just so summarizeFilters() doesn't need its own category lookup. */
  categoryName?: string;
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

// Item Condition defaults off (unfiltered) — turning a toggle on explicitly opts into that
// condition. Since itemCondition[...] params are only ever sent when true, "both off" needs no
// special-casing to mean "no restriction" the way "both on" would have.
export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  useMyLocation: false,
  conditionNew: false,
  conditionNeatlyUsed: false,
};

function computeHasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.categoryId !== undefined ||
    filters.useMyLocation ||
    filters.state !== undefined ||
    filters.city !== undefined ||
    filters.area !== undefined ||
    filters.conditionNew ||
    filters.conditionNeatlyUsed ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined
  );
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
    conditionNew: filters.conditionNew || undefined,
    conditionNeatlyUsed: filters.conditionNeatlyUsed || undefined,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    search: keyword.trim() || undefined,
  };
}

/** Short human-readable labels for whatever's currently active — e.g. for a filter-summary row. */
export function summarizeFilters(filters: SearchFilters): string[] {
  const parts: string[] = [];

  if (filters.categoryName) parts.push(filters.categoryName);

  if (filters.useMyLocation) {
    parts.push(filters.searchWithin !== undefined ? `Within ${filters.searchWithin}km` : 'Near you');
  } else if (filters.state || filters.city || filters.area) {
    parts.push([filters.area, filters.city, filters.state].filter(Boolean).join(', '));
  }

  if (filters.conditionNew || filters.conditionNeatlyUsed) {
    const conditions = [filters.conditionNew && 'New', filters.conditionNeatlyUsed && 'Neatly Used'].filter(Boolean);
    if (conditions.length) parts.push(conditions.join(' & '));
  }

  if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
    parts.push(`${formatCurrency(filters.minPrice)} - ${formatCurrency(filters.maxPrice)}`);
  } else if (filters.minPrice !== undefined) {
    parts.push(`From ${formatCurrency(filters.minPrice)}`);
  } else if (filters.maxPrice !== undefined) {
    parts.push(`Up to ${formatCurrency(filters.maxPrice)}`);
  }

  return parts;
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
