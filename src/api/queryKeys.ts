import type {
  ListingSearchParams,
  MyListingsStatusFilter,
  NearbyListingsParams,
  PurchaseStatusFilter,
} from './types';

type NearbyKeyParams = Pick<NearbyListingsParams, 'lat' | 'lng' | 'radiusKm'>;

/**
 * Single source of truth for every React Query key in the app — so a mutation's invalidation and
 * a screen's query always agree on how a list/detail is identified. `lists()` is a shared prefix
 * over every public listing list (mine/nearby/new/search); invalidating it is how a
 * create/pause/resume/delete tells every screen that could show that listing to refetch.
 *
 * Naming rule: any key backing a useInfiniteQuery includes an explicit 'infinite' segment, and any
 * plain useQuery reading the same underlying endpoint gets its own distinct segment (e.g.
 * 'teaser', 'lookup'). React Query v5 does not allow a useQuery and a useInfiniteQuery to share one
 * key — they cache different shapes ({@link PaginatedResponse} vs a `{pages, pageParams}` object).
 */
export const queryKeys = {
  listings: {
    all: ['listings'] as const,
    lists: () => [...queryKeys.listings.all, 'list'] as const,
    // Prefix over every status-filtered mineInfinite() variant — GET /listings/mine is the only
    // list endpoint that includes the caller's own listings (nearby/new/search all explicitly
    // exclude them, per the Postman collection), so it's the only one worth invalidating on create.
    mine: () => [...queryKeys.listings.lists(), 'mine'] as const,
    mineInfinite: (status: MyListingsStatusFilter | 'all') => [...queryKeys.listings.mine(), 'infinite', status] as const,
    nearbyTeaser: (params: NearbyKeyParams) => [...queryKeys.listings.lists(), 'nearby', 'teaser', params] as const,
    nearbyInfinite: (params: NearbyKeyParams) => [...queryKeys.listings.lists(), 'nearby', 'infinite', params] as const,
    newTeaser: () => [...queryKeys.listings.lists(), 'new', 'teaser'] as const,
    newInfinite: () => [...queryKeys.listings.lists(), 'new', 'infinite'] as const,
    searchInfinite: (params: ListingSearchParams) => [...queryKeys.listings.lists(), 'search', 'infinite', params] as const,
    details: () => [...queryKeys.listings.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.listings.details(), id] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    purchasesInfinite: (filter: PurchaseStatusFilter) => [...queryKeys.transactions.all, 'purchases', 'infinite', filter] as const,
    // Page-1/limit-50 lookup used by listingDetailsModal to find the buyer's own transaction for a
    // listing — distinct key from purchasesInfinite (History's list) even though both ultimately
    // read the same GET /transactions/purchases endpoint; see the naming rule above.
    purchasesLookup: (filter: PurchaseStatusFilter) => [...queryKeys.transactions.all, 'purchases', 'lookup', filter] as const,
    // Seller-side equivalent (GET /transactions, not /transactions/purchases) — myListingDetailsModal.
    myTransactionsLookup: () => [...queryKeys.transactions.all, 'mine', 'lookup'] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    forListing: (listingId: string) => [...queryKeys.reviews.all, 'listing', listingId] as const,
  },
  categories: {
    all: ['categories'] as const,
    listInfinite: () => [...queryKeys.categories.all, 'list', 'infinite'] as const,
  },
  banks: {
    all: ['banks'] as const,
    list: () => [...queryKeys.banks.all, 'list'] as const,
  },
  bankAccounts: {
    all: ['bankAccounts'] as const,
    mine: (userId: string) => [...queryKeys.bankAccounts.all, 'mine', userId] as const,
  },
  notificationSettings: {
    all: ['notificationSettings'] as const,
    mine: (userId: string) => [...queryKeys.notificationSettings.all, 'mine', userId] as const,
  },
  systemSettings: {
    all: ['systemSettings'] as const,
  },
};
