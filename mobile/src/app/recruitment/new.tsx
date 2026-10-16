import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { toJpegUpload } from '@/shared/utils/upload';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useMapSearchStore } from '@/features/map/searchStore';
import type { RecruitmentCreateRequest, RecruitmentDetail } from '@/features/recruitment/api';
import { normalizeMeetType } from '@/features/recruitment/config';
import { rcKeys, useCreateRecruitment, useRecruitment, useUpdateRecruitment } from '@/features/recruitment/queries';
import { createWorkspace, uploadWorkspaceIcon } from '@/features/workspace/api';
import { useMyWorkspaces } from '@/features/workspace/queries';
import { CompactDate } from '@/features/todo/todoPickers';
import { useTheme } from '@/hooks/use-theme';
import { Button as AppButton } from '@/shared/ui/Button';
import { tickHaptic } from '@/shared/ui/haptics';
import { toast } from '@/shared/ui/toast';
import { readableOn } from '@/shared/ui/tone';

// ── 옵션 상수 — 웹 recruitmentFormOptions/recruitmentConfig 1:1 ──
const CATEGORIES = [
  { id: '토이프로젝트', icon: '🚀', color: '#5B8AF5', desc: '가볍게 만들어보는 프로젝트' },
  { id: '사이드프로젝트', icon: '⚡', color: '#9B7BF5', desc: '짧고 굵게 완성하는 프로젝트' },
  { id: '스터디', icon: '📚', color: '#2DD4A0', desc: '함께 공부하며 성장하는 모임' },
  { id: '기타', icon: '✨', color: '#F5A623', desc: '그 외 모집' },
];
const ROLE_OPTIONS = [
  '프론트엔드 개발자', '백엔드 개발자', '풀스택 개발자', '모바일 개발자', 'AI/ML 엔지니어',
  '디자이너 (UI/UX)', '기획자/PM', '데이터 엔지니어', 'DevOps/인프라', 'QA 엔지니어', 'CTO급 개발자',
];
const STACK_OPTIONS = [
  'React', 'Next.js', 'Vue', 'TypeScript', 'JavaScript', 'Spring', 'Node.js', 'Django', 'FastAPI',
  'NestJS', 'Python', 'Kotlin', 'Swift', 'Flutter', 'Dart', 'Figma', 'AWS', 'Firebase', 'PostgreSQL',
  'MySQL', 'Redis', 'Docker', 'GraphQL', '디자인 시스템',
];
const FREQ_OPTIONS = ['주 1회', '주 2회', '주 3회', '주 4회 이상', '유동적'];
const DURATION_OPTIONS = ['1개월', '2개월', '3개월', '6개월', '1년 이상', '기간 미정'];
const TOOL_OPTIONS = ['Discord', 'Slack', '카카오톡', 'Notion', 'Zoom', 'Google Meet'];
const MEET_TYPES = [
  { id: 'online', icon: '🌐', label: '온라인 전용', sub: '원격으로 진행' },
  { id: 'offline', icon: '📍', label: '오프라인 전용', sub: '직접 만나서 진행' },
  { id: 'hybrid', icon: '⚡', label: '온/오프 혼합', sub: '두 방식 모두 활용' },
];
const MAX_TEAM = 20;
const STEP_LABELS = ['워크스페이스', '기본 정보', '모집 역할', '진행 방식', '미리보기'];

type Role = { key: string; name: string; count: number; desc: string };
type Loc = { name: string; address?: string; lat: number; lng: number } | null;

let roleSeq = 0;

// 매 렌더 동일 참조여야 함 — 인라인 함수 포함 옵션은 setOptions 루프를 유발
const STATIC_SCREEN_OPTIONS = { headerShown: false } as const;

/** 팀 모집 작성/수정 — 웹 4단계 위저드 + 워크스페이스 게이트 1:1 이식. ?edit=<id>로 수정 모드. */
export default function RecruitmentNewScreen() {
  const theme = useTheme();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editId = edit ? Number(edit) : null;
  const { data: editData } = useRecruitment(editId ?? 0, editId != null);

  // 수정 모드는 데이터 로드 후 폼 마운트 — useState 초기값으로 프리필 (렌더 중/이펙트 setState 회피)
  if (editId != null && !editData) {
    return (
      <View style={[styles.container, styles.loadingWrap, { backgroundColor: theme.background }]}>
        <Stack.Screen options={STATIC_SCREEN_OPTIONS} />
        <ActivityIndicator />
      </View>
    );
  }
  return <WizardForm editId={editId} initial={editId != null ? editData : undefined} />;
}

