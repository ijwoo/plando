import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { AssigneeSection } from '@/features/todo/AssigneeSection';
import { useMapSearchStore } from '@/features/map/searchStore';
import { BottomSheet, CompactDate, SelectChip, type Option } from '@/features/todo/todoPickers';
import { ListGroup } from '@/shared/ui/List';
import { newTodoStatusKey, useCreateTodo } from '@/features/todo/queries';
import { type TodoTemplate } from '@/features/template/api';
import { useTemplates } from '@/features/template/queries';
import { upsertRecurrence, RECURRENCE_OPTIONS, type RecurrenceType } from '@/features/recurrence/api';
import { useProjects } from '@/features/project/queries';
import { projectIcon } from '@/features/project/projectIcons';
import { useSettings } from '@/features/settings/queries';
import { useProjectFilter } from '@/shared/store/projectStore';
import { useMe } from '@/features/auth/queries';
import { defaultDueToDate } from '@/shared/utils/datetime';
import { Segmented } from '@/shared/ui/Segmented';
import { DateField } from '@/shared/ui/DateField';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';
import { toast } from '@/shared/ui/toast';
import {
  priorityColor,
  PRIORITY_OPTIONS,
  statusColor,
  STATUS_OPTIONS,
  type TodoPriority,
} from '@/shared/ui/tone';
import { useStatusMap } from '@/features/status/queries';

