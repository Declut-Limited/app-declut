import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationSettingsApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
import type { NotificationSettings, UpdateNotificationSettingsPayload } from '@/api/types';

// STATIC: only this device's own toggles (below) ever change it, and they already update the
// cache directly (optimistically, then with the server's own response) — no other-actor path.
export function useMyNotificationSettings(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notificationSettings.mine(userId ?? ''),
    queryFn: () => notificationSettingsApi.getMyNotificationSettings(userId as string),
    enabled: !!userId,
    staleTime: STALE_TIME.STATIC,
  });
}

/** Optimistic — the toggle flips immediately and rolls back on failure. Same behavior as the
 *  screen's old hand-rolled version, just expressed as useMutation's onMutate/onError/onSettled
 *  instead of a manual "snapshot previous, setState, catch, revert" block. */
export function useUpdateNotificationSettingsMutation(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.notificationSettings.mine(userId ?? '');

  return useMutation({
    mutationFn: (payload: UpdateNotificationSettingsPayload) => notificationSettingsApi.updateMyNotificationSettings(userId as string, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationSettings>(queryKey);
      if (previous) {
        queryClient.setQueryData<NotificationSettings>(queryKey, {
          ...previous,
          ...payload,
          channels: payload.channels ? { ...previous.channels, ...payload.channels } : previous.channels,
        });
      }
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
    },
  });
}
