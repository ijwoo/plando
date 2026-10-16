import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import * as dmApi from './api';
import type { DmMessage } from './api';

/** 캐시 전용 로컬 필드 — 전송 중/실패 표시 (서버 스키마엔 없음) */
export type LocalDmMessage = DmMessage & { pending?: boolean; failed?: boolean };

const PAGE_SIZE = 30;

export const dmKeys = {
  rooms: ['dm', 'rooms'] as const,
  messages: (roomId: number) => ['dm', 'messages', roomId] as const,
  suggestions: (roomId: number) => ['dm', 'suggestions', roomId] as const,
};

/** 방별 대기 제안 수 {roomId: count} — DM 목록 ✨ 뱃지 */
export function usePendingSuggestionCounts() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({
    queryKey: ['dm', 'suggestion-counts'],
    queryFn: dmApi.getPendingSuggestionCounts,
    enabled: activeId != null,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

/** 방의 AI 할 일 제안(PENDING) — WS 이벤트로 실시간 갱신 + WS 끊김 대비 주기 폴링 안전망 */
export function useSuggestions(roomId: number) {
  return useQuery({
    queryKey: dmKeys.suggestions(roomId),
    queryFn: () => dmApi.getSuggestions(roomId),
    staleTime: 10_000,
    refetchInterval: 15_000, // 화면이 떠 있는 동안만 — AI 분석(수 초) 완료분을 WS 없이도 수거
  });
}

export function useRooms() {
  // 방 목록은 X-Workspace-Id 헤더가 필수 → 워크스페이스 해석 후에만 요청
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({
    queryKey: dmKeys.rooms,
    queryFn: dmApi.getRooms,
    enabled: activeId != null,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partnerId: number) => dmApi.getOrCreateRoom(partnerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.rooms }),
  });
}

export function useCreateGroupRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupName, memberIds }: { groupName: string; memberIds: number[] }) =>
      dmApi.createGroupRoom(groupName, memberIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: dmKeys.rooms }),
  });
}

export function useMessages(roomId: number) {
  return useQuery({
    queryKey: dmKeys.messages(roomId),
    queryFn: () => dmApi.getMessages(roomId),
  });
}

/**
 * 과거 메시지 로드 — 캐시의 가장 오래된 id를 `before`로 요청해 플랫 배열 앞에 붙인다
 * (웹 useDmChatRoom.loadOlder 미러). useMessages의 캐시 형태(DmMessage[])를 그대로 유지.
 */
export function useLoadOlderMessages(roomId: number) {
  const qc = useQueryClient();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const guardRef = useRef({ loading: false, hasMore: true });

  const loadOlder = useCallback(async () => {
    const g = guardRef.current;
    if (g.loading || !g.hasMore) return;
    const list = qc.getQueryData<DmMessage[]>(dmKeys.messages(roomId)) ?? [];
    const oldestId = list[0]?.id;
    if (oldestId == null) return;
    g.loading = true;
    setLoadingOlder(true);
    try {
      const older = await dmApi.getMessages(roomId, oldestId, PAGE_SIZE);
      if (older.length < PAGE_SIZE) {
        g.hasMore = false;
        setHasMore(false);
      }
      if (older.length) {
        qc.setQueryData<DmMessage[]>(dmKeys.messages(roomId), (old) => {
          const cur = old ?? [];
          const ids = new Set(cur.map((m) => m.id));
          return [...older.filter((m) => !ids.has(m.id)), ...cur];
        });
      }
    } catch {
      // 일시 실패 — 다음 스크롤에서 재시도
    } finally {
      g.loading = false;
      setLoadingOlder(false);
    }
  }, [qc, roomId]);

  return { loadOlder, loadingOlder, hasMore };
}

export function useSearchInRoom(roomId: number, q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ['dm', 'search', roomId, query],
    queryFn: () => dmApi.searchInRoom(roomId, query),
    enabled: query.length > 0,
  });
}

/**
 * 메시지가 어디서 왔는지.
 * - `'rest'`(기본): 내 요청의 응답 — 서버가 **나를 기준으로** enrich했으므로 전부 신뢰한다.
 * - `'socket'`: 방 브로드캐스트 — 서버(DmController)는 REACTION_UPDATED/MESSAGE_UPDATED를
 *   **행동한 사람 기준으로** enrich한 DTO 하나를 방 전체에 그대로 뿌린다. 따라서 보는 사람마다
 *   달라야 하는 필드(myReactions)는 남의 값이 실려 온다.
 */
