import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Host, Menu } from '@expo/ui/swift-ui';
import { font, tint } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { CommentSection } from '@/features/comment/CommentSection';
import { propagateRecurrence, type RecurrenceScope } from '@/features/recurrence/api';
import { useRecurrence } from '@/features/recurrence/queries';
import { RecurrenceSection } from '@/features/recurrence/RecurrenceSection';
import { ActivitySection } from '@/features/todo/ActivitySection';
import { AssigneeSection } from '@/features/todo/AssigneeSection';
import { AttachmentSection } from '@/features/todo/AttachmentSection';
import { LocationCard } from '@/features/todo/LocationCard';
import { RichEditorSheet } from '@/features/todo/RichEditorSheet';
import { ParentBreadcrumb, SubtaskSection } from '@/features/todo/SubtaskSection';
import { TagSection } from '@/features/tag/TagSection';
import { StatusPicker } from '@/features/status/StatusPicker';
import { useStatusMap } from '@/features/status/queries';
import { BottomSheet, DateRow, SelectRow, TimeRow, type Option } from '@/features/todo/todoPickers';
import { MarkdownLite } from '@/shared/ui/MarkdownLite';
import { Button as AppButton } from '@/shared/ui/Button';
import { ListGroup, ListRow } from '@/shared/ui/List';
import type { Todo } from '@/features/todo/api';
import { todoKeys, useArchiveTodo, useDeleteTodo, useRestoreTodo, useTodo, useUpdateTodoField, useUpdateTodoFocus } from '@/features/todo/queries';
import { useMe } from '@/features/auth/queries';
import { useWorkspacePermissions } from '@/features/workspace/permissions';
import { useProjects } from '@/features/project/queries';
import { projectIcon } from '@/features/project/projectIcons';
import { toast } from '@/shared/ui/toast';
import { useTheme } from '@/hooks/use-theme';
import {
  priorityColor,
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  statusColor,
  type TodoPriority,
} from '@/shared/ui/tone';

type SaveState = 'idle' | 'saving' | 'saved' | 'readonly';
type Tab = 'overview' | 'comments' | 'attachments' | 'activity';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: '개요' },
  { id: 'comments', label: '댓글' },
  { id: 'attachments', label: '첨부' },
  { id: 'activity', label: '활동' },
];


export default function TodoDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Number(idParam);
  const { data: todo, isLoading, isError, error } = useTodo(id);
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : isError || !todo ? (
        <View style={styles.center}>
          <ThemedText type="default" style={[styles.err, { color: theme.danger }]}>
            {getApiErrorMessage(error)}
          </ThemedText>
        </View>
      ) : (
        <EditForm key={id} id={id} todo={todo} />
      )}
    </SafeAreaView>
  );
}

