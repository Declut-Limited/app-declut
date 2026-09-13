import { useMutation } from '@tanstack/react-query';
import { usersApi } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import type { UpdateProfilePayload } from '@/api/types';

/** profile.tsx and accountDetails.tsx both patch /users/me (name, or a freshly-uploaded avatar
 *  URL) and then need the rest of the app to see the new value. There's no separate 'me' query
 *  cache to invalidate — AuthContext.user is the single source of truth for the signed-in
 *  profile — so success just re-runs AuthContext's own refreshUser() rather than duplicating its
 *  GET /users/me + KYC-bypass merge logic here. */
export function useUpdateProfileMutation() {
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => usersApi.updateMyProfile(payload),
    onSuccess: () => refreshUser(),
  });
}