export type DmMsgSource = 'rest' | 'socket';

/** 뷰어 종속 필드 — 소켓 에코에서는 신뢰할 수 없다 (아래 upsert 주석 참고) */
function stripViewerFields(msg: DmMessage): DmMessage {
  const { myReactions: _drop, ...rest } = msg;
  return rest;
}

/** 방 캐시에 메시지 upsert (id 있으면 교체=편집/반응 반영, 없으면 추가) */
export function useUpsertMessage(roomId: number) {
  const qc = useQueryClient();
  return (msg: DmMessage, source: DmMsgSource = 'rest') => {
    // 소켓 에코의 myReactions는 "리액션을 누른 사람" 기준이다. 그대로 반영하면 A가 누른 칩이
    // B에게도 '내 리액션 — 탭해서 취소'로 보이고, B가 탭하면 취소가 아니라 추가돼 개수가 1→2로
    // 늘었다. 편집(MESSAGE_UPDATED)도 같은 경로라 편집 한 번에 방 전체의 소유 표시가 뒤집혔다.
    // → 소켓에서 온 값은 뷰어 종속 필드를 떼고, 내 로컬 값을 유지한다.
    //   (내가 누른 리액션은 useToggleReaction의 REST 응답이 정확한 값으로 갱신한다)
    const incoming = source === 'socket' ? stripViewerFields(msg) : msg;
    qc.setQueryData<DmMessage[]>(dmKeys.messages(roomId), (old) => {
      const list = old ?? [];
      const idx = list.findIndex((m) => m.id === incoming.id);
      if (idx >= 0) {
        const next = [...list];
        // merge — 소켓 에코가 linkedTodo* 를 누락/null 로 실어도 기존 해결값을 덮어쓰지 않음
        const prev = list[idx];
        next[idx] = {
          ...prev,
          ...incoming,
          linkedTodoId: incoming.linkedTodoId ?? prev.linkedTodoId,
          linkedTodoTitle: incoming.linkedTodoTitle ?? prev.linkedTodoTitle,
          linkedTodoStatus: incoming.linkedTodoStatus ?? prev.linkedTodoStatus,
        };
        return next;
      }
      return [...list, incoming];
    });
  };
}

export function useRemoveMessage(roomId: number) {
  const qc = useQueryClient();
  return (messageId: number) => {
    qc.setQueryData<DmMessage[]>(dmKeys.messages(roomId), (old) =>
      (old ?? []).filter((m) => m.id !== messageId),
    );
  };
}

export type SendVars = {
  content: string;
  replyToId?: number;
  linkedTodoId?: number;
  linkedTodoTitle?: string;
  linkedTodoStatus?: string;
  // 낙관적 버블 표시용 메타 (화면에서 전달)
  senderEmail?: string;
  senderName?: string;
  replyToSenderName?: string;
  replyToContent?: string;
  /** 재시도 시 기존 임시 id 재사용 — 버블 위치 유지 */
  tempId?: number;
};

export function useSendMessage(roomId: number) {
  const upsert = useUpsertMessage(roomId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, replyToId, linkedTodoId }: SendVars) =>
      dmApi.sendMessage(roomId, content, replyToId, linkedTodoId),
    // 낙관적 버블 — 즉시 리스트에 추가(반투명 '전송 중'), 성공 시 서버 메시지로 교체
    onMutate: (vars) => {
      const tempId = vars.tempId ?? -Math.abs(Math.trunc(performance.now() * 1000) + Math.floor(Math.random() * 1000));
      const temp: LocalDmMessage = {
        id: tempId,
        content: vars.content,
        replyToId: vars.replyToId,
        replyToSenderName: vars.replyToSenderName,
        replyToContent: vars.replyToContent,
        linkedTodoId: vars.linkedTodoId,
        linkedTodoTitle: vars.linkedTodoTitle,
        linkedTodoStatus: vars.linkedTodoStatus,
        senderEmail: vars.senderEmail,
        senderName: vars.senderName,
        sentAt: new Date().toISOString(),
        pending: true,
      };
      qc.setQueryData<LocalDmMessage[]>(dmKeys.messages(roomId), (old) => {
        const list = (old ?? []).filter((m) => m.id !== tempId); // 재시도면 기존 실패 버블 교체
        return [...list, temp];
      });
      return { tempId };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.tempId == null) return;
      qc.setQueryData<LocalDmMessage[]>(dmKeys.messages(roomId), (old) =>
        (old ?? []).map((m) => (m.id === ctx.tempId ? { ...m, pending: false, failed: true } : m)),
      );
    },
    onSuccess: (msg, vars, ctx) => {
      // 임시 버블 제거 후 서버 메시지 반영
      if (ctx?.tempId != null) {
        qc.setQueryData<LocalDmMessage[]>(dmKeys.messages(roomId), (old) =>
          (old ?? []).filter((m) => m.id !== ctx.tempId),
        );
      }
      // 전송 응답에 linkedTodo* 가 누락될 수 있어, 첨부한 할 일의 제목·상태를 낙관적으로 채워 넣는다(웹과 동일)
      const merged =
        vars.linkedTodoId != null
          ? {
              ...msg,
              linkedTodoId: msg.linkedTodoId ?? vars.linkedTodoId,
              linkedTodoTitle: msg.linkedTodoTitle ?? vars.linkedTodoTitle,
              linkedTodoStatus: msg.linkedTodoStatus ?? vars.linkedTodoStatus,
            }
          : msg;
      upsert(merged);
      qc.invalidateQueries({ queryKey: dmKeys.rooms });
      // (linkedTodo 제목은 merged에서 낙관적으로 채움 — messages invalidate는 temp·히스토리를 파괴하므로 금지)
    },
  });
}

