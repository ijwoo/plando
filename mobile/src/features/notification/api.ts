import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

export type Notification = Schemas['NotificationResponseDto'];

export async function getNotifications(): Promise<Notification[]> {
  const { data } = await api.get<Notification[]>('/api/notifications');
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<{ unreadCount?: number }>('/api/notifications/unread-count');
  return data.unreadCount ?? 0;
}

/** 팀모집 알림 미읽음 수 — 팀모집 목록 헤더 벨 배지용 */
export async function getRecruitmentUnreadCount(): Promise<number> {
  const { data } = await api.get<{ unreadCount?: number }>('/api/notifications/recruitment/unread-count');
  return data.unreadCount ?? 0;
}

export async function markRead(id: number): Promise<void> {
  await api.patch(`/api/notifications/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await api.patch('/api/notifications/read-all');
}

/** iOS APNs 디바이스 토큰 등록 (백엔드가 Pushy APNs로 발송). */
export async function registerApnsToken(deviceToken: string): Promise<void> {
  await api.post('/api/notifications/push/ios/register', { deviceToken });
}

export async function unregisterApnsToken(deviceToken: string): Promise<void> {
  await api.delete('/api/notifications/push/ios/unregister', { data: { deviceToken } });
}
