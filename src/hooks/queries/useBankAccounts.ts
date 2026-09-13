import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bankAccountsApi, banksApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
import { useAuth } from '@/contexts/AuthContext';
import type { CreateBankAccountPayload } from '@/api/types';

/** GET /banks — a Paystack passthrough of active Nigerian banks, effectively static for the life
 *  of the app session. paymentInfo.tsx and payoutDetailsModal.tsx both need it; sharing this query
 *  key means only the first of the two to mount actually fetches it. */
export function useBanksList() {
  return useQuery({
    queryKey: queryKeys.banks.list(),
    queryFn: () => banksApi.getBanks(),
    staleTime: STALE_TIME.STATIC,
  });
}

// STATIC: only the signed-in user's own create/update/delete mutations (below) can ever change
// this, and every one of them invalidates or removes it explicitly — there's no other-actor path.
export function useMyBankAccount(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.bankAccounts.mine(userId ?? ''),
    queryFn: () => bankAccountsApi.getMyBankAccount(userId as string),
    enabled: enabled && !!userId,
    staleTime: STALE_TIME.STATIC,
  });
}

/** Every write here also flips User.hasPayoutDetails server-side — refreshUser() picks that up
 *  for the rest of the app (e.g. listingDetailsModal's post-payment payout-setup nudge) alongside
 *  invalidating the bank-account query itself. */
function useInvalidateBankAccount() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  return () => {
    if (user?.id) queryClient.invalidateQueries({ queryKey: queryKeys.bankAccounts.mine(user.id) });
    refreshUser();
  };
}

export function useCreateBankAccountMutation() {
  const invalidate = useInvalidateBankAccount();
  return useMutation({
    mutationFn: (payload: CreateBankAccountPayload) => bankAccountsApi.createBankAccount(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateBankAccountMutation() {
  const invalidate = useInvalidateBankAccount();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateBankAccountPayload }) => bankAccountsApi.updateBankAccount(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteBankAccountMutation() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  return useMutation({
    mutationFn: (id: string) => bankAccountsApi.deleteBankAccount(id),
    onSuccess: () => {
      // Removed outright rather than just invalidated: refreshUser() below flips
      // hasPayoutDetails to false, which disables useMyBankAccount's query — a disabled query
      // keeps whatever it last cached, so an invalidate alone could leave the deleted account
      // rendering until something re-enables and refetches it.
      if (user?.id) queryClient.removeQueries({ queryKey: queryKeys.bankAccounts.mine(user.id) });
      refreshUser();
    },
  });
}
