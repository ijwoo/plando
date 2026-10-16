import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import {
  extractChatTasks,
  extractContext,
  fetchAgents,
  fetchSchedules,
  fetchUsage,
  PENDING_LABELS,
  resultKind,
  mutatedServerState,
  deletedTaskIds,
  sendChat,
  toParsedDraft,
  type AiUsage,
  type ChatAgent,
  type ChatContext,
  type ChatHistoryTurn,
  type ChatTask,
  type ParsedDraft,
} from '@/features/chat/api';
import { ChatParsedCard } from '@/features/chat/ChatParsedCard';
import { ChatResultCard } from '@/features/chat/ChatResultCard';
import { AgentEditSheet } from '@/features/chat/AgentEditSheet';
import { AgentPicker } from '@/features/chat/AgentPicker';
import { ScheduleSheet } from '@/features/chat/ScheduleSheet';
import { AiGlow } from '@/features/chat/AiGlow';
import { AiIdleDemo } from '@/features/chat/AiIdleDemo';
import { ParsePreview } from '@/features/chat/ParsePreview';
import { parseKoreanTask, type ParsedHints } from '@/features/chat/parseKoreanTask';
import { ChatSteps, type AgentStep } from '@/features/chat/ChatSteps';
import { AGENT_ACCENT, agentLook } from '@/features/chat/agentLook';
import { useCreateTodo } from '@/features/todo/queries';
import { useSetTodoTags } from '@/features/tag/queries';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';
import { toast } from '@/shared/ui/toast';
import { type TodoPriority, type TodoStatus } from '@/shared/ui/tone';

// 음성 인식 — 네이티브 모듈 없는 빌드(구 dev 클라이언트)에서 import가 던지므로 지연 로드 + no-op 폴백
type SpeechModule = typeof import('expo-speech-recognition');
let speech: SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speech = require('expo-speech-recognition') as SpeechModule;
} catch {
  speech = null;
}
const useSpeechRecognitionEvent: SpeechModule['useSpeechRecognitionEvent'] = speech
  ? speech.useSpeechRecognitionEvent
  : () => {};

/** 테마에 soft 계열 토큰이 없어 알파를 직접 붙인다(ChatSteps·AgentPicker 와 같은 방식). */
function withAlpha(hex: string, alpha: number): string {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

type ResultKind = 'updated' | 'listed';
type Msg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tasks?: ChatTask[];
  kind?: ResultKind;
  parsed?: ParsedDraft; // TASK_CREATED 편집 초안
  steps?: AgentStep[]; // AI 가 실행한 단계
  prompt?: string; // 재생성용 원문
  hints?: ParsedHints; // 보낼 때 입력창 위에 띄웠던 로컬 추측(서버 보정 강조용)
};

/**
 * 서버에 실어 보낼 최근 대화.
 *
 * 로딩 중이거나 빈 말풍선은 뺀다 — 맥락에 보탬이 없으면서 토큰만 쓴다.
 * 서버도 상한을 두지만 보내는 쪽에서 먼저 줄인다(요청 크기가 대화 길이에 비례하면
 * 긴 대화에서 느려진다).
 */
const HISTORY_TURNS = 8;
function recentHistory(msgs: Msg[]): ChatHistoryTurn[] {
  return msgs
    .filter((m) => typeof m.text === 'string' && m.text.trim())
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), text: m.text }));
}

/**
 * 시작 예시.
 *
 * 갈래(추가·조회·정리) 탭을 두었다가 없앴다. **역할과 같은 축을 두 번 말하기 때문이다** —
 * "정리 도우미 역할"과 "정리 탭"이 무엇이 다른지 알 방법이 없어서 역할 고르기 자체가
 * 부담이 됐다. 축은 하나만 둔다: 역할은 **무엇까지 할 수 있는가**(범위·안전도),
 * 예시는 그냥 시작 문장이다.
 *
 * 대신 의도를 섞어 한 벌로 둔다 — 추가·조회·정리가 한눈에 보이면 탭 없이도 폭이 읽힌다.
 * 장소가 들어간 예시를 하나는 남긴다. 위치 기반이 이 앱의 차별점인데 예시가 전부
 * 사무직 톤이면 "그냥 할 일 앱" 으로 학습된다.
 */