function EditForm({ id, todo }: { id: number; todo: Todo }) {
  const theme = useTheme();
  const router = useRouter();
  const fieldMut = useUpdateTodoField();
  const focusMut = useUpdateTodoFocus();
  const archive = useArchiveTodo();
  const restore = useRestoreTodo();
  const del = useDeleteTodo();
  const qc = useQueryClient();
  const { data: projects } = useProjects();

  // 딥링크(?tab=comments 등)로 초기 탭 지정 — 댓글 알림에서 바로 댓글로
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  // 본문: 읽기 모드(마크다운 렌더) ↔ 탭하면 WYSIWYG 에디터(웹과 동일한 TipTap, 마크다운 저장).
  // 에디터 로드 실패(오프라인 등) 시에만 플레인 텍스트 편집으로 폴백.
  const [richOpen, setRichOpen] = useState(false);
  const [plainFallback, setPlainFallback] = useState(false);
  const [contentEditing, setContentEditing] = useState(false);
  const contentSel = useRef({ start: 0, end: 0 });
  const openContentEditor = () => {
    if (plainFallback) setContentEditing(true);
    else setRichOpen(true);
  };

  /** 마크다운 미니 툴바 — 선택 영역 감싸기(굵게/기울임) 또는 줄 앞 마커(목록/인용) */
  const applyMd = (kind: 'bold' | 'italic' | 'list' | 'quote') => {
    const { start, end } = contentSel.current;
    const c = content;
    if (kind === 'bold' || kind === 'italic') {
      const mark = kind === 'bold' ? '**' : '*';
      const selText = c.slice(start, end) || '텍스트';
      setContent(c.slice(0, start) + mark + selText + mark + c.slice(end));
      // 연속 적용 대비 — 오프셋을 새 문자열 기준으로 즉시 보정
      contentSel.current = { start: start + mark.length, end: start + mark.length + selText.length };
      return;
    }
    const lineStart = c.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const marker = kind === 'list' ? '- ' : '> ';
    setContent(c.slice(0, lineStart) + marker + c.slice(lineStart));
    contentSel.current = { start: start + marker.length, end: end + marker.length };
  };
  const [tab, setTab] = useState<Tab>(
    tabParam === 'comments' || tabParam === 'attachments' || tabParam === 'activity' ? tabParam : 'overview',
  );
  const [title, setTitle] = useState(todo.title ?? '');
  const [content, setContent] = useState(todo.content ?? '');
  const [status, setStatus] = useState<string>(todo.status ?? 'TODO');
  const sm = useStatusMap();
  const statusHex = sm.color(status) ?? statusColor(theme, status);
  const [priority, setPriority] = useState<TodoPriority>((todo.priority as TodoPriority) ?? 'MEDIUM');
  const [dueDate, setDueDate] = useState<string | undefined>(todo.dueDate ?? undefined);
  const [startAt, setStartAt] = useState<string | undefined>(todo.startAt ?? undefined);
  const [startTime, setStartTime] = useState<string | undefined>(todo.startTime ?? undefined);
  const [endTime, setEndTime] = useState<string | undefined>(todo.endTime ?? undefined);
  const [allDay, setAllDay] = useState(!todo.startTime); // 시작 시간 없으면 하루종일
  const [projectId, setProjectId] = useState<number>(todo.projectId ?? 0);
  const [assignees, setAssignees] = useState<string[]>(
    todo.assignees?.map((a) => a.email).filter((e): e is string => !!e) ?? [],
  );
  const [focused, setFocused] = useState(!!todo.focused);
  // 편집 권한 — 역할 기반(MEMBER 이상, 협업). 담당자 특별대우 제거. 샘플은 읽기전용.
  // 삭제는 canDeleteTodo(작성자 || ADMIN+)로 별도 게이트. 로딩 중이면 잠그지 않고 서버 403 폴백.
  const { data: me } = useMe();
  const myEmail = me?.email;
  const perms = useWorkspacePermissions();
  const canEdit = perms.canEditContent;
  const canDelete = perms.canDeleteTodo(todo);
  const [saveState, setSaveState] = useState<SaveState>(todo.isSample || !canEdit ? 'readonly' : 'idle');
  const readonly = saveState === 'readonly';

  const committed = useRef<Record<string, unknown>>({
    title: todo.title ?? '',
    content: todo.content ?? '',
  });
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitInFlight = useRef<Set<string>>(new Set());
  const commit = useCallback(
    /** after: 이 항목 저장이 **성공한 뒤에만** 이어서 할 일(반복 전파 등) */
    (field: string, value: unknown, after?: () => void) => {
      if (readonly) return;
      setSaveState('saving');
      commitInFlight.current.add(field);
      fieldMut.mutate(
        { id, field, value },
        {
          onSuccess: () => {
            commitInFlight.current.delete(field);
            committed.current[field] = value;
            after?.();
            setSaveState('saved');
            if (savedTimer.current) clearTimeout(savedTimer.current);
            savedTimer.current = setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1200);
          },
          onError: (e) => {
            commitInFlight.current.delete(field);
            const st = (e as { response?: { status?: number } })?.response?.status;
            setSaveState(st === 403 ? 'readonly' : 'idle');
            // 낙관적 값이 화면에 남으므로 실패를 조용히 넘기지 않는다.
            // 서버 사유를 그대로 쓴다 — 예전엔 항상 "네트워크를 확인해주세요"로 덮어써서
            // 400 "'title'는 비울 수 없는 항목입니다." 같은 진짜 원인이 사라졌다.
            // (403 은 위에서 읽기전용 상태로 표시하므로 토스트를 겹치지 않는다)
            if (st !== 403) toast.error(getApiErrorMessage(e, '저장에 실패했어요 — 네트워크를 확인해주세요'));
          },
        },
      );
    },
    [id, readonly, fieldMut],
  );

  // 반복 할 일 여부 — 생성된 인스턴스이거나 자체 반복이 설정된 원본
  const { data: recurrence } = useRecurrence(id);
  const isRecurring =
    todo.recurrenceSourceId != null || (!!recurrence?.recurrenceType && recurrence.recurrenceType !== 'NONE');

  // 반복 항목의 공유 속성(제목·내용·우선순위) 편집 시 적용 범위를 물어본다.
  // 입력/선택은 이미 화면에 반영된 상태로 시트가 뜨므로, 취소하면 **화면도 되돌려야** 한다 —
  // 예전엔 취소해도 새 값이 남아 서버(변경 없음)와 화면이 어긋난 채 "저장됨"으로 보였다.
  const [scopePending, setScopePending] = useState<{ field: string; value: unknown; revert: () => void } | null>(null);

  const requestCommit = (field: string, value: unknown, revert: () => void) => {
    if (committed.current[field] === value) return;
    if (isRecurring) setScopePending({ field, value, revert });
    else commit(field, value);
  };

  const cancelScope = () => {
    scopePending?.revert();
    setScopePending(null);
  };

  const applyScope = (scope: RecurrenceScope) => {
    if (!scopePending) return;
    const { field, value } = scopePending;
    setScopePending(null);
    // 전파는 이 항목 저장이 성공한 뒤에 — 실패(403 등)하면 형제까지 건드리지 않는다.
    // 실패를 삼키면 "이후 모두"를 눌렀는데 이 건만 바뀌는 조용한 반쪽 저장이 된다.
    commit(field, value, () => {
      if (scope === 'THIS') return;
      propagateRecurrence(id, scope, field, value == null ? '' : String(value))
        .then(() => {
          // 형제 인스턴스가 바뀌었으므로 목록·캘린더 캐시를 새로 받는다
          qc.invalidateQueries({ queryKey: todoKeys.all });
        })
        .catch((e) => toast.error(getApiErrorMessage(e, '다른 반복 일정에는 적용하지 못했어요')));
    });
  };

  const commitText = (field: 'title' | 'content', value: string) => {
    const v = value.trim();
    if (committed.current[field] === v) return;
    const prev = (committed.current[field] as string | null) ?? '';
    requestCommit(field, v || null, () => (field === 'title' ? setTitle(prev) : setContent(prev)));
  };

  // 백 스와이프·뒤로가기 등 blur 없이 이탈해도 미커밋 제목/본문을 저장 (웹의 키스트로크 디바운스 커밋 대응).
  // 반복 항목은 범위를 물을 수 없으므로 이 항목에만 저장된다.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      if (readonly) return;
      for (const [field, value] of [['title', title], ['content', content]] as const) {
        if (commitInFlight.current.has(field)) continue; // onBlur 커밋이 진행 중 — 중복 PATCH 방지
        const v = value.trim();
        const cur = (committed.current[field] as string | null) ?? '';
        if (cur !== v) fieldMut.mutate({ id, field, value: v || null });
      }
    };
  });
  useEffect(() => () => flushRef.current(), []);

  // 시작일 ≤ 마감일 보장 — 한쪽이 넘어가면 다른 쪽을 끌어당긴다(자동저장 반영)
  const day = (s?: string) => s?.slice(0, 10) ?? '';
  const onStartChange = (d?: string) => {
    setStartAt(d);
    commit('startAt', d ?? null);
    if (d && dueDate && day(d) > day(dueDate)) {
      setDueDate(d);
      commit('dueDate', d);
    }
  };
  const onDueChange = (d?: string) => {
    setDueDate(d);
    commit('dueDate', d ?? null);
    if (d && startAt && day(d) < day(startAt)) {
      setStartAt(d);
      commit('startAt', d);
    }
  };

  // 하루종일 토글 — 웹과 동일: 켜면 빈 문자열로 시간 제거, 끄면 09:00~10:00 기본값(둘 다 커밋)
  const onToggleAllDay = (v: boolean) => {
    setAllDay(v);
    if (v) {
      setStartTime(undefined);
      setEndTime(undefined);
      commit('startTime', '');
      commit('endTime', '');
    } else {
      setStartTime('09:00');
      setEndTime('10:00');
      commit('startTime', '09:00');
      commit('endTime', '10:00');
    }
  };

  const projectOpts = useMemo<Option<number>[]>(
    () => [
      { value: 0, label: '없음', icon: 'file-tray-outline' },
      ...(projects ?? []).map((p) => ({ value: p.id ?? 0, label: p.name ?? '프로젝트', color: p.color, icon: projectIcon(p.icon) })),
    ],
    [projects],
  );
  const priorityOpts = useMemo<Option<TodoPriority>[]>(
    () => PRIORITY_OPTIONS.map((o) => ({ ...o, icon: 'flag', color: priorityColor(theme, o.value) })),
    [theme],
  );

  // 보관/복원/삭제는 훅에 onError가 없다 — 실패하면 화면이 그대로라 "눌러도 아무 일 없음"으로 보인다.
  // 서버 사유(권한·샘플 등 한국어)를 그대로 띄운다.
  const onArchive = () =>
    archive.mutate(id, {
      onSuccess: () => { toast.success('보관함으로 옮겼어요'); router.back(); },
      onError: (e) => toast.error(getApiErrorMessage(e, '보관하지 못했어요')),
    });
  // 포커스는 per-user 전용 엔드포인트 — 편집권한(readonly)과 무관하게 내게만 적용된다
  const onToggleFocus = () => {
    const v = !focused;
    setFocused(v);
    focusMut.mutate({ id, focused: v }, { onError: () => { setFocused(!v); toast.error('포커스 변경에 실패했어요'); } });
  };
  const onRestore = () =>
    restore.mutate(id, {
      onSuccess: () => { toast.success('복원했어요'); router.back(); },
      onError: (e) => toast.error(getApiErrorMessage(e, '복원하지 못했어요')),
    });
  const onDelete = () =>
    Alert.alert('삭제', '이 할 일을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          del.mutate(id, {
            onSuccess: () => router.back(),
            onError: (e) => toast.error(getApiErrorMessage(e, '삭제하지 못했어요')),
          }),
      },
    ]);

  const saveLabel = saveState === 'saving' ? '저장 중…' : saveState === 'readonly' ? '읽기 전용' : '저장됨';
  const author = todo.userName || todo.userEmail;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로" accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.flex} />
        <Pressable
          onPress={onToggleFocus}
          hitSlop={8}
          style={styles.headerFocus}
          accessibilityLabel={focused ? '집중 해제' : '집중'}
          accessibilityRole="button">
          <Ionicons name={focused ? 'flash' : 'flash-outline'} size={20} color={focused ? theme.primary : theme.textSecondary} />
        </Pressable>
        <DetailMenu archived={!!todo.archived} onArchive={onArchive} onRestore={onRestore} onDelete={onDelete} disabled={readonly} canDelete={canDelete} />
      </View>

      {/* 읽기 전용 안내 — 조용한 403 대신 이유를 명확히 */}
      {readonly ? (
        <View style={[styles.roBanner, { backgroundColor: theme.surfaceAlt }]}>
          <Ionicons name="lock-closed-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {todo.isSample ? '샘플 할 일이라 수정할 수 없어요' : !canEdit ? '읽기 전용 역할이라 수정할 수 없어요' : '읽기 전용'}
          </ThemedText>
        </View>
      ) : null}

      {/* 서브태스크 상세 — 상위 할 일 브레드크럼 (깊이 1단계라 하위 서브태스크 섹션은 없음) */}
      {todo.parentId != null ? <ParentBreadcrumb parentId={todo.parentId} /> : null}

      <TextInput
        value={title}
        onChangeText={setTitle}
        onBlur={() => commitText('title', title)}
        placeholder="제목"
        placeholderTextColor={theme.textSecondary}
        editable={!readonly}
        style={[styles.title, { color: theme.text }]}
        multiline
      />

      {/* 배지 행 */}
      <View style={styles.badges}>
        <View style={[styles.badge, { backgroundColor: statusHex + '26' }]}>
          <ThemedText type="small" style={{ color: statusHex, fontWeight: '700' }}>
            {sm.label(status) || '할 일'}
          </ThemedText>
        </View>
        <View style={[styles.badge, { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
          <Ionicons name="flag" size={11} color={priorityColor(theme, priority)} />
          <ThemedText type="small" style={{ color: theme.text, fontWeight: '700' }}>
            {PRIORITY_LABEL[priority]}
          </ThemedText>
        </View>
        {author ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            작성자 : {author}
          </ThemedText>
        ) : null}
      </View>

      {/* 탭 */}
      <View style={[styles.tabs, { borderBottomColor: theme.divider }]}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tab}>
              <ThemedText type="default" style={{ color: active ? theme.text : theme.textSecondary, fontWeight: active ? '700' : '500' }}>
                {t.label}
              </ThemedText>
              <View style={[styles.tabBar, { backgroundColor: active ? theme.text : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>

      {tab === 'comments' ? (
        <View style={styles.flex}>
          <CommentSection todoId={id} />
        </View>
      ) : tab === 'attachments' ? (
        <ScrollView keyboardShouldPersistTaps="handled">
          <AttachmentSection todoId={id} readonly={readonly} />
        </ScrollView>
      ) : tab === 'activity' ? (
        <ScrollView>
          <ActivitySection todoId={id} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* 내용 — 읽기: 마크다운 렌더 / 탭: 편집 */}
          <ListGroup card style={styles.contentCard}>
            {!contentEditing && content.trim() ? (
              <Pressable
                onPress={readonly ? undefined : openContentEditor}
                accessibilityLabel="내용 편집"
                style={styles.contentInput}>
                <MarkdownLite text={content} />
              </Pressable>
            ) : !contentEditing && !readonly && !plainFallback ? (
              <Pressable onPress={openContentEditor} accessibilityLabel="내용 추가" style={styles.contentInput}>
                <ThemedText type="default" style={{ color: theme.textSecondary }}>
                  내용 추가
                </ThemedText>
              </Pressable>
            ) : (
              <>
                {contentEditing && !readonly ? (
                  <View style={[styles.mdToolbar, { borderBottomColor: theme.divider }]}>
                    {(
                      [
                        { k: 'bold', label: 'B', a11y: '굵게', bold: true },
                        { k: 'italic', label: 'I', a11y: '기울임', italic: true },
                        { k: 'list', label: '• 목록', a11y: '목록' },
                        { k: 'quote', label: '❝ 인용', a11y: '인용' },
                      ] as const
                    ).map((b) => (
                      <Pressable
                        key={b.k}
                        onPressIn={(e) => e.preventDefault?.()}
                        onPress={() => applyMd(b.k)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={b.a11y}
                        style={[styles.mdBtn, { backgroundColor: theme.surfaceSelected }]}>
                        <ThemedText
                          type="small"
                          style={{ fontWeight: 'bold' in b && b.bold ? '800' : '600', fontStyle: 'italic' in b && b.italic ? 'italic' : 'normal' }}>
                          {b.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  onSelectionChange={(e) => {
                    contentSel.current = e.nativeEvent.selection;
                  }}
                  onFocus={() => setContentEditing(true)}
                  onBlur={() => {
                    commitText('content', content);
                    setContentEditing(false);
                  }}
                  autoFocus={contentEditing}
                  placeholder="내용 추가"
                  placeholderTextColor={theme.textSecondary}
                  editable={!readonly}
                  multiline
                  style={[styles.contentInput, { color: theme.text }]}
                />
              </>
            )}
          </ListGroup>

          {/* 속성 카드 — 양옆 여백 없이 전체 폭 */}
          <ListGroup card style={styles.propsCard}>
            <StatusPicker
              value={status}
              disabled={readonly}
              onChange={(v) => {
                setStatus(v);
                commit('status', v);
              }}
            />
            <SelectRow
              icon="flag-outline"
              title="우선순위"
              label="우선순위"
              value={priority}
              options={priorityOpts}
              disabled={readonly}
              onChange={(v) => {
                const prev = priority;
                setPriority(v);
                requestCommit('priority', v, () => setPriority(prev));
              }}
            />
            <SelectRow
              icon="folder-outline"
              title="프로젝트"
              label="프로젝트"
              value={projectId}
              options={projectOpts}
              disabled={readonly}
              onChange={(v) => {
                setProjectId(v);
                commit('projectId', v > 0 ? v : null);
              }}
            />
            <DateRow label="시작일" value={startAt} disabled={readonly} onChange={onStartChange} />
            <DateRow label="마감일" value={dueDate} disabled={readonly} onChange={onDueChange} />
            <ListRow dense
              icon="time-outline"
              label="하루종일"
              right={<Switch value={allDay} onValueChange={onToggleAllDay} disabled={readonly} />}
            />
            {!allDay ? (
              <>
                <TimeRow
                  label="시작 시간"
                  value={startTime}
                  disabled={readonly}
                  onChange={(t) => {
                    setStartTime(t);
                    commit('startTime', t ?? '');
                  }}
                />
                <TimeRow
                  label="종료 시간"
                  value={endTime}
                  disabled={readonly}
                  onChange={(t) => {
                    setEndTime(t);
                    commit('endTime', t ?? '');
                  }}
                />
              </>
            ) : null}
            <ListRow dense
              icon="person-outline"
              label="담당자"
              last
              right={
                <View pointerEvents={readonly ? 'none' : 'auto'} style={styles.assigneeRight}>
                  <AssigneeSection
                    value={assignees}
                    onChange={(v) => {
                      setAssignees(v);
                      // 백엔드는 assignees를 콤마 구분 문자열로 받는다(웹과 동일)
                      commit('assignees', v.join(','));
                    }}
                  />
                </View>
              }
            />
          </ListGroup>

          {/* 태그(라벨) */}
          <ListGroup card style={styles.sectionCard}>
            <TagSection todoId={id} tags={todo.tags ?? []} readonly={readonly} />
          </ListGroup>

          {/* 위치 — 좌표가 있으면 정적 지도 카드, 없으면 표시 안 함 */}
          <LocationCard todo={todo} />

          {/* 서브태스크 — 진짜 할 일 트리(깊이 1). 서브태스크 자신의 상세엔 표시하지 않음 */}
          {todo.parentId == null ? (
            <ListGroup card style={styles.sectionCard}>
              <SubtaskSection
                parentId={id}
                projectColor={projects?.find((p) => p.id === projectId)?.color}
                readonly={readonly}
              />
            </ListGroup>
          ) : null}

          {/* 반복 */}
          <ListGroup card style={styles.sectionCard}>
            <RecurrenceSection todoId={id} readonly={readonly} />
          </ListGroup>
        </ScrollView>
      )}

      {/* 저장 상태 푸터 */}
      <View style={[styles.footer, { borderTopColor: theme.divider }]}>
        <View style={[styles.saveDot, { backgroundColor: readonly ? theme.danger : theme.green }]} />
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {saveLabel}
        </ThemedText>
      </View>

      {/* 반복 항목 편집 범위 선택 */}
      <BottomSheet open={scopePending != null} onClose={cancelScope}>
        <View style={styles.scopeBody}>
          <ThemedText type="label" style={styles.scopeTitle}>
            반복 할 일 — 어디까지 변경할까요?
          </ThemedText>
          <AppButton title="이 일정만" onPress={() => applyScope('THIS')} />
          <AppButton title="이 일정부터 이후 모두" variant="tonal" onPress={() => applyScope('THIS_AND_FOLLOWING')} />
          <AppButton title="전체 반복 일정" variant="tonal" onPress={() => applyScope('ALL')} />
          {/* 취소는 화면 값도 원래대로 — 시트 밖을 눌러 닫아도(onClose) 같은 처리 */}
          <AppButton title="취소" variant="plain" onPress={cancelScope} />
        </View>
      </BottomSheet>

      {/* 본문 WYSIWYG 에디터 — 웹과 동일한 TipTap, 마크다운 저장 */}
      {richOpen ? (
        <RichEditorSheet
          initialMarkdown={content}
          onSave={(md) => {
            setRichOpen(false);
            setContent(md);
            commitText('content', md);
          }}
          onClose={() => setRichOpen(false)}
          onFallback={() => {
            setRichOpen(false);
            setPlainFallback(true);
            setContentEditing(true);
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** 헤더 우측 더보기 — 네이티브 메뉴(보관/삭제). */
function DetailMenu({
  archived,
  onArchive,
  onRestore,
  onDelete,
  disabled,
  canDelete,
}: {
  archived?: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  disabled?: boolean;
  canDelete?: boolean;
}) {
  const theme = useTheme();
  if (disabled) return null;
  return (
    <Host matchContents>
      <Menu label="" systemImage="ellipsis" modifiers={[tint(theme.text), font({ size: 21 })]}>
        {archived ? (
          <Button label="복원" systemImage="arrow.uturn.backward" onPress={onRestore} />
        ) : (
          <Button label="보관" systemImage="archivebox" onPress={onArchive} />
        )}
        {/* 삭제 = 작성자 || ADMIN+ 만 노출 */}
        {canDelete ? (
          <Button label="삭제" systemImage="trash" role="destructive" onPress={onDelete} />
        ) : null}
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  headerFocus: { paddingHorizontal: 4 },
  roBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tabs: { flexDirection: 'row', gap: 20, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { alignItems: 'center', gap: 7, paddingTop: 4 },
  tabBar: { height: 2, alignSelf: 'stretch', borderRadius: 2 },
  body: { padding: 16, gap: 12 },
  contentCard: { padding: 14 },
  propsCard: { marginHorizontal: -16, borderRadius: 0 },
  mdToolbar: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  mdBtn: { minWidth: 34, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  contentInput: { fontSize: 15, lineHeight: 22, minHeight: 40, textAlignVertical: 'top', padding: 0 },
  assigneeRight: { flex: 1, alignItems: 'flex-end' },
  sectionCard: { marginHorizontal: -16, borderRadius: 0, paddingHorizontal: 16, paddingVertical: 14 },
  scopeBody: { gap: 10, paddingHorizontal: 20, paddingBottom: 8 },
  scopeTitle: { marginBottom: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  saveDot: { width: 8, height: 8, borderRadius: 4 },
  err: {  },
});