function WizardForm({ editId, initial }: { editId: number | null; initial?: RecruitmentDetail }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(0);

  // 키보드 높이 추적 — 하단 버튼 바가 키보드에 가리지 않게 (chat·dm 과 같은 방식)
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKb(e.endCoordinates.height));
    const h = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);
  const qc = useQueryClient();

  // step 0=워크스페이스(작성 모드만) 1~4=기본/역할/진행/미리보기
  const [step, setStep] = useState(editId != null ? 1 : 0);

  // 워크스페이스 게이트
  const { data: workspaces } = useMyWorkspaces();
  const [wsMode, setWsMode] = useState<'existing' | 'new' | null>(null);
  const [selectedWsId, setSelectedWsId] = useState<number | null>(null);
  const [newWsName, setNewWsName] = useState('');
  const [newWsIcon, setNewWsIcon] = useState<{ uri: string; name: string; type: string } | null>(null);

  // 폼 — 웹 createInitialForm 미러, 수정 모드는 initial에서 프리필
  const [category, setCategory] = useState(initial?.typeLabel ?? '토이프로젝트');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [desc, setDesc] = useState(initial?.summary ?? '');
  const [stacks, setStacks] = useState<string[]>(initial?.techStacks ?? []);
  const [stackInput, setStackInput] = useState('');
  const [roles, setRoles] = useState<Role[]>(() =>
    (initial?.roles ?? []).map((r) => ({
      key: `r-${roleSeq++}`,
      name: r.name ?? '',
      count: r.count ?? 1,
      desc: r.description ?? '',
    })),
  );
  const [roleInput, setRoleInput] = useState('');
  const [showAllRoles, setShowAllRoles] = useState(false);
  const [currentMembers, setCurrentMembers] = useState(initial?.currentMembers ?? initial?.members?.length ?? 1);
  const [maxMembers, setMaxMembers] = useState(initial?.maxMembers ?? 3);
  // 서버 데이터에는 'OFFLINE'(대문자)과 'hybrid'(소문자)가 섞여 있다. MEET_TYPES.id는 소문자라
  // 정규화하지 않으면 수정 화면에서 아무것도 선택 안 된 상태로 열리고 미리보기가 'undefined'가 된다.
  const [meetType, setMeetType] = useState(normalizeMeetType(initial?.meetType));
  const [location, setLocation] = useState<Loc>(() =>
    initial?.hasLocation && initial.locationLat != null && initial.locationLng != null
      ? { name: initial.locationText ?? '', address: initial.locationText ?? undefined, lat: initial.locationLat, lng: initial.locationLng }
      : null,
  );
  const [frequency, setFrequency] = useState(initial?.frequency ?? '주 2회');
  const [duration, setDuration] = useState(initial?.duration ?? '3개월');
  const [deadline, setDeadline] = useState<string | undefined>(initial?.deadline ?? undefined);
  const [tools, setTools] = useState<string[]>(initial?.tools ?? []);
  const [requirements, setRequirements] = useState(initial?.requirements ?? '');
  const [submitting, setSubmitting] = useState(false);

  /* 리더 직책·소개는 이 위저드에 입력 UI가 없다. 그런데 백엔드 update()는 요청 값을 조건 없이
     덮어쓰므로(RecruitmentService.update의 setLeaderRole/setLeaderBio) 본문에서 빼면 기존 값이
     null로 지워진다 — 앱에서 한 번만 수정해도 복구 불가. 웹처럼 기존 값을 그대로 되돌려 보낸다.
     (상세 응답은 leaderRole/leaderBio 평면 필드와 leader.role/leader.bio 두 경로로 내려온다) */
  const leaderRole = initial?.leaderRole ?? initial?.leader?.role ?? undefined;
  const leaderBio = initial?.leaderBio ?? initial?.leader?.bio ?? undefined;

  // 장소 검색 모달 복귀 시 선택값 소비 (todo/new와 동일 패턴)
  useFocusEffect(
    useCallback(() => {
      const picked = useMapSearchStore.getState().picked;
      if (!picked) return;
      useMapSearchStore.getState().clear();
      setLocation({ name: picked.name, address: picked.address, lat: picked.lat, lng: picked.lng });
    }, []),
  );

  const availableSlots = Math.max(0, maxMembers - currentMembers);
  const totalRoleCount = roles.reduce((s, r) => s + r.count, 0);
  const remainingSlots = Math.max(0, availableSlots - totalRoleCount);

  // 스텝별 검증 — 웹 validationHint 미러
  const hint = useMemo((): string | null => {
    if (step === 0) {
      if (wsMode === 'existing') return selectedWsId ? null : '워크스페이스를 선택해 주세요.';
      if (wsMode === 'new') return newWsName.trim() ? null : '워크스페이스 이름을 입력해 주세요.';
      return '워크스페이스 방식을 선택해 주세요.';
    }
    if (step === 1) {
      if (!category) return '카테고리를 선택해 주세요.';
      if (title.trim().length < 2) return '제목을 2자 이상 입력해 주세요.';
      if (desc.trim().length < 10) return '프로젝트 설명을 10자 이상 입력해 주세요.';
      return null;
    }
    if (step === 2) {
      if (!(maxMembers > currentMembers)) return '현재 인원보다 많은 최대 인원을 설정해 주세요.';
      if (roles.length === 0) return '역할을 1개 이상 추가해 주세요.';
      if (totalRoleCount > availableSlots) return '역할 인원 합계가 남은 자리보다 많아요. 인원을 조정해 주세요.';
      return null;
    }
    if (step === 3) {
      if (!meetType) return '진행 방식을 선택해 주세요.';
      if (!frequency) return '모임 빈도를 선택해 주세요.';
      if (!duration) return '프로젝트 기간을 선택해 주세요.';
      if (!deadline) return '마감일을 선택해 주세요.';
      if (meetType !== 'online' && !location) return '오프라인 모임 장소를 선택해 주세요.';
      return null;
    }
    return null;
  }, [step, wsMode, selectedWsId, newWsName, category, title, desc, maxMembers, currentMembers, roles.length, totalRoleCount, availableSlots, meetType, frequency, duration, deadline, location]);

  const goNext = () => {
    if (hint) {
      toast.error(hint);
      return;
    }
    tickHaptic();
    if (step === 0 && wsMode === 'existing') {
      const ws = workspaces?.find((w) => w.workspaceId === selectedWsId);
      const mc = Math.max(1, ws?.memberCount ?? 1);
      setCurrentMembers(mc);
      setMaxMembers((m) => Math.max(m, mc + 1));
    }
    if (step === 0 && wsMode === 'new') {
      setCurrentMembers(1);
      setMaxMembers((m) => Math.max(m, 3));
    }
    setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step === (editId != null ? 1 : 0)) {
      router.back();
      return;
    }
    setStep((s) => s - 1);
  };

  const addStack = (name: string) => {
    const t = name.trim();
    if (!t || t.length > 24) return;
    if (stacks.some((s) => s.toLowerCase() === t.toLowerCase())) return;
    setStacks((prev) => [...prev, t]);
    setStackInput('');
  };

  const addRole = (name: string) => {
    const t = name.trim();
    if (!t) return toast.error('역할 이름을 입력해 주세요.');
    if (t.length > 30) return toast.error('역할 이름은 30자 이내로 입력해 주세요.');
    if (roles.some((r) => r.name.toLowerCase() === t.toLowerCase())) return toast.error('이미 추가된 역할이에요.');
    if (remainingSlots <= 0) return toast.error('남은 자리가 없어요. 최대 인원을 늘려 주세요.');
    setRoles((prev) => [...prev, { key: `r-${roleSeq++}`, name: t, count: 1, desc: '' }]);
    setRoleInput('');
  };

  const pickWsIcon = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const a = res.assets?.[0];
    if (!a) return;
    // HEIC(아이폰 기본)는 서버가 못 읽으므로 JPEG로 변환
    setNewWsIcon(await toJpegUpload(a.uri, 'icon'));
  };

  const create = useCreateRecruitment();
  const update = useUpdateRecruitment(editId ?? 0);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // 새 워크스페이스는 최종 제출 시점에 생성 (웹과 동일)
      let wsId: number | null = editId != null ? null : selectedWsId;
      if (editId == null && wsMode === 'new') {
        const ws = await createWorkspace(newWsName.trim());
        wsId = ws.workspaceId ?? null;
        if (wsId && newWsIcon) {
          try {
            await uploadWorkspaceIcon(wsId, newWsIcon);
          } catch {
            /* 아이콘 실패는 무시 — 웹과 동일 */
          }
        }
        qc.invalidateQueries({ queryKey: ['workspaces', 'my'] });
      }

      const body: RecruitmentCreateRequest = {
        category,
        title: title.trim(),
        summary: desc.trim(),
        techStacks: stacks,
        roles: roles.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), count: r.count || 1, description: r.desc })),
        maxMembers,
        meetType,
        locationText: location?.name || (meetType === 'online' ? '어디서든 참여 가능' : ''),
        locationLat: location?.lat ?? undefined,
        locationLng: location?.lng ?? undefined,
        hasLocation: !!location && meetType !== 'online',
        frequency,
        duration,
        deadline,
        tools,
        requirements: requirements.trim() || undefined,
        leaderRole,
        leaderBio,
        workspaceId: editId != null ? undefined : (wsId ?? undefined),
      };

      if (editId != null) {
        await update.mutateAsync(body);
        qc.invalidateQueries({ queryKey: rcKeys.detail(editId) });
        toast.success('모집 글을 수정했어요');
        router.back();
      } else {
        const created = await create.mutateAsync(body);
        toast.success('모집 글을 올렸어요!');
        router.back();
        if (created?.id != null) router.push(`/recruitment/${created.id}`);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndex = editId != null ? step : step + 1; // 표기용 (작성: 1~5 단계)
  const totalSteps = editId != null ? 4 : 5;

  return (
    /* 키보드 높이만큼 화면 전체를 밀어 올린다.
       예전엔 KeyboardAvoidingView 가 ScrollView 만 감쌌고 하단 버튼 바는 바깥이라,
       키보드가 올라오면 "다음"·"모집 시작하기" 가 키보드 뒤에 가려졌다.
       offset 100 도 헤더 높이를 숫자로 박은 값이라 기기마다 어긋난다. */
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: kb }]}>
      {/* 동적 headerLeft 클로저는 setOptions ↔ 재렌더 무한 루프 유발 → 정적 옵션 + 커스텀 헤더 (todo/new 관례) */}
      <Stack.Screen options={STATIC_SCREEN_OPTIONS} />

      {/* 커스텀 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={10} accessibilityLabel="뒤로" accessibilityRole="button" style={styles.headerBtn}>
          <Ionicons name={step === (editId != null ? 1 : 0) ? 'close' : 'chevron-back'} size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="default" style={styles.headerTitle}>
          {editId != null ? '모집 글 수정' : '모집 글 쓰기'}
        </ThemedText>
        <View style={styles.headerBtn} />
      </View>

      {/* 진행 바 */}
      <View style={styles.progressWrap}>
        <View style={[styles.progressTrack, { backgroundColor: theme.surfaceSelected }]}>
          <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${(stepIndex / totalSteps) * 100}%` }]} />
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {STEP_LABELS[step]} · {stepIndex}/{totalSteps}
        </ThemedText>
      </View>

      <View style={styles.flex1}>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 120 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <WsGate
              theme={theme}
              workspaces={workspaces ?? []}
              wsMode={wsMode}
              setWsMode={(m) => {
                setWsMode(m);
                if (m === 'existing' && selectedWsId == null && workspaces?.length) setSelectedWsId(workspaces[0].workspaceId ?? null);
              }}
              selectedWsId={selectedWsId}
              setSelectedWsId={setSelectedWsId}
              newWsName={newWsName}
              setNewWsName={setNewWsName}
              newWsIcon={newWsIcon}
              pickWsIcon={pickWsIcon}
              clearWsIcon={() => setNewWsIcon(null)}
            />
          ) : null}

          {step === 1 ? (
            <View style={styles.gap18}>
              <Field label="카테고리" required>
                <View style={styles.catGrid}>
                  {CATEGORIES.map((c) => {
                    const active = category === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => { tickHaptic(); setCategory(c.id); }}
                        style={[styles.catCard, { backgroundColor: theme.surface, borderColor: active ? c.color : theme.border, borderWidth: active ? 1.5 : StyleSheet.hairlineWidth }]}>
                        <ThemedText type="default" style={styles.catIcon}>{c.icon}</ThemedText>
                        <ThemedText type="default" style={[styles.catName, active && { color: c.color }]}>{c.id}</ThemedText>
                        <ThemedText type="small" style={{ color: theme.textTertiary }} numberOfLines={1}>{c.desc}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="모집글 제목" required counter={`${title.length}/60`}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  maxLength={60}
                  placeholder="어떤 팀원을 찾고 있나요?"
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                />
              </Field>

              <Field label="프로젝트 소개" required counter={`${desc.length}/1000`}>
                <TextInput
                  value={desc}
                  onChangeText={setDesc}
                  maxLength={1000}
                  multiline
                  placeholder={'어떤 프로젝트인지 자세히 알려주세요.\n어떤 문제를 풀고 어떤 기술을 쓰는지 적어주세요.'}
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.input, styles.multiline, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                />
              </Field>

              <Field label="기술 스택" counter={`${stacks.length}개 선택됨`}>
                {stacks.length ? (
                  <View style={styles.chipWrap}>
                    {stacks.map((s) => (
                      <Pressable key={s} onPress={() => setStacks((prev) => prev.filter((x) => x !== s))} style={[styles.tagChip, { backgroundColor: theme.primarySoft }]}>
                        <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>{s}</ThemedText>
                        <Ionicons name="close" size={12} color={theme.primary} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <TextInput
                  value={stackInput}
                  onChangeText={setStackInput}
                  onSubmitEditing={() => addStack(stackInput)}
                  maxLength={24}
                  placeholder="기술 검색 또는 직접 입력 후 엔터"
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="none"
                  style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                />
                <View style={styles.chipWrap}>
                  {STACK_OPTIONS.filter((s) => !stacks.includes(s) && (!stackInput.trim() || s.toLowerCase().includes(stackInput.trim().toLowerCase())))
                    .slice(0, 14)
                    .map((s) => (
                      <Pressable key={s} onPress={() => { tickHaptic(); addStack(s); }} style={[styles.tagChip, { backgroundColor: theme.surfaceAlt }]}>
                        <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '600' }}>+ {s}</ThemedText>
                      </Pressable>
                    ))}
                </View>
              </Field>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.gap18}>
              <Field label="몇 명을 모을까요?" required>
                <View style={[styles.countCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.flex1}>
                    <ThemedText type="default" style={styles.countTitle}>최대 인원</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      현재 {currentMembers}명 · 남은 자리 {remainingSlots}명
                    </ThemedText>
                  </View>
                  <Stepper
                    value={maxMembers}
                    min={currentMembers + 1}
                    max={MAX_TEAM}
                    onChange={setMaxMembers}
                    theme={theme}
                  />
                </View>
              </Field>

              <Field label="모집할 역할" required>
                {roles.length === 0 ? (
                  <View style={[styles.emptyRoles, { backgroundColor: theme.surfaceAlt }]}>
                    <ThemedText type="small" style={{ color: theme.textTertiary }}>
                      아래에서 역할을 추가해 주세요
                    </ThemedText>
                  </View>
                ) : (
                  roles.map((r) => (
                    <View key={r.key} style={[styles.roleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <View style={styles.roleHead}>
                        <ThemedText type="default" style={[styles.flex1, styles.roleName]} numberOfLines={1}>{r.name}</ThemedText>
                        <Stepper
                          small
                          value={r.count}
                          min={1}
                          max={MAX_TEAM}
                          onChange={(v) => setRoles((prev) => prev.map((x) => (x.key === r.key ? { ...x, count: v } : x)))}
                          theme={theme}
                        />
                        <Pressable onPress={() => setRoles((prev) => prev.filter((x) => x.key !== r.key))} hitSlop={8} accessibilityLabel={`${r.name} 삭제`}>
                          <Ionicons name="trash-outline" size={17} color={theme.textTertiary} />
                        </Pressable>
                      </View>
                      <TextInput
                        value={r.desc}
                        onChangeText={(t) => setRoles((prev) => prev.map((x) => (x.key === r.key ? { ...x, desc: t } : x)))}
                        maxLength={200}
                        placeholder="예: React 1년 이상, 디자인 시스템 작업 환영 (선택)"
                        placeholderTextColor={theme.textTertiary}
                        style={[styles.roleDescInput, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
                      />
                    </View>
                  ))
                )}
              </Field>

              <Field label="자주 찾는 역할">
                <View style={styles.chipWrap}>
                  {(showAllRoles ? ROLE_OPTIONS : ROLE_OPTIONS.slice(0, 5)).map((name) => {
                    const selected = roles.some((r) => r.name === name);
                    const disabled = !selected && remainingSlots <= 0;
                    return (
                      <Pressable
                        key={name}
                        disabled={disabled}
                        onPress={() => {
                          tickHaptic();
                          if (selected) setRoles((prev) => prev.filter((r) => r.name !== name));
                          else addRole(name);
                        }}
                        style={[styles.tagChip, { backgroundColor: selected ? theme.primary : theme.surfaceAlt, opacity: disabled ? 0.4 : 1 }]}>
                        <ThemedText type="small" style={{ color: selected ? readableOn(theme.primary) : theme.textSecondary, fontWeight: '600' }}>
                          {name}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                  {!showAllRoles ? (
                    <Pressable onPress={() => setShowAllRoles(true)} style={[styles.tagChip, { backgroundColor: 'transparent' }]}>
                      <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>더보기</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              </Field>

              <Field label="직접 입력">
                <View style={styles.rowGap8}>
                  <TextInput
                    value={roleInput}
                    onChangeText={setRoleInput}
                    onSubmitEditing={() => addRole(roleInput)}
                    maxLength={30}
                    editable={remainingSlots > 0}
                    placeholder="역할 이름"
                    placeholderTextColor={theme.textTertiary}
                    style={[styles.input, styles.flex1, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                  />
                  <AppButton title="추가" variant="tonal" onPress={() => addRole(roleInput)} disabled={remainingSlots <= 0} />
                </View>
              </Field>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.gap18}>
              <Field label="진행 방식" required>
                <View style={styles.rowGap8}>
                  {MEET_TYPES.map((m) => {
                    const active = meetType === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          tickHaptic();
                          setMeetType(m.id);
                          if (m.id === 'online') setLocation(null);
                        }}
                        style={[styles.meetCard, { backgroundColor: theme.surface, borderColor: active ? theme.primary : theme.border, borderWidth: active ? 1.5 : StyleSheet.hairlineWidth }]}>
                        <ThemedText type="default">{m.icon}</ThemedText>
                        <ThemedText type="small" style={[styles.meetLabel, active && { color: theme.primary }]}>{m.label}</ThemedText>
                        <ThemedText type="small" style={{ color: theme.textTertiary, fontSize: 10 }}>{m.sub}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              {meetType !== 'online' ? (
                <Field label="주요 활동 지역" required>
                  <Pressable
                    onPress={() => router.push('/map-search')}
                    style={[styles.input, styles.locRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="location-outline" size={16} color={location ? theme.primary : theme.textTertiary} />
                    {location ? (
                      <View style={styles.flex1}>
                        <ThemedText type="default" style={styles.locName}>{location.name}</ThemedText>
                        {location.address ? (
                          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>{location.address}</ThemedText>
                        ) : null}
                      </View>
                    ) : (
                      <ThemedText type="default" style={[styles.flex1, { color: theme.textTertiary }]}>
                        장소를 검색하면 지도에서 위치가 표시돼요
                      </ThemedText>
                    )}
                    {location ? (
                      <Pressable onPress={() => setLocation(null)} hitSlop={8} accessibilityLabel="장소 지우기">
                        <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
                      </Pressable>
                    ) : (
                      <Ionicons name="search" size={15} color={theme.textTertiary} />
                    )}
                  </Pressable>
                </Field>
              ) : null}

              <Field label="미팅 빈도" required>
                <ChipRow options={FREQ_OPTIONS} value={frequency} onSelect={setFrequency} theme={theme} />
              </Field>
              <Field label="예상 기간" required>
                <ChipRow options={DURATION_OPTIONS} value={duration} onSelect={setDuration} theme={theme} />
              </Field>

              <Field label="모집 마감일" required>
                <View style={styles.deadlineRow}>
                  <CompactDate value={deadline} onChange={setDeadline} onClear={() => setDeadline(undefined)} />
                  {!deadline ? (
                    <ThemedText type="small" style={{ color: theme.textTertiary }}>날짜를 선택해 주세요</ThemedText>
                  ) : null}
                </View>
              </Field>

              <Field label="커뮤니케이션 툴">
                <View style={styles.chipWrap}>
                  {TOOL_OPTIONS.map((t) => {
                    const on = tools.includes(t);
                    return (
                      <Pressable
                        key={t}
                        onPress={() => { tickHaptic(); setTools((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t])); }}
                        style={[styles.tagChip, { backgroundColor: on ? theme.primary : theme.surfaceAlt }]}>
                        <ThemedText type="small" style={{ color: on ? readableOn(theme.primary) : theme.textSecondary, fontWeight: '600' }}>{t}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="지원자에게 바라는 점" counter={`${requirements.length}/300`}>
                <TextInput
                  value={requirements}
                  onChangeText={setRequirements}
                  maxLength={300}
                  multiline
                  placeholder="예: 매주 목요일 저녁 미팅 가능하신 분, 포트폴리오 있으신 분 우대, 초보자도 환영…"
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.input, styles.multilineSm, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                />
              </Field>
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.gap18}>
              {/* 미리보기 카드 */}
              <View style={[styles.previewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.chipWrapTight}>
                  <View style={[styles.tagChip, { backgroundColor: theme.primarySoft }]}>
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>{category}</ThemedText>
                  </View>
                  <View style={[styles.tagChip, { backgroundColor: theme.green + '1A' }]}>
                    <ThemedText type="small" style={{ color: theme.green, fontWeight: '700' }}>모집중</ThemedText>
                  </View>
                </View>
                <ThemedText type="default" style={styles.previewTitle}>{title || '(제목 없음)'}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={3}>{desc}</ThemedText>
                {roles.length ? (
                  <View style={styles.chipWrapTight}>
                    {roles.map((r) => (
                      <View key={r.key} style={[styles.tagChip, { backgroundColor: theme.surfaceAlt }]}>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>{r.name} {r.count}명</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
                <ThemedText type="small" style={{ color: theme.textTertiary }}>
                  {currentMembers}/{maxMembers}명{deadline ? ` · ~${deadline}` : ''}{location ? ` · ${location.name}` : ''}
                </ThemedText>
              </View>

              {/* 등록 요약 */}
              <View style={[styles.summaryCard, { backgroundColor: theme.surfaceAlt }]}>
                <SummaryRow ok label={`카테고리 · ${category}`} theme={theme} />
                <SummaryRow ok={title.trim().length >= 2} label={`제목 · ${title.trim() || '미입력'}`} theme={theme} />
                <SummaryRow ok={roles.length > 0} label={`역할 ${roles.length}개 · 총 ${totalRoleCount}명 모집`} theme={theme} />
                <SummaryRow ok={!!deadline} label={`마감일 · ${deadline ?? '미선택'}`} theme={theme} />
                <SummaryRow
                  ok={meetType === 'online' || !!location}
                  label={`진행 · ${MEET_TYPES.find((m) => m.id === meetType)?.label ?? '미선택'}${location ? ` (${location.name})` : ''}`}
                  theme={theme}
                />
                {editId == null ? (
                  <SummaryRow
                    ok={wsMode === 'new' ? !!newWsName.trim() : selectedWsId != null}
                    label={
                      wsMode === 'new'
                        ? `새 워크스페이스 · ${newWsName.trim() || '미입력'}`
                        : `워크스페이스 · ${workspaces?.find((w) => w.workspaceId === selectedWsId)?.workspaceName ?? '미선택'}`
                    }
                    theme={theme}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>

      {/* 하단 네비 */}
      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.divider, paddingBottom: kb > 0 ? 10 : insets.bottom + 10 }]}>
        {step === 4 ? (
          <AppButton
            title={submitting ? (editId != null ? '수정 중…' : '등록 중…') : editId != null ? '수정 완료' : '모집 시작하기'}
            onPress={submit}
            disabled={submitting}
            style={styles.footerBtn}
          />
        ) : (
          <AppButton title="다음" onPress={goNext} style={styles.footerBtn} />
        )}
      </View>
    </View>
  );
}

// ── 워크스페이스 게이트 (작성 모드 전용) ─────────────────────────
function WsGate({
  theme, workspaces, wsMode, setWsMode, selectedWsId, setSelectedWsId, newWsName, setNewWsName, newWsIcon, pickWsIcon, clearWsIcon,
}: {
  theme: ReturnType<typeof useTheme>;
  workspaces: { workspaceId?: number; workspaceName?: string; memberCount?: number; iconImageUrl?: string }[];
  wsMode: 'existing' | 'new' | null;
  setWsMode: (m: 'existing' | 'new') => void;
  selectedWsId: number | null;
  setSelectedWsId: (id: number | null) => void;
  newWsName: string;
  setNewWsName: (v: string) => void;
  newWsIcon: { uri: string } | null;
  pickWsIcon: () => void;
  clearWsIcon: () => void;
}) {
  return (
    <View style={styles.gap18}>
      <ThemedText type="default" style={styles.wsPrompt}>어떤 워크스페이스로 모집할까요?</ThemedText>
      <View style={styles.rowGap8}>
        {(
          [
            { id: 'existing' as const, icon: 'folder-outline' as const, title: '기존 워크스페이스', desc: '이미 만든 워크스페이스로 모집해요' },
            { id: 'new' as const, icon: 'sparkles-outline' as const, title: '새 워크스페이스', desc: '새 팀을 위한 워크스페이스를 만들어요' },
          ]
        ).map((o) => {
          const active = wsMode === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => { tickHaptic(); setWsMode(o.id); }}
              style={[styles.wsTypeCard, { backgroundColor: theme.surface, borderColor: active ? theme.primary : theme.border, borderWidth: active ? 1.5 : StyleSheet.hairlineWidth }]}>
              <Ionicons name={o.icon} size={22} color={active ? theme.primary : theme.textSecondary} />
              <ThemedText type="default" style={[styles.wsTypeTitle, active && { color: theme.primary }]}>{o.title}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textTertiary, textAlign: 'center' }}>{o.desc}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      {wsMode === 'existing' ? (
        workspaces.length === 0 ? (
          <ThemedText type="small" style={{ color: theme.textTertiary, textAlign: 'center', paddingVertical: 20 }}>
            아직 워크스페이스가 없어요
          </ThemedText>
        ) : (
          <View style={styles.gap8}>
            {workspaces.map((ws) => {
              const active = selectedWsId === ws.workspaceId;
              return (
                <Pressable
                  key={ws.workspaceId}
                  onPress={() => { tickHaptic(); setSelectedWsId(ws.workspaceId ?? null); }}
                  style={[styles.wsRow, { backgroundColor: theme.surface, borderColor: active ? theme.primary : theme.border, borderWidth: active ? 1.5 : StyleSheet.hairlineWidth }]}>
                  {ws.iconImageUrl ? (
                    <Image source={{ uri: ws.iconImageUrl }} style={styles.wsIcon} />
                  ) : (
                    <View style={[styles.wsIcon, { backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
                      <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800' }}>
                        {(ws.workspaceName ?? '?').slice(0, 1)}
                      </ThemedText>
                    </View>
                  )}
                  <View style={styles.flex1}>
                    <ThemedText type="default" style={styles.wsName}>{ws.workspaceName}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>멤버 {ws.memberCount ?? 1}명</ThemedText>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={20} color={theme.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        )
      ) : null}

      {wsMode === 'new' ? (
        <View style={styles.gap12}>
          <View style={styles.wsIconPickRow}>
            <Pressable onPress={pickWsIcon} style={[styles.wsIconPick, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]} accessibilityLabel="아이콘 이미지 선택">
              {newWsIcon ? (
                <Image source={{ uri: newWsIcon.uri }} style={styles.wsIconPickImg} />
              ) : (
                <Ionicons name="image-outline" size={22} color={theme.textTertiary} />
              )}
            </Pressable>
            <View style={styles.flex1}>
              <ThemedText type="default" style={styles.wsName}>아이콘 이미지 (선택)</ThemedText>
              <ThemedText type="small" style={{ color: theme.textTertiary }}>JPG, PNG · 최대 5MB</ThemedText>
            </View>
            {newWsIcon ? (
              <Pressable onPress={clearWsIcon} hitSlop={8} accessibilityLabel="아이콘 제거">
                <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
              </Pressable>
            ) : null}
          </View>
          <TextInput
            value={newWsName}
            onChangeText={setNewWsName}
            maxLength={30}
            placeholder="예: 알고리즘 스터디"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
          />
        </View>
      ) : null}
    </View>
  );
}

// ── 소품 ─────────────────────────────────────────────────────────
function Field({ label, required, counter, children }: { label: string; required?: boolean; counter?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.gap8}>
      <View style={styles.fieldHead}>
        <ThemedText type="default" style={styles.fieldLabel}>
          {label}
          {required ? <ThemedText type="default" style={{ color: theme.danger }}> *</ThemedText> : null}
        </ThemedText>
        {counter ? <ThemedText type="small" style={{ color: theme.textTertiary }}>{counter}</ThemedText> : null}
      </View>
      {children}
    </View>
  );
}

function ChipRow({ options, value, onSelect, theme }: { options: string[]; value: string; onSelect: (v: string) => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.chipWrap}>
      {options.map((o) => {
        const active = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => { tickHaptic(); onSelect(o); }}
            style={[styles.tagChip, { backgroundColor: active ? theme.primary : theme.surfaceAlt }]}>
            <ThemedText type="small" style={{ color: active ? readableOn(theme.primary) : theme.textSecondary, fontWeight: '600' }}>{o}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({ value, min, max, onChange, theme, small }: { value: number; min: number; max: number; onChange: (v: number) => void; theme: ReturnType<typeof useTheme>; small?: boolean }) {
  const size = small ? 26 : 32;
  return (
    <View style={[styles.stepper, { backgroundColor: theme.surfaceAlt }]}>
      <Pressable
        onPress={() => { tickHaptic(); onChange(Math.max(min, value - 1)); }}
        disabled={value <= min}
        style={[styles.stepBtn, { width: size, height: size, opacity: value <= min ? 0.35 : 1 }]}
        accessibilityLabel="빼기">
        <Ionicons name="remove" size={16} color={theme.text} />
      </Pressable>
      <ThemedText type="default" style={[styles.stepVal, small && { fontSize: 13, minWidth: 22 }]}>{value}</ThemedText>
      <Pressable
        onPress={() => { tickHaptic(); onChange(Math.min(max, value + 1)); }}
        disabled={value >= max}
        style={[styles.stepBtn, { width: size, height: size, opacity: value >= max ? 0.35 : 1 }]}
        accessibilityLabel="더하기">
        <Ionicons name="add" size={16} color={theme.text} />
      </Pressable>
    </View>
  );
}

function SummaryRow({ ok, label, theme }: { ok: boolean; label: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle-outline'} size={16} color={ok ? theme.green : theme.orange} />
      <ThemedText type="small" style={[styles.flex1, { color: theme.textSecondary }]} numberOfLines={1}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 14, paddingBottom: 2 },
  headerBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '800', fontSize: 17 },
  flex1: { flex: 1 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap18: { gap: 18 },
  rowGap8: { flexDirection: 'row', gap: 8 },
  progressWrap: { paddingHorizontal: 16, paddingTop: 10, gap: 6 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  body: { padding: 16, paddingTop: 14 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontWeight: '800', fontSize: 15 },
  input: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  multilineSm: { minHeight: 84, textAlignVertical: 'top' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catCard: { width: '48%', flexGrow: 1, borderRadius: 14, padding: 12, gap: 3 },
  catIcon: { fontSize: 20 },
  catName: { fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chipWrapTight: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  countCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  countTitle: { fontWeight: '700' },
  emptyRoles: { borderRadius: 12, paddingVertical: 22, alignItems: 'center' },
  roleCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8, marginBottom: 8 },
  roleHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleName: { fontWeight: '700' },
  roleDescInput: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, overflow: 'hidden' },
  stepBtn: { alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontWeight: '800', minWidth: 26, textAlign: 'center' },
  meetCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 3 },
  meetLabel: { fontWeight: '700' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locName: { fontWeight: '700', fontSize: 14 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  previewTitle: { fontWeight: '800', fontSize: 17 },
  summaryCard: { borderRadius: 14, padding: 14, gap: 9 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wsPrompt: { fontWeight: '800', fontSize: 17 },
  wsTypeCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 5 },
  wsTypeTitle: { fontWeight: '800' },
  wsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12 },
  wsIcon: { width: 36, height: 36, borderRadius: 10 },
  wsName: { fontWeight: '700' },
  wsIconPickRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wsIconPick: { width: 52, height: 52, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wsIconPickImg: { width: 52, height: 52 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footerBtn: { width: '100%' },
});