const EXAMPLES = [
  '금요일까지 계약서 검토 급하게',
  '내일 오후 3시 강남역에서 팀 미팅',
  '이번주에 아직 시작 안 한 일 뭐야?',
  '재고 현황 작업 완료 처리해줘',
];

/** AI 어시스턴트 — 웹 ChatWidget 1:1. 자연어 명령 + 다중 턴 컨텍스트 + 결과 카드 + 생성 편집 카드. */
export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const glass = isLiquidGlassAvailable();
  const createTodo = useCreateTodo();
  const setTags = useSetTodoTags();
  // AI 결과 카드의 상태 칩 — 워크스페이스 커스텀 상태 라벨·색을 쓰기 위해
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ctxRef = useRef<ChatContext>({});
  const [pending, setPending] = useState<string | null>(null); // 진행 중 pendingAction
  const listRef = useRef<FlatList>(null);
  // 대화 세대 — 초기화 시 +1, 진행 중이던 응답은 도착해도 폐기
  const sessionRef = useRef(0);
  const qc = useQueryClient();

  /* 역할·사용량. 목록을 못 받아도 대화는 되어야 하므로(기본 역할) 실패를 삼킨다. */
  const [agents, setAgents] = useState<ChatAgent[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /* 편집 대상. null = 새로 만들기, undefined = 편집 화면 닫힘.
     "열림 여부" 와 "무엇을 편집하는가" 를 한 값으로 둔다 — 둘로 나누면 어긋난 조합이 생긴다. */
  const [editing, setEditing] = useState<ChatAgent | null | undefined>(undefined);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [kb, setKb] = useState(0);

  // 키보드 높이 추적 → 입력창을 키보드 바로 위에 정확히 올린다
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

  /* 역할 목록을 실제로 받아왔는지. 빈 목록이 "없다" 인지 "못 받았다" 인지 화면이 구분해야 한다. */
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  useEffect(() => {
    void fetchAgents().then((list) => {
      setAgents(list);
      setAgentsLoaded(list.length > 0);
    });
    void fetchUsage().then(setUsage);
  }, []);

  /* 예약 실행 알림에서 들어온 경우 (`/chat?scheduleId=N`).
     알림 본문은 "기한이 지난 일정이 2개 있어요" 같은 요약이라, 그것만 보면 **무엇이**
     지났는지 알 수 없다. 그 예약이 던졌던 질문을 그대로 다시 던져 결과 카드를 띄운다.
     한 번 처리한 id 는 ref 에 남겨 리렌더마다 다시 묻지 않게 한다. */
  const { scheduleId } = useLocalSearchParams<{ scheduleId?: string }>();
  const replayedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scheduleId || replayedRef.current === scheduleId) return;
    replayedRef.current = scheduleId;
    void (async () => {
      /* 못 불러온 것과 지워진 것을 **구분해서** 말한다. 목록 조회가 실패했을 뿐인데
         "지워졌어요" 라고 하면, 멀쩡한 예약을 사용자가 다시 만들게 된다. */
      let list: Awaited<ReturnType<typeof fetchSchedules>>;
      try {
        list = await fetchSchedules();
      } catch (e) {
        setMessages((m) => [
          ...m,
          { id: `e-${Date.now()}`, role: 'assistant', text: `예약을 불러오지 못했어요. ${getApiErrorMessage(e)}` },
        ]);
        return;
      }
      const found = list.find((sc) => String(sc.id) === scheduleId);
      if (!found) {
        // 예약이 지워졌는데 알림만 남은 경우. 빈 화면으로 두지 않고 이유를 말한다.
        setMessages((m) => [
          ...m,
          { id: `e-${Date.now()}`, role: 'assistant', text: '이 알림을 보낸 예약이 지워졌어요. 무엇을 도와드릴까요?' },
        ]);
        return;
      }
      setAgentId(found.agentId); // 이어서 물을 때도 같은 역할로
      await ask(found.prompt, found.agentId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleId 변화에만 반응
  }, [scheduleId]);

  const activeAgent = agents.find((a) => a.id === (agentId ?? 'default'));

  /* 배경 빛은 지금 고른 역할의 색을 쓴다 — 역할을 바꾸면 화면 공기가 바뀌어야
     "다른 역할로 말하고 있다" 가 느껴진다. 한 색의 그라데이션이라 섞지 않는다. */
  const accent = AGENT_ACCENT[activeAgent?.id ?? 'default'] ?? (activeAgent?.readOnly ? theme.green : theme.primary);
  const canReset = messages.length > 0 || !!pending;

  const ask = async (raw: string, agentOverride?: string | null) => {
    const t = raw.trim();
    if (!t || busy) return;
    /* 예약 알림에서 들어온 재실행은 그 예약의 역할로 물어야 한다. setAgentId 를 부르고
       바로 ask 하면 이 클로저는 **직전 값**을 들고 있어 엉뚱한 역할로 나간다. */
    const useAgent = agentOverride === undefined ? agentId : agentOverride;
    const session = sessionRef.current;
    setText('');
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text: t }]);
    setBusy(true);
    try {
      const res = await sendChat(t, ctxRef.current as Record<string, unknown>, useAgent, recentHistory(messages));
      if (sessionRef.current !== session) return; // 응답 대기 중 초기화됨 — 폐기
      // 사용량은 답변과 함께 온다 — 따로 다시 물으면 요청만 두 배가 된다
      if (res.usage) setUsage(res.usage);
      // 다음 턴 컨텍스트 갱신 (NEED_MORE_INFO 이어가기 / 검색 id / lastTaskId)
      ctxRef.current = extractContext(res.actions, ctxRef.current);
      setPending(ctxRef.current.pendingAction ?? null);
      // AI 가 서버 상태를 바꿨으면(수정·삭제) 목록·캘린더·홈 캐시를 갱신한다.
      // 이게 없어서 "수정 완료"를 보고 할 일 탭에 가면 옛 값이 그대로였다.
      if (mutatedServerState(res.actions)) {
        void qc.invalidateQueries({ queryKey: ['todos'] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      }
      // 삭제는 되돌릴 수 없다. 서버는 제목이 하나만 얼추 맞아도 바로 지우므로,
      // 무엇이 지워졌는지 분명히 알린다(사전 확인은 서버 계약상 불가 — 사후 고지가 최선).
      const deleted = deletedTaskIds(res.actions);
      if (deleted.length) toast.error(`${deleted.length}건을 삭제했어요 — 되돌릴 수 없어요`);

      const kind = resultKind(res.actions);
      const tasks = extractChatTasks(res.actions);
      const base: Msg = { id: `a-${Date.now()}`, role: 'assistant', text: res.assistantMessage ?? '처리했어요.', steps: res.steps };
      // 보낸 문장을 그대로 다시 읽는다 — 프리뷰와 같은 함수라 같은 추측이 나온다
      const localHints = parseKoreanTask(t);
      if (kind === 'created' && tasks[0]) {
        // 생성은 파싱 초안 → 편집 카드(확정 시 실제 생성). 다건 생성이면 항목 수만큼 카드가 이어진다.
        const draftMsgs: Msg[] = tasks.map((task, i) => ({
          ...base,
          id: `${base.id}-${i}`,
          text: i === 0 ? base.text : '',
          parsed: toParsedDraft(task),
          prompt: t,
          hints: localHints,
        }));
        setMessages((m) => [...m, ...draftMsgs]);
      } else if ((kind === 'updated' || kind === 'listed') && tasks.length) {
        setMessages((m) => [...m, { ...base, tasks, kind }]);
      } else {
        setMessages((m) => [...m, base]);
      }
    } catch (e) {
      if (sessionRef.current !== session) return;
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: 'assistant', text: getApiErrorMessage(e) }]);
    } finally {
      if (sessionRef.current === session) setBusy(false);
    }
  };

  // 대화 초기화 — 메시지 + NEED_MORE_INFO 이어가기 컨텍스트까지 모두 비운다
  const resetChat = () => {
    tickHaptic();
    Alert.alert('대화를 초기화할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: () => {
          sessionRef.current += 1; // 진행 중 응답 폐기
          setMessages([]);
          setBusy(false);
          setPending(null);
          ctxRef.current = {};
        },
      },
    ]);
  };

  // 편집 카드 닫기(취소/확정 후)
  const dismissParsed = (msgId: string) => setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, parsed: undefined } : x)));

  // 편집 카드 "태스크 추가" — 초안으로 실제 할 일 생성
  const confirmParsed = async (msgId: string, d: ParsedDraft) => {
    try {
      const created = await createTodo.mutateAsync({
        title: d.title,
        content: d.description || undefined,
        priority: d.priority as TodoPriority,
        status: d.status as TodoStatus,
        startAt: d.startAt || undefined,
        dueDate: d.dueDate || undefined,
        startTime: d.startTime || undefined,
        endTime: d.endTime || undefined,
        assignees: d.assigneeEmails,
        projectId: d.projectId ?? undefined,
        locationName: d.locationName || undefined,
        locationAddress: d.locationAddress || undefined,
        locationLat: d.locationLat ?? undefined,
        locationLng: d.locationLng ?? undefined,
      });
      // AI가 인식한 태그 부착(실존 태그만 서버 매핑됨).
      // 태그 실패는 '할 일 생성 실패'가 아니다 — 초안을 되살리면 같은 할 일을 또 만들게 되므로
      // 카드는 닫고 태그만 못 붙였다고 알린다.
      if (created?.id != null && d.tags?.length) {
        try {
          await setTags.mutateAsync({ todoId: created.id, tagIds: d.tags.map((t) => t.id) });
        } catch {
          toast.error('할 일은 추가했지만 태그를 붙이지 못했어요');
        }
      }
      dismissParsed(msgId);
    } catch (e) {
      // 예전엔 catch 없이 finally에서 카드를 지워, 실패하면 사용자가 다듬은 초안까지 함께 사라졌다
      // (게다가 unhandled rejection). 실패 시에는 초안을 남겨 그대로 다시 시도할 수 있게 한다.
      toast.error(getApiErrorMessage(e, '할 일을 추가하지 못했어요'));
    }
  };

  return (
    // 채팅은 흰(surface) 배경 — 회색 캔버스에선 어시스턴트 버블(surfaceAlt)이 묻힌다
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'AI 어시스턴트',
          // 이모지만 두면 무슨 역할인지 모른다 — 이름까지 보여준다
          /* 대화 초기화. 예전엔 본문 우상단에 떠 있어서 첫 말풍선을 가렸다.
             보여줄 게 없으면 **함수 자체를 주지 않는다** — 빈 View 를 돌려주면 iOS 26 이
             그 자리에 빈 유리 캡슐을 그린다(아무것도 없는 동그라미가 헤더에 남았다). */
          /* 예약은 항상 있고, 초기화는 대화가 있을 때만 나온다.
             둘 다 없을 때 빈 View 를 돌려주면 iOS 26 이 빈 캡슐을 그리므로, 여기서는
             예약 버튼이 늘 있어서 그 문제가 생기지 않는다. */
          headerRight: () => (
            <View style={styles.headerActions}>
              {canReset ? (
                <Pressable
                  onPress={resetChat}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="대화 초기화"
                  style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.5 }]}>
                  <Ionicons name="refresh" size={17} color={theme.textSecondary} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  tickHaptic();
                  setScheduleOpen(true);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="예약"
                style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.5 }]}>
                <Ionicons name="alarm-outline" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          ),
        }}
      />
      {/* 역할 바.
          예전엔 네이티브 헤더의 headerRight 에 뒀는데, iOS 26 은 바 버튼을 유리 캡슐로
          감싼다(뒤로가기와 같은 처리). 글자 라벨에 그 캡슐이 씌워지면 헤더 위에 떠 있는
          것처럼 겉돌고, native-stack 이 그걸 끄는 옵션(hidesSharedBackground)을 노출하지도
          않는다. 헤더 밖으로 빼서 캡슐 자체를 없앤다.
          겸사겸사 빈 화면에만 뜨던 범위 칩과 합쳤다 — 같은 걸 두 군데서 말할 이유가 없고,
          대화 중에도 "지금 무엇을 할 수 있는 역할인가" 가 보여야 한다. */}
      {activeAgent ? (
        <Pressable
          onPress={() => {
            tickHaptic();
            setPickerOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`역할 고르기: ${activeAgent.name}`}
          style={({ pressed }) => [
            styles.roleBar,
            { borderBottomColor: theme.divider },
            pressed && { backgroundColor: theme.surfaceAlt },
          ]}>
          {/* 목록과 같은 심볼·같은 색. 여기만 이모지면 고르고 나서 다른 역할처럼 보인다. */}
          {(() => {
            const look = agentLook(activeAgent, accent);
            return look.icon ? (
              <Ionicons name={look.icon} size={14} color={look.color} />
            ) : (
              <ThemedText type="small">{look.emoji}</ThemedText>
            );
          })()}
          <ThemedText type="small" style={styles.roleName} numberOfLines={1}>
            {activeAgent.name}
          </ThemedText>
          <View
            style={[
              styles.rolePerm,
              { backgroundColor: withAlpha(activeAgent.readOnly ? theme.green : theme.orange, 0.12) },
            ]}>
            <ThemedText
              type="small"
              style={{ fontWeight: '700', color: activeAgent.readOnly ? theme.green : theme.orange }}>
              {activeAgent.readOnly ? '읽기 전용' : '읽기·쓰기'}
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ flexShrink: 1, color: theme.textTertiary }} numberOfLines={1}>
            {activeAgent.description}
          </ThemedText>
          <Ionicons name="chevron-down" size={13} color={theme.textSecondary} style={styles.roleChevron} />
        </Pressable>
      ) : null}

      {/* 배경 빛은 **화면 전체** 뒤에 깔린다. 리스트 안에 두면 리스트 경계에서 잘려
          가로줄이 생긴다. 대화가 시작되면 걷어낸다 — 말풍선 뒤에 색이 깔릴 이유가 없다. */}
      {messages.length === 0 ? <AiGlow accent={accent} /> : null}

      <AgentPicker
        open={pickerOpen}
        agents={agents}
        selectedId={agentId}
        usage={usage}
        onSelect={setAgentId}
        onEdit={(a) => {
          setPickerOpen(false);
          setEditing(a);
        }}
        onClose={() => setPickerOpen(false)}
      />
      {/* 열려 있을 때만 그린다 + 대상이 바뀌면 새로 만든다(key).
          그래야 편집 화면이 초기값을 그대로 들고 시작한다. */}
      {editing !== undefined ? (
        <AgentEditSheet
          key={editing?.id ?? 'new'}
          agent={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            // 목록을 다시 받아야 방금 만든 역할이 보인다
            void fetchAgents().then(setAgents);
          }}
        />
      ) : null}
      {/* 열려 있을 때만 마운트 — 목록을 매번 새로 받게 한다(다른 기기에서 바꿨을 수 있다) */}
      {scheduleOpen ? <ScheduleSheet agents={agents} agentsLoaded={agentsLoaded} onClose={() => setScheduleOpen(false)} /> : null}
      {/* KeyboardAvoidingView 의 keyboardVerticalOffset 은 헤더 높이를 숫자로 박아야 하는데,
          기기마다 헤더가 달라 어긋난다(90 으로 두었더니 입력창 아래가 키보드에 잘렸다).
          DM 방과 같은 방식으로 키보드 높이를 직접 재서 그만큼 밀어 올린다. */}
      {/* SafeAreaView 가 이미 하단 인셋을 넣고, iOS 키보드 높이에도 홈 인디케이터 영역이
          포함돼 있다. 그대로 더하면 키보드 위에 그만큼 빈 틈이 생기므로 한 번 빼준다. */}
      <View style={[styles.flex, { paddingBottom: Math.max(0, kb - insets.bottom) }]}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }: { item: Msg }) => {
            const mine = item.role === 'user';
            const hasCard = !!item.parsed || !!item.tasks?.length;
            return (
              <View style={[styles.bubbleWrap, mine ? styles.right : styles.left, hasCard && styles.cardWrap]}>
                {item.text ? (
                  mine ? (
                    <View style={[styles.bubble, { backgroundColor: theme.primary }]}>
                      <ThemedText type="default" style={{ color: '#fff' }}>
                        {item.text}
                      </ThemedText>
                    </View>
                  ) : (
                    /* AI 답변에는 표식을 붙인다. 이 화면의 주인공이 AI 인데 사용자 쪽만
                       파란 말풍선으로 구분되고 AI 는 그냥 회색 상자였다. */
                    <View style={styles.aiRow}>
                      <View style={[styles.aiMark, { backgroundColor: theme.primary + '1F' }]}>
                        <Ionicons name="sparkles" size={12} color={theme.primary} />
                      </View>
                      <View style={[styles.bubble, styles.aiBubble, { backgroundColor: theme.surfaceAlt }]}>
                        <ThemedText type="default" style={{ color: theme.text }}>
                          {item.text}
                        </ThemedText>
                      </View>
                    </View>
                  )
                ) : null}
                {/* AI 가 실행한 단계 — 결과 문장만으로는 무엇을 했는지 알 수 없다 */}
                {!mine ? <ChatSteps steps={item.steps} /> : null}
                {item.parsed ? (
                  <ChatParsedCard
                    draft={item.parsed}
                    hints={item.hints}
                    onConfirm={(dd) => confirmParsed(item.id, dd)}
                    onDismiss={() => dismissParsed(item.id)}
                    onRetry={item.prompt ? () => { dismissParsed(item.id); void ask(item.prompt!); } : undefined}
                  />
                ) : null}
                {item.tasks?.length ? <ChatResultCard tasks={item.tasks} kind={item.kind} /> : null}
              </View>
            );
          }}
          ListFooterComponent={
            /* 맨 스피너 대신 답변이 올 자리에 같은 모양으로 세워 둔다 — 어디에 뭐가 나올지
               미리 보이면 기다림이 짧게 느껴진다. */
            busy ? (
              <View style={[styles.bubbleWrap, styles.left]}>
                <View style={styles.aiRow}>
                  <View style={[styles.aiMark, { backgroundColor: theme.primary + '1F' }]}>
                    <Ionicons name="sparkles" size={12} color={theme.primary} />
                  </View>
                  <View style={[styles.bubble, styles.aiBubble, styles.typingBubble, { backgroundColor: theme.surfaceAlt }]}>
                    <ActivityIndicator size="small" />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      생각하는 중
                    </ThemedText>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            /* 예시를 입력창 바로 위에 붙인다.
               화면 중상단에 띄워 두었더니 아래 30% 가 비고, "여기 눌러서 시작한다" 는
               관계도 안 보였다. 엄지 동선도 아래가 맞다. */
            <View style={styles.hero}>
              {/* 가운데 시연 — 문장이 써지고 거기서 뽑아낸 칩이 튀어나온다.
                  누르면 그대로 입력창에 들어간다. */}
              <AiIdleDemo paused={text.length > 0} onPick={setText} />

              <View style={styles.heroBottom}>
                {/* 안내는 한 줄만. 예전엔 "말하듯이 입력하세요" 와 "말하듯 적으면…" 이
                    한 화면에 같은 말을 두 번 했다. 예시 바로 위에 둬야 둘이 한 덩어리로 읽힌다. */}
                <ThemedText type="small" style={[styles.heroDesc, { color: theme.textTertiary }]}>
                  마감·우선순위·장소까지 알아서 채워드려요
                </ThemedText>
              {EXAMPLES.map((ex) => (
                <Pressable
                  key={ex}
                  /* 보내지 않고 **입력창에 채운다.** 화살표를 달아 바로 보내게 했더니
                     하단 전송 버튼과 똑같이 생겨서 어느 쪽인지 예측이 안 됐고,
                     고칠 틈도 없이 나갔다. */
                  onPress={() => {
                    tickHaptic();
                    setText(ex);
                  }}
                  style={({ pressed }) => [
                    styles.exChip,
                    { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText type="small" style={{ color: theme.text }}>
                    {ex}
                  </ThemedText>
                </Pressable>
              ))}
              </View>
            </View>
          }
        />

        {/* 진행 중(이어가기) 인디케이터 — NEED_MORE_INFO 후속 답변 대기 */}
        {pending ? (
          <View style={[styles.pendingBar, { backgroundColor: theme.primary + '12', borderTopColor: theme.divider }]}>
            <View style={[styles.pendingDot, { backgroundColor: theme.primary }]} />
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
              {PENDING_LABELS[pending] ?? '진행'} 이어가는 중
            </ThemedText>
            <Pressable
              onPress={() => {
                ctxRef.current = { lastTaskId: ctxRef.current.lastTaskId, lastSearchIds: ctxRef.current.lastSearchIds };
                setPending(null);
              }}
              hitSlop={8}
              style={styles.pendingCancel}>
              <Ionicons name="close" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}

        {/* 입력창 **바로 위**에 붙는다. 높이가 0↔40 으로만 움직여 입력창이 밀리지 않는다. */}
        <ParsePreview text={text} />

        <View style={styles.composerWrap}>
          {glass ? (
            <GlassView style={styles.composer} glassEffectStyle="regular" isInteractive>
              <ChatComposerRow text={text} setText={setText} onSend={() => ask(text)} busy={busy} pending={!!pending} theme={theme} />
            </GlassView>
          ) : (
            <View style={[styles.composer, { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
              <ChatComposerRow text={text} setText={setText} onSend={() => ask(text)} busy={busy} pending={!!pending} theme={theme} />
            </View>
          )}
        </View>
      </View>

    </SafeAreaView>
  );
}

/** DM 컴포저와 동일한 입력 행 — multiline TextInput + 마이크(음성 입력) + 원형 arrow-up 전송. */
function ChatComposerRow({
  text,
  setText,
  onSend,
  busy,
  pending,
  theme,
}: {
  text: string;
  setText: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  pending: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const canSend = !!text.trim() && !busy;

  // 네이티브 음성 입력 — 웹 ChatWidget의 mic(SpeechRecognition) 네이티브 대체.
  // 듣는 동안 중간 인식 결과가 입력창에 실시간 반영되고, 탭으로 시작/종료 토글.
  const [listening, setListening] = useState(false);
  const baseTextRef = useRef(''); // 음성 시작 시점의 기존 입력 (이어붙이기)

  useSpeechRecognitionEvent('result', (e) => {
    const transcript = e.results?.[0]?.transcript ?? '';
    if (!transcript) return;
    const base = baseTextRef.current;
    setText(base ? `${base} ${transcript}` : transcript);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    // no-speech는 침묵 종료 — 사용자에게 에러로 보이지 않게 무시
    if (e.error !== 'no-speech' && e.error !== 'aborted') toast.error('음성 인식에 실패했어요');
  });
  // 화면 이탈 시 인식 중단
  useEffect(() => {
    return () => {
      try {
        speech?.ExpoSpeechRecognitionModule.abort();
      } catch {
        /* 네이티브 모듈 없는 빌드 — 무시 */
      }
    };
  }, []);

  const toggleVoice = async () => {
    tickHaptic();
    try {
      if (listening) {
        speech?.ExpoSpeechRecognitionModule.stop();
        return;
      }
      if (!speech) {
        toast.info('음성 인식은 앱 업데이트 후 사용할 수 있어요');
        return;
      }
      const perm = await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        toast.info('설정에서 마이크·음성 인식 권한을 허용해주세요');
        return;
      }
      baseTextRef.current = text.trim();
      speech.ExpoSpeechRecognitionModule.start({ lang: 'ko-KR', interimResults: true, continuous: false });
      setListening(true);
    } catch {
      toast.info('음성 인식은 앱 업데이트 후 사용할 수 있어요');
    }
  };

  return (
    <View style={styles.composerRow}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={listening ? '듣고 있어요…' : pending ? '답변을 입력하세요…' : '메시지 입력'}
        placeholderTextColor={listening ? theme.danger : theme.textSecondary}
        multiline
        style={[styles.composerInput, { color: theme.text }]}
      />
      <Pressable
        onPress={() => void toggleVoice()}
        hitSlop={6}
        accessibilityLabel={listening ? '음성 입력 중지' : '음성으로 입력'}
        accessibilityRole="button"
        style={[styles.micBtn, listening && { backgroundColor: theme.danger + '1A' }]}>
        <Ionicons name={listening ? 'stop-circle' : 'mic-outline'} size={22} color={listening ? theme.danger : theme.textSecondary} />
      </Pressable>
      <Pressable onPress={onSend} hitSlop={6} disabled={!canSend} accessibilityLabel="보내기" accessibilityRole="button">
        <Ionicons name="arrow-up-circle" size={32} color={canSend ? theme.primary : theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  roleBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  roleName: { fontWeight: '800' },
  rolePerm: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  roleChevron: { marginLeft: 'auto' },
  container: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: 16, flexGrow: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerIconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  aiMark: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  aiBubble: { flexShrink: 1 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubbleWrap: { maxWidth: '86%', marginVertical: 4, gap: 6 },
  cardWrap: { maxWidth: '96%', width: '96%' },
  right: { alignSelf: 'flex-end' },
  left: { alignSelf: 'flex-start' },
  bubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  // 빈 상태 히어로 + 예시
  // flexGrow 된 리스트 안에서 아래로 붙는다 — 예시가 입력창 바로 위에 오게
  hero: { flex: 1, justifyContent: 'space-between', alignItems: 'stretch', paddingHorizontal: 4, gap: 8 },
  heroBottom: { gap: 8 },
  heroDesc: { textAlign: 'center', lineHeight: 19, marginBottom: 2 },
  exChip: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  // 진행 중 인디케이터
  pendingBar: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  pendingDot: { width: 7, height: 7, borderRadius: 4 },
  pendingCancel: { marginLeft: 'auto' },
  // DM 컴포저와 동일한 네이티브 입력 — 둥근 글래스 surface + multiline + 원형 전송
  composerWrap: { paddingHorizontal: 12, paddingVertical: 8 },
  composer: { borderRadius: 22, paddingHorizontal: 14, paddingVertical: 6, overflow: 'visible', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  micBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  composerInput: { flex: 1, fontSize: 15, lineHeight: 21, maxHeight: 120, paddingTop: 6, paddingBottom: 6 },
});