export function useSetNotice(roomId: number) {
  const upsert = useUpsertMessage(roomId);
  return useMutation({
    mutationFn: ({ messageId, pinned }: { messageId: number; pinned: boolean }) =>
      dmApi.setNotice(roomId, messageId, pinned),
    onSuccess: (msg) => upsert(msg),
  });
}

export type SendFileVars = {
  file: { uri: string; name: string; type: string };
  content?: string;
  senderEmail?: string;
  senderName?: string;
  tempId?: number;
};

export function useSendFile(roomId: number) {
  const upsert = useUpsertMessage(roomId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, content }: SendFileVars) => dmApi.sendFile(roomId, file, content),
    // 낙관적 버블 — 로컬 uri로 즉시 미리보기(업로드 중), 실패 시 탭 재시도
    onMutate: (vars) => {
      const tempId = vars.tempId ?? -Math.abs(Math.trunc(performance.now() * 1000) + Math.floor(Math.random() * 1000));
      const temp: LocalDmMessage = {
        id: tempId,
        content: vars.content,
        fileUrl: vars.file.uri, // 로컬 file:// — MessageBubble이 그대로 렌더
        fileName: vars.file.name,
        fileType: vars.file.type,
        senderEmail: vars.senderEmail,
        senderName: vars.senderName,
        sentAt: new Date().toISOString(),
        pending: true,
      };
      qc.setQueryData<LocalDmMessage[]>(dmKeys.messages(roomId), (old) => [
        ...(old ?? []).filter((m) => m.id !== tempId),
        temp,
      ]);
      return { tempId };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.tempId == null) return;
      qc.setQueryData<LocalDmMessage[]>(dmKeys.messages(roomId), (old) =>
        (old ?? []).map((m) => (m.id === ctx.tempId ? { ...m, pending: false, failed: true } : m)),
      );
    },
    onSuccess: (msg, _vars, ctx) => {
      if (ctx?.tempId != null) {
        qc.setQueryData<LocalDmMessage[]>(dmKeys.messages(roomId), (old) =>
          (old ?? []).filter((m) => m.id !== ctx.tempId),
        );
      }
      upsert(msg);
      qc.invalidateQueries({ queryKey: dmKeys.rooms });
    },
  });
}

export function useEditMessage(roomId: number) {
  const upsert = useUpsertMessage(roomId);
  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: number; content: string }) =>
      dmApi.editMessage(roomId, messageId, content),
    onSuccess: (msg) => upsert(msg),
  });
}

export function useDeleteMessage(roomId: number) {
  const removeMsg = useRemoveMessage(roomId);
  return useMutation({
    mutationFn: (messageId: number) => dmApi.deleteMessage(roomId, messageId),
    onSuccess: (_d, messageId) => removeMsg(messageId),
  });
}

export function useToggleReaction(roomId: number) {
  const upsert = useUpsertMessage(roomId);
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: number; emoji: string }) =>
      dmApi.toggleReaction(roomId, messageId, emoji),
    onSuccess: (msg) => upsert(msg),
  });
}
