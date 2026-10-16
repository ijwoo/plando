import { api } from '@/api/client';
import { toDateString } from '@/shared/utils/datetime';

import type { AgentStep } from './ChatSteps';

/** AI가 만들거나 조회한 할 일 (id는 "T-123" 형식) */
export interface ChatTask {
  id?: string;
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  startAt?: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  assigneeId?: string;
  locationName?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  projectId?: string;
  /** 서버가 워크스페이스 실데이터로 매핑한 태그만 */
  tags?: { id: number; name: string; color?: string | null }[];
}

/** TASK_CREATED 파싱 초안 — 편집 카드에서 확정(태스크 추가) 전까지 보관 (웹 ChatParsedCard 입력) */
export interface ParsedDraft {
  title: string;
  description: string;
  priority: string; // HIGH | MEDIUM | LOW
  status: string;
  startAt?: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  assigneeEmails: string[];
  locationName?: string;
  locationAddress?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  projectId?: number;
  tags?: { id: number; name: string; color?: string | null }[];
}

/** ChatTask → 편집 초안 (웹 processResponse의 parsed 빌드 미러) */
export function toParsedDraft(task: ChatTask): ParsedDraft {
  return {
    title: task.title ?? '',
    description: task.description ?? '',
    priority: (task.priority ?? 'MEDIUM').toUpperCase(),
    status: task.status ?? 'TODO',
    startAt: task.startAt || undefined,
    // 기본 마감일 = **로컬(KST) 오늘**. toISOString()은 UTC라 KST 00:00~09:00 사이엔
    // 하루 전 날짜가 나왔고, 초안을 확정하자마자 이미 지난 마감으로 저장됐다.
    dueDate: task.dueDate || toDateString(new Date()),
    startTime: task.startTime || undefined,
    endTime: task.endTime || undefined,
    assigneeEmails: task.assigneeId ? task.assigneeId.split(',').map((e) => e.trim()).filter(Boolean) : [],
    locationName: task.locationName || undefined,
    locationAddress: task.locationAddress ?? null,
    locationLat: task.locationLat ?? null,
    locationLng: task.locationLng ?? null,
    projectId: task.projectId && !Number.isNaN(Number(task.projectId)) ? Number(task.projectId) : undefined,
    tags: task.tags ?? [],
  };
}

export interface ChatAction {
  type?: string;
  payload?: {
    tasks?: ChatTask[];
    task?: ChatTask;
    id?: string;
    count?: number;
    question?: string;
    missingFields?: string[];
    pendingAction?: string;
    pendingArgs?: Record<string, unknown>;
  };
}

export interface ChatResult {
  assistantMessage?: string;
  actions?: ChatAction[];
  /** AI 가 실행한 단계. 도구를 안 쓴 대화에는 오지 않는다. */
  steps?: AgentStep[];
  /** 이번 요청 후의 오늘 사용량. 답변과 함께 와서 따로 다시 물을 필요가 없다. */
  usage?: AiUsage;
}

export interface AiUsage {
  used: number;
  limit: number;
  remaining?: number;
}

/** 고를 수 있는 역할. 화면에 하드코딩하지 않고 서버에서 받는다 — 양쪽에 두면 조용히 어긋난다. */
export interface ChatAgent {
  id: string;
  name: string;
  emoji?: string;
  description?: string;
  readOnly?: boolean;
  tools?: string[];
  custom?: boolean;
  /** 조회 결과를 한 줄로 요약할지. 켜면 조회마다 AI 를 한 번 더 쓴다. */
  summarize?: boolean;
  /** 답변 문장을 이 역할의 지침대로 다시 쓸지. 끄면 지침은 도구 선택에만 쓰인다. */
  voice?: boolean;
  instructions?: string;
}

/** 다중 턴 대화 컨텍스트 (웹 chatContext 미러) — 매 요청에 함께 보낸다. */
export interface ChatContext {
  lastTaskId?: string;
  lastSearchIds?: string[];
  pendingAction?: string;
  pendingMissingFields?: string[];
  pendingArgs?: Record<string, unknown>;
}

/** 진행 중(pending) 액션 라벨 (웹 PENDING_LABELS) */
export const PENDING_LABELS: Record<string, string> = {
  create_task: '일정 생성',
  update_task: '일정 수정',
  delete_task: '일정 삭제',
  search_tasks: '일정 조회',
};

