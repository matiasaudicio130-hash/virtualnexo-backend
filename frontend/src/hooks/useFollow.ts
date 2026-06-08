import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { followsApi } from "@/lib/api";

export interface FollowStatus {
  i_follow: boolean;
  follows_me: boolean;
  mutual: boolean;
  request_pending: boolean;
}

const DEFAULT_STATUS: FollowStatus = { i_follow: false, follows_me: false, mutual: false, request_pending: false };

interface Options {
  enabled?: boolean;
  /** true si la cuenta del target es privada — define si "Seguir" crea una solicitud o un follow directo. */
  isPrivateAccount?: boolean;
  /** Notifica cambios de estado (para sincronizar contadores externos, ej. followCounts en ProfileView). */
  onChange?: (next: FollowStatus, prev: FollowStatus) => void;
}

/** Estado de follow de un perfil con mutación optimista (seguir / dejar de seguir / solicitar). */
export function useFollow(userId: string | undefined, { enabled = true, isPrivateAccount = false, onChange }: Options = {}) {
  const qc = useQueryClient();
  const queryKey = ["follow-status", userId] as const;

  const { data, isLoading: isStatusLoading } = useQuery({
    queryKey,
    queryFn: () => followsApi.status(userId!).then(r => r.data as FollowStatus),
    enabled: enabled && !!userId,
  });

  const status = data ?? DEFAULT_STATUS;

  const mutation = useMutation({
    mutationFn: async (): Promise<FollowStatus> => {
      if (status.i_follow) {
        await followsApi.unfollow(userId!);
        return { ...status, i_follow: false, mutual: false, request_pending: false };
      }
      const { data: res } = await followsApi.follow(userId!);
      if (res.requested) return { ...status, i_follow: false, request_pending: true };
      return { ...status, i_follow: true, mutual: status.follows_me, request_pending: false };
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<FollowStatus>(queryKey) ?? status;
      const optimistic: FollowStatus = previous.i_follow
        ? { ...previous, i_follow: false, mutual: false, request_pending: false }
        : isPrivateAccount
          ? { ...previous, request_pending: true }
          : { ...previous, i_follow: true, mutual: previous.follows_me, request_pending: false };
      qc.setQueryData(queryKey, optimistic);
      onChange?.(optimistic, previous);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.previous) return;
      qc.setQueryData(queryKey, ctx.previous);
      onChange?.(ctx.previous, status);
    },
    onSuccess: (result, _vars, ctx) => {
      qc.setQueryData(queryKey, result);
      if (ctx?.previous) onChange?.(result, ctx.previous);
    },
  });

  return {
    status,
    toggle: () => { if (userId && !status.request_pending) mutation.mutate(); },
    isLoading: isStatusLoading || mutation.isPending,
  };
}
