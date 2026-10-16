import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { projectIcon } from '@/features/project/projectIcons';
import { useProjects } from '@/features/project/queries';
import type { TodoTemplate, TodoTemplateInput } from '@/features/template/api';
import { useApplyTemplate, useCreateTemplate, useDeleteTemplate, useTemplates, useUpdateTemplate } from '@/features/template/queries';
import { AssigneeSection } from '@/features/todo/AssigneeSection';
import { BottomSheet, SelectChip, type Option } from '@/features/todo/todoPickers';
import { useTheme } from '@/hooks/use-theme';
import { GlassButton } from '@/shared/ui/GlassButton';
import { ListGroup, ListRow } from '@/shared/ui/List';
import { Segmented } from '@/shared/ui/Segmented';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { toast } from '@/shared/ui/toast';
import { PRIORITY_OPTIONS, PRIORITY_LABEL, readableOn, type TodoPriority } from '@/shared/ui/tone';
import { radius } from '@/shared/ui/tokens';

export default function TemplatesScreen() {
  const theme = useTheme();
  const { data: templates, isLoading, isError, error, refetch, isRefetching } = useTemplates();
  const { data: projects } = useProjects();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const del = useDeleteTemplate();
  const apply = useApplyTemplate();
  const router = useRouter();

  // 폼 시트 — 새 템플릿·기존 템플릿 수정 공용 (editing이 있으면 수정 모드)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TodoTemplate | null>(null);
  const [name, setName] = useState('');
  const [defaultTitle, setDefaultTitle] = useState('');
  const [defaultContent, setDefaultContent] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('MEDIUM');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  // 기본 프로젝트 선택지 — todo/new의 프로젝트 픽커와 동일 패턴 (0 = 인박스/없음)
  const projectOpts = useMemo<Option<number>[]>(
    () => [
      { value: 0, label: '인박스', icon: 'file-tray-outline' },
      ...(projects ?? []).map((p) => ({ value: p.id ?? 0, label: p.name ?? '프로젝트', color: p.color, icon: projectIcon(p.icon) })),
    ],
    [projects],
  );
  const curProject = projectOpts.find((o) => o.value === projectId) ?? projectOpts[0];

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDefaultTitle('');
    setDefaultContent('');
    setPriority('MEDIUM');
    setAssignees([]);
    setProjectId(0);
    setErr(null);
    setFormOpen(true);
  };

  const openEdit = (t: TodoTemplate) => {
    setEditing(t);
    setName(t.name ?? '');
    setDefaultTitle(t.defaultTitle ?? '');
    setDefaultContent(t.defaultContent ?? '');
    setPriority((t.defaultPriority as TodoPriority) ?? 'MEDIUM');
    setAssignees(t.defaultAssigneeEmails ?? []);
    setProjectId(t.defaultProjectId ?? 0);
    setErr(null);
    setFormOpen(true);
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      setErr('템플릿 이름을 입력해주세요.');
      return;
    }
    setErr(null);
    const input: TodoTemplateInput = {
      name: name.trim(),
      defaultTitle: defaultTitle.trim() || undefined,
      defaultContent: defaultContent.trim() || undefined,
      defaultPriority: priority,
      // 체크리스트 제거 후 UI에서 편집하지 않는 필드. PUT은 전체 교체이므로
      // 수정 시 서버에 남아 있는 기존 값을 그대로 되돌려보내 데이터가 지워지지 않게 한다.
      defaultSubtasks: editing?.defaultSubtasks ?? undefined,
      defaultAssigneeEmails: assignees.length ? assignees : undefined,
      defaultProjectId: projectId > 0 ? projectId : undefined,
    };
    try {
      if (editing?.id != null) {
        await update.mutateAsync({ id: editing.id, input });
        toast.success('템플릿을 수정했어요');
      } else {
        await create.mutateAsync(input); // 추가 토스트는 useCreateTemplate onSuccess에서
      }
      setFormOpen(false);
    } catch (e) {
      setErr(getApiErrorMessage(e));
    }
  };

  const onApply = (t: TodoTemplate) => {
    // 탭 즉시 생성은 헷갈릴 수 있어 확인창으로 — 편집 경로(할 일 추가 프리필)도 함께 제안
    Alert.alert(`'${t.name}' 템플릿`, '이 템플릿으로 할 일을 만들까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '편집해서 추가',
        onPress: () =>
          // 템플릿의 모든 기본값을 넘긴다. 예전엔 제목·내용·프로젝트만 넘겨서, 같은 템플릿인데도
          // '바로 추가'(useApplyTemplate)와 결과가 달랐다 — 우선순위·담당자가 조용히 사라졌다.
          router.push({
            pathname: '/todo/new',
            params: {
              ...(t.defaultTitle ? { title: t.defaultTitle } : {}),
              ...(t.defaultContent ? { content: t.defaultContent } : {}),
              ...(t.defaultProjectId != null ? { projectId: String(t.defaultProjectId) } : {}),
              ...(t.defaultPriority ? { priority: t.defaultPriority } : {}),
              // 배열 파라미터는 라우터마다 해석이 갈려 콤마 문자열로 넘긴다(받는 쪽에서 분해)
              ...(t.defaultAssigneeEmails?.length ? { assignees: t.defaultAssigneeEmails.join(',') } : {}),
            },
          }),
      },
      {
        text: '바로 추가',
        onPress: () =>
          apply.mutate(t, {
            onSuccess: () => toast.success('템플릿으로 할 일을 만들었어요'),
            onError: (e) => toast.error(getApiErrorMessage(e)),
          }),
      },
    ]);
  };

  const onDelete = (t: TodoTemplate) => {
    Alert.alert('템플릿 삭제', `'${t.name}' 템플릿을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => t.id != null && del.mutate(t.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '할 일 템플릿',
          headerRight: () => (
            <Pressable onPress={openCreate} hitSlop={8} accessibilityLabel="템플릿 추가">
              <Ionicons name="add" size={26} color={theme.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        {isLoading ? (
          <SkeletonList rows={5} />
        ) : isError ? (
          <View style={styles.stateBox}>
            <ThemedText type="default" style={{ color: theme.danger }}>
              {getApiErrorMessage(error)}
            </ThemedText>
            <Pressable onPress={() => refetch()}>
              <ThemedText type="link">다시 시도</ThemedText>
            </Pressable>
          </View>
        ) : templates?.length ? (
          <ListGroup>
            {templates.map((t, i) => {
              const assigneeCount = t.defaultAssigneeEmails?.length ?? 0;
              const projName =
                t.defaultProjectId != null ? (projects ?? []).find((p) => p.id === t.defaultProjectId)?.name : undefined;
              // 장식 뱃지 대신 텍스트 메타 한 줄 — 기본 제목 · 우선순위 · 프로젝트 · 담당
              const metaParts = [
                t.defaultTitle,
                PRIORITY_LABEL[(t.defaultPriority as TodoPriority) ?? 'MEDIUM'],
                projName,
                assigneeCount > 0 ? `담당 ${assigneeCount}` : undefined,
              ].filter(Boolean);
              return (
                <ListRow
                  key={t.id}
                  icon="documents"
                  label={t.name ?? '템플릿'}
                  desc={metaParts.length ? metaParts.join(' · ') : undefined}
                  last={i === templates.length - 1}
                  onPress={() => onApply(t)}
                  onLongPress={() => openEdit(t)}
                  right={
                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={() => onApply(t)}
                        disabled={apply.isPending}
                        accessibilityRole="button"
                        accessibilityLabel={`${t.name ?? '템플릿'} 사용`}
                        style={[styles.useBtn, { backgroundColor: theme.primary }]}>
                        <Ionicons name="add" size={15} color={readableOn(theme.primary)} />
                        <ThemedText type="small" style={[styles.useText, { color: readableOn(theme.primary) }]}>
                          사용
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => openEdit(t)} hitSlop={8} style={styles.iconBtn} accessibilityLabel="템플릿 수정">
                        <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
                      </Pressable>
                      <Pressable onPress={() => onDelete(t)} hitSlop={8} style={styles.iconBtn} accessibilityLabel="템플릿 삭제">
                        <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                  }
                />
              );
            })}
          </ListGroup>
        ) : (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="documents-outline" size={30} color={theme.textTertiary} />
            </View>
            <ThemedText type="default" style={styles.emptyTitle}>
              아직 템플릿이 없어요
            </ThemedText>
            <ThemedText type="small" style={[styles.dim, styles.emptyDesc]}>
              자주 쓰는 할 일 양식을 템플릿으로 저장하면{'\n'}한 번에 추가할 수 있어요.
            </ThemedText>
            <GlassButton title="템플릿 만들기" onPress={openCreate} style={styles.emptyBtn} />
          </View>
        )}
      </ScrollView>

      {/* 템플릿 폼 — 헤더 +(새로) 또는 카드 수정으로 여는 바텀시트 */}
      <BottomSheet open={formOpen} onClose={() => setFormOpen(false)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="label" style={styles.sheetTitle}>
            {editing ? '템플릿 수정' : '새 템플릿'}
          </ThemedText>
          <TextField placeholder="템플릿 이름 (예: 주간 회의)" value={name} onChangeText={setName} />
          <TextField placeholder="기본 제목 (선택)" value={defaultTitle} onChangeText={setDefaultTitle} />
          <TextField placeholder="기본 내용 (선택)" value={defaultContent} onChangeText={setDefaultContent} />
          <ThemedText type="small" style={[styles.dim, styles.fieldLabel]}>
            기본 우선순위
          </ThemedText>
          <Segmented options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
          <ThemedText type="small" style={[styles.dim, styles.fieldLabel]}>
            기본 프로젝트 · 담당자
          </ThemedText>
          {/* todo/new와 동일 패턴 — 프로젝트 SelectChip + 담당자 AssigneeSection */}
          <View style={styles.defaultsRow}>
            <SelectChip
              icon={curProject.icon ?? 'file-tray-outline'}
              title="기본 프로젝트"
              value={projectId}
              options={projectOpts}
              onChange={setProjectId}
              color={curProject.color}
              active={projectId > 0}
            />
            <AssigneeSection value={assignees} onChange={setAssignees} />
          </View>
          {err ? (
            <ThemedText type="small" style={[styles.err, { color: theme.danger }]}>
              {err}
            </ThemedText>
          ) : null}
          <GlassButton
            title={editing ? '저장' : '템플릿 추가'}
            loading={create.isPending || update.isPending}
            onPress={onSubmit}
            style={styles.add}
          />
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stateBox: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  container: { flex: 1 },
  list: { padding: 16, gap: 10 },
  dim: { opacity: 0.6 },
  // 플랫 행 우측 — 사용 버튼 + 수정/삭제
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  useBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  useText: { fontWeight: '700' },
  iconBtn: { padding: 2 },
  // 빈 상태
  empty: { alignItems: 'center', gap: 10, paddingTop: 64, paddingHorizontal: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontWeight: '700' },
  emptyDesc: { textAlign: 'center', lineHeight: 19 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 22 },
  // 시트
  sheetContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  sheetTitle: { textAlign: 'center', fontWeight: '700', marginBottom: 4 },
  fieldLabel: { marginTop: 4 },
  defaultsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  err: {  },
  add: { marginTop: 4 },
});