/** 웹 ChatWidget.extractContext 미러 — 응답 actions로 다음 턴 컨텍스트를 만든다. */
export function extractContext(actions: ChatAction[] = [], prev: ChatContext = {}): ChatContext {
  const needMore = actions.find((a) => a.type === 'NEED_MORE_INFO');
  if (needMore) {
    return {
      lastTaskId: prev.lastTaskId,
      lastSearchIds: prev.lastSearchIds,
      pendingAction: needMore.payload?.pendingAction,
      pendingMissingFields: needMore.payload?.missingFields,
      pendingArgs: needMore.payload?.pendingArgs,
    };
  }
  const listed = actions.find((a) => a.type === 'TASK_LISTED');
  if (listed) {
    const ids = (listed.payload?.tasks ?? []).map((t) => t.id).filter((x): x is string => !!x);
    return { lastTaskId: prev.lastTaskId, lastSearchIds: ids };
  }
  const taskAction = actions.find((a) => (a.type === 'TASK_CREATED' || a.type === 'TASK_UPDATED') && a.payload?.task?.id);
  if (taskAction) return { lastTaskId: taskAction.payload?.task?.id, lastSearchIds: prev.lastSearchIds };
  return { lastTaskId: prev.lastTaskId, lastSearchIds: prev.lastSearchIds };
}

/** 웹 ChatWidget.extractTasks 미러 — actions에서 표시할 task 목록을 뽑는다. */
export function extractChatTasks(actions: ChatAction[] = []): ChatTask[] {
  const collected: ChatTask[] = [];
  for (const a of actions) {
    if (a.type === 'TASK_LISTED') return a.payload?.tasks ?? [];
    // 다건 생성이면 TASK_CREATED 액션이 여러 개 온다 — 전부 수집
    if ((a.type === 'TASK_CREATED' || a.type === 'TASK_UPDATED') && a.payload?.task) collected.push(a.payload.task);
  }
  return collected;
}

/** 응답이 어떤 종류의 결과 카드인지 (헤더 라벨 분기용) */
export function resultKind(actions: ChatAction[] = []): 'created' | 'updated' | 'listed' | null {
  if (actions.some((a) => a.type === 'TASK_CREATED')) return 'created';
  if (actions.some((a) => a.type === 'TASK_UPDATED')) return 'updated';
  if (actions.some((a) => a.type === 'TASK_LISTED')) return 'listed';
  return null;
}

/**
 * 이번 응답에서 서버가 **실제로 데이터를 바꿨는지**.
 *
 * 생성(TASK_CREATED)은 초안일 뿐이라 사용자가 카드를 확정해야 저장된다(서버 로그도 `parsed only,
 * not saved`). 반면 수정·삭제는 서버에서 즉시 반영된다. 예전엔 chat 화면이 쿼리 캐시를 전혀
 * 건드리지 않아, AI 로 고치거나 지운 뒤 할 일 탭에 돌아가면 **옛 내용이 그대로** 보였다.
 */
export function mutatedServerState(actions: ChatAction[] = []): boolean {
  return actions.some((a) => a.type === 'TASK_UPDATED' || a.type === 'TASK_DELETED');
}

/** 이번 응답에 삭제가 포함됐는지 — 되돌릴 수 없으므로 사용자에게 분명히 알린다. */
export function deletedTaskIds(actions: ChatAction[] = []): string[] {
  // 서버는 payload.id 로 내려준다 (ChatService: TASK_DELETED → payload {id})
  return actions
    .filter((a) => a.type === 'TASK_DELETED')
    .map((a) => a.payload?.id ?? '')
    .filter(Boolean);
}

/** "T-123" → 123 (할 일 상세 라우팅용) */
export function chatTaskNumericId(id?: string): number | null {
  if (!id) return null;
  const n = parseInt(id.replace(/^T-/, ''), 10);
  return Number.isNaN(n) ? null : n;
}

/** AI 어시스턴트 — 자연어 메시지로 일정·할 일 추가 등. 백엔드 Spring AI(gpt-4o-mini). */
/** 서버에 실어 보낼 최근 대화 한 턴. */
export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export async function sendChat(
  message: string,
  context: Record<string, unknown> = {},
  agentId?: string | null,
  /**
   * 최근 대화 — 서버가 프롬프트에 실어 맥락을 잡는다("아까 말한 것 중에" 같은 말이 통하게).
   * 서버에 대화를 저장하지 않는 대신 갖고 있는 쪽이 매 요청에 보낸다. 서버도 한 번 더 자른다.
   */
  history: ChatHistoryTurn[] = [],
): Promise<ChatResult> {
  const { data } = await api.post<ChatResult>('/api/chat/service', { message, context, agentId, history });
  return data;
}

