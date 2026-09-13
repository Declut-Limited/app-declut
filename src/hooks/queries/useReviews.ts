import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
import type { LeaveReviewPayload } from '@/api/types';

// STATIC: this is always "my own review of this listing" — nobody but the current viewer can ever
// create it (one buyer→seller review per listing, ever), and useLeaveReviewMutation writes the
// cache directly on success, so there's no other-actor path that could make this go stale.
export function useReviewForListing(listingId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reviews.forListing(listingId ?? ''),
    queryFn: () => reviewsApi.getReviewForListing(listingId as string),
    enabled: enabled && !!listingId,
    staleTime: STALE_TIME.STATIC,
  });
}

export function useLeaveReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeaveReviewPayload) => reviewsApi.leaveReview(payload),
    onSuccess: (review) => {
      queryClient.setQueryData(queryKeys.reviews.forListing(review.listingId), review);
    },
  });
}
