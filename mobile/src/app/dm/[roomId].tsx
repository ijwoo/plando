import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useMe } from '@/features/auth/queries';
import { getMessages, getPartnerProfile, markRead } from '@/features/dm/api';
import type { DmMessage, DmTodoSuggestion } from '@/features/dm/api';
import type { LocalDmMessage } from '@/features/dm/queries';
import { MessageBubble } from '@/features/dm/MessageBubble';
import { NoticePin } from '@/features/dm/NoticePin';
import { RoomInfoSheet } from '@/features/dm/RoomInfoSheet';
import { ExtractTodosSheet } from '@/features/dm/ExtractTodosSheet';
import { TodoSuggestionCard } from '@/features/dm/TodoSuggestionCard';
import { dmDraft } from '@/features/dm/draftStore';
import { useSettings } from '@/features/settings/queries';
import { useWorkspaceMembers } from '@/features/workspace/queries';
import { dmSearchFocus } from '@/features/dm/searchFocusStore';
import {
  useDeleteMessage,
  useEditMessage,
  useLoadOlderMessages,
  useMessages,
  useRemoveMessage,
  useRooms,
  useSendFile,
  useSendMessage,
  useSetNotice,
  useSuggestions,
  useToggleReaction,
  useUpsertMessage,
  dmKeys,
} from '@/features/dm/queries';
import { BottomSheet } from '@/features/todo/todoPickers';
import { useTodos, todoKeys } from '@/features/todo/queries';
import { getTodo } from '@/features/todo/api';
import { Avatar } from '@/shared/ui/Avatar';
import { tickHaptic } from '@/shared/ui/haptics';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { useStatusMap } from '@/features/status/queries';
import { useAuthStore } from '@/shared/store/authStore';
import { useTheme } from '@/hooks/use-theme';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

import { API_BASE_URL } from '@/shared/config/env';
import { toast } from '@/shared/ui/toast';
import { ToastHost } from '@/shared/ui/ToastHost';
import { exceedsUploadLimit, MAX_UPLOAD_LABEL, toJpegUpload } from '@/shared/utils/upload';
import { useDmSocket } from '@/shared/ws/useDmSocket';