/** 할 일 추가 — 헤더 · 제목 · 메타 칩 · 담당자 · 고급 옵션(반복·장소) · 하단 추가. */
export default function NewTodoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const create = useCreateTodo();
  const { data: projects } = useProjects();
  const { data: settings } = useSettings();
  const activeProjectId = useProjectFilter((s) => s.activeProjectId);
  const { data: me } = useMe();
  const myEmail = me?.email;
  // 진입 파라미터 — 지도 위치(좌표/주소), 홈에서 넘긴 마감일·프로젝트 프리필
  const loc = useLocalSearchParams<{
    locationLat?: string;
    locationLng?: string;
    locationName?: string;
    locationAddress?: string;
    dueDate?: string;
    startTime?: string;
    endTime?: string;
    projectId?: string;
    title?: string;
    content?: string;
    /** 템플릿 '편집해서 추가' 프리필 — 우선순위(HIGH|MEDIUM|LOW) */
    priority?: string;
    /** 템플릿 '편집해서 추가' 프리필 — 담당자 이메일 콤마 목록 */
    assignees?: string;
  }>();

  const [title, setTitle] = useState(loc.title ?? '');
  const [content, setContent] = useState(loc.content ?? '');
  const [showDesc, setShowDesc] = useState(!!loc.content);
  // 파라미터 우선순위는 값이 유효할 때만 채택 — 딥링크로 아무 문자열이나 들어오면
  // 칩 라벨이 비고 저장 시 400이 난다.
  const paramPriority = PRIORITY_OPTIONS.some((o) => o.value === loc.priority)
    ? (loc.priority as TodoPriority)
    : undefined;
  const paramAssignees = loc.assignees
    ? loc.assignees.split(',').map((s) => s.trim()).filter(Boolean)
    : null;
  const [priority, setPriority] = useState<TodoPriority>(
    paramPriority ?? (settings?.defaultPriority as TodoPriority) ?? 'MEDIUM',
  );
  const sm = useStatusMap();
  // 상태 초기값을 'TODO'로 박아두면 기본 상태를 바꾼(또는 TODO를 지운) 워크스페이스에서
  // 칩에 보이는 라벨과 실제로 만들어지는 상태가 어긋난다. 직접 고르기 전(null)에는
  // 워크스페이스 기본 상태를 그대로 따른다 — 상태 목록이 아직 안 왔을 때만 'TODO' 폴백.
  const [statusSel, setStatusSel] = useState<string | null>(null);
  const status = statusSel ?? newTodoStatusKey(sm.list);
  const [dueDate, setDueDate] = useState<string | undefined>(loc.dueDate ?? defaultDueToDate(settings?.defaultDue));
  const [projectId, setProjectId] = useState<number>(
    loc.projectId ? Number(loc.projectId) : typeof activeProjectId === 'number' ? activeProjectId : 0,
  );
  // 기본 담당자 = 나 (me 캐시되면 즉시, 늦게 오면 effect로 1회 채움).
  // 템플릿이 담당자를 지정해 들어왔으면 그쪽이 우선 — '나'로 덮어쓰지 않는다.
  const [assignees, setAssignees] = useState<string[]>(paramAssignees ?? (myEmail ? [myEmail] : []));
  const selfDefaulted = useRef(!!myEmail || !!paramAssignees);
  // 고급 옵션 — 위치를 들고 들어와도 기본은 접어둔다(위치는 저장 시 자동 첨부)
  const [advanced, setAdvanced] = useState(false);
  const [startAt, setStartAt] = useState<string | undefined>(undefined);

  // 템플릿 사용 — 웹 AddTodoModal.handleApplyTemplate 미러 (폼 프리필, 빈 값은 기존 유지)
  const { data: templates } = useTemplates();
  const [tplOpen, setTplOpen] = useState(false);
  const applyTemplate = (tpl: TodoTemplate) => {
    tickHaptic();
    if (tpl.defaultTitle) setTitle((prev) => tpl.defaultTitle || prev);
    if (tpl.defaultContent) {
      setContent(tpl.defaultContent);
      setShowDesc(true);
    }
    if (tpl.defaultPriority) setPriority(tpl.defaultPriority as TodoPriority);
    if (tpl.defaultAssigneeEmails?.length) setAssignees(tpl.defaultAssigneeEmails);
    if (tpl.defaultProjectId != null) setProjectId(tpl.defaultProjectId);
    setTplOpen(false);
    toast.success(`'${tpl.name}' 템플릿을 적용했어요`);
  };
  const [recur, setRecur] = useState<RecurrenceType>('NONE');
  const [recurEnd, setRecurEnd] = useState<string | undefined>(undefined);
  // 장소 — 카카오 검색(/map-search)에서 고른 결과 또는 지도에서 넘어온 좌표
  const [place, setPlace] = useState<{ name: string; address?: string; lat?: number; lng?: number } | null>(
    loc.locationLat != null && loc.locationLng != null
      ? { name: loc.locationName ?? '', address: loc.locationAddress, lat: Number(loc.locationLat), lng: Number(loc.locationLng) }
      : loc.locationName
        ? { name: loc.locationName }
        : null,
  );
  // 장소 검색 모달에서 돌아오면 선택값 소비 (일회성 스토어)
  useFocusEffect(
    useCallback(() => {
      const picked = useMapSearchStore.getState().picked;
      if (!picked) return;
      useMapSearchStore.getState().clear();
      setPlace({ name: picked.name, address: picked.address, lat: picked.lat, lng: picked.lng });
    }, []),
  );
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // me가 늦게 로드되면 기본 담당자(나)를 1회 채운다 (사용자가 이미 건드렸으면 유지)
  useEffect(() => {
    if (selfDefaulted.current || !myEmail) return;
    selfDefaulted.current = true;
    setAssignees((prev) => (prev.length ? prev : [myEmail]));
  }, [myEmail]);

  const projectOpts = useMemo<Option<number>[]>(
    () => [
      { value: 0, label: '인박스', icon: 'file-tray-outline' },
      ...(projects ?? []).map((p) => ({ value: p.id ?? 0, label: p.name ?? '프로젝트', color: p.color, icon: projectIcon(p.icon) })),
    ],
    [projects],
  );
  const curProject = projectOpts.find((o) => o.value === projectId) ?? projectOpts[0];
  const priorityOpts = useMemo<Option<TodoPriority>[]>(
    () => PRIORITY_OPTIONS.map((o) => ({ ...o, icon: 'flag', color: priorityColor(theme, o.value) })),
    [theme],
  );
  // 워크스페이스 상태집합(커스텀 포함). 로딩 전엔 기본 3상태 폴백.
  const statusOpts = useMemo<Option<string>[]>(
    () =>
      (sm.list.length ? sm.list : STATUS_OPTIONS.map((o) => ({ statusKey: o.value, label: o.label, color: null }))).map(
        (s: any) => ({ value: (s.statusKey ?? s.value) as string, label: s.label, color: s.color ?? statusColor(theme, s.statusKey ?? s.value) }),
      ),
    [sm.list, theme],
  );

  const canSave = title.trim().length > 0 && !saving;

  const onSave = async () => {
    if (!title.trim()) return;
    setErr(null);
    setSaving(true);
    try {
      const todo = await create.mutateAsync({
        title: title.trim(),
        status,
        priority,
        content: content.trim() || undefined,
        startAt: startAt || undefined,
        dueDate: dueDate || undefined,
        startTime: loc.startTime || undefined,
        endTime: loc.endTime || undefined,
        projectId: projectId > 0 ? projectId : undefined,
        assignees,
        locationName: place?.name?.trim() || undefined,
        locationLat: place?.lat,
        locationLng: place?.lng,
        locationAddress: place?.address || undefined,
      });
      const newId = todo.id;
      if (newId != null && recur !== 'NONE') await upsertRecurrence(newId, recur, recurEnd);
      if (place?.lat != null) qc.invalidateQueries({ queryKey: ['map', 'locationTodos'] });
      toast.success('할 일을 추가했어요');
      router.back();
    } catch (e) {
      setErr(getApiErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          할 일 추가
        </ThemedText>
        {templates?.length ? (
          <Pressable
            onPress={() => {
              tickHaptic();
              setTplOpen(true);
            }}
            hitSlop={8}
            accessibilityLabel="템플릿 사용"
            accessibilityRole="button"
            style={[styles.tplBtn, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="sparkles" size={13} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800' }}>
              템플릿
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.back()} hitSlop={8} style={[styles.closeBtn, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="close" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <View style={[styles.headerDivider, { backgroundColor: theme.divider }]} />

      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          // 하단 입력이 키보드에 가리지 않게 (iOS 전용 — 콘텐츠 인셋만 조정)
          automaticallyAdjustKeyboardInsets>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="할 일 제목을 입력하세요"
            placeholderTextColor={theme.textSecondary}
            autoFocus
            style={[styles.titleInput, { color: theme.text }]}
            multiline
          />

          {showDesc ? (
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="내용"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.descInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          ) : (
            <Pressable onPress={() => setShowDesc(true)} style={styles.linkRow} hitSlop={6}>
              <Ionicons name="reorder-three-outline" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={styles.linkText}>
                설명 추가
              </ThemedText>
            </Pressable>
          )}

          {/* 메타 칩 */}
          <View style={styles.chipRow}>
            <SelectChip icon={curProject.icon ?? 'file-tray-outline'} title="프로젝트" value={projectId} options={projectOpts} onChange={setProjectId} color={curProject.color} active={projectId > 0} />
            <SelectChip icon="flag" title="우선순위" value={priority} options={priorityOpts} onChange={setPriority} color={priorityColor(theme, priority)} active />
            <SelectChip icon="ellipse" title="상태" value={status} options={statusOpts} onChange={setStatusSel} color={sm.color(status) ?? statusColor(theme, status)} active />
          </View>

          {/* 시작/마감 (기본) */}
          <View style={styles.dateChips}>
            <View style={[styles.dateChip, { backgroundColor: theme.backgroundElement, borderColor: startAt ? theme.primary : theme.border }]}>
              <Ionicons name="calendar-outline" size={15} color={theme.textSecondary} />
              <ThemedText type="small" style={styles.dateLabel}>시작</ThemedText>
              <CompactDate
                value={startAt}
                onChange={(d) => {
                  setStartAt(d);
                  if (d && dueDate && d.slice(0, 10) > dueDate.slice(0, 10)) setDueDate(d);
                }}
                onClear={() => setStartAt(undefined)}
              />
            </View>
            <View style={[styles.dateChip, { backgroundColor: theme.backgroundElement, borderColor: dueDate ? theme.primary : theme.border }]}>
              <Ionicons name="flag-outline" size={15} color={theme.textSecondary} />
              <ThemedText type="small" style={styles.dateLabel}>마감</ThemedText>
              <CompactDate
                value={dueDate}
                onChange={(d) => {
                  setDueDate(d);
                  if (d && startAt && d.slice(0, 10) < startAt.slice(0, 10)) setStartAt(d);
                }}
                onClear={() => setDueDate(undefined)}
              />
            </View>
          </View>

          {/* 담당자 */}
          <View style={styles.assigneeRow}>
            <Ionicons name="person-outline" size={16} color={theme.textSecondary} />
            <AssigneeSection value={assignees} onChange={setAssignees} />
          </View>

          {/* 고급 옵션 */}
          <Pressable onPress={() => setAdvanced((v) => !v)} style={styles.advHeader} hitSlop={6}>
            <Ionicons name={advanced ? 'chevron-down' : 'chevron-forward'} size={16} color={theme.text} />
            <ThemedText type="default" style={styles.advTitle}>
              고급 옵션
            </ThemedText>
            {!advanced ? (
              <ThemedText type="small" style={styles.linkText}>
                반복 · 장소
              </ThemedText>
            ) : null}
          </Pressable>

          {advanced ? (
            <View style={styles.advBody}>
              {/* 반복 — 상세와 동일하게 유형 + 종료일(선택) */}
              <ListGroup card style={styles.advCard}>
                <ThemedText type="label" style={styles.advLabel}>
                  반복
                </ThemedText>
                <Segmented options={RECURRENCE_OPTIONS} value={recur} onChange={setRecur} />
                {recur !== 'NONE' ? (
                  <>
                    <ThemedText type="small" style={[styles.advLabel, styles.subEndLabel]}>
                      종료일 (선택)
                    </ThemedText>
                    <DateField value={recurEnd} onChange={setRecurEnd} placeholder="종료일 없음" minimumDate={new Date()} />
                  </>
                ) : null}
              </ListGroup>

              {/* 장소 — 카카오 장소 검색 */}
              <ListGroup card style={styles.advCard}>
                <ThemedText type="label" style={styles.advLabel}>
                  장소
                </ThemedText>
                <Pressable
                  onPress={() => router.push('/map-search')}
                  style={[styles.locPick, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Ionicons name="location-outline" size={18} color={place ? theme.primary : theme.textSecondary} />
                  <View style={styles.flex1}>
                    {place ? (
                      <>
                        <ThemedText type="default" numberOfLines={1}>
                          {place.name || '선택한 장소'}
                        </ThemedText>
                        {place.address ? (
                          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                            {place.address}
                          </ThemedText>
                        ) : null}
                      </>
                    ) : (
                      <ThemedText type="default" style={{ color: theme.textSecondary }}>
                        장소 검색 (예: 강남역)
                      </ThemedText>
                    )}
                  </View>
                  {place ? (
                    <Pressable onPress={() => setPlace(null)} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
                    </Pressable>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                  )}
                </Pressable>
              </ListGroup>
            </View>
          ) : null}

          {err ? (
            <ThemedText type="small" style={[styles.err, { color: theme.danger }]}>
              {err}
            </ThemedText>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.divider, marginBottom: Math.max(0, kb - insets.bottom) }]}>
          <ThemedText type="small" style={styles.linkText}>
            제목 필수 · 날짜는 선택
          </ThemedText>
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={[styles.addBtn, { backgroundColor: canSave ? theme.primary : theme.backgroundElement }]}>
            <ThemedText type="default" style={[styles.addBtnText, { color: canSave ? '#fff' : theme.textSecondary }]}>
              {saving ? '추가 중…' : '추가'}
            </ThemedText>
            <Ionicons name="chevron-forward" size={18} color={canSave ? '#fff' : theme.textSecondary} />
          </Pressable>
        </View>
      </View>
      {/* 템플릿 선택 시트 — 웹 AddTodoMobile 템플릿 시트 미러 */}
      <BottomSheet open={tplOpen} onClose={() => setTplOpen(false)}>
        <View style={styles.tplSheet}>
          <ThemedText type="label" style={styles.tplSheetTitle}>
            템플릿 선택
          </ThemedText>
          <ScrollView style={styles.tplList} showsVerticalScrollIndicator={false}>
            {(templates ?? []).map((tpl) => (
              <Pressable
                key={tpl.id}
                onPress={() => applyTemplate(tpl)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.tplRow, { borderBottomColor: theme.divider }, pressed && { backgroundColor: theme.surfaceSelected }]}>
                <ThemedText type="default" style={styles.tplName}>
                  {tpl.name}
                </ThemedText>
                {tpl.defaultTitle ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                    {tpl.defaultTitle}
                  </ThemedText>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tplBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginRight: 10 },
  tplSheet: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  tplSheetTitle: { textAlign: 'center', fontWeight: '700' },
  tplList: { maxHeight: 420 },
  tplRow: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 },
  tplName: { fontWeight: '700' },
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  headerDivider: { height: StyleSheet.hairlineWidth, marginBottom: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 32, gap: 16 },
  titleInput: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, padding: 0, paddingTop: 4 },
  descInput: { minHeight: 80, borderRadius: 12, padding: 12, textAlignVertical: 'top', fontSize: 15, marginTop: -8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 10, paddingRight: 12 },
  linkText: { opacity: 0.6, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  dateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -8 },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, height: 40 },
  dateLabel: { fontWeight: '700', opacity: 0.6 },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 },
  advHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  advTitle: { fontWeight: '700' },
  advBody: { gap: 10 },
  advCard: { padding: 14, gap: 10 },
  advLabel: { fontWeight: '700', opacity: 0.7 },
  subEndLabel: { marginTop: 4 },
  locPick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 11 },
  flex1: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 46, paddingHorizontal: 22, borderRadius: 999 },
  addBtnText: { fontWeight: '800', fontSize: 15 },
  err: {  },
});