/**
 * 역할 목록·사용량.
 *
 * 실패해도 화면이 죽으면 안 된다 — 목록을 못 받으면 기본 역할로, 사용량을 못 받으면
 * 표시만 생략하고 대화는 되게 한다.
 */
export async function fetchAgents(): Promise<ChatAgent[]> {
  try {
    const { data } = await api.get<ChatAgent[]>('/api/chat/agents');
    return Array.isArray(data) ? data : [];
  } catch {
    /* 대화 자체는 기본 역할로 계속돼야 하므로 여기서는 빈 목록을 돌려준다.
       다만 **비었다는 사실을 못 받았다는 뜻으로 읽는 화면**이 있으면 안 된다
       (예약 시트의 "예약할 수 있는 역할이 없어요"). 그런 화면은 agentsLoaded 로 구분한다. */
    return [];
  }
}

/**
 * 역할 만들기·수정·삭제.
 *
 * 조회와 달리 **실패를 삼키지 않는다** — 저장이 안 됐는데 화면이 닫히면 저장된 줄 안다.
 * 목록의 id 는 "custom:12" 형식이고 수정·삭제 경로에는 숫자만 들어간다.
 */
export interface AgentInput {
  name: string;
  emoji?: string;
  description?: string;
  instructions?: string;
  tools: string[];
  summarize?: boolean;
  voice?: boolean;
}

export const rawAgentId = (id: string) => id.replace(/^custom:/, '');

export async function createAgent(body: AgentInput): Promise<ChatAgent> {
  const { data } = await api.post<ChatAgent>('/api/chat/agents', body);
  return data;
}

export async function updateAgent(id: string, body: AgentInput): Promise<ChatAgent> {
  const { data } = await api.put<ChatAgent>(`/api/chat/agents/${rawAgentId(id)}`, body);
  return data;
}

export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/api/chat/agents/${rawAgentId(id)}`);
}

/**
 * 예약 실행 — 역할을 시간에 걸어두기.
 *
 * days 는 'DAILY' 또는 'MON,TUE,...' 형식이다. 한글 요일을 그대로 보내면 서버가 버리고
 * 매일로 되돌린다(모르는 값은 영원히 안 도는 예약이 되므로).
 */
export interface AiSchedule {
  id: number;
  agentId: string;
  prompt: string;
  hour: number;
  minute: number;
  days: string;
  enabled: boolean;
  lastRunAt?: string | null;
}

export type AiScheduleInput = Omit<AiSchedule, 'id' | 'lastRunAt'>;

/**
 * 예약 목록.
 *
 * **실패를 삼키지 않는다.** 빈 배열로 돌려주면 화면은 "아직 예약이 없어요" 를 그리는데,
 * 이건 못 받은 것과 없는 것이 같은 그림이 된다. 실제로 예약 하나를 지운 직후 목록 조회가
 * 429 로 막혀 **둘 다 지워진 것처럼 보인** 일이 있었다(2026-08-22). 부르는 쪽이 실패를
 * 알아야 "불러오지 못했어요, 다시 시도" 를 보여줄 수 있다.
 */
export async function fetchSchedules(): Promise<AiSchedule[]> {
  const { data } = await api.get<AiSchedule[]>('/api/chat/schedules');
  return Array.isArray(data) ? data : [];
}

/** 저장·삭제는 실패를 삼키지 않는다 — 안 됐는데 닫히면 된 줄 안다. */
export async function createSchedule(body: AiScheduleInput): Promise<AiSchedule> {
  const { data } = await api.post<AiSchedule>('/api/chat/schedules', body);
  return data;
}

export async function updateSchedule(id: number, body: AiScheduleInput): Promise<AiSchedule> {
  const { data } = await api.put<AiSchedule>(`/api/chat/schedules/${id}`, body);
  return data;
}

export async function deleteSchedule(id: number): Promise<void> {
  await api.delete(`/api/chat/schedules/${id}`);
}

export async function fetchUsage(): Promise<AiUsage | null> {
  try {
    const { data } = await api.get<AiUsage>('/api/chat/usage');
    return data ?? null;
  } catch {
    return null;
  }
}