// 클립보드 — 네이티브 모듈 없는 빌드에서 import가 던지지 않게 지연 로드
async function clipboardSet(text: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

const EMOJIS = ['👍', '❤️', '😂', '🎉', '✅', '👀']; // 웹 리액션 세트와 동일
const SCREEN_W = Dimensions.get('window').width;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 메시지 날짜 구분선 라벨: 오늘 / 어제 / YYYY년 M월 D일 요일 */
function dateSepLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const ymd = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (ymd(d) === ymd(today)) return '오늘';
  if (ymd(d) === ymd(yesterday)) return '어제';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

export default function DmRoomScreen() {
  // 커스텀 상태(st_xxx)를 원시 키로 노출하지 않도록 — 할 일 탭과 같은 규칙
  const sm = useStatusMap();
  const theme = useTheme();
  const router = useRouter();
  const { roomId, title, focusAt } = useLocalSearchParams<{ roomId: string; title?: string; focusAt?: string }>();
  const id = Number(roomId);

  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [kb, setKb] = useState(0);
  const { data: me } = useMe();
  // authStore.user는 앱 재시작 후 null — 설정의 표시 이름으로 폴백 (타이핑 인디케이터용)
  const sessionName = useAuthStore((s) => s.user?.name);
  const { data: mySettings } = useSettings();
  const myName = sessionName ?? mySettings?.displayName;
  const { data: messages, isLoading } = useMessages(id);
  const { loadOlder, loadingOlder, hasMore } = useLoadOlderMessages(id);
  // AI 할 일 제안 — 메시지 아래 칩으로 표시, WS 이벤트로 실시간 동기화
  const { data: suggestions } = useSuggestions(id);
  const suggestionByMsg = useMemo(() => {
    const m = new Map<number, DmTodoSuggestion>();
    for (const s of suggestions ?? []) if (s.status === 'PENDING') m.set(s.messageId, s);
    return m;
  }, [suggestions]);
  const removeSuggestion = useCallback(
    (sid: number) => {
      qc.setQueryData<DmTodoSuggestion[]>(dmKeys.suggestions(id), (old) => (old ?? []).filter((x) => x.id !== sid));
    },
    [qc, id],
  );
  const { data: rooms } = useRooms();
  const { data: todos } = useTodos();

  // 상단 고정 공지 — tag==='NOTICE'인 가장 최근 메시지 (웹 DmNoticePin 미러)
  const notice = useMemo(() => {
    for (let i = (messages?.length ?? 0) - 1; i >= 0; i--) {
      if (messages![i].tag === 'NOTICE') return messages![i];
    }
    return null;
  }, [messages]);

  // 캐시된 방 목록에서 현재 방 → 헤더 pill / 인트로용 상대 정보
  const room = useMemo(() => rooms?.find((r) => r.id === id), [rooms, id]);

  // 안읽음 구분선 — 진입 시점 unreadCount로 첫 안읽음 메시지를 한 번만 고정(웹 firstUnreadId 미러).
  // markRead는 rooms 쿼리를 무효화하지 않아 room.unreadCount가 유지됨.
  const [firstUnreadId, setFirstUnreadId] = useState<number | null>(null);
  // 진입 시 최신으로 스크롤되므로 안읽음 구분선은 화면 위에 있다 — pill 탭 or 1회 사용 후 숨김
  const [unreadPillDismissed, setUnreadPillDismissed] = useState(false);
  const unreadDone = useRef(false);
  useEffect(() => {
    if (unreadDone.current || !messages?.length || !room) return;
    unreadDone.current = true;
    const u = room.unreadCount ?? 0;
    if (u > 0 && messages.length > u) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 진입 1회 고정값
      setFirstUnreadId(messages[messages.length - u].id ?? null);
    }
  }, [messages, room]);
  // 읽음 표시 — 내 메시지 중 상대가 읽은(readAt) 마지막 것의 id (웹 useDmChatRoom.lastReadIdx 미러).
  // 그룹방 readAt은 서버가 '전원 읽음'일 때만 채워 주므로 같은 규칙이 그대로 적용된다.
  const lastReadMyId = useMemo(() => {
    let last: number | null = null;
    for (const m of messages ?? []) {
      if (m.id != null && m.id > 0 && !!me && m.senderEmail === me.email && m.readAt) last = m.id;
    }
    return last;
  }, [messages, me]);
  const peerName = room
    ? room.isGroup
      ? (room.groupName ?? '그룹')
      : (room.partnerName ?? title ?? '대화')
    : (title ?? '대화');
  const peerImage = room ? (room.isGroup ? room.groupImageUrl : room.partnerProfileImageUrl) : undefined;
  const peerSubtitle = room?.isGroup ? `멤버 ${room.memberCount ?? 0}명` : (room?.partnerEmail ?? '');
  // 보낸 직후 응답엔 linkedTodoTitle이 없을 수 있어 로컬 목록에서 제목/상태 보강
  const todoMap = useMemo(() => {
    const m = new Map<number, { title?: string; status?: string }>();
    for (const t of todos ?? []) if (t.id != null) m.set(t.id, { title: t.title, status: t.status });
    return m;
  }, [todos]);
  // 첨부 일정이 보관됐거나 서버가 제목을 안 주는 경우 — 누락된 linkedTodoId를 개별 조회로 보강
  const missingIds = useMemo(() => {
    const s = new Set<number>();
    for (const m of messages ?? [])
      if (m.linkedTodoId != null && !m.linkedTodoTitle && !todoMap.has(m.linkedTodoId)) s.add(m.linkedTodoId);
    return [...s];
  }, [messages, todoMap]);
  const linkedQueries = useQueries({
    queries: missingIds.map((id) => ({ queryKey: todoKeys.detail(id), queryFn: () => getTodo(id), staleTime: 60_000, retry: false })),
  });
  const linkedMap = useMemo(() => {
    const m = new Map<number, { title?: string; status?: string }>();
    linkedQueries.forEach((q, i) => {
      if (q.data) m.set(missingIds[i], { title: q.data.title, status: q.data.status });
    });
    return m;
  }, [linkedQueries, missingIds]);
  // 뷰어 갤러리(좌우 넘기기)용 이미지 목록 — 로드된 메시지만 쓰면 과거 기록을 스크롤로
  // 불러오기 전엔 옛 사진을 넘겨볼 수 없다. 서버 집계(방 전체 히스토리, 최신 20개 파일)를
  // 합쳐 과거 사진까지 포함시킨다. (RoomInfoSheet와 같은 쿼리 키 — 캐시 공유)
  const { data: roomProfile } = useQuery({
    queryKey: ['dm', 'partner-profile', id],
    queryFn: () => getPartnerProfile(id),
    staleTime: 60_000,
  });
  const imageUrls = useMemo(() => {
    const absUrl = (u: string) => (/^https?:\/\//.test(u) ? u : `${API_BASE_URL}${u}`);
    // 서버 집계는 최신순 → 뒤집어 옛것부터, 그 뒤에 로드된 메시지 이미지(시간순)를 중복 없이
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (u?: string | null) => {
      if (!u) return;
      const a = absUrl(u);
      if (!seen.has(a)) {
        seen.add(a);
        out.push(a);
      }
    };
    const serverFiles = roomProfile?.sharedFiles ?? [];
    for (let i = serverFiles.length - 1; i >= 0; i--) {
      const f = serverFiles[i];
      if ((f.fileType ?? '').startsWith('image/')) push(f.fileUrl);
    }
    for (const m of messages ?? []) {
      if (m.fileUrl && (m.fileType ?? '').startsWith('image/')) push(m.fileUrl);
    }
    return out;
  }, [messages, roomProfile]);
  // 최신 30개만 다시 받아 기존 캐시에 '머지' — invalidate와 달리 낙관적 temp(-id)·불러온 과거 페이지를 보존
  const refreshLatest = useCallback(async () => {
    try {
      const latest = await getMessages(id);
      qc.setQueryData<LocalDmMessage[]>(dmKeys.messages(id), (old) => {
        const cur = old ?? [];
        const temps = cur.filter((m) => (m.id ?? 0) < 0);
        const map = new Map<number, LocalDmMessage>();
        for (const m of cur) if ((m.id ?? 0) > 0) map.set(m.id!, m);
        for (const m of latest) map.set(m.id!, { ...map.get(m.id!), ...m });
        const merged = [...map.values()].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
        return [...merged, ...temps];
      });
    } catch {
      // 일시 실패 — 다음 이벤트에서 재시도
    }
  }, [id, qc]);

  const upsert = useUpsertMessage(id);
  const removeMsg = useRemoveMessage(id);
  // 제안 수락 — 서버가 돌려준 갱신 메시지(linkedTodoId)를 캐시에 반영하고 제안 제거
  const onSuggestionAccepted = useCallback(
    (updated: DmMessage, sid: number) => {
      upsert(updated);
      removeSuggestion(sid);
    },
    [upsert, removeSuggestion],
  );
  const send = useSendMessage(id);
  const sendFile = useSendFile(id);
  const edit = useEditMessage(id);
  const del = useDeleteMessage(id);
  const react = useToggleReaction(id);
  const noticeMut = useSetNotice(id);

  const [text, setText] = useState(() => dmDraft.get(id));
  // 그룹방 @멘션 자동완성 — 입력 끝의 "@쿼리"를 감지해 멤버 후보 표시.
  // 백엔드(MentionExtractor)는 @토큰이 이름(공백 없음) 또는 이메일 로컬파트와 정확히 일치해야 알림을 보낸다.
  const { data: wsMembers } = useWorkspaceMembers();
  const mentionQuery = useMemo(() => {
    if (!room?.isGroup) return null;
    const m = text.match(/@([\w가-힣]*)$/);
    return m ? m[1] : null;
  }, [text, room?.isGroup]);
  const mentionToken = (name?: string | null, email?: string | null) => {
    // 백엔드가 공백 제거 이름·이메일 로컬파트도 매칭하므로, 읽기 좋은 공백 제거 이름 우선
    const n = (name ?? '').replace(/\s+/g, '');
    return n || (email ?? '').split('@')[0];
  };
  const mentionCandidates = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    return (wsMembers ?? [])
      .filter((mb) => mb.email !== me?.email)
      .filter((mb) => {
        if (!q) return true;
        return (mb.name ?? '').toLowerCase().includes(q) || (mb.email ?? '').toLowerCase().startsWith(q);
      })
      .slice(0, 6);
  }, [mentionQuery, wsMembers, me?.email]);
  const applyMention = (name?: string | null, email?: string | null) => {
    const token = mentionToken(name, email);
    if (!token) return;
    setText((prev) => prev.replace(/@([\w가-힣]*)$/, `@${token} `));
  };
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [composerH, setComposerH] = useState(0); // 입력 오버레이 높이 → 리스트 하단 패딩 보정
  const [focused, setFocused] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [todoPickerOpen, setTodoPickerOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [pendingTodo, setPendingTodo] = useState<{ id: number; title?: string; status?: string } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
  const [actionTarget, setActionTarget] = useState<DmMessage | null>(null);
  const [extractTarget, setExtractTarget] = useState<number | null>(null); // AI 일괄 추출 대상 메시지
  // 뷰어는 URL 목록을 자체 보유 — 방 정보의 공유 파일은 아직 로드 안 된 옛 메시지의
  // 이미지도 포함하므로, 로드된 메시지 인덱스에 의존하면 빈 화면/엉뚱한 이미지가 열린다
  const [viewer, setViewer] = useState<{ urls: string[]; index: number } | null>(null);
  const openViewer = useCallback(
    (url: string, gallery: string[]) => {
      const i = gallery.indexOf(url);
      setViewer(i >= 0 ? { urls: gallery, index: i } : { urls: [url], index: 0 });
    },
    [],
  );
  const [infoOpen, setInfoOpen] = useState(false);
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  // 검색에서 온 메시지로 스크롤(화면 중앙)·하이라이트.
  // 진입 파라미터(전역 검색) 또는 방 내 검색(모달→back→스토어 소비) 모두 같은 경로로 처리.
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const stayInPlace = useRef(false); // 포커스 메시지에 머무름 → 하단 자동 스크롤 억제
  // 점프 대상 — 검색은 sentAt으로, 답장 인용·안읽음 pill은 메시지 id로 찾는다 (같은 스크롤·하이라이트 경로)
  const pendingFocusRef = useRef<{ sentAt?: string; id?: number } | null>(focusAt ? { sentAt: focusAt } : null);
  const [focusNonce, setFocusNonce] = useState(0);

  // 방 내 검색(모달)에서 돌아오면 점프 대상을 소비 — 새 방을 열지 않고 기존 방에서 스크롤
  useFocusEffect(
    useCallback(() => {
      const s = dmSearchFocus.take(id);
      if (!s) return;
      pendingFocusRef.current = { sentAt: s };
      setFocusNonce((n) => n + 1);
    }, [id]),
  );

  // 답장 인용·안읽음 pill 탭 → 원본 메시지로 점프 (검색 포커스와 동일한 재시도·하이라이트 경로 재사용)
  const jumpToMessage = useCallback((mid: number) => {
    pendingFocusRef.current = { id: mid };
    setFocusNonce((n) => n + 1);
  }, []);

  const focusRetries = useRef(0);
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target || !messages?.length) return;
    const key = (target.sentAt ?? '').slice(0, 19);
    const idx =
      target.id != null
        ? messages.findIndex((m) => m.id === target.id)
        : messages.findIndex((m) => (m.sentAt ?? '').slice(0, 19) === key);
    if (idx < 0) {
      // 아직 로드되지 않은 과거 메시지 — 위 페이지를 더 불러와 재시도 (상한 20페이지 ≈ 600개)
      if (hasMore && focusRetries.current < 20) {
        focusRetries.current += 1;
        void loadOlder(); // messages가 갱신되면 이 effect가 다시 돈다
      } else {
        pendingFocusRef.current = null; // 끝까지 못 찾으면 포기 → 기본(하단)
        focusRetries.current = 0;
      }
      return;
    }
    pendingFocusRef.current = null; // 1회 소비
    focusRetries.current = 0;
    stayInPlace.current = true;
    initialScrolled.current = true; // 포커스 진입도 초기 스크롤 완료로 간주 → 상단 페이지네이션 활성화
    const targetId = messages[idx].id ?? null;
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true });
      setHighlightId(targetId);
    }, 350);
    setTimeout(() => {
      if (targetId != null) setHighlightId(null);
      stayInPlace.current = false; // 하이라이트 종료 후 자동 스크롤 복구
    }, 2600);
  }, [focusNonce, messages, hasMore, loadOlder]);

  // 입력 초안 방별 저장(전송 시 ''로 비워지면 자동 삭제)
  useEffect(() => {
    dmDraft.set(id, text);
  }, [id, text]);

  // 진입 시 최신 메시지(맨 아래)로 — 검색 포커스가 아닐 때만, 최초 1회.
  // 레이아웃 확정 전 호출돼 살짝 덜 내려가는 것 방지 위해 여러 번 재시도.
  // composerH(입력 오버레이 높이)가 측정된 뒤에 스크롤해야 하단 패딩이 반영돼 마지막 메시지가 입력 위로 온다.
  const initialScrolled = useRef(false);
  useEffect(() => {
    if (focusAt || initialScrolled.current || !messages?.length || composerH === 0) return;
    // eslint-disable-next-line react-hooks/immutability -- 1회 플래그 ref: 검색 포커스 effect와 공유
    initialScrolled.current = true;
    [0, 120, 320].forEach((d) => setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), d));
  }, [focusAt, messages, composerH]);

  // 수신 시 읽음 처리·방 목록 갱신은 잦은 트래픽 방지로 스로틀 (웹은 수신마다 markAsRead)
  const lastReadSync = useRef(0);
  const syncReadState = () => {
    const now = Date.now();
    if (now - lastReadSync.current < 1500) return;
    lastReadSync.current = now;
    markRead(id).catch(() => {});
    qc.invalidateQueries({ queryKey: dmKeys.rooms });
  };

  // 실시간 구독: 신규/수정/반응 upsert, 삭제 제거, 타이핑 표시
  const { sendTyping } = useDmSocket(id, {
    onMessage: (msg) => {
      // 'socket' — 서버는 리액션/편집 브로드캐스트를 "행동한 사람 기준"으로 enrich한 DTO 하나로
      // 방 전체에 뿌린다. myReactions 같은 뷰어 종속 필드는 신뢰하면 안 된다(queries.ts 참고).
      upsert(msg, 'socket');
      // 방을 보고 있는 동안 받은 메시지는 즉시 읽음 처리 — 목록 배지가 부풀지 않게
      if (!me || msg.senderEmail !== me.email) syncReadState();
      // 첨부 일정 메시지인데 브로드캐스트에 제목이 없으면, 서버가 채운 제목을 다시 받아온다
      // (상대는 발신자의 할 일을 직접 조회할 수 없으므로 REST 응답에 의존)
      if (msg.linkedTodoId != null && !msg.linkedTodoTitle) {
        void refreshLatest(); // 전체 교체(invalidate)는 pending 버블·과거 페이지를 날린다
      }
    },
    onDelete: removeMsg,
    // 재연결 — 끊긴 사이 놓친 메시지 refetch
    onReconnect: () => {
      void refreshLatest(); // 끊긴 사이 놓친 메시지 보충 — temp·히스토리 보존
    },
    onTyping: ({ senderEmail, senderName }) => {
      if (me && senderEmail === me.email) return; // 내 타이핑은 무시
      setTypingName(senderName || '상대방');
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingName(null), 3000);
    },
    // AI 할 일 제안 — 생성/종결 이벤트로 제안 캐시 갱신 (양쪽 화면 동기화)
    onSuggestion: (s) => {
      qc.setQueryData<DmTodoSuggestion[]>(dmKeys.suggestions(id), (old) => {
        const cur = old ?? [];
        return cur.some((x) => x.id === s.id) ? cur : [s, ...cur];
      });
    },
    onSuggestionResolved: (sid) => {
      qc.setQueryData<DmTodoSuggestion[]>(dmKeys.suggestions(id), (old) =>
        (old ?? []).filter((x) => x.id !== sid),
      );
    },
    // 상대가 읽음 — 1:1은 내 메시지 전부 읽음 처리(낙관적). 그룹은 '전원 읽음' 기준이라
    // 낙관적 처리 없이 다음 로드 때 서버 계산값(readAt)을 반영한다 (웹 handleIncoming 미러)
    onReadReceipt: () => {
      if (room?.isGroup) return;
      qc.setQueryData<LocalDmMessage[]>(dmKeys.messages(id), (old) =>
        (old ?? []).map((m) => (m.readAt ? m : { ...m, readAt: new Date().toISOString() })),
      );
    },
  });

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  useEffect(() => {
    markRead(id).catch(() => {});
    // 방을 **나갈 때** 방 목록을 무효화해 안읽음 배지(DM 탭 배지·앱 아이콘 배지)를 내린다.
    // 예전엔 DM '목록' 화면이 포커스를 되찾을 때만 갱신돼서, 푸시 알림이나 홈에서 방으로
    // 바로 들어왔다 나오면 이미 읽은 대화의 배지가 그대로 남아 있었다.
    // 안읽음 구분선은 진입 시 firstUnreadId로 이미 1회 고정되므로 영향받지 않는다.
    return () => {
      qc.invalidateQueries({ queryKey: dmKeys.rooms });
    };
  }, [id, qc]);

  // 키보드 높이 직접 추적 → 컴포저를 키보드 위로 정확히 올림(겹침 방지)
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => {
      setKb(e.endCoordinates.height);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    const h = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  const onSend = () => {
    const t = text.trim();
    // 내 전송은 항상 최신으로 스크롤 (위 가드와 무관하게)
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    // 전송 실패 시 입력·첨부를 복원해 바로 재시도할 수 있게 (웹 retrySend 대응)
    const restore = (fn: () => void) => () => {
      fn();
      toast.error('전송에 실패했어요 — 다시 시도해주세요');
    };
    // 전송 중 새로 타이핑한 내용이 있으면 덮어쓰지 않는다 (dmDraft가 항상 최신 입력을 보관)
    const restoreText = (prev: string) => {
      if (!dmDraft.get(id).trim()) setText(prev);
    };
    if (pendingFile) {
      const file = pendingFile;
      // 낙관적 버블(로컬 미리보기) — 실패는 리스트의 실패 버블(탭 재시도)로
      sendFile.mutate({ file, content: t || undefined, senderEmail: me?.email, senderName: myName ?? undefined });
      setPendingFile(null);
      // send-file 에는 replyToId 가 없고 편집도 아니다. 배너를 남기면 다음 텍스트가
      // 엉뚱한 메시지의 답장/수정으로 나간다.
      setReplyTo(null);
      setEditingId(null);
      setText('');
      return;
    }
    if (pendingTodo) {
      const todo = pendingTodo;
      send.mutate({
        content: t,
        linkedTodoId: todo.id,
        linkedTodoTitle: todo.title,
        linkedTodoStatus: todo.status,
        senderEmail: me?.email,
        senderName: myName ?? undefined,
      });
      setPendingTodo(null);
      setReplyTo(null);
      setEditingId(null);
      setText('');
      return;
    }
    if (!t) return;
    if (editingId != null) {
      const msgId = editingId;
      edit.mutate(
        { messageId: msgId, content: t },
        { onError: restore(() => { setEditingId(msgId); restoreText(t); }) },
      );
      setEditingId(null);
    } else {
      const reply = replyTo;
      // 실패 시 입력 복원 대신 리스트의 실패 버블(탭 재시도)로 처리
      send.mutate({
        content: t,
        replyToId: reply?.id,
        replyToSenderName: reply?.senderName,
        replyToContent: reply?.content,
        senderEmail: me?.email,
        senderName: myName ?? undefined,
      });
      setReplyTo(null);
    }
    setText('');
  };

  const tooLarge = () => Alert.alert('파일이 너무 큽니다', `${MAX_UPLOAD_LABEL} 이하만 보낼 수 있어요.`);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      if (exceedsUploadLimit(a.fileSize)) return tooLarge();
      if (a.type === 'video') {
        setPendingFile({ uri: a.uri, name: a.fileName ?? `video-${Date.now()}.mov`, type: a.mimeType ?? 'video/quicktime' });
      } else {
        // HEIC(아이폰 기본)는 서버가 못 읽으므로 JPEG로 변환
        setPendingFile(await toJpegUpload(a.uri, 'image'));
      }
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '카메라 접근 권한을 허용해주세요.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      if (exceedsUploadLimit(a.fileSize)) return tooLarge();
      // 카메라도 iOS 설정에 따라 HEIF로 저장될 수 있어 JPEG로 변환
      setPendingFile(await toJpegUpload(a.uri, 'photo'));
    }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      if (exceedsUploadLimit(a.size)) return tooLarge();
      setPendingFile({ uri: a.uri, name: a.name ?? `file-${Date.now()}`, type: a.mimeType ?? 'application/octet-stream' });
    }
  };

  // 미리보기 이미지를 사진 라이브러리에 저장
  const onDownload = async () => {
    const url = viewer?.urls[viewer.index];
    if (!url) return;
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('권한 필요', '사진 저장 권한을 허용해주세요.');
        return;
      }
      // 고유 파일명으로 다운로드(중복 충돌 방지) 후 라이브러리에 저장
      const ext = (url.split('?')[0].match(/\.(jpg|jpeg|png|gif|heic|webp)$/i)?.[1] ?? 'jpg').toLowerCase();
      const dest = new File(Paths.cache, `dm-${Date.now()}.${ext}`);
      const file = await File.downloadFileAsync(url, dest);
      await MediaLibrary.Asset.create(file.uri); // 새 API (saveToLibraryAsync deprecated)
      toast.success('사진에 저장했어요');
    } catch (e) {
      console.log('[download] failed', e);
      toast.error('저장에 실패했어요');
    }
  };

  // 시트를 먼저 닫고 네이티브 picker 실행 — present 충돌 방지 (짧게)
  const closeAttachThen = (fn: () => void) => {
    setAttachOpen(false);
    setTimeout(fn, 160);
  };

  const onAttachTodo = (todo: { id: number; title?: string; status?: string }) => {
    setTodoPickerOpen(false);
    setPendingFile(null);
    setPendingTodo(todo);
  };

  /**
   * 컴포저 편집 헬퍼.
   *
   * 예전엔 `setText((t) => t + s)` 로 **항상 문장 끝에** 붙였다. 그래서 문장 중간에
   * 커서를 두고 이모지를 넣으면 엉뚱한 자리에 들어갔고, 굵게 버튼은 `*` 한 개만 붙어
   * 닫히지 않은 별표가 그대로 전송됐다.
   */
  const [sel, setSel] = useState({ start: 0, end: 0 });

  /** 커서 위치에 삽입 (선택 영역이 있으면 대체). */
  /** 서버에 저장된 메시지인지 — 낙관적 버블은 음수 임시 id 를 쓴다(queries.ts). */
  const isPersisted = (mid?: number | null) => mid != null && mid > 0;

  const insert = (ins: string) =>
    setText((t) => {
      const a = Math.min(sel.start, sel.end, t.length);
      const b = Math.min(Math.max(sel.start, sel.end), t.length);
      return t.slice(0, a) + ins + t.slice(b);
    });

  // 굵게(**)·코드(`) 버튼은 컴포저에서 뺐다. 채팅에서 마크업을 직접 넣는 건
  // 일반 사용자에게 "이게 뭐지?" 인 버튼이고(카카오톡·iMessage 에도 없다),
  // RN TextInput 은 입력 중 서식을 보여줄 수 없어 결국 별표가 그대로 보인다.
  // 다만 **렌더는 그대로 둔다** — 웹에는 굵게/기울임 버튼이 있어 그쪽에서 온 메시지가
  // 마크업을 포함하고, 직접 백틱을 친 사람도 코드로 보여야 한다(MessageBubble).


  const onChangeText = (t: string) => {
    setText(t);
    // 타이핑 발행은 1.5초에 한 번으로 스로틀
    const now = Date.now();
    if (t && now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      sendTyping(myName ?? '');
    }
  };

  const isMine = (m: DmMessage) => !!me && m.senderEmail === me.email;

  // 실패 버블 탭 → 같은 임시 id로 재전송 (버블 위치 유지)
  const onRetrySend = (m: LocalDmMessage) => {
    if (m.id == null) return;
    // 파일 메시지(로컬 uri 보존) — 파일 재업로드
    if (m.fileUrl && /^(file|content|ph|assets-library):/.test(m.fileUrl)) {
      sendFile.mutate({
        file: { uri: m.fileUrl, name: m.fileName ?? 'file', type: m.fileType ?? 'application/octet-stream' },
        content: m.content ?? undefined,
        senderEmail: me?.email,
        senderName: myName ?? undefined,
        tempId: m.id,
      });
      return;
    }
    send.mutate({
      content: m.content ?? '',
      replyToId: m.replyToId,
      replyToSenderName: m.replyToSenderName,
      replyToContent: m.replyToContent,
      linkedTodoId: m.linkedTodoId,
      linkedTodoTitle: m.linkedTodoTitle,
      linkedTodoStatus: m.linkedTodoStatus,
      senderEmail: me?.email,
      senderName: myName ?? undefined,
      tempId: m.id,
    });
  };

  const onLongPress = (m: DmMessage) => setActionTarget(m);

  // 메시지 텍스트 복사 (텍스트 메시지만 — 파일/이미지 전용은 액션 자체를 숨김)
  const onCopy = () => {
    const content = actionTarget?.content;
    setActionTarget(null);
    if (!content) return;
    tickHaptic();
    void clipboardSet(content).then((ok) =>
      ok ? toast.success('복사했어요') : toast.error('복사에 실패했어요 — 앱 업데이트 후 사용할 수 있어요'),
    );
  };

  const onReact = (emoji: string) => {
    // 전송 중·실패 버블은 음수 임시 id 라 서버에 없다(404). 예전엔 id != null 만 보고
    // 그대로 요청해 아무 반응도 없었다 — 서버에 존재하는 id 만 보낸다.
    if (isPersisted(actionTarget?.id)) react.mutate({ messageId: actionTarget!.id!, emoji });
    else if (actionTarget) toast.error('전송이 끝난 뒤에 할 수 있어요');
    setActionTarget(null);
  };

  const onReply = () => {
    setReplyTo(actionTarget);
    setEditingId(null);
    setActionTarget(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const onNotice = () => {
    // 이미 공지면 해제, 아니면 등록 (웹 토글과 동일)
    if (isPersisted(actionTarget?.id)) noticeMut.mutate({ messageId: actionTarget!.id!, pinned: actionTarget!.tag !== 'NOTICE' });
    else if (actionTarget) toast.error('전송이 끝난 뒤에 할 수 있어요');
    setActionTarget(null);
  };

  // 공지 배너 탭 → 해당 메시지로 스크롤
  const scrollToNotice = () => {
    if (notice?.id == null || !messages?.length) return;
    const idx = messages.findIndex((m) => m.id === notice.id);
    if (idx < 0) return;
    stayInPlace.current = true;
    listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.4, animated: true });
    setHighlightId(notice.id);
    setTimeout(() => {
      setHighlightId(null);
      stayInPlace.current = false;
    }, 2600);
  };

  const onEdit = () => {
    if (actionTarget && !isPersisted(actionTarget.id)) {
      toast.error('전송이 끝난 뒤에 수정할 수 있어요');
      setActionTarget(null);
      return;
    }
    if (actionTarget) {
      setEditingId(actionTarget.id ?? null);
      setText(actionTarget.content ?? '');
    }
    setActionTarget(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // 메시지 내용으로 할 일 만들기 (웹 DmCreateTodoModal 대응 — 작성 화면에 제목 프리필)
  const onCreateTodoFromMsg = () => {
    const content = actionTarget?.content;
    setActionTarget(null);
    if (!content) return;
    router.push({ pathname: '/todo/new', params: { title: content.slice(0, 200) } });
  };

  const onDelete = () => {
    const target = actionTarget;
    setActionTarget(null);
    if (target && !isPersisted(target.id)) {
      toast.error('전송이 끝난 뒤에 삭제할 수 있어요');
      return;
    }
    Alert.alert('메시지 삭제', '이 메시지를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => target?.id != null && del.mutate(target.id),
      },
    ]);
  };

  const glass = isLiquidGlassAvailable();
  const expanded = focused || text.length > 0 || editingId != null || replyTo != null || pendingFile != null || pendingTodo != null;
  const canSend = !!text.trim() || !!pendingFile || !!pendingTodo;

  return (
    // 채팅은 관례대로 흰(surface) 배경 — 회색 캔버스에선 상대 버블(surfaceAlt)이 묻힌다
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]} edges={['left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: 'transparent' },
          headerBackButtonDisplayMode: 'minimal',
          headerTitleAlign: 'center',
          headerTitle: () => (
            <Pressable
              onPress={() => setInfoOpen(true)}
              style={({ pressed }) => [styles.headerPill, pressed && styles.pressed]}
              hitSlop={6}>
              <Avatar person={{ name: peerName, profileImageUrl: peerImage }} size={26} />
              <ThemedText type="label" numberOfLines={1} style={styles.headerName}>
                {peerName}
              </ThemedText>
              <Ionicons name="chevron-down" size={13} color={theme.textTertiary} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/dm/search/${id}`)}
              hitSlop={8}
              accessibilityLabel="대화 내 검색"
              accessibilityRole="button"
              style={({ pressed }) => pressed && styles.pressed}>
              <Ionicons name="search" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <View style={[styles.flex, { paddingBottom: kb }]}>
        {isLoading ? (
          // 첫 로드 — 스피너 대신 대화 목록 자리를 잡아주는 스켈레톤
          <View style={[styles.flex, { paddingTop: insets.top + 52 }]}>
            <SkeletonList rows={8} avatar={32} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[styles.list, { paddingTop: insets.top + 52 }]}
            ListFooterComponent={<View style={{ height: composerH + 8 }} />}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            keyboardDismissMode="interactive"
            // 과거 메시지를 위에 붙여도 보던 위치 유지
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListHeaderComponent={
              loadingOlder ? (
                <View style={styles.olderSpinner}>
                  <ActivityIndicator />
                </View>
              ) : !hasMore || (messages?.length ?? 0) < 30 ? (
                // 대화의 처음까지 다 불러왔을 때만 인트로 노출
                <View style={styles.intro}>
                  <Avatar person={{ name: peerName, profileImageUrl: peerImage }} size={80} />
                  <ThemedText type="title" style={styles.introName}>
                    {peerName}
                  </ThemedText>
                  {peerSubtitle ? (
                    <ThemedText type="small" style={styles.introSub}>
                      {peerSubtitle}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" style={styles.introHint}>
                    Plan Do!에서 나눈 대화예요
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.olderSpacer} />
              )
            }
            renderItem={({ item, index }) => {
              const prev = index > 0 ? messages?.[index - 1] : undefined;
              // 날짜가 바뀌면 구분선 표시 + 그룹 리셋
              const newDay = !prev || dateSepLabel(prev.sentAt) !== dateSepLabel(item.sentAt);
              // 같은 사람이 연속으로 보낸 메시지는 아바타·이름 생략하고 아래로 쌓는다 (단, 날짜가 바뀌면 새 그룹)
              const sameSender = (a?: DmMessage, b?: DmMessage) =>
                !!a && !!b && (a.senderId != null && b.senderId != null ? a.senderId === b.senderId : !!a.senderEmail && a.senderEmail === b.senderEmail);
              const grouped = !newDay && sameSender(prev, item);
              // 다음 메시지가 같은 사람·같은 날이면 이 버블의 시간은 숨긴다 (그룹 끝에만 표시 — 노이즈 감소)
              const next = messages?.[index + 1];
              const tailOfGroup =
                !next || !sameSender(next, item) || dateSepLabel(next.sentAt) !== dateSepLabel(item.sentAt);
              const lt =
                item.linkedTodoId != null ? (todoMap.get(item.linkedTodoId) ?? linkedMap.get(item.linkedTodoId)) : undefined;
              return (
                <>
                  {firstUnreadId != null && item.id === firstUnreadId ? (
                    <View style={styles.dateSep}>
                      <View style={[styles.dateLine, { backgroundColor: theme.primary }]} />
                      <ThemedText type="small" style={[styles.dateText, { color: theme.primary, fontWeight: '700' }]}>
                        여기까지 읽음
                      </ThemedText>
                      <View style={[styles.dateLine, { backgroundColor: theme.primary }]} />
                    </View>
                  ) : null}
                  {newDay ? (
                    <View style={styles.dateSep}>
                      <View style={[styles.dateLine, { backgroundColor: theme.divider }]} />
                      <ThemedText type="small" style={[styles.dateText, { color: theme.textSecondary }]}>
                        {dateSepLabel(item.sentAt)}
                      </ThemedText>
                      <View style={[styles.dateLine, { backgroundColor: theme.divider }]} />
                    </View>
                  ) : null}
                  <MessageBubble
                    message={item}
                    mine={isMine(item)}
                    grouped={grouped}
                    onLongPress={() => onLongPress(item)}
                    onImagePress={(url) => openViewer(url, imageUrls)}
                    linkedTitle={item.linkedTodoTitle || lt?.title}
                    linkedStatus={item.linkedTodoStatus || lt?.status}
                    highlighted={item.id === highlightId}
                    showTime={tailOfGroup}
                    showRead={item.id != null && item.id === lastReadMyId && tailOfGroup}
                    pending={(item as LocalDmMessage).pending}
                    failed={(item as LocalDmMessage).failed}
                    onRetry={() => onRetrySend(item as LocalDmMessage)}
                    onToggleReaction={(emoji) => {
                      if (item.id != null && item.id > 0) react.mutate({ messageId: item.id, emoji });
                    }}
                    onReplyPress={item.replyToId != null ? () => jumpToMessage(item.replyToId!) : undefined}
                  />
                  {/* AI 할 일 제안 — 설정 off·이미 할 일 연결된 메시지엔 표시하지 않음 */}
                  {mySettings?.dmSuggestionEnabled !== false && item.id != null && item.linkedTodoId == null && suggestionByMsg.has(item.id) ? (
                    <TodoSuggestionCard
                      suggestion={suggestionByMsg.get(item.id)!}
                      onAccepted={onSuggestionAccepted}
                      onDismissed={removeSuggestion}
                    />
                  ) : null}
                </>
              );
            }}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const fromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
              setShowScrollDown(fromBottom > 400);
              // 상단 근처 도달 → 과거 메시지 로드 (초기 하단 스크롤 완료 후에만)
              if (initialScrolled.current && contentOffset.y < 80) void loadOlder();
            }}
            scrollEventThrottle={80}
            onContentSizeChange={() => {
              // 검색 포커스 중이거나 사용자가 위로 스크롤해 히스토리를 읽는 중(과거 페이지 prepend 포함)엔
              // 바닥으로 끌어내리지 않는다 — 새 메시지는 '맨 아래로' 버튼으로 안내
              if (stayInPlace.current || showScrollDown) return;
              listRef.current?.scrollToEnd({ animated: false });
            }}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true }), 300);
            }}
          />
        )}

        {/* 상단 고정 공지 */}
        {notice ? (
          <View style={[styles.noticeWrap, { top: insets.top + 54 }]} pointerEvents="box-none">
            <NoticePin notice={notice} onPress={scrollToNotice} />
          </View>
        ) : null}

        {/* 안 읽은 메시지로 점프 — 진입 시 위쪽에 안읽음 구분선이 있을 때만, 탭하면 사라짐 */}
        {!isLoading && firstUnreadId != null && !unreadPillDismissed ? (
          <View style={[styles.unreadPillWrap, { top: insets.top + (notice ? 104 : 58) }]} pointerEvents="box-none">
            <Pressable
              onPress={() => {
                tickHaptic();
                setUnreadPillDismissed(true);
                jumpToMessage(firstUnreadId);
              }}
              accessibilityLabel="안 읽은 메시지로 이동"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.unreadPill,
                { backgroundColor: theme.surface, borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="arrow-up" size={13} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                안 읽은 메시지
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* 맨 아래로 — 위로 스크롤했을 때만 */}
        {showScrollDown ? (
          <Pressable
            onPress={() => listRef.current?.scrollToEnd({ animated: true })}
            accessibilityLabel="맨 아래로"
            accessibilityRole="button"
            style={[styles.scrollDown, { backgroundColor: theme.surface, borderColor: theme.border, bottom: kb + composerH + 12 }]}>
            <Ionicons name="chevron-down" size={22} color={theme.text} />
          </Pressable>
        ) : null}

        {typingName ? (
          <View style={[styles.typingRow, { bottom: kb + composerH + 2 }]} pointerEvents="none">
            <ThemedText type="small" style={styles.typing}>
              {typingName}님이 입력 중
            </ThemedText>
            <TypingDots color={theme.textSecondary} />
          </View>
        ) : null}

        <View
          style={[styles.composerWrap, { bottom: kb, paddingBottom: kb > 0 ? 8 : insets.bottom + 8 }]}
          onLayout={(e) => setComposerH(e.nativeEvent.layout.height)}>
          {expanded && editingId != null ? (
            <View style={styles.editBanner}>
              <ThemedText type="small" style={styles.editText}>
                메시지 편집 중
              </ThemedText>
              <Pressable onPress={() => { setEditingId(null); setText(''); }} accessibilityLabel="편집 취소" accessibilityRole="button">
                <ThemedText type="small" style={[styles.editCancel, { color: theme.danger }]}>
                  취소
                </ThemedText>
              </Pressable>
            </View>
          ) : expanded && replyTo != null ? (
            <View style={styles.editBanner}>
              <ThemedText type="small" style={styles.editText} numberOfLines={1}>
                답장: {replyTo.senderName ?? ''} · {replyTo.content ?? '[파일]'}
              </ThemedText>
              <Pressable onPress={() => setReplyTo(null)} accessibilityLabel="답장 취소" accessibilityRole="button">
                <ThemedText type="small" style={[styles.editCancel, { color: theme.danger }]}>
                  취소
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {/* @멘션 자동완성 — 그룹방에서 입력 끝이 @쿼리일 때 멤버 후보 */}
          {mentionQuery != null && mentionCandidates.length ? (
            <View style={[styles.mentionBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {mentionCandidates.map((mb) => (
                <Pressable
                  key={mb.userId ?? mb.email}
                  onPress={() => applyMention(mb.name, mb.email)}
                  accessibilityLabel={`${mb.name ?? mb.email} 멘션`}
                  style={({ pressed }) => [styles.mentionItem, pressed && { backgroundColor: theme.surfaceSelected }]}>
                  <Avatar person={{ name: mb.name ?? mb.email, profileImageUrl: mb.profileImageUrl }} size={24} />
                  <ThemedText type="small" style={styles.mentionName} numberOfLines={1}>
                    {mb.name ?? mb.email}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}

          {expanded ? (
            <ComposerSurface glass={glass} theme={theme}>
              {pendingFile ? (
                <View style={[styles.preview, { borderColor: theme.border }]}>
                  {pendingFile.type.startsWith('image') ? (
                    <Image source={{ uri: pendingFile.uri }} style={styles.previewImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.previewFile, { backgroundColor: theme.background }]}>
                      <Ionicons name="document-outline" size={20} color={theme.textSecondary} />
                    </View>
                  )}
                  <ThemedText type="small" numberOfLines={1} style={styles.flex}>
                    {pendingFile.name}
                  </ThemedText>
                  <Pressable onPress={() => setPendingFile(null)} hitSlop={8} accessibilityLabel="첨부 제거" accessibilityRole="button">
                    <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ) : null}

              {pendingTodo ? (
                <View style={[styles.todoPreview, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Ionicons name="checkbox-outline" size={18} color={theme.primary} />
                  <View style={styles.flex}>
                    <ThemedText type="small" style={styles.todoPreviewTitle} numberOfLines={1}>
                      {pendingTodo.title ?? '할 일'}
                    </ThemedText>
                    {pendingTodo.status ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {sm.label(pendingTodo.status) ?? pendingTodo.status} · 일정 첨부
                      </ThemedText>
                    ) : (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        일정 첨부
                      </ThemedText>
                    )}
                  </View>
                  <Pressable onPress={() => setPendingTodo(null)} hitSlop={8} accessibilityLabel="일정 첨부 제거" accessibilityRole="button">
                    <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ) : null}

              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={onChangeText}
                onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={editingId != null ? '메시지 수정' : `${title ?? '상대'}에게 메시지 보내기`}
                placeholderTextColor={theme.textSecondary}
                autoFocus
                multiline
                style={[styles.composerInput, { color: theme.text }]}
              />

              {emojiOpen ? (
                <View style={styles.emojiBar}>
                  {EMOJIS.map((e) => (
                    <Pressable key={e} onPress={() => insert(e)} hitSlop={4} style={styles.emojiPick}>
                      <ThemedText type="default" style={styles.emojiPickText}>
                        {e}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={styles.toolbar}>
                <Pressable onPress={() => setAttachOpen(true)} hitSlop={8} style={styles.toolBtn} accessibilityLabel="첨부" accessibilityRole="button">
                  <Ionicons name="add" size={24} color={theme.textSecondary} />
                </Pressable>
                <Pressable onPress={() => setEmojiOpen((v) => !v)} hitSlop={8} style={styles.toolBtn} accessibilityLabel="이모지" accessibilityRole="button">
                  <Ionicons name="happy-outline" size={21} color={emojiOpen ? theme.primary : theme.textSecondary} />
                </Pressable>
                {/* 1:1 은 자동완성이 없고(그룹 전용) 백엔드도 멘션 알림을 스킵한다 → 웹처럼 숨긴다 */}
                {room?.isGroup ? (
                  <Pressable onPress={() => insert('@')} hitSlop={8} style={styles.toolBtn} accessibilityLabel="멘션" accessibilityRole="button">
                    <Ionicons name="at" size={20} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
                <View style={styles.flex} />
                <Pressable onPress={onSend} hitSlop={6} disabled={send.isPending || sendFile.isPending || !canSend} accessibilityLabel="보내기" accessibilityRole="button">
                  <Ionicons
                    name={editingId != null ? 'checkmark-circle' : 'arrow-up-circle'}
                    size={32}
                    color={canSend ? theme.primary : theme.textSecondary}
                  />
                </Pressable>
              </View>
            </ComposerSurface>
          ) : (
            <ComposerSurface glass={glass} theme={theme}>
              {/* + 는 첨부 아이콘이라 첨부 시트를 열어야 한다(예전엔 포커스만 했다).
                  플레이스홀더 쪽을 누르면 입력으로 들어간다. */}
              <View style={styles.collapsed}>
                <Pressable onPress={() => setAttachOpen(true)} hitSlop={8} accessibilityLabel="첨부" accessibilityRole="button">
                  <Ionicons name="add" size={24} color={theme.textSecondary} />
                </Pressable>
                <Pressable onPress={() => setFocused(true)} style={styles.flex} accessibilityLabel="메시지 입력" accessibilityRole="button">
                  <ThemedText type="default" style={[styles.collapsedText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {`${title ?? '상대'}에게 메시지 보내기`}
                  </ThemedText>
                </Pressable>
              </View>
            </ComposerSurface>
          )}
        </View>
      </View>

      {/* 메시지 long-press 액션 — 앱 공통 BottomSheet (핸들·드래그 닫기 일관) */}
      <BottomSheet open={!!actionTarget} onClose={() => setActionTarget(null)}>
        <View style={styles.actionSheetBody}>
            <View style={styles.emojiRow}>
              {EMOJIS.map((e) => (
                <Pressable key={e} onPress={() => onReact(e)} style={styles.emoji}>
                  <ThemedText type="title" style={styles.emojiText}>
                    {e}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={onReply} style={styles.action}>
              <ThemedText type="default">답장</ThemedText>
            </Pressable>
            {actionTarget?.content ? (
              <Pressable onPress={onCopy} style={styles.action} accessibilityLabel="메시지 복사" accessibilityRole="button">
                <ThemedText type="default">복사</ThemedText>
              </Pressable>
            ) : null}
            {actionTarget?.content ? (
              <Pressable onPress={onCreateTodoFromMsg} style={styles.action}>
                <ThemedText type="default">할 일로 만들기</ThemedText>
              </Pressable>
            ) : null}
            {actionTarget?.id != null && (actionTarget.content?.length ?? 0) >= 60 ? (
              <Pressable
                onPress={() => {
                  const mid = actionTarget.id!;
                  setActionTarget(null);
                  setExtractTarget(mid);
                }}
                style={styles.action}>
                <ThemedText type="default">✨ AI로 할 일 추출</ThemedText>
              </Pressable>
            ) : null}
            {actionTarget && isMine(actionTarget) ? (
              <>
                <Pressable onPress={onNotice} style={styles.action}>
                  <ThemedText type="default">{actionTarget.tag === 'NOTICE' ? '공지 해제' : '공지로 등록'}</ThemedText>
                </Pressable>
                {actionTarget.content ? (
                  <Pressable onPress={onEdit} style={styles.action}>
                    <ThemedText type="default">편집</ThemedText>
                  </Pressable>
                ) : null}
                <Pressable onPress={onDelete} style={styles.action}>
                  <ThemedText type="default" style={[styles.destructive, { color: theme.danger }]}>
                    삭제
                  </ThemedText>
                </Pressable>
              </>
            ) : null}
        </View>
      </BottomSheet>

      {/* + 첨부 바텀시트 (Slack식) */}
      <BottomSheet open={attachOpen} onClose={() => setAttachOpen(false)}>
        <View style={styles.attachList}>
          <AttachItem theme={theme} icon="images-outline" label="사진 및 동영상" onPress={() => closeAttachThen(pickImage)} />
          <AttachItem theme={theme} icon="camera-outline" label="사진 촬영" onPress={() => closeAttachThen(takePhoto)} />
          <AttachItem theme={theme} icon="document-outline" label="파일 업로드" onPress={() => closeAttachThen(pickFile)} />
          <AttachItem
            theme={theme}
            icon="checkbox-outline"
            label="일정 첨부"
            last
            onPress={() => {
              setAttachOpen(false);
              setTimeout(() => setTodoPickerOpen(true), 160);
            }}
          />
        </View>
      </BottomSheet>

      {/* 일정(할 일) 선택 시트 */}
      <BottomSheet open={todoPickerOpen} onClose={() => setTodoPickerOpen(false)}>
        <ThemedText type="label" style={styles.attachTitle}>
          일정 첨부
        </ThemedText>
        <FlatList
          data={todos ?? []}
          keyExtractor={(t) => String(t.id)}
          style={styles.todoList}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <ThemedText type="small" style={styles.searchEmpty}>
              할 일이 없어요.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.id != null && onAttachTodo({ id: item.id, title: item.title, status: item.status })}
              style={({ pressed }) => [styles.todoRow, { borderBottomColor: theme.divider }, pressed && { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="checkbox-outline" size={18} color={theme.textSecondary} />
              <ThemedText type="default" numberOfLines={1} style={styles.flex}>
                {item.title}
              </ThemedText>
              {item.status ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {sm.label(item.status) ?? item.status}
                </ThemedText>
              ) : null}
            </Pressable>
          )}
        />
      </BottomSheet>

      {/* AI 일괄 추출 — 롱프레스 메뉴에서 진입 */}
      <ExtractTodosSheet roomId={id} messageId={extractTarget} onClose={() => setExtractTarget(null)} />

      {/* 방 정보 — 프로필·멤버 초대·공유 일정/파일 모아보기 */}
      {infoOpen ? (
        <RoomInfoSheet
          room={room}
          roomId={id}
          messages={messages ?? []}
          onClose={() => setInfoOpen(false)}
          onOpenTodo={(tid) => {
            setInfoOpen(false);
            router.push(`/todo/${tid}`);
          }}
          onOpenImage={(url) => {
            setInfoOpen(false);
            openViewer(url, imageUrls);
          }}
        />
      ) : null}

      {/* 이미지 풀스크린 갤러리 — 좌우 넘기기 + N/전체 */}
      <Modal visible={viewer != null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerBackdrop}>
          <View style={[styles.viewerHeader, { top: insets.top + 8 }]} pointerEvents="box-none">
            <ThemedText type="default" style={styles.viewerCount}>
              {(viewer?.index ?? 0) + 1} / {viewer?.urls.length ?? 0}
            </ThemedText>
            <View style={styles.viewerActions}>
              <Pressable onPress={onDownload} hitSlop={10} accessibilityLabel="사진 저장" accessibilityRole="button">
                <Ionicons name="download-outline" size={26} color="#fff" />
              </Pressable>
              <Pressable onPress={() => setViewer(null)} hitSlop={10} accessibilityLabel="닫기" accessibilityRole="button">
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
            </View>
          </View>
          <FlatList
            data={viewer?.urls ?? []}
            keyExtractor={(u, i) => `${u}-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewer?.index ?? 0}
            getItemLayout={(_d, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              // 이미 닫힌(null) 상태면 무시 — 닫는 순간의 관성 스크롤이 재오픈하는 것 방지
              setViewer((prev) => (prev == null ? null : { ...prev, index: i }));
            }}
            renderItem={({ item }) => (
              <Pressable style={styles.viewerPage} onPress={() => setViewer(null)}>
                <Image source={{ uri: item }} style={styles.viewerImage} contentFit="contain" />
              </Pressable>
            )}
          />
          {/* 미리보기 Modal은 별도 레이어라 루트 ToastHost가 가려진다 → 여기서도 렌더 */}
          <ToastHost />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** 타이핑 점 3개 — 위상차 펄스 (텍스트 '…' 대체) */
function TypingDots({ color }: { color: string }) {
  const t = useSharedValue(0);
   
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
  }, [t]);
   
  const dot = (phase: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- 고정 3회 호출(조건 없음)
    useAnimatedStyle(() => ({
      opacity: 0.25 + 0.75 * Math.abs(Math.sin((t.value + phase) * Math.PI)),
    }));
  const d0 = dot(0);
  const d1 = dot(0.22);
  const d2 = dot(0.44);
  return (
    <View style={styles.typingDots}>
      {[d0, d1, d2].map((st, i) => (
        <Animated.View key={i} style={[styles.typingDot, { backgroundColor: color }, st]} />
      ))}
    </View>
  );
}

/** 컴포저 표면 — Liquid Glass(가능 시) 또는 surface+테두리 폴백. */
function ComposerSurface({
  glass,
  theme,
  children,
}: {
  glass: boolean;
  theme: ReturnType<typeof useTheme>;
  children: React.ReactNode;
}) {
  if (glass) {
    return (
      <GlassView style={styles.composer} glassEffectStyle="regular" isInteractive>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.composer, { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
      {children}
    </View>
  );
}

function AttachItem({
  theme,
  icon,
  label,
  onPress,
  last,
}: {
  theme: ReturnType<typeof useTheme>;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.attachRow,
        { borderBottomColor: theme.divider, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
        pressed && { backgroundColor: theme.background },
      ]}>
      <Ionicons name={icon} size={22} color={theme.text} />
      <ThemedText type="default">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mentionBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginHorizontal: 12, marginBottom: 6, padding: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  mentionItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, maxWidth: 160 },
  mentionName: { fontWeight: '600', flexShrink: 1 },
  container: { flex: 1 },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  viewerHeader: { position: 'absolute', left: 20, right: 20, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  viewerCount: { color: '#fff', fontWeight: '700' },
  viewerPage: { width: SCREEN_W, flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 0 },
  headerPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3, maxWidth: 220 },
  pressed: { opacity: 0.5 },
  headerName: { fontWeight: '700', flexShrink: 1 },
  intro: { alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 28 },
  olderSpinner: { paddingVertical: 16, alignItems: 'center' },
  olderSpacer: { height: 8 },
  noticeWrap: { position: 'absolute', left: 12, right: 12, zIndex: 5 },
  unreadPillWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 4 },
  unreadPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  introName: { marginTop: 6 },
  introSub: { opacity: 0.6 },
  introHint: { opacity: 0.45, marginTop: 2 },
  dateSep: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateText: { fontSize: 11 },
  editBanner: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  editText: { opacity: 0.6 },
  editCancel: {  },
  typing: { opacity: 0.5 },
  typingRow: { position: 'absolute', left: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingBottom: 2 },
  typingDots: { flexDirection: 'row', gap: 3, opacity: 0.6 },
  typingDot: { width: 4, height: 4, borderRadius: 2 },
  actionSheetBody: { paddingHorizontal: 12, paddingBottom: 4 },
  composerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 8 },
  scrollDown: { position: 'absolute', right: 16, bottom: 90, width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  composer: { borderRadius: 22, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6, overflow: 'visible', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  collapsed: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  collapsedText: { flex: 1 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 4, marginBottom: 2 },
  previewImg: { width: 40, height: 40, borderRadius: 8 },
  previewFile: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  todoPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  todoPreviewTitle: { fontWeight: '700' },
  attachList: { paddingHorizontal: 8, paddingBottom: 4 },
  attachTitle: { textAlign: 'center', fontWeight: '700', marginBottom: 8 },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 15, borderRadius: 12 },
  todoList: { maxHeight: 360, paddingHorizontal: 8 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  composerInput: { fontSize: 15, lineHeight: 21, maxHeight: 120, paddingTop: 2, paddingBottom: 4 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  toolBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  emojiBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 6 },
  emojiPick: { padding: 4 },
  emojiPickText: { fontSize: 24, lineHeight: 30 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 16, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 6 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  emoji: { padding: 6 },
  emojiText: { fontSize: 30, lineHeight: 38 },
  action: { paddingVertical: 14, alignItems: 'center' },
  destructive: {  },
  searchEmpty: { textAlign: 'center', opacity: 0.5, marginTop: 40 },
});
