import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Button, Host, Menu } from '@expo/ui/swift-ui';
import { font, tint } from '@expo/ui/swift-ui/modifiers';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useMe } from '@/features/auth/queries';
import { ProjectScopeFilter } from '@/features/project/ProjectScopeFilter';
import { useProjects } from '@/features/project/queries';
import type { Todo } from '@/features/todo/api';
import { KanbanColumn } from '@/features/todo/KanbanColumn';
import { SubtaskListRow, TaskListRow } from '@/features/todo/TaskListRow';
import { useSettings } from '@/features/settings/queries';
import { AssigneePickerSheet } from '@/features/todo/AssigneeSection';
import * as todoApi from '@/features/todo/api';
import { useArchivedTodos, useArchiveTodo, useBulkTodoAction, useCreateTodo, useDeleteTodo, useRestoreTodo, useTodos, useToggleTodo, useUpdateTodoField } from '@/features/todo/queries';
import {
  buildGroups,
  filterForTab,
  filterByAssignees,
  filterByTags,
  sortTodos,
  tabCounts,
  formatMonthDay,
  type MobileTab,
  type SortKey,
} from '@/features/todo/todoFilters';
import { useListPrefs, type ViewMode } from '@/features/todo/listPrefs';
import { ActiveFilterBar } from '@/features/todo/ActiveFilterBar';
import { TaskFilterSheet, type DueFilter } from '@/features/todo/TaskFilterSheet';
import { useSmartViews, viewAssignees, viewTags } from '@/features/todo/smartViews';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { collectRolloverTargets, markRolloverRun, useAutoRollover } from '@/features/todo/autoRollover';
import { BulkEditSheet } from '@/features/todo/BulkEditSheet';
import { useWorkspaceMembers } from '@/features/workspace/queries';
import { useTags } from '@/features/tag/queries';
import { AvatarStack } from '@/shared/ui/Avatar';
import { useProjectFilter } from '@/shared/store/projectStore';
import { Press } from '@/shared/ui/Press';
import { useTabRetap } from '@/shared/ui/tabRetap';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { toDateString } from '@/shared/utils/datetime';
import { shadow } from '@/shared/ui/tokens';
import { BottomTabInset } from '@/constants/theme';
import { TopNav, useTopNavScroll } from '@/shared/ui/TopNav';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspacePermissions } from '@/features/workspace/permissions';
import { doneStatusKey, isTodoDone, undoneStatusKey, useStatusMap } from '@/features/status/queries';
import type { WorkflowStatusLite } from '@/api/typesExt';
import { toast } from '@/shared/ui/toast';
import { readableOn, statusColor, type TodoPriority } from '@/shared/ui/tone';
import { tickHaptic } from '@/shared/ui/haptics';
import { BottomSheet, DateRow } from '@/features/todo/todoPickers';

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'list', label: '목록' },
  { value: 'board', label: '보드' },
];

const TABS: { id: MobileTab; label: string }[] = [
  { id: 'today', label: '오늘' },
  { id: 'week', label: '이번 주' },
  { id: 'all', label: '전체' },
  { id: 'done', label: '완료' },
  { id: 'recurring', label: '반복' },
];

const COLUMN_RATIO = 0.86;
const COLUMN_GAP = 8;

/** 상태집합 로딩 전 보드 폴백(기본 3상태) */
const FALLBACK_BOARD_STATUSES: WorkflowStatusLite[] = [
  { id: -1, statusKey: 'TODO', label: '할 일', color: null, category: 'TODO', sortOrder: 0, isDefault: true },
  { id: -2, statusKey: 'IN_PROGRESS', label: '진행 중', color: null, category: 'IN_PROGRESS', sortOrder: 1, isDefault: false },
  { id: -3, statusKey: 'DONE', label: '완료', color: null, category: 'DONE', sortOrder: 2, isDefault: false },
];

/** 가상화 리스트 행 — 그룹 헤더·할 일·(확장된) 서브태스크 행을 한 배열로 평탄화 */
type ListRowItem =
  | { kind: 'group'; key: string; label: string; accent?: boolean; count: number }
  | { kind: 'todo'; key: string; todo: Todo; isLast: boolean }
  | { kind: 'subtask'; key: string; todo: Todo; isLast: boolean };

