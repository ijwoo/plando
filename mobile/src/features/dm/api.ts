import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

export type DmRoom = Schemas['DmRoomResponse'];
export type DmMessage = Schemas['DmMessageResponse'];

export async function getRooms(): Promise<DmRoom[]> {
  const { data } = await api.get<DmRoom[]>('/api/dm/rooms');
  return data;
}

/** 1:1 방 가져오기/생성 (X-Workspace-Id는 인터셉터가 주입) */
export async function getOrCreateRoom(partnerId: number): Promise<DmRoom> {
  const { data } = await api.post<DmRoom>('/api/dm/rooms', { partnerId });
  return data;
}

/** 그룹 방 생성 */
export async function createGroupRoom(groupName: string, memberIds: number[]): Promise<DmRoom> {
  const { data } = await api.post<DmRoom>('/api/dm/rooms/group', { groupName, memberIds });
  return data;
}

/** 최신 `size`개 메시지(선택적으로 `before` 이전), 오래된→최신 순으로 정렬해 반환 */
export async function getMessages(roomId: number, before?: number, size = 30): Promise<DmMessage[]> {
  const { data } = await api.get<DmMessage[]>(`/api/dm/rooms/${roomId}/messages`, {
    params: { before, size },
  });
  return [...data].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function sendMessage(roomId: number, content: string, replyToId?: number, linkedTodoId?: number): Promise<DmMessage> {
  const { data } = await api.post<DmMessage>(`/api/dm/rooms/${roomId}/messages`, { content, replyToId, linkedTodoId });
  return data;
}

/** 1:1 방 상대 프로필 — 최근 활동 + 서버가 집계한 공유 파일/일정(전체 히스토리 기준) */
export type DmPartnerProfile = Schemas['DmPartnerProfileResponse'];

export async function getPartnerProfile(roomId: number): Promise<DmPartnerProfile> {
  const { data } = await api.get<DmPartnerProfile>(`/api/dm/rooms/${roomId}/partner-profile`);
  return data;
}

/** AI 할 일 제안 — 신규 엔드포인트라 생성 스키마에 아직 없음 (백엔드 DmTodoSuggestionResponse 미러) */
export type DmTodoSuggestion = {
  id: number;
  roomId: number;
  messageId: number;
  title: string;
  dueDate?: string | null; // YYYY-MM-DD
  dueTime?: string | null; // HH:mm
  ownerEmail?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED';
};

export async function getSuggestions(roomId: number): Promise<DmTodoSuggestion[]> {
  const { data } = await api.get<DmTodoSuggestion[]>(`/api/dm/rooms/${roomId}/suggestions`);
  return data;
}

/** 수락 — 클라이언트가 만든 todoId를 원본 메시지에 연결. 갱신된 메시지를 돌려준다 */
export async function acceptSuggestion(id: number, todoId: number): Promise<DmMessage> {
  const { data } = await api.post<DmMessage>(`/api/dm/suggestions/${id}/accept`, { todoId });
  return data;
}

export async function dismissSuggestion(id: number): Promise<void> {
  await api.post(`/api/dm/suggestions/${id}/dismiss`);
}

/** 내 방들의 대기 제안 수 {roomId: count} — 방 목록 ✨ 뱃지용 */
export async function getPendingSuggestionCounts(): Promise<Record<string, number>> {
  const { data } = await api.get<Record<string, number>>('/api/dm/suggestions/pending-counts');
  return data;
}

/** 긴 메시지에서 할 일 후보 일괄 추출 (비영속) */
export type ExtractedTodo = { title: string; dueDate?: string | null; dueTime?: string | null };
export async function extractTodos(roomId: number, messageId: number): Promise<ExtractedTodo[]> {
  const { data } = await api.post<ExtractedTodo[]>(`/api/dm/rooms/${roomId}/messages/${messageId}/extract`);
  return data;
}

/** URL 언퍼링(제목·설명·이미지) — 메시지 속 링크 미리보기 카드용 */
export type LinkPreview = Schemas['LinkPreviewResponse'];

export async function getLinkPreview(url: string): Promise<LinkPreview> {
  const { data } = await api.get<LinkPreview>('/api/link-preview', { params: { url } });
  return data;
}

/** 그룹 방에 멤버 초대 */
export async function inviteToGroup(roomId: number, memberIds: number[]): Promise<DmRoom> {
  const { data } = await api.post<DmRoom>(`/api/dm/rooms/${roomId}/invite`, { memberIds });
  return data;
}

/** 방 내 메시지 검색 */
export async function searchInRoom(roomId: number, q: string): Promise<DmMessage[]> {
  const { data } = await api.get<DmMessage[]>(`/api/dm/rooms/${roomId}/search`, { params: { q } });
  return data;
}

/** 공지 등록/해제 (pinned) */
export async function setNotice(roomId: number, messageId: number, pinned: boolean): Promise<DmMessage> {
  const { data } = await api.patch<DmMessage>(
    `/api/dm/rooms/${roomId}/messages/${messageId}/notice`,
    { pinned },
  );
  return data;
}

export async function markRead(roomId: number): Promise<void> {
  await api.post(`/api/dm/rooms/${roomId}/read`);
}

/** 파일/이미지 전송 (multipart). RN FormData 파일 형식 {uri,name,type}. */
export async function sendFile(
  roomId: number,
  file: { uri: string; name: string; type: string },
  content?: string,
): Promise<DmMessage> {
  const form = new FormData();
  // RN에서 파일 append는 {uri,name,type} 객체
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  if (content) form.append('content', content);
  const { data } = await api.post<DmMessage>(`/api/dm/rooms/${roomId}/send-file`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function editMessage(roomId: number, messageId: number, content: string): Promise<DmMessage> {
  const { data } = await api.patch<DmMessage>(`/api/dm/rooms/${roomId}/messages/${messageId}`, { content });
  return data;
}

export async function deleteMessage(roomId: number, messageId: number): Promise<void> {
  await api.delete(`/api/dm/rooms/${roomId}/messages/${messageId}`);
}

export async function toggleReaction(roomId: number, messageId: number, emoji: string): Promise<DmMessage> {
  const { data } = await api.post<DmMessage>(
    `/api/dm/rooms/${roomId}/messages/${messageId}/reactions`,
    { emoji },
  );
  return data;
}
