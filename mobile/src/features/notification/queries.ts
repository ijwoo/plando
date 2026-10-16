import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import * as notiApi from './api';
import type { Notification } from './api';

export const notiKeys = {
  list: ['notifications'] as const,
  unread: ['notifications', 'unread-count'] as const,
};

export function useNotifications() {
  // 알림은 X-Workspace-Id 필요 → 워크스페이스 해석 후
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({
    queryKey: notiKeys.list,
    queryFn: notiApi.getNotifications,
    enabled: activeId != null,
  });
}

export function useUnreadCount() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({
    queryKey: notiKeys.unread,
    queryFn: notiApi.getUnreadCount,
    enabled: activeId != null,
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notiApi.markRead(id),
    // 안읽음 점·배지가 탭 즉시 사라지게 낙관 반영
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notiKeys.list });
      const prevList = qc.getQueryData<Notification[]>(notiKeys.list);
      if (prevList) {
        qc.setQueryData<Notification[]>(
          notiKeys.list,
          prevList.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
      }
      const prevUnread = qc.getQueryData<number>(notiKeys.unread);
      if (typeof prevUnread === 'number' && prevUnread > 0) qc.setQueryData(notiKeys.unread, prevUnread - 1);
      return { prevList, prevUnread };
    },
    onError: (_e, _id, snap) => {
      if (snap?.prevList) qc.setQueryData(notiKeys.list, snap.prevList);
      if (typeof snap?.prevUnread === 'number') qc.setQueryData(notiKeys.unread, snap.prevUnread);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notiApi.markAllRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notiKeys.list });
      const prevList = qc.getQueryData<Notification[]>(notiKeys.list);
      if (prevList) qc.setQueryData<Notification[]>(notiKeys.list, prevList.map((n) => ({ ...n, read: true })));
      const prevUnread = qc.getQueryData<number>(notiKeys.unread);
      qc.setQueryData(notiKeys.unread, 0);
      return { prevList, prevUnread };
    },
    onError: (_e, _v, snap) => {
      if (snap?.prevList) qc.setQueryData(notiKeys.list, snap.prevList);
      if (typeof snap?.prevUnread === 'number') qc.setQueryData(notiKeys.unread, snap.prevUnread);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