export default function TodoScreen() {
  const { data: settings } = useSettings();
  // '간단히 보기' — 목록 행을 제목+마감만으로 줄인다(설정 키는 기존 compactMode 재사용)
  const simpleList = !!settings?.compactMode;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const perms = useWorkspacePermissions();
  const statusMap = useStatusMap();
  const insets = useSafeAreaInsets();
  const { data: todos, isLoading, isError, error, refetch } = useTodos();
  const { data: me } = useMe();
  const { data: projects } = useProjects();
  const activeProjectId = useProjectFilter((s) => s.activeProjectId);
  const toggleTodo = useToggleTodo();
  const archiveTodo = useArchiveTodo();
  const restoreTodo = useRestoreTodo();
  const deleteTodo = useDeleteTodo();
  const fieldMut = useUpdateTodoField();
  const createTodo = useCreateTodo();
  // 인라인 빠른 추가 — 담당자 빠른 지정 포함(기본: 나)
  const [quickAdd, setQuickAdd] = useState('');
  const [quickAddOn, setQuickAddOn] = useState(false);
  const [quickAssignees, setQuickAssignees] = useState<string[]>([]);
  const [quickAssigneeOpen, setQuickAssigneeOpen] = useState(false);
  const [quickDue, setQuickDue] = useState<string | undefined>(undefined);
  const [quickDueOpen, setQuickDueOpen] = useState(false);
  // 시트가 열릴 때 기준으로 1회 계산 (렌더 중 Date.now 호출 금지 — react-compiler purity)
  const quickDueOptions = useMemo(() => {
    const base = new Date();
    const plus = (d: number) => {
      const x = new Date(base);
      x.setDate(base.getDate() + d);
      return toDateString(x);
    };
    return [
      { label: '없음', value: undefined as string | undefined },
      { label: '오늘', value: plus(0) },
      { label: '내일', value: plus(1) },
      { label: '다음 주', value: plus(7) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때마다 오늘 기준 재계산
  }, [quickDueOpen]);
  const pickingAssignee = useRef(false); // 시트가 열리며 입력이 blur돼도 빠른추가가 닫히지 않게
  const quickInputRef = useRef<TextInput>(null);
  // 키보드 높이 — 빠른 추가 도크를 키보드 바로 위에 붙인다 (DM 입력창·홈 AI독과 동일 패턴).
  // 상태 대신 shared value로 두고 키보드 애니메이션 duration에 맞춰 같이 움직인다
  // (상태로 점프시키면 키보드가 내려간 뒤에도 도크가 옛 위치에 잠깐 남는다)
  const kbSV = useSharedValue(0);
  useEffect(() => {
    const ease = { duration: 250, easing: Easing.out(Easing.cubic) };
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      kbSV.value = withTiming(e.endCoordinates.height, { ...ease, duration: e.duration || ease.duration });
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      kbSV.value = withTiming(0, { ...ease, duration: e.duration || ease.duration });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [kbSV]);
  // 키보드 위/하단 안전영역 사이를 부드럽게 오가도록 padding도 함께 보간
  const quickDockStyle = useAnimatedStyle(() => ({
    bottom: kbSV.value,
    paddingBottom: interpolate(kbSV.value, [0, 40], [insets.bottom + 14, 14], 'clamp'),
  }));
  const { data: wsMembers } = useWorkspaceMembers();
  // 다중 선택 모드
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const enterSelect = (id: number) => {
    setSelectMode(true);
    setSelected(new Set([id]));
  };
  // 보드 아카이브 컬럼 — 펼칠 때만 보관 목록을 가져온다(기본 접힘)
  const [archiveOpen, setArchiveOpen] = useState(false);

  // 보드 카드 롱프레스 → 상태 이동 시트 (웹 MobileKanban 매칭)
  const [boardCtx, setBoardCtx] = useState<Todo | null>(null);

  // 탭·보기는 앱을 껐다 켜도 유지된다 — 예전엔 항상 '오늘'+목록으로 초기화됐다
  const tab = useListPrefs((s) => s.tab);
  const setTab = useListPrefs((s) => s.setTab);
  const view = useListPrefs((s) => s.view);
  const setView = useListPrefs((s) => s.setView);
  // 보관 목록은 보드 뷰에서 아카이브 컬럼을 펼쳤을 때만 fetch
  const { data: archivedTodos } = useArchivedTodos(view === 'board' && archiveOpen);
  // 담당 다중 필터 토큰: 'me'(내 할 일) · 'none'(미지정) · <email>(멤버). 합집합(OR).
  const [assigneeSel, setAssigneeSel] = useState<string[]>([]);
  const toggleAssignee = useCallback((token: string) => {
    setAssigneeSel((prev) => (prev.includes(token) ? prev.filter((x) => x !== token) : [...prev, token]));
  }, []);
  // 필터·정렬
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPrio, setFilterPrio] = useState<TodoPriority[]>([]);
  const [filterDue, setFilterDue] = useState<DueFilter>('all');
  // 태그 다중 필터(태그 id). 합집합(OR) — 담당 필터와 같은 규칙.
  const [filterTags, setFilterTags] = useState<number[]>([]);
  const toggleTag = useCallback((id: number) => {
    setFilterTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);
  const { data: allTags } = useTags();
  // 실제로 존재하는 태그만 필터로 인정한다. 태그가 삭제되면(또는 저장된 뷰에 옛 태그가 남아
  // 있으면) 그 id는 아무 할 일과도 매칭되지 않아 목록이 통째로 비는데, 칩도 이름을 못 찾아
  // 그려지지 않으니 화면에는 이유가 전혀 드러나지 않는다. 태그 목록 로딩 전에는 손대지 않는다.
  const activeTags = useMemo(() => {
    if (!allTags) return filterTags;
    const ids = new Set(allTags.map((t) => t.id));
    return filterTags.filter((id) => ids.has(id));
  }, [filterTags, allTags]);
  const [sort, setSort] = useState<SortKey>('default');
  // 필터 시트와 활성 필터 바가 같은 초기화를 쓰도록 한 곳에 둔다
  const resetFilters = useCallback(() => {
    setAssigneeSel([]);
    setFilterPrio([]);
    setFilterDue('all');
    setFilterTags([]);
    setSort('default');
  }, []);
  const togglePrio = useCallback((p: TodoPriority) => {
    setFilterPrio((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }, []);
  const filterActive =
    assigneeSel.length > 0 || filterPrio.length > 0 || activeTags.length > 0 || filterDue !== 'all' || sort !== 'default';

  // 스마트 뷰(저장된 필터) 하이드레이트 — 앱 재시작 후 로컬 저장분 로드
  const hydrateViews = useSmartViews((s) => s.hydrate);
  // 스마트 뷰는 워크스페이스별 저장이라 전환 시 다시 읽어야 한다
  // (전역 저장이던 시절엔 A에서 만든 뷰가 B에서도 떠서 적용하면 목록이 비었다)
  const wsIdForViews = useWorkspaceStore((s) => s.activeId);
  useEffect(() => {
    void hydrateViews();
  }, [hydrateViews, wsIdForViews]);

  // 미완료 자동 이월 — 켜져 있으면 하루 1회, 지난 미완료 내 할 일을 오늘로 옮긴다(투명 토스트)
  const rolloverEnabled = useAutoRollover((st) => st.enabled);
  const hydrateRollover = useAutoRollover((st) => st.hydrate);
  const bulkRollover = useBulkTodoAction();
  const rolloverRan = useRef(false);
  useEffect(() => {
    void hydrateRollover();
  }, [hydrateRollover]);
  useEffect(() => {
    const my = me?.email ?? '';
    if (!rolloverEnabled || rolloverRan.current || !todos || !my) return;
    rolloverRan.current = true; // 세션 내 중복 실행 방지(리페치로 effect 재발화해도)
    void (async () => {
      const targets = await collectRolloverTargets(todos, my);
      if (targets.length) {
        const today = toDateString(new Date());
        await bulkRollover(
          targets.map((t) => t.id).filter((x): x is number => x != null),
          (id) => todoApi.updateTodoField(id, 'dueDate', today),
        );
        toast.success(`지난 미완료 ${targets.length}건을 오늘로 옮겼어요`);
      }
      await markRolloverRun();
    })();
  }, [rolloverEnabled, todos, me?.email, bulkRollover]);

  // 홈 대시보드 카드/미니필·검색 딥링크 — ?tab=…&my=0|1&tag=<id> 적용 후 파라미터 클리어(반복 탭 대응)
  const params = useLocalSearchParams<{ tab?: string; my?: string; tag?: string }>();
  useEffect(() => {
    if (params.tab == null && params.my == null && params.tag == null) return;
    // 딥링크 파라미터를 화면 상태에 반영하는 자리라 effect 안 setState가 불가피하다.
    // (setTab은 이제 zustand 액션이라 규칙 대상이 아니고, setAssigneeSel/setFilterTags만 해당)
    if (params.tab) setTab(params.tab as MobileTab);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.my != null) setAssigneeSel(params.my === '1' ? ['me'] : []);
    if (params.tag != null) {
      const tagId = Number(params.tag);
      // 누적이 아니라 교체 — 앞서 걸어 둔 다른 태그가 남아 있으면 OR라서 엉뚱한 항목까지 딸려 온다
      if (Number.isFinite(tagId)) setFilterTags([tagId]);
    }
    router.setParams({ tab: undefined, my: undefined, tag: undefined });
  }, [params.tab, params.my, params.tag, router]);

  const myEmail = me?.email ?? '';

  // 프로젝트 스코프 → 내 할 일 → 우선순위 → 마감 → 태그 필터 순으로 base 산출
  const baseTodos = useMemo(() => {
    let scoped = (todos ?? []).filter((t) =>
      activeProjectId == null
        ? true
        : activeProjectId === 'inbox'
          ? t.projectId == null
          : t.projectId === activeProjectId,
    );
    if (assigneeSel.length) scoped = filterByAssignees(scoped, assigneeSel, myEmail);
    if (filterPrio.length) scoped = scoped.filter((t) => filterPrio.includes((t.priority as TodoPriority) ?? 'LOW'));
    if (filterDue !== 'all') {
      // 웹 useTaskListFilters.matchesDueDateFilter — 오늘: dueDate=오늘, 지연: dueDate<오늘 && 미완료
      const today = toDateString(new Date());
      scoped = scoped.filter((t) => {
        if (!t.dueDate) return false;
        if (filterDue === 'today') return t.dueDate === today;
        return t.dueDate < today && !isTodoDone(t);
      });
    }
    if (activeTags.length) scoped = filterByTags(scoped, activeTags);
    return scoped;
  }, [todos, activeProjectId, assigneeSel, myEmail, filterPrio, filterDue, activeTags]);

  const counts = useMemo(() => tabCounts(baseTodos), [baseTodos]);

  // 리스트 뷰: 탭별 그룹 (+정렬을 각 그룹에 적용)
  const groups = useMemo(
    () => buildGroups(tab, baseTodos).map((g) => ({ ...g, items: sortTodos(g.items, sort) })),
    [tab, baseTodos, sort],
  );

  // 서브태스크 확장 상태(행 배지 쉐브론 토글) — 화면 로컬
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // parentId → 자식들 — 목록 쿼리에 이미 포함된 todos에서 그룹핑(추가 fetch 없음)
  const childrenMap = useMemo(() => {
    const m = new Map<number, Todo[]>();
    for (const t of todos ?? []) {
      if (t.parentId == null) continue;
      const arr = m.get(t.parentId);
      if (arr) arr.push(t);
      else m.set(t.parentId, [t]);
    }
    return m;
  }, [todos]);

  const todoById = useMemo(() => {
    const m = new Map<number, Todo>();
    for (const t of todos ?? []) if (t.id != null) m.set(t.id, t);
    return m;
  }, [todos]);

  // 서브태스크는 절대 단독 노출하지 않는다(클릭업 방식) — 탭 필터에 자식이 걸리면
  // 부모를 그 그룹으로 승격시키고(그룹 간 전역 중복 제거), 그 부모는 자동 펼침.
  // 부모가 로드 목록에 없을 때(보관 등)만 자식 단독 표시.
  const { listData, autoExpandIds } = useMemo(() => {
    const seen = new Set<number>();
    const auto = new Set<number>();
    const out: ListRowItem[] = [];
    groups.forEach((g, gi) => {
      const items: Todo[] = [];
      for (const t of g.items) {
        if (t.parentId == null) {
          if (t.id == null || seen.has(t.id)) continue;
          seen.add(t.id);
          items.push(t);
        } else {
          const parent = todoById.get(t.parentId);
          if (!parent || parent.id == null) {
            if (t.id != null && !seen.has(t.id)) {
              seen.add(t.id);
              items.push(t);
            }
            continue;
          }
          auto.add(parent.id);
          if (seen.has(parent.id)) continue;
          seen.add(parent.id);
          items.push(parent);
        }
      }
      if (!items.length) return;
      // key에 인덱스를 넣지 않는다 — '완료' 그룹이 생겼다 사라질 때 아래 그룹들의 key가
      // 전부 바뀌어 FlatList가 제거+추가로 오인했다
      out.push({ kind: 'group', key: `g-${g.label}`, label: g.label, accent: !!g.accent, count: items.length });
      items.forEach((item, i) => {
        const isLast = i === items.length - 1;
        out.push({ kind: 'todo', key: `t-${item.id}`, todo: item, isLast });
        // 펼침(수동 XOR 자동) 시 자식 인라인 — 부모의 전체 진행 맥락이라 탭 필터와 무관하게 전부.
        // 단 '간단히 보기'에선 접기 칩이 숨겨지므로 자식도 내보내지 않는다. 자동 펼침은 사용자
        // 조작 없이도 열리기 때문에, 그대로 두면 펼쳐진 채 접을 방법이 없는 상태가 된다.
        const open = !simpleList && item.id != null && (auto.has(item.id) !== expandedIds.has(item.id));
        const kids = open && item.id != null ? childrenMap.get(item.id) : undefined;
        kids?.forEach((k, ki) =>
          out.push({ kind: 'subtask', key: `s-${k.id}`, todo: k, isLast: isLast && ki === kids.length - 1 }),
        );
      });
    });
    return { listData: out, autoExpandIds: auto };
  }, [groups, expandedIds, childrenMap, todoById, simpleList]);

  // 당김 새로고침 — 스피너는 사용자 제스처에만. (isRefetching은 mutation invalidate에도 true가 돼
  // 완료 체크만 해도 RefreshControl이 열리며 콘텐츠를 아래로 밀어냈다)
  const [pulling, setPulling] = useState(false);
  const onPullRefresh = async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  };

  // 보드 뷰: 탭(완료→전체) flat 필터 후 상태별 그룹 (+정렬)
  const boardTab: MobileTab = tab === 'done' ? 'all' : tab;
  // 보드 컬럼 = 워크스페이스 상태집합(커스텀 포함). 카테고리(할일→진행중→완료) 우선 + 카테고리 내 sortOrder로 정렬해
  // 커스텀 상태(예: '검토필요'=진행중)가 생성 순서와 무관하게 제 카테고리 자리에 놓이게 한다. 로딩 중엔 기본 3상태 폴백.
  const boardStatuses = useMemo(() => {
    const base = statusMap.list.length ? statusMap.list : FALLBACK_BOARD_STATUSES;
    const rank: Record<string, number> = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
    return [...base].sort((a, b) => {
      const ca = rank[a.category] ?? 1;
      const cb = rank[b.category] ?? 1;
      return ca !== cb ? ca - cb : (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [statusMap]);
  const boardGrouped = useMemo(() => {
    const flat = filterForTab(boardTab, baseTodos);
    // 서브태스크는 카드로 섞지 않는다 — 자식이 걸리면 부모 카드로 승격(부모 자신의 상태 컬럼)
    const seen = new Set<number>();
    const lifted: Todo[] = [];
    for (const t of flat) {
      const top = t.parentId != null ? (todoById.get(t.parentId) ?? t) : t;
      if (top.id == null || seen.has(top.id)) continue;
      seen.add(top.id);
      lifted.push(top);
    }
    const g: Record<string, Todo[]> = {};
    for (const s of boardStatuses) g[s.statusKey] = [];
    const fallbackKey = boardStatuses[0]?.statusKey ?? 'TODO';
    for (const t of lifted) (g[t.status ?? ''] ?? g[fallbackKey]).push(t);
    const out: Record<string, Todo[]> = {};
    for (const k of Object.keys(g)) out[k] = sortTodos(g[k], sort);
    return out;
  }, [boardTab, baseTodos, sort, todoById, boardStatuses]);

  // 전체 스코프에서만 프로젝트 칩 노출 (웹과 동일)
  const projectMap = useMemo(() => {
    const m = new Map<number, { name: string; color?: string; icon?: string }>();
    for (const p of projects ?? []) if (p.id != null) m.set(p.id, { name: p.name ?? '프로젝트', color: p.color, icon: p.icon });
    return m;
  }, [projects]);
  const showProjectPill = activeProjectId == null;
  // 보드 카드 ⑂ 배지 — 목록 캐시 자식 파생 우선, DTO 카운트 폴백
  const subtaskCounts = useMemo(() => {
    const m = new Map<number, { done: number; total: number }>();
    for (const t of todos ?? []) {
      if (t.id == null) continue;
      const kids = childrenMap.get(t.id);
      if (kids?.length) m.set(t.id, { done: kids.filter((k) => isTodoDone(k)).length, total: kids.length });
      else if (t.subtaskTotal) m.set(t.id, { done: t.subtaskDone ?? 0, total: t.subtaskTotal });
    }
    return m;
  }, [todos, childrenMap]);
  // 보드 카드 프로젝트·담당자: 전체/인박스 스코프에서만 (특정 프로젝트면 숨김)
  const showBoardMeta = typeof activeProjectId !== 'number';

  const colWidth = width * COLUMN_RATIO;

  /**
   * 이 항목을 편집할 수 있는가 — 역할 + 샘플 여부. 서버 PermissionService 와 같은 기준.
   *
   * 권한이 없으면 호출부가 핸들러를 넘기지 않아 스와이프 액션 자체가 렌더되지 않는다.
   * 예전엔 상세 화면에만 게이트가 있어, 목록에서 샘플·VIEWER·남의 할 일을 밀면
   * 완료 햅틱과 체크가 그려진 뒤 403 으로 되돌아왔다.
   */
  const canEditItem = (t: Todo) => perms.canEditContent && !t.isSample;

  const onToggle = (todo: Todo, done: boolean) => todo.id != null && toggleTodo.mutate({ id: todo.id, done });
  const onArchive = (todo: Todo) => {
    if (todo.id == null) return;
    const id = todo.id;
    // 성공 콜백에서 안내한다. 예전엔 요청 직후 무조건 띄워, 실패해도 "실행취소" 토스트가
    // 잠깐 떴다가 전역 에러 토스트로 덮였다.
    archiveTodo.mutate(id, {
      onSuccess: () => toast.action('보관함으로 옮겼어요', '실행취소', () => restoreTodo.mutate(id)),
    });
  };
  const onDeleteOne = (todo: Todo) => {
    if (todo.id == null) return;
    const id = todo.id;
    Alert.alert('할 일 삭제', '이 할 일을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteTodo.mutate(id) },
    ]);
  };
  const onRestore = (todo: Todo) => {
    if (todo.id == null) return;
    restoreTodo.mutate(todo.id, { onSuccess: () => toast.success('복원했어요') });
  };
  const onOpen = (todo: Todo) => todo.id != null && router.push(`/todo/${todo.id}`);
  const onCardLongPress = (todo: Todo) => {
    // 시트를 열되, 편집 불가면 이동 항목을 감추고 이유를 보여준다.
    // 조용히 return 하면 롱프레스가 고장난 것처럼 보인다(둘러보기는 전부 샘플이라
    // 보드 전체에서 아무 반응이 없어진다). 열기·아카이브 같은 읽기 동작은 여전히 유효하다.
    tickHaptic();
    setBoardCtx(todo);
  };
  const moveStatus = (s: string) => {
    const t = boardCtx;
    if (t?.id == null) return;
    fieldMut.mutate(
      { id: t.id, field: 'status', value: s },
      { onSuccess: () => toast.success(`${statusMap.label(s) || s}(으)로 이동`) },
    );
    setBoardCtx(null);
  };

  // 인라인 빠른 추가 — 현재 프로젝트 스코프 + 나를 기본 담당자로 생성, 연속 입력 유지
  const submitQuickAdd = () => {
    const title = quickAdd.trim();
    if (!title) return;
    // 선택한 마감일 우선 — 없으면 오늘/이번 주 탭 기본(오늘)으로 그 탭 필터에 보이도록
    const dueDate = quickDue ?? (tab === 'today' || tab === 'week' ? toDateString(new Date()) : undefined);
    createTodo.mutate({
      title,
      projectId: typeof activeProjectId === 'number' ? activeProjectId : undefined,
      // 담당자: 선택했으면 그 멤버들, 아니면 기본(나)
      assignees: quickAssignees.length ? quickAssignees : myEmail ? [myEmail] : [],
      dueDate,
    });
    setQuickAdd('');
  };

  // 일괄 작업 — 선택된 id들에 병렬 적용(무효화 1회) 후 선택 해제 (완료·보관은 실행취소 토스트)
  const bulkAction = useBulkTodoAction();
  const ids = () => [...selected];
  // 선택 항목이 모두 완료면 일괄 버튼을 "되돌리기"로 전환(완료된 항목에 완료 재적용 방지)
  const selectedTodos = (todos ?? []).filter((t) => t.id != null && selected.has(t.id));
  const allSelectedDone = selectedTodos.length > 0 && selectedTodos.every((t) => isTodoDone(t));
  // 워크스페이스 실제 상태 key — 'DONE'/'TODO'를 지운 워크스페이스에서 400이 나던 문제
  const doneKey = doneStatusKey(statusMap.list);
  const undoneKey = undoneStatusKey(statusMap.list);
  const bulkComplete = () => {
    // 아직 미완료인 항목만 완료 → 실행취소도 그 항목만 되돌려(원래 완료였던 건 유지)
    const applied = selectedTodos.filter((t) => !isTodoDone(t)).map((t) => t.id!) as number[];
    exitSelect();
    if (!applied.length) return;
    // 결과를 받은 뒤 실제 성공 건수로 안내한다(예전엔 요청 전에 낙관적으로 띄웠다).
    void bulkAction(applied, (id) => todoApi.updateTodoStatus(id, doneKey)).then((ok) => {
      if (!ok) return;
      toast.action(`${ok}개 완료`, '실행취소', () => void bulkAction(applied, (id) => todoApi.updateTodoStatus(id, undoneKey)));
    });
  };
  const bulkReopen = () => {
    const applied = selectedTodos.filter((t) => isTodoDone(t)).map((t) => t.id!) as number[];
    exitSelect();
    if (!applied.length) return;
    void bulkAction(applied, (id) => todoApi.updateTodoStatus(id, undoneKey)).then((ok) => {
      if (!ok) return;
      toast.action(`${ok}개 되돌림`, '실행취소', () => void bulkAction(applied, (id) => todoApi.updateTodoStatus(id, doneKey)));
    });
  };
  const bulkArchive = () => {
    const applied = ids();
    exitSelect();
    void bulkAction(applied, (id) => todoApi.archiveTodo(id)).then((ok) => {
      if (!ok) return;
      toast.action(`${ok}개 보관`, '실행취소', () => void bulkAction(applied, (id) => todoApi.restoreTodo(id)));
    });
  };
  const bulkField = (field: string, value: unknown, label: string) => {
    const applied = ids();
    exitSelect();
    void bulkAction(applied, (id) => todoApi.updateTodoField(id, field, value)).then((ok) => {
      if (ok) toast.success(`${ok}개 ${label}`);
    });
  };
  const bulkSetPriority = (p: TodoPriority) => bulkField('priority', p, '우선순위 변경');
  const bulkSetDue = (date?: string) => bulkField('dueDate', date ?? null, date ? '마감일 변경' : '마감일 제거');
  const bulkSetProject = (pid: number) => bulkField('projectId', pid > 0 ? pid : null, '프로젝트 이동');
  const bulkSetAssignees = (emails: string[]) => bulkField('assignees', emails.join(','), '담당자 변경');
  const bulkDelete = () => {
    Alert.alert('할 일 삭제', `${selected.size}개를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void bulkAction(ids(), (id) => todoApi.deleteTodo(id));
          exitSelect();
        },
      },
    ]);
  };

  // 아카이브 컬럼 목록 — 보드 스코프(프로젝트)·내 할 일 필터를 동일 적용
  const archivedScoped = useMemo(() => {
    const scoped = (archivedTodos ?? []).filter((t) =>
      activeProjectId == null
        ? true
        : activeProjectId === 'inbox'
          ? t.projectId == null
          : t.projectId === activeProjectId,
    );
    if (assigneeSel.length) return filterByAssignees(scoped, assigneeSel, myEmail);
    return scoped;
  }, [archivedTodos, activeProjectId, assigneeSel, myEmail]);

  const { navH, scrollY, onScroll } = useTopNavScroll();
  const listRef = useRef<Animated.FlatList<ListRowItem>>(null);
  useTabRetap('todo', () => (listRef.current as unknown as { scrollToOffset?: (o: { offset: number; animated: boolean }) => void })?.scrollToOffset?.({ offset: 0, animated: true }));

  const tabsByMode = view === 'board' ? TABS.filter((t) => t.id !== 'done') : TABS;

  // 탭바(언더라인 5탭) + 내 할 일 토글
  const tabBar = (
    <View style={[styles.tabBar, { borderBottomColor: theme.divider }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
        {tabsByMode.map((t) => {
          const active = tab === t.id;
          const count = counts[t.id];
          return (
            <Press key={t.id} onPress={() => setTab(t.id)} style={styles.tab} scale={1} pressedStyle={{ opacity: 0.6 }}>
              <View style={styles.tabInner}>
                <ThemedText
                  type="label"
                  style={{ color: active ? theme.text : theme.textSecondary, fontWeight: active ? '700' : '500' }}>
                  {t.label}
                </ThemedText>
                {count > 0 ? (
                  <ThemedText
                    type="small"
                    style={{ color: active ? theme.text : theme.textSecondary, opacity: 0.6, fontWeight: '700' }}>
                    {count}
                  </ThemedText>
                ) : null}
              </View>
              <View style={[styles.tabUnderline, { backgroundColor: active ? theme.text : 'transparent' }]} />
            </Press>
          );
        })}
      </ScrollView>
      <View style={styles.tabRight}>
        {/* '내 할 일'은 필터 시트 안으로 통합 — 여기선 필터 버튼만 (활성 시 점 표시) */}
        <Press onPress={() => setFilterOpen(true)} hitSlop={8} style={styles.filterBtn} accessibilityLabel="필터·정렬">
          <Ionicons name="options-outline" size={20} color={filterActive ? theme.primary : theme.textSecondary} />
          {filterActive ? <View style={[styles.filterDot, { backgroundColor: theme.primary }]} /> : null}
        </Press>
      </View>
    </View>
  );

  // 걸려 있는 필터를 칩으로 보여주고 바로 해제 — 필터가 없으면 아무것도 그리지 않는다
  /* 지금 목록을 좁히고 있는 것이 있는가. 빈 화면 문구를 가르는 기준이다. */
  const hasActiveFilter =
    assigneeSel.length > 0 || filterPrio.length > 0 || filterDue !== 'all' || activeTags.length > 0;

  const filterChips = (
    <ActiveFilterBar
      assignees={assigneeSel}
      onClearAssignees={() => setAssigneeSel([])}
      prios={filterPrio}
      onTogglePrio={togglePrio}
      due={filterDue}
      onClearDue={() => setFilterDue('all')}
      tagIds={activeTags}
      onToggleTag={toggleTag}
      onClearAll={resetFilters}
      myEmail={myEmail}
    />
  );

  const header = (
    <>
      <ProjectScopeFilter pendingCount={counts.all} />
      {tabBar}
      {filterChips}
    </>
  );
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isLoading ? (
        <View style={[styles.flex1, { paddingTop: navH + 8 }]}>
          <SkeletonList rows={9} avatar={26} />
        </View>
      ) : isError ? (
        <View style={[styles.center, { paddingTop: navH }]}>
          <ThemedText type="default" style={[styles.error, { color: theme.danger }]}>
            {getApiErrorMessage(error)}
          </ThemedText>
          <Pressable onPress={() => refetch()}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : view === 'board' ? (
        <View style={[styles.flex1, { paddingTop: navH }]}>
          {header}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={colWidth + COLUMN_GAP}
            decelerationRate="fast"
            contentContainerStyle={styles.board}>
            {boardStatuses.map((s) => (
              <KanbanColumn
                key={s.statusKey}
                status={s.statusKey}
                label={s.label}
                dotColor={s.color ?? statusColor(theme, s.statusKey)}
                todos={boardGrouped[s.statusKey] ?? []}
                width={colWidth}
                refreshing={pulling}
                onRefresh={onPullRefresh}
                onToggle={onToggle}
                onOpen={onOpen}
                onLongPress={onCardLongPress}
                showMeta={showBoardMeta}
                projectMap={projectMap}
                subtaskCounts={subtaskCounts}
                bottomPad={BottomTabInset + insets.bottom + 24}
              />
            ))}
            {/* 아카이브 — 기본 접힘, 탭으로 펼침. 카드 왼쪽 버튼은 '복원'(체크박스 아님) */}
            <KanbanColumn
              status="DONE"
              label="아카이브"
              dotColor={theme.textTertiary}
              todos={archivedScoped}
              /* 보관 목록은 펼쳤을 때만 fetch한다(접힌 컬럼 때문에 워크스페이스 전체 보관함을
                 매번 받아오지 않으려고). 그래서 아직 한 번도 받지 않았으면 개수를 모른다 —
                 이때 0을 그리면 "보관함이 비었다"는 거짓말이 된다. 프리페치로 바꾸는 대신
                 모르는 동안 숫자를 감추는 쪽을 택했다: 기본이 접힘이라 대부분의 진입에서
                 쓰지 않을 요청을 늘리지 않고, 한 번 펼치면 캐시가 남아 이후엔 접혀도 정확한
                 개수가 보인다. */
              count={archivedTodos ? archivedScoped.length : null}
              width={colWidth}
              refreshing={pulling}
              onRefresh={onPullRefresh}
              onToggle={(todo) => onRestore(todo)}
              toggleMode="restore"
              onOpen={onOpen}
              showMeta={showBoardMeta}
              projectMap={projectMap}
              bottomPad={BottomTabInset + insets.bottom + 24}
              collapsible
              collapsed={!archiveOpen}
              onToggleCollapse={() => setArchiveOpen((v) => !v)}
            />
          </ScrollView>
        </View>
      ) : (
        <Animated.FlatList
          ref={listRef}
          // 탭·필터가 바뀌면 key로 리마운트 (남은 스크롤 위치·열린 스와이프 상태 초기화)
          key={`${tab}-${String(activeProjectId)}-${assigneeSel.join(',')}-${sort}-${filterPrio.join('.')}-${filterDue}-${activeTags.join('.')}`}
          // 라이트: 리스트를 흰 콘텐츠 시트로(그룹 헤더·여백까지 흰색). 다크: 회색 캔버스 유지.
          style={[styles.flex1, !theme.isDark && { backgroundColor: theme.surface }]}
          data={listData}
          keyExtractor={(row: ListRowItem) => row.key}
          onScroll={onScroll}
          scrollEventThrottle={16}
          stickyHeaderIndices={[0]}
          /* 보이는 항목의 화면상 위치를 유지한다.
             행 높이가 제각각인데 getItemLayout이 없어 FlatList가 높이를 추정한다. 완료/되돌리기로
             화면 **위쪽**의 행이 다른 그룹으로 빠지면 추정과 실제 높이 차이만큼 스크롤이 튀고,
             가상화가 새 행을 실측할 때마다 보정이 반복돼 위아래로 계속 흔들린다.
             (DM 화면 [roomId].tsx가 같은 이유로 이미 쓰고 있다) */
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={{ paddingBottom: BottomTabInset + insets.bottom + 24 }}
          /* itemLayoutAnimation 제거.
             완료/되돌리기로 행이 그룹 사이를 이동할 때(예: '전체' 탭에서 우선순위 그룹 →
             맨 아래 완료 그룹) 이동 거리가 길다. 가상화(windowSize=7) 중에는 그 행이
             렌더 윈도를 들락거리며 언마운트/리마운트되고, 그때마다 레이아웃 애니메이션이
             다시 시작되면서 콘텐츠 높이가 계속 바뀐다 → 화면이 위아래로 떨린다.
             (스티키 헤더가 매 프레임 다시 고정되며 증폭)
             되돌리기가 실제로 동작하게 고친 뒤에야 재현되는 경로라 그동안 드러나지 않았다.
             가상화를 끄거나 애니메이션을 포기해야 하는데, 긴 목록에서 가상화가 우선이다. */
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          // 스피너는 사용자가 당겼을 때만 — 백그라운드 invalidate가 콘텐츠를 밀어내리지 않게
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPullRefresh} progressViewOffset={navH} />}
          // index 0: 프로젝트 선택 + 탭 필터 묶음 — 통째로 스티키. 상단 navH 패딩(불투명)으로
          // 고정 시 TopNav 뒤를 가려 콘텐츠가 비치지 않게 한다.
          ListHeaderComponent={
            <View style={{ backgroundColor: theme.background, paddingTop: navH }}>
              <ProjectScopeFilter pendingCount={counts.all} />
              {tabBar}
              {/* 활성 필터 칩 — 예전엔 보드에만 있었다. 상세에서 태그를 눌러 목록에
                  필터가 걸려도 아무 표시가 없어, 텅 빈 목록을 "할 일이 사라졌다"로 읽혔다. */}
              {filterChips}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceSelected }]}>
                <Ionicons
                  name={tab === 'today' ? 'sunny-outline' : tab === 'done' ? 'checkmark-done-outline' : 'file-tray-outline'}
                  size={28}
                  color={theme.textTertiary}
                />
              </View>
              <ThemedText type="default" style={{ opacity: 0.5 }}>
                {/* 필터 때문에 빈 것과 진짜 없는 것을 구분한다.
                    [고치는 결함] 태그 하나만 걸어도 "할 일이 없어요" 가 떴다 — 50건이 있어도
                    그렇게 말하니 "다 사라졌다" 로 읽힌다. 위에 필터 칩을 붙여 반쯤 가렸지만
                    문구 자체는 여전히 틀린 말을 하고 있었다. */}
                {hasActiveFilter
                  ? '조건에 맞는 할 일이 없어요'
                  : tab === 'today'
                    ? '오늘 할 일을 다 끝냈어요'
                    : tab === 'done'
                      ? '완료한 할 일이 없어요'
                      : '할 일이 없어요'}
              </ThemedText>
              {/* 필터가 원인이면 푸는 길을 준다. 칩을 하나씩 지우는 것보다 빠르고,
                  무엇이 가리고 있었는지도 분명해진다.
                  필터가 없을 때는 CTA 를 두지 않는다 — 인라인 "할 일 추가" 행 + FAB 가
                  이미 같은 역할이라, 또 두면 같은 것을 세 번 말하는 셈이다. */}
              {hasActiveFilter ? (
                <Pressable
                  onPress={() => {
                    tickHaptic();
                    resetFilters();
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.emptyReset, pressed && { opacity: 0.6 }]}>
                  <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                    필터 지우기
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item: row }: { item: ListRowItem }) => {
            if (row.kind === 'group') {
              return (
                <View style={styles.groupHeader}>
                  <ThemedText type="small" style={{ color: row.accent ? theme.primary : theme.textSecondary, fontWeight: '700' }}>
                    {row.label}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, opacity: 0.6, fontWeight: '700' }}>
                    {row.count}
                  </ThemedText>
                </View>
              );
            }
            if (row.kind === 'subtask') {
              const item = row.todo;
              return (
                <SubtaskListRow
                  todo={item}
                  isLast={row.isLast}
                  compact={simpleList}
                  onToggle={(done) => onToggle(item, done)}
                  onOpen={() => onOpen(item)}
                />
              );
            }
            const item = row.todo;
            const proj = showProjectPill && item.projectId != null ? projectMap.get(item.projectId) : undefined;
            // 서브태스크 배지 N/M — 목록 캐시의 자식들에서 파생(낙관 업데이트가 즉시 반영),
            // 자식이 목록 응답에 없으면 부모 DTO의 subtaskTotal/Done 폴백
            const kids = item.id != null ? childrenMap.get(item.id) : undefined;
            const sub = kids?.length
              ? { done: kids.filter((k) => isTodoDone(k)).length, total: kids.length }
              : item.subtaskTotal
                ? { done: item.subtaskDone ?? 0, total: item.subtaskTotal }
                : undefined;
            return (
              <TaskListRow
                todo={item}
                subtasks={sub}
                expanded={item.id != null && (autoExpandIds.has(item.id) !== expandedIds.has(item.id))}
                onToggleExpand={() => item.id != null && toggleExpand(item.id)}
                isLast={row.isLast}
                onToggle={canEditItem(item) ? (done) => onToggle(item, done) : undefined}
                onArchive={canEditItem(item) ? () => onArchive(item) : undefined}
                onDelete={perms.canDeleteTodo(item) ? () => onDeleteOne(item) : undefined}
                onOpen={() => onOpen(item)}
                projectName={proj?.name}
                projectColor={proj?.color}
                projectIconKey={proj?.icon}
                simple={simpleList}
                selectMode={selectMode}
                selected={item.id != null && selected.has(item.id)}
                onLongPress={() => item.id != null && enterSelect(item.id)}
                onToggleSelect={() => item.id != null && toggleSelect(item.id)}
              />
            );
          }}
          // 인라인 빠른 추가 — 새 항목(미완료·비반복)이 보이는 탭에서만
          ListFooterComponent={
            !selectMode && tab !== 'done' && tab !== 'recurring' && perms.canEditContent ? (
              <Pressable
                onPress={() => setQuickAddOn(true)}
                style={[styles.quickAdd, { borderTopColor: theme.divider }]}>
                <Ionicons name="add" size={20} color={theme.primary} />
      <ThemedText type="default" style={{ color: theme.textSecondary }}>
        할 일 추가
      </ThemedText>
    </Pressable>
  ) : null
}
        />
      )}
      {/* 빠른 추가 — 열리면 키보드 바로 위에 도킹 (리스트 푸터에 두면 키보드에 가려 입력·담당자·마감일 조작 불가) */}
      {quickAddOn ? (
        <Animated.View
          entering={FadeInDown.duration(180)}
          exiting={FadeOutDown.duration(160)}
          style={[
            styles.quickDock,
            { backgroundColor: theme.surface, borderTopColor: theme.divider },
            quickDockStyle,
            shadow.float,
          ]}>
          <Ionicons name="add" size={20} color={theme.primary} />
          <TextInput
            ref={quickInputRef}
            value={quickAdd}
            onChangeText={setQuickAdd}
            onSubmitEditing={submitQuickAdd}
            onBlur={() => {
              // 담당자·마감일 시트를 여는 중이면 닫지 않는다.
              // 입력 중이던 내용이 있으면 키보드만 내려가도 도크는 유지 (작성분 보존 — 닫기는 X 버튼)
              if (!pickingAssignee.current && !quickAdd.trim() && !quickAssignees.length && !quickDue) {
                setQuickAddOn(false);
              }
            }}
            placeholder="할 일 추가"
            placeholderTextColor={theme.textTertiary}
            autoFocus
            blurOnSubmit={false}
            returnKeyType="done"
            style={[styles.quickAddInput, { color: theme.text }]}
          />
          {/* 마감일 빠른 지정 — 선택 시 M/D 라벨 */}
          <Press
            onPress={() => {
              pickingAssignee.current = true;
              setQuickDueOpen(true);
              Keyboard.dismiss();
            }}
            hitSlop={8}
            accessibilityLabel="마감일 지정"
            style={styles.quickAssignBtn}>
            {quickDue ? (
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                {formatMonthDay(quickDue)}
              </ThemedText>
            ) : (
              <Ionicons name="calendar-outline" size={19} color={theme.textSecondary} />
            )}
          </Press>
          {/* 담당자 빠른 지정 — 선택 있으면 아바타 스택, 없으면 사람+ 아이콘 */}
          <Press
            onPress={() => {
              pickingAssignee.current = true;
              setQuickAssigneeOpen(true);
              Keyboard.dismiss(); // 시트가 키보드에 가려지지 않게 (blur는 가드가 흡수)
            }}
            hitSlop={8}
            accessibilityLabel="담당자 지정"
            style={styles.quickAssignBtn}>
            {quickAssignees.length ? (
              <AvatarStack
                people={(wsMembers ?? []).filter((m) => m.email && quickAssignees.includes(m.email))}
                size={24}
              />
            ) : (
              <Ionicons name="person-add-outline" size={20} color={theme.textSecondary} />
            )}
          </Press>
          {/* 닫기 — 키보드를 내리고 빠른 추가 종료 (작성 중이던 내용도 정리) */}
          <Press
            onPress={() => {
              Keyboard.dismiss();
              setQuickAddOn(false);
              setQuickAdd('');
              setQuickAssignees([]);
              setQuickDue(undefined);
            }}
            hitSlop={8}
            accessibilityLabel="빠른 추가 닫기"
            style={styles.quickAssignBtn}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </Press>
        </Animated.View>
      ) : null}

      {!isLoading && !isError && !selectMode && !quickAddOn && perms.canEditContent ? (
        <Press
          onPress={() => router.push('/todo/new')}
          scale={0.92}
          style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 8 }]}
          accessibilityLabel="할 일 추가">
          <Ionicons name="add" size={30} color={readableOn(theme.primary)} />
        </Press>
      ) : null}

      {/* 다중 선택 일괄 작업 바 */}
      {selectMode ? (
        <View style={[styles.bulkBar, { backgroundColor: theme.surface, borderTopColor: theme.divider, paddingBottom: insets.bottom + 8 }]}>
          <Pressable onPress={exitSelect} hitSlop={8} style={styles.bulkClose} accessibilityLabel="선택 종료" accessibilityRole="button">
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
          <ThemedText type="default" style={styles.bulkCount}>
            {selected.size}개 선택
          </ThemedText>
          <View style={styles.bulkActions}>
            <Pressable
              onPress={allSelectedDone ? bulkReopen : bulkComplete}
              disabled={!selected.size}
              hitSlop={6}
              style={styles.bulkBtn}
              accessibilityLabel={allSelectedDone ? '되돌리기' : '완료'}
              accessibilityRole="button">
              <Ionicons name={allSelectedDone ? 'arrow-undo-outline' : 'checkmark-circle-outline'} size={24} color={selected.size ? theme.green : theme.textTertiary} />
            </Pressable>
            <Pressable
              onPress={() => selected.size && setBulkEditOpen(true)}
              disabled={!selected.size}
              hitSlop={6}
              style={styles.bulkBtn}
              accessibilityLabel="일괄 편집"
              accessibilityRole="button">
              <Ionicons name="create-outline" size={22} color={selected.size ? theme.textSecondary : theme.textTertiary} />
            </Pressable>
            <Pressable onPress={bulkArchive} disabled={!selected.size} hitSlop={6} style={styles.bulkBtn} accessibilityLabel="보관" accessibilityRole="button">
              <Ionicons name="archive-outline" size={22} color={selected.size ? theme.textSecondary : theme.textTertiary} />
            </Pressable>
            <Pressable onPress={bulkDelete} disabled={!selected.size} hitSlop={6} style={styles.bulkBtn} accessibilityLabel="삭제" accessibilityRole="button">
              <Ionicons name="trash-outline" size={22} color={selected.size ? theme.danger : theme.textTertiary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <TopNav scrollY={scrollY} trailing={<ViewMenu value={view} onChange={setView} />} />

      {/* 인라인 빠른 추가 — 마감일 선택 시트 */}
      <BottomSheet
        open={quickDueOpen}
        onClose={() => {
          setQuickDueOpen(false);
          pickingAssignee.current = false;
          setTimeout(() => quickInputRef.current?.focus(), 200);
        }}>
        <ThemedText type="label" style={styles.quickDueTitle}>
          마감일
        </ThemedText>
        <View style={styles.quickDueChips}>
          {quickDueOptions.map((o) => {
            const active = quickDue === o.value;
            return (
              <Press
                key={o.label}
                onPress={() => setQuickDue(o.value)}
                style={[styles.quickDueChip, { backgroundColor: active ? theme.primary : theme.surfaceAlt }]}>
                <ThemedText type="small" style={{ color: active ? '#fff' : theme.text, fontWeight: '700' }}>
                  {o.label}
                </ThemedText>
              </Press>
            );
          })}
        </View>
        <DateRow label="직접 선택" value={quickDue} onChange={setQuickDue} last />
      </BottomSheet>

      {/* 인라인 빠른 추가 — 담당자 선택 시트 */}
      <AssigneePickerSheet
        open={quickAssigneeOpen}
        onClose={() => {
          setQuickAssigneeOpen(false);
          pickingAssignee.current = false;
          // 이어서 제목을 계속 쓸 수 있게 입력으로 복귀
          setTimeout(() => quickInputRef.current?.focus(), 200);
        }}
        value={quickAssignees}
        onChange={setQuickAssignees}
      />

      <BulkEditSheet
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        count={selected.size}
        onPriority={bulkSetPriority}
        onAssignees={bulkSetAssignees}
        onDue={bulkSetDue}
        onProject={bulkSetProject}
      />

      {/* 보드 카드 롱프레스 → 상태 이동 */}
      <BottomSheet open={boardCtx != null} onClose={() => setBoardCtx(null)}>
        <ThemedText type="label" style={styles.moveTitle} numberOfLines={1}>
          {boardCtx?.title ?? '할 일'}
        </ThemedText>
        {boardCtx && !canEditItem(boardCtx) ? (
          <ThemedText type="small" style={[styles.moveTitle, { color: theme.textSecondary }]}>
            {boardCtx.isSample ? '예시 항목이라 상태를 바꿀 수 없어요' : '편집 권한이 없어요'}
          </ThemedText>
        ) : null}
        {(boardCtx && canEditItem(boardCtx) ? boardStatuses.filter((s) => s.statusKey !== boardCtx?.status) : []).map((s) => (
          <Pressable
            key={s.statusKey}
            onPress={() => moveStatus(s.statusKey)}
            style={({ pressed }) => [styles.moveRow, pressed && { backgroundColor: theme.surfaceSelected }]}>
            <View style={styles.moveLead}>
              <View style={[styles.moveDot, { backgroundColor: s.color ?? statusColor(theme, s.statusKey) }]} />
            </View>
            <ThemedText type="default">{s.label}(으)로 이동</ThemedText>
          </Pressable>
        ))}
        <View style={[styles.moveSep, { backgroundColor: theme.divider }]} />
        <Pressable
          onPress={() => {
            const t = boardCtx;
            setBoardCtx(null);
            if (t) onArchive(t);
          }}
          style={({ pressed }) => [styles.moveRow, pressed && { backgroundColor: theme.surfaceSelected }]}>
          <Ionicons name="archive-outline" size={18} color={theme.textSecondary} style={styles.moveLead} />
          <ThemedText type="default">아카이브</ThemedText>
        </Pressable>
      </BottomSheet>

      <TaskFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        tab={tab}
        assigneeSel={assigneeSel}
        onToggleAssignee={toggleAssignee}
        members={wsMembers ?? []}
        myEmail={myEmail}
        priorities={filterPrio}
        onTogglePriority={(p) => setFilterPrio((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))}
        due={filterDue}
        onDue={setFilterDue}
        tagSel={activeTags}
        onToggleTag={toggleTag}
        sort={sort}
        onSort={setSort}
        onReset={resetFilters}
        onApplyView={(v) => {
          setTab(v.tab);
          setAssigneeSel(viewAssignees(v));
          setFilterPrio(v.prio);
          setFilterDue(v.due);
          setFilterTags(viewTags(v));
          setSort(v.sort);
        }}
      />
    </View>
  );
}

/** 목록/보드 전환 — 네이티브 SwiftUI 메뉴(@expo/ui). 트리거는 아이콘만. TopNav 캡슐에 묶임. */
function ViewMenu({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const theme = useTheme();
  return (
    <Host matchContents>
      <Menu
        label=""
        systemImage={value === 'board' ? 'rectangle.split.3x1' : 'list.bullet'}
        modifiers={[tint(theme.text), font({ size: 21 })]}>
        {VIEW_OPTIONS.map((o) => (
          <Button
            key={o.value}
            label={o.label}
            systemImage={o.value === value ? 'checkmark' : o.value === 'board' ? 'rectangle.split.3x1' : 'list.bullet'}
            onPress={() => onChange(o.value)}
          />
        ))}
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  tabBar: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth, paddingRight: 12 },
  tabScroll: { paddingLeft: 16, gap: 18, alignItems: 'flex-end' },
  tab: { alignItems: 'center', gap: 6 },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 6 },
  tabUnderline: { height: 2, alignSelf: 'stretch', borderRadius: 2 },
  tabRight: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingLeft: 8, paddingRight: 4 },
  filterBtn: { padding: 4 },
  filterDot: { position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  error: { textAlign: 'center' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 56 },
  emptyReset: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 6 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  board: { paddingHorizontal: 8, gap: COLUMN_GAP },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8 },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...shadow.float },
  bulkBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  bulkClose: { padding: 2 },
  bulkCount: { fontWeight: '700', flex: 1 },
  bulkActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bulkBtn: { padding: 2 },
  quickDock: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  quickAdd: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  quickAssignBtn: { paddingLeft: 8, alignItems: 'center', justifyContent: 'center' },
  quickDueTitle: { textAlign: 'center', fontWeight: '700', marginBottom: 10 },
  quickDueChips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 6 },
  quickDueChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  quickAddInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  moveTitle: { fontWeight: '800', paddingHorizontal: 16, paddingBottom: 10, marginBottom: 2 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10 },
  moveLead: { width: 18, alignItems: 'center', textAlign: 'center' },
  moveDot: { width: 9, height: 9, borderRadius: 5 },
  moveSep: { height: StyleSheet.hairlineWidth, marginVertical: 4, marginHorizontal: 16 },
});
