import { useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useQuery } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/api/error';
import { buildStaticMapHtml } from '@/features/map/mapHtml';
import { KAKAO_JS_KEY, KAKAO_MAP_REFERRER } from '@/shared/config/env';
import { ThemedText } from '@/components/themed-text';
import type { RecruitmentDetail, RecruitmentQuestion } from '@/features/recruitment/api';
import { meetTypeLabel } from '@/features/recruitment/config';
import {
  useApplications,
  useCreateQuestion,
  useDeleteAnswer,
  useDeleteQuestion,
  useDeleteRecruitment,
  usePinQuestion,
  useRecruitment,
  useRecruitmentQuestions,
  useReviewApplication,
  useToggleApply,
  useToggleBookmark,
  useToggleChecklist,
  useUpdateRecruitmentStatus,
  useUpsertAnswer,
  useUserQaStats,
} from '@/features/recruitment/queries';
import { joinWorkspace } from '@/features/workspace/api';
import { useMyWorkspaces } from '@/features/workspace/queries';
import { useAuthStore } from '@/shared/store/authStore';
import { getMyAccountMeta } from '@/features/settings/api';
import { BottomSheet } from '@/features/todo/todoPickers';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/shared/ui/Avatar';
import { Button as AppButton } from '@/shared/ui/Button';
import { tickHaptic } from '@/shared/ui/haptics';
import { toast } from '@/shared/ui/toast';
import { readableOn } from '@/shared/ui/tone';

/** 팀 모집 상세 — 개요·역할·진행·리더·Q&A + 지원/북마크. 딥링크 ?tab=qa 시 Q&A로 스크롤. */
export default function RecruitmentDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id: idParam, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const id = Number(idParam);

  const { data, isLoading, isError, error, refetch, isRefetching } = useRecruitment(id);
  const { data: questions } = useRecruitmentQuestions(id);
  const bookmark = useToggleBookmark();
  const apply = useToggleApply(id);
  const checklist = useToggleChecklist(id);

  const { data: me } = useQuery({ queryKey: ['users', 'me', 'meta'], queryFn: getMyAccountMeta });
  const isAuthor = !!data?.isAuthor;
  // appliedStatus: PENDING | ACCEPTED | REJECTED | CANCELLED | null (백엔드 원값)
  const isPending = data?.appliedStatus === 'PENDING';
  const isAccepted = data?.appliedStatus === 'ACCEPTED';
  // 예전엔 REJECTED 분기가 없어 기본 CTA('참여 신청하기')로 흘렀다. 목록 카드는 '거절됨'을 보여주는데
  // 상세만 아무 표시가 없어 두 화면이 엇갈렸고, 누르면 실제로는 취소 처리가 됐다.
  const isRejected = data?.appliedStatus === 'REJECTED';
  const closed = !!data?.statusLabel && data.statusLabel !== '모집중';

  // 지원 시트
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');
  const [applyRole, setApplyRole] = useState<number | undefined>(undefined);

  // 작성자 액션
  const router = useRouter();
  const updateStatus = useUpdateRecruitmentStatus(id);
  const deleteRc = useDeleteRecruitment();
  const [applicantsOpen, setApplicantsOpen] = useState(false);

  // 게스트 차단 — 지원·북마크·질문 (웹 GuestBlockModal 미러)
  const signOut = useAuthStore((s) => s.signOut);
  const guestBlock = () => {
    Alert.alert(
      '회원 전용 기능이에요',
      '회원가입하고 팀을 찾아보세요.\n지원 신청, 북마크, 모집글 작성은\n회원만 이용할 수 있어요.',
      [
        { text: '닫기', style: 'cancel' },
        { text: '회원가입', onPress: () => void signOut() },
      ],
    );
  };

  const openAuthorMenu = () => {
    const recruiting = data?.statusLabel === '모집중';
    Alert.alert(data?.title ?? '모집 글', undefined, [
      {
        // 웹 표기는 '마감'이지만 백엔드 유효값은 '모집완료'
        text: recruiting ? '마감 처리' : '모집중으로 변경',
        onPress: async () => {
          try {
            await updateStatus.mutateAsync(recruiting ? '모집완료' : '모집중');
            toast.success(recruiting ? '모집을 마감했어요' : '모집중으로 변경했어요');
          } catch (e) {
            toast.error(getApiErrorMessage(e));
          }
        },
      },
      { text: '수정', onPress: () => router.push({ pathname: '/recruitment/new', params: { edit: String(id) } }) },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          Alert.alert('모집글 삭제', `'${data?.title}' 모집글을 삭제하시겠어요?\n삭제 후에는 복구할 수 없어요.`, [
            { text: '취소', style: 'cancel' },
            {
              text: '삭제하기',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteRc.mutateAsync(id);
                  toast.success('모집글을 삭제했어요');
                  router.back();
                } catch (e) {
                  toast.error(getApiErrorMessage(e));
                }
              },
            },
          ]),
      },
      { text: '닫기', style: 'cancel' },
    ]);
  };

  // ?tab=qa → Q&A 위치로 스크롤
  const scrollRef = useRef<ScrollView>(null);
  const qaY = useRef(0);
  const qaScrolled = useRef(false);
  const maybeScrollQa = () => {
    if (tab === 'qa' && !qaScrolled.current && qaY.current > 0) {
      qaScrolled.current = true;
      setTimeout(() => scrollRef.current?.scrollTo({ y: qaY.current - 12, animated: true }), 250);
    }
  };

  const onApply = async () => {
    try {
      const body = { message: applyMsg.trim(), roleId: applyRole };
      let status = await apply.mutateAsync(body);
      /* 서버 toggleApply는 CANCELLED만 '재신청'으로 특별 취급하고, REJECTED 지원은 그냥 CANCELLED로
         뒤집는다(RecruitmentService.toggleApply). 그래서 거절된 사람이 다시 지원하면 첫 호출은
         취소로 끝난다 — 여기서 멈추면 "지원했어요"가 거짓말이 되므로, CANCELLED가 되었을 때
         한 번 더 호출해 실제 PENDING까지 밀어준다(CANCELLED→PENDING은 서버가 허용).
         서버가 REJECTED→PENDING을 직접 받아주도록 고쳐지면 첫 응답이 PENDING이라 이 보정은 꺼진다. */
      if (isRejected && status === 'CANCELLED') {
        status = await apply.mutateAsync(body);
      }
      setApplyOpen(false);
      setApplyMsg('');
      if (status === 'PENDING') {
        toast.success(isRejected ? '다시 지원했어요! 결과를 기다려주세요' : '지원했어요! 결과를 기다려주세요');
      } else {
        // 성공하지 않은 결과를 성공처럼 알리지 않는다
        toast.error('지원 처리를 완료하지 못했어요. 잠시 후 다시 시도해 주세요');
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const onCancelApply = () => {
    Alert.alert('지원 취소', '이 모집에 대한 지원을 취소할까요?', [
      { text: '아니요', style: 'cancel' },
      {
        text: '지원 취소',
        style: 'destructive',
        onPress: async () => {
          try {
            await apply.mutateAsync({ message: '' });
            toast.success('지원을 취소했어요');
          } catch (e) {
            toast.error(getApiErrorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '모집 상세',
          headerRight: () =>
            data ? (
              <View style={styles.headerRight}>
                <Pressable
                  onPress={() => {
                    if (me?.guest) return guestBlock();
                    tickHaptic();
                    bookmark.mutate(id);
                  }}
                  hitSlop={8}
                  accessibilityLabel={data.bookmarked ? '북마크 해제' : '북마크'}
                  accessibilityRole="button">
                  <Ionicons name={data.bookmarked ? 'bookmark' : 'bookmark-outline'} size={21} color={data.bookmarked ? theme.primary : theme.text} />
                </Pressable>
                {isAuthor ? (
                  <Pressable onPress={openAuthorMenu} hitSlop={8} accessibilityLabel="더보기" accessibilityRole="button">
                    <Ionicons name="ellipsis-horizontal" size={21} color={theme.text} />
                  </Pressable>
                ) : null}
              </View>
            ) : null,
        }}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <ThemedText type="default" style={{ color: theme.danger }}>
            {getApiErrorMessage(error)}
          </ThemedText>
          <Pressable onPress={() => refetch()}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.body, { paddingBottom: 120 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
            {/* 헤더 */}
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <View style={styles.chipRow}>
                {data.typeLabel ? <Chip label={data.typeLabel} color={theme.primary} bg={theme.primarySoft} /> : null}
                {data.statusLabel ? (
                  <Chip
                    label={data.statusLabel}
                    color={closed ? theme.textSecondary : theme.green}
                    bg={closed ? theme.surfaceSelected : theme.green + '1A'}
                  />
                ) : null}
                {isPending ? <Chip label="지원함" color={theme.orange} bg={theme.orange + '1A'} /> : null}
                {isAccepted ? <Chip label="합류됨" color={theme.green} bg={theme.green + '1A'} /> : null}
                {isRejected ? <Chip label="거절됨" color={theme.danger} bg={theme.danger + '1A'} /> : null}
              </View>
              <ThemedText type="title" style={styles.title}>
                {data.title}
              </ThemedText>
              {data.summary ? (
                <ThemedText type="default" style={[styles.summary, { color: theme.textSecondary }]}>
                  {data.summary}
                </ThemedText>
              ) : null}
              <View style={styles.statRow}>
                {data.applicants != null ? (
                  <ThemedText type="small" style={{ color: theme.textTertiary }}>
                    지원 {data.applicants}
                  </ThemedText>
                ) : null}
                {data.views != null ? (
                  <ThemedText type="small" style={{ color: theme.textTertiary }}>
                    조회 {data.views}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            {/* 합류 수락 배너 — 웹 JoinWorkspaceBanner 미러 */}
            {isAccepted && !isAuthor ? <JoinWorkspaceBanner detail={data} theme={theme} /> : null}

            {/* 핵심 정보 그리드 */}
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <View style={styles.grid}>
                {/* 원값은 'OFFLINE'/'hybrid'처럼 케이스가 섞여 있다 — 한국어 라벨로 정규화 */}
                <Info label="모임 방식" value={meetTypeLabel(data.meetType)} theme={theme} />
                <Info label="주기" value={data.frequency} theme={theme} />
                <Info label="기간" value={data.duration} theme={theme} />
                <Info label="마감" value={data.dueText ?? data.deadline} theme={theme} />
                <Info
                  label="인원"
                  value={data.maxMembers ? `${data.currentMembers ?? 0}/${data.maxMembers}명` : data.headCount}
                  theme={theme}
                />
                <Info label="장소" value={data.locationText} theme={theme} />
              </View>
              {/* 활동 위치 — 정적 카카오 미니맵 (웹 RecruitMapCanvas 미러) */}
              {data.hasLocation && data.locationLat != null && data.locationLng != null ? (
                <RecruitLocationMap lat={data.locationLat} lng={data.locationLng} label={data.locationText} theme={theme} />
              ) : null}
            </View>

            {/* 모집 역할 */}
            {data.roles?.length ? (
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <SectionTitle>모집 역할</SectionTitle>
                {data.roles.map((r) => {
                  const full = r.count != null && (r.acceptedCount ?? 0) >= r.count;
                  return (
                    <View key={r.id} style={styles.roleRow}>
                      <View style={styles.roleBody}>
                        <ThemedText type="default" style={styles.roleName}>
                          {r.name}
                        </ThemedText>
                        {r.description ? (
                          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={2}>
                            {r.description}
                          </ThemedText>
                        ) : null}
                      </View>
                      <View style={[styles.roleCount, { backgroundColor: full ? theme.surfaceSelected : theme.primarySoft }]}>
                        <ThemedText type="small" style={{ color: full ? theme.textSecondary : theme.primary, fontWeight: '800' }}>
                          {r.acceptedCount ?? 0}/{r.count ?? '-'}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* 지원 자격 */}
            {data.requirements ? (
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <SectionTitle>지원 자격</SectionTitle>
                <ThemedText type="default" style={styles.paragraph}>
                  {data.requirements}
                </ThemedText>
              </View>
            ) : null}

            {/* 기술 스택 / 툴 */}
            {data.techStacks?.length || data.tools?.length ? (
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <SectionTitle>기술 · 툴</SectionTitle>
                <View style={styles.tagWrap}>
                  {[...(data.techStacks ?? []), ...(data.tools ?? [])].map((t, i) => (
                    <View key={`${t}-${i}`} style={[styles.tag, { backgroundColor: theme.surfaceAlt }]}>
                      <ThemedText type="small" style={{ fontWeight: '600' }}>
                        {t}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* 진행 방식 체크리스트 */}
            {data.progress?.length ? (
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <SectionTitle>진행 상황</SectionTitle>
                {data.progress.map((p) => (
                  <Pressable
                    key={p.id}
                    disabled={!isAuthor}
                    onPress={() => {
                      tickHaptic();
                      if (p.id != null) checklist.mutate(p.id);
                    }}
                    accessibilityLabel={p.label}
                    style={styles.progressRow}>
                    <Ionicons
                      name={p.done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={p.done ? theme.green : theme.textTertiary}
                    />
                    <ThemedText type="default" style={[styles.progressLabel, p.done && { color: theme.textSecondary }]}>
                      {p.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* 리더 */}
            {data.leader?.name || data.leaderBio ? (
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <SectionTitle>리더</SectionTitle>
                <View style={styles.leaderRow}>
                  <Avatar person={{ name: data.leader?.name }} size={40} />
                  <View style={styles.leaderBody}>
                    <ThemedText type="default" style={styles.roleName}>
                      {data.leader?.name}
                      {data.leader?.role || data.leaderRole ? (
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          {'  '}{data.leader?.role ?? data.leaderRole}
                        </ThemedText>
                      ) : null}
                    </ThemedText>
                    {data.leader?.bio || data.leaderBio ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {data.leader?.bio ?? data.leaderBio}
                      </ThemedText>
                    ) : null}
                    <LeaderQaStats userId={data.leader?.userId} theme={theme} />
                  </View>
                </View>
              </View>
            ) : null}

            {/* 멤버 */}
            {data.members?.length ? (
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <SectionTitle>함께하는 멤버 {data.members.length}</SectionTitle>
                {data.members.map((m) => (
                  <View key={m.id} style={styles.leaderRow}>
                    <Avatar person={{ name: m.name }} size={30} />
                    <ThemedText type="default" style={styles.memberName}>
                      {m.name}
                    </ThemedText>
                    {m.role ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {m.role}
                      </ThemedText>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Q&A */}
            <View
              style={[styles.section, { backgroundColor: theme.surface }]}
              onLayout={(e) => {
                qaY.current = e.nativeEvent.layout.y;
                maybeScrollQa();
              }}>
              <SectionTitle>
                Q&A{questions?.length ? ` ${questions.length}` : ''}
              </SectionTitle>
              <QaSection
                recruitmentId={id}
                questions={questions ?? []}
                isAuthor={isAuthor}
                myId={me?.id}
                isGuest={!!me?.guest}
                onGuestBlock={guestBlock}
                theme={theme}
              />
            </View>
          </ScrollView>

          {/* 하단 고정 CTA — 작성자: 신청자 관리 / 지원자: 상태별 */}
          <View style={[styles.cta, { backgroundColor: theme.surface, borderTopColor: theme.divider, paddingBottom: insets.bottom + 10 }]}>
            {isAuthor ? (
              <AppButton
                title={`신청자 관리${data.applicants ? ` (${data.applicants})` : ''}`}
                onPress={() => setApplicantsOpen(true)}
                style={styles.ctaBtn}
              />
            ) : isAccepted ? (
              <View style={[styles.acceptedBadge, { backgroundColor: theme.green + '14' }]}>
                <Ionicons name="checkmark-circle" size={17} color={theme.green} />
                <ThemedText type="default" style={{ color: theme.green, fontWeight: '800' }}>
                  합류 완료
                </ThemedText>
              </View>
            ) : isPending ? (
              <AppButton title="신청 취소" variant="tonal" onPress={onCancelApply} style={styles.ctaBtn} />
            ) : (
              <View style={styles.ctaCol}>
                {isRejected ? (
                  <ThemedText type="small" style={[styles.ctaNote, { color: theme.textSecondary }]}>
                    아쉽지만 이번 지원은 거절됐어요. 메시지를 다듬어 다시 지원할 수 있어요.
                  </ThemedText>
                ) : null}
                <AppButton
                  title={closed ? '모집이 마감되었어요' : isRejected ? '다시 지원하기' : '참여 신청하기'}
                  onPress={() => {
                    if (me?.guest) return guestBlock();
                    setApplyOpen(true);
                  }}
                  disabled={closed || apply.isPending}
                  style={styles.ctaBtn}
                />
              </View>
            )}
          </View>

          {/* 지원자 관리 시트 (작성자 전용) */}
          <ApplicantsSheet open={applicantsOpen} onClose={() => setApplicantsOpen(false)} recruitmentId={id} theme={theme} />

          {/* 지원 시트 — 역할 선택 + 메시지 */}
          <BottomSheet open={applyOpen} onClose={() => setApplyOpen(false)}>
            <View style={styles.applyBody}>
              <ThemedText type="label" style={styles.applyTitle}>
                {isRejected ? '다시 지원하기' : '지원하기'}
              </ThemedText>
              {data.roles?.length ? (
                <View style={styles.applyRoles}>
                  {data.roles.map((r) => {
                    const active = applyRole === r.id;
                    const full = r.count != null && (r.acceptedCount ?? 0) >= r.count;
                    return (
                      <Pressable
                        key={r.id}
                        disabled={full}
                        onPress={() => {
                          tickHaptic();
                          setApplyRole(active ? undefined : r.id);
                        }}
                        style={[
                          styles.applyRole,
                          {
                            backgroundColor: active ? theme.primary : theme.surfaceAlt,
                            opacity: full ? 0.45 : 1,
                          },
                        ]}>
                        <ThemedText type="small" style={{ color: active ? readableOn(theme.primary) : theme.text, fontWeight: '700' }}>
                          {r.name} {r.acceptedCount ?? 0}/{r.count ?? '-'}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <TextInput
                value={applyMsg}
                onChangeText={setApplyMsg}
                placeholder="리더에게 한마디 (선택) — 경험·가능 시간 등"
                placeholderTextColor={theme.textTertiary}
                multiline
                maxLength={300}
                style={[styles.applyInput, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
              />
              <AppButton title={apply.isPending ? '지원 중…' : '지원 보내기'} onPress={onApply} disabled={apply.isPending} />
            </View>
          </BottomSheet>
        </>
      )}
    </SafeAreaView>
  );
}

/** Q&A — 질문 목록(고정 우선·비공개 마스킹) + 작성. 작성자는 답변/고정/답변 삭제, 질문자는 삭제. */
function QaSection({
  recruitmentId,
  questions,
  isAuthor,
  myId,
  isGuest,
  onGuestBlock,
  theme,
}: {
  recruitmentId: number;
  questions: RecruitmentQuestion[];
  isAuthor: boolean;
  myId?: number;
  isGuest: boolean;
  onGuestBlock: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const createQ = useCreateQuestion(recruitmentId);
  const deleteQ = useDeleteQuestion(recruitmentId);
  const answer = useUpsertAnswer(recruitmentId);
  const removeAnswer = useDeleteAnswer(recruitmentId);
  const pin = usePinQuestion(recruitmentId);

  const [body, setBody] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [answering, setAnswering] = useState<number | null>(null);
  const [answerBody, setAnswerBody] = useState('');

  const sorted = [...questions].sort((a, b) => Number(b.pinned ?? b.isPinned ?? false) - Number(a.pinned ?? a.isPinned ?? false));

  const onAsk = async () => {
    if (isGuest) return onGuestBlock();
    const t = body.trim();
    if (t.length < 2) return;
    try {
      await createQ.mutateAsync({ body: t, isPrivate });
      setBody('');
      setIsPrivate(false);
      toast.success('질문을 남겼어요');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const onAnswer = async (qId: number) => {
    const t = answerBody.trim();
    if (t.length < 2) return;
    try {
      await answer.mutateAsync({ qId, body: t });
      setAnswering(null);
      setAnswerBody('');
      toast.success('답변을 등록했어요');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  return (
    <View style={qa.wrap}>
      {sorted.length === 0 ? (
        <ThemedText type="small" style={{ color: theme.textTertiary }}>
          아직 질문이 없어요. 궁금한 걸 남겨보세요!
        </ThemedText>
      ) : (
        sorted.map((q) => {
          const pinned = !!(q.pinned ?? q.isPinned);
          const isMine = myId != null && q.askerId === myId;
          const isPrivateQ = !!(q.private ?? q.isPrivate);
          // 백엔드가 권한 없는 뷰어에겐 body·asker를 null로 마스킹해서 내려줌
          const masked = isPrivateQ && q.body == null;
          const answerMasked = !!q.answer && q.answer.body == null;
          return (
            <View key={q.id} style={[qa.item, { borderColor: isAuthor && !q.answer && !masked ? theme.orange + '55' : theme.divider }]}>
              <View style={qa.head}>
                {pinned ? <Ionicons name="pin" size={13} color={theme.orange} /> : null}
                {masked ? (
                  <>
                    <Ionicons name="lock-closed" size={12} color={theme.textTertiary} />
                    <ThemedText type="small" style={[qa.asker, { color: theme.textSecondary }]}>
                      비공개 질문
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText type="small" style={qa.asker}>
                      {q.askerName ?? '익명'}
                    </ThemedText>
                    {isPrivateQ ? (
                      <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                        · 🔒 비공개
                      </ThemedText>
                    ) : null}
                    {isAuthor && !q.answer ? (
                      <ThemedText type="small" style={{ color: theme.orange, fontWeight: '700' }}>
                        · 미답변
                      </ThemedText>
                    ) : null}
                  </>
                )}
                <View style={qa.flex1} />
                {isAuthor && q.id != null && !masked ? (
                  <Pressable onPress={() => { tickHaptic(); pin.mutate({ qId: q.id!, pinned: !pinned }); }} hitSlop={8} accessibilityLabel={pinned ? '고정 해제' : '질문 고정'}>
                    <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={15} color={pinned ? theme.orange : theme.textTertiary} />
                  </Pressable>
                ) : null}
                {(isMine || isAuthor) && q.id != null && !masked ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert('질문 삭제', '이 질문을 삭제하시겠어요?\n삭제된 질문은 다른 사용자에게 보이지 않아요.', [
                        { text: '취소', style: 'cancel' },
                        { text: '삭제', style: 'destructive', onPress: () => deleteQ.mutate(q.id!) },
                      ])
                    }
                    hitSlop={8}
                    accessibilityLabel={isAuthor && !isMine ? '질문 숨기기' : '질문 삭제'}>
                    <Ionicons name={isAuthor && !isMine ? 'eye-off-outline' : 'trash-outline'} size={14} color={theme.textTertiary} />
                  </Pressable>
                ) : null}
              </View>
              {masked ? (
                <ThemedText type="small" style={[qa.maskedBody, { color: theme.textTertiary }]}>
                  🔒 비공개 질문이에요. 작성자만 내용을 볼 수 있어요.
                </ThemedText>
              ) : (
                <ThemedText type="default" style={qa.body}>
                  {q.body}
                </ThemedText>
              )}

              {answerMasked ? (
                <View style={[qa.answer, { backgroundColor: theme.surfaceAlt }]}>
                  <View style={qa.head}>
                    <Ionicons name="return-down-forward" size={13} color={theme.primary} />
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                      리더 답변
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={[qa.maskedBody, { color: theme.textTertiary }]}>
                    🔒 비공개 답변이에요. 작성자만 내용을 볼 수 있어요.
                  </ThemedText>
                </View>
              ) : q.answer?.body ? (
                <View style={[qa.answer, { backgroundColor: theme.surfaceAlt }]}>
                  <View style={qa.head}>
                    <Ionicons name="return-down-forward" size={13} color={theme.primary} />
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                      리더 답변
                    </ThemedText>
                    <View style={qa.flex1} />
                    {isAuthor && q.id != null ? (
                      <Pressable
                        onPress={() =>
                          Alert.alert('답변 삭제', '이 답변을 삭제하시겠어요?', [
                            { text: '취소', style: 'cancel' },
                            { text: '삭제', style: 'destructive', onPress: () => removeAnswer.mutate(q.id!) },
                          ])
                        }
                        hitSlop={8}
                        accessibilityLabel="답변 삭제">
                        <Ionicons name="trash-outline" size={13} color={theme.textTertiary} />
                      </Pressable>
                    ) : null}
                  </View>
                  <ThemedText type="default" style={qa.body}>
                    {q.answer.body}
                  </ThemedText>
                </View>
              ) : isAuthor && q.id != null ? (
                answering === q.id ? (
                  <View style={qa.answerForm}>
                    <TextInput
                      value={answerBody}
                      onChangeText={setAnswerBody}
                      placeholder="답변을 입력하세요. (2~1000자)"
                      placeholderTextColor={theme.textTertiary}
                      multiline
                      autoFocus
                      maxLength={1000}
                      style={[qa.input, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
                    />
                    <View style={qa.answerBtns}>
                      <ThemedText type="small" style={[qa.flex1, { color: answerBody.length >= 970 ? theme.orange : theme.textTertiary }]}>
                        {answerBody.length}/1000
                      </ThemedText>
                      <Pressable onPress={() => { setAnswering(null); setAnswerBody(''); }} hitSlop={6}>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>취소</ThemedText>
                      </Pressable>
                      <Pressable onPress={() => onAnswer(q.id!)} hitSlop={6} disabled={answer.isPending || answerBody.trim().length < 2}>
                        <ThemedText type="small" style={{ color: answerBody.trim().length >= 2 ? theme.primary : theme.textTertiary, fontWeight: '800' }}>
                          {answer.isPending ? '등록 중…' : '등록'}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    // 다른 질문으로 옮길 때 입력값도 같이 비운다 — 안 비우면 A질문에 쓰다 만 글이 B질문 폼에 그대로 뜬다
                    onPress={() => { setAnswering(q.id!); setAnswerBody(''); }}
                    style={qa.answerCta}
                    accessibilityLabel="답변 작성">
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color={theme.primary} />
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                      답변 작성
                    </ThemedText>
                  </Pressable>
                )
              ) : (
                <ThemedText type="small" style={{ color: theme.textTertiary }}>
                  답변 대기 중
                </ThemedText>
              )}
            </View>
          );
        })
      )}

      {/* 질문 작성 — 작성자는 안내만 (웹과 동일) */}
      {isAuthor ? (
        <View style={[qa.authorInfo, { backgroundColor: theme.surfaceAlt }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            내 모집글에 도착한 질문에 답변해보세요.
          </ThemedText>
        </View>
      ) : (
        <View style={qa.form}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={isPrivate ? '작성자만 볼 수 있는 비공개 질문을 입력하세요. (2~500자)' : '궁금한 점을 자유롭게 물어보세요. (2~500자)'}
            placeholderTextColor={theme.textTertiary}
            multiline
            maxLength={500}
            style={[qa.input, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
          />
          <View style={qa.formFoot}>
            <View style={qa.privateRow}>
              <Switch value={isPrivate} onValueChange={setIsPrivate} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                비공개로 묻기
              </ThemedText>
            </View>
            <Pressable
              onPress={onAsk}
              disabled={body.trim().length < 2 || createQ.isPending}
              accessibilityLabel="질문 등록"
              accessibilityRole="button"
              style={[qa.askBtn, { backgroundColor: body.trim().length >= 2 ? theme.primary : theme.surfaceSelected }]}>
              <ThemedText type="small" style={{ color: body.trim().length >= 2 ? readableOn(theme.primary) : theme.textTertiary, fontWeight: '700' }}>
                {createQ.isPending ? '등록 중…' : '질문 등록'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

/** 활동 위치 정적 미니맵 — 탭하면 카카오맵으로 (웹 RecruitMapCanvas + 카카오맵에서 열기 미러) */
function RecruitLocationMap({
  lat,
  lng,
  label,
  theme,
}: {
  lat: number;
  lng: number;
  label?: string | null;
  theme: ReturnType<typeof useTheme>;
}) {
  const html = useMemo(() => buildStaticMapHtml(KAKAO_JS_KEY, lat, lng), [lat, lng]);
  const open = () => {
    const name = encodeURIComponent(label ?? '활동 위치');
    void Linking.openURL(`https://map.kakao.com/link/map/${name},${lat},${lng}`);
  };
  return (
    <View style={styles.locMapWrap}>
      <View style={styles.locMapBox}>
        <WebView
          style={styles.locMap}
          originWhitelist={['*']}
          source={{ html, baseUrl: KAKAO_MAP_REFERRER }}
          javaScriptEnabled
          scrollEnabled={false}
          pointerEvents="none"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={open} accessibilityLabel="카카오맵에서 열기" accessibilityRole="button" />
        <View style={styles.locMapChip}>
          <Ionicons name="map" size={13} color="#DCEBFF" />
          <ThemedText type="small" style={styles.locMapChipText}>
            카카오맵에서 열기
          </ThemedText>
        </View>
      </View>
      {label ? (
        <View style={styles.locLabelRow}>
          <Ionicons name="location" size={13} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
            {label}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/** 합류 수락 배너 — 워크스페이스 참가/이동 (웹 JoinWorkspaceBanner 1:1) */
function JoinWorkspaceBanner({ detail, theme }: { detail: RecruitmentDetail; theme: ReturnType<typeof useTheme> }) {
  const router = useRouter();
  const { data: workspaces, refetch } = useMyWorkspaces();
  const [joining, setJoining] = useState(false);
  const [joinDone, setJoinDone] = useState(false);
  const alreadyIn = !!workspaces?.some((w) => w.workspaceId === detail.workspaceId);
  const showJoined = joinDone || alreadyIn;
  const hasCode = !!detail.workspaceInviteCode;

  const onJoin = async () => {
    if (!hasCode) {
      toast.error('초대 코드 정보가 없어요. 팀장에게 문의해 주세요.');
      return;
    }
    setJoining(true);
    try {
      await joinWorkspace(detail.workspaceInviteCode!);
      await refetch();
      setJoinDone(true);
      toast.success('워크스페이스에 참가했어요!');
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        await refetch();
        setJoinDone(true);
        toast.success('이미 워크스페이스 멤버예요.');
      } else {
        toast.error(getApiErrorMessage(e));
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={[styles.section, styles.joinBanner, { backgroundColor: showJoined ? theme.green + '12' : theme.primarySoft }]}>
      <ThemedText type="default" style={styles.joinTitle}>
        {showJoined ? '✅ 워크스페이스 준비됐어요!' : '👋 팀 합류가 수락되었어요!'}
      </ThemedText>
      {showJoined ? (
        <AppButton
          title="워크스페이스로 이동"
          variant="tonal"
          onPress={() => router.dismissTo('/(tabs)')}
        />
      ) : hasCode ? (
        <AppButton title={joining ? '참가 중…' : '워크스페이스 참가하기'} onPress={onJoin} disabled={joining} />
      ) : (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          팀장에게 문의해서 워크스페이스 초대를 받아보세요.
        </ThemedText>
      )}
    </View>
  );
}

/** 리더 Q&A 응답 신뢰도 한 줄 — 질문 이력이 있을 때만 */
function LeaderQaStats({ userId, theme }: { userId?: number; theme: ReturnType<typeof useTheme> }) {
  const { data } = useUserQaStats(userId);
  if (!data || !data.totalQuestionCount) return null;
  const latency = fmtLatency(data.avgAnswerLatencyMinutes);
  return (
    <ThemedText type="small" style={{ color: theme.textTertiary }}>
      Q&A 응답{latency ? ` — 평균 ${latency}` : ''} · 응답률 {data.answerRate ?? 0}% · 응답 {data.answeredCount ?? 0}건
    </ThemedText>
  );
}

function fmtLatency(min?: number | null): string | null {
  if (min == null) return null;
  if (min < 60) return `${Math.round(min)}분`;
  if (min < 24 * 60) return `${Math.round(min / 60)}시간`;
  return `${Math.round(min / (24 * 60))}일`;
}

const APP_STATUS_CFG: Record<string, { label: string; colorKey: 'orange' | 'green' | 'danger' }> = {
  PENDING: { label: '대기 중', colorKey: 'orange' },
  ACCEPTED: { label: '수락됨', colorKey: 'green' },
  REJECTED: { label: '거절됨', colorKey: 'danger' },
};

/** 지원자 관리 시트 — 목록 + 수락/거절 (작성자 전용) */
function ApplicantsSheet({
  open,
  onClose,
  recruitmentId,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  recruitmentId: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const { data, isLoading } = useApplications(recruitmentId, open);
  const review = useReviewApplication(recruitmentId);
  const [reviewing, setReviewing] = useState<number | null>(null);

  const act = async (appId: number, action: 'accept' | 'reject') => {
    setReviewing(appId);
    try {
      await review.mutateAsync({ appId, action });
      toast.success(action === 'accept' ? '수락 처리됐어요.' : '거절 처리됐어요.');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setReviewing(null);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={styles.appsBody}>
        <ThemedText type="label" style={styles.applyTitle}>
          신청자 관리
        </ThemedText>
        {isLoading ? (
          <ActivityIndicator style={styles.appsSpinner} />
        ) : !data?.length ? (
          <View style={styles.appsEmpty}>
            <ThemedText type="default">📬</ThemedText>
            <ThemedText type="default" style={{ color: theme.textSecondary }}>
              아직 신청자가 없어요
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textTertiary }}>
              모집 글을 공유하면 더 많은 지원자를 만날 수 있어요
            </ThemedText>
          </View>
        ) : (
          <ScrollView style={styles.appsList} showsVerticalScrollIndicator={false}>
            {data.map((a) => {
              const cfg = APP_STATUS_CFG[a.status ?? ''] ?? APP_STATUS_CFG.PENDING;
              const tone = theme[cfg.colorKey];
              const busy = reviewing === a.id;
              return (
                <View key={a.id} style={[styles.appRow, { borderColor: theme.divider }]}>
                  <View style={styles.appHead}>
                    <Avatar person={{ name: a.applicantName }} size={34} />
                    <View style={styles.flex1c}>
                      <View style={styles.appNameRow}>
                        <ThemedText type="default" style={styles.appName} numberOfLines={1}>
                          {a.applicantName}
                        </ThemedText>
                        {a.selectedRoleName ? (
                          <View style={[styles.appChip, { backgroundColor: theme.primarySoft }]}>
                            <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700', fontSize: 11 }}>
                              {a.selectedRoleName}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText type="small" style={{ color: theme.textTertiary }}>
                        {a.appliedAt}
                      </ThemedText>
                    </View>
                    <View style={[styles.appChip, { backgroundColor: tone + '1A' }]}>
                      <ThemedText type="small" style={{ color: tone, fontWeight: '700', fontSize: 11 }}>
                        {cfg.label}
                      </ThemedText>
                    </View>
                  </View>
                  {a.message ? (
                    <View style={[styles.appMsg, { borderLeftColor: theme.border }]}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {a.message}
                      </ThemedText>
                    </View>
                  ) : null}
                  {a.status === 'PENDING' && a.id != null ? (
                    <View style={styles.appActions}>
                      <Pressable
                        onPress={() => act(a.id!, 'reject')}
                        disabled={busy}
                        style={[styles.appActBtn, { backgroundColor: theme.surfaceAlt, opacity: busy ? 0.5 : 1 }]}
                        accessibilityLabel={`${a.applicantName} 거절`}>
                        <Ionicons name="close" size={15} color={theme.danger} />
                        <ThemedText type="small" style={{ color: theme.danger, fontWeight: '700' }}>거절</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => act(a.id!, 'accept')}
                        disabled={busy}
                        style={[styles.appActBtn, { backgroundColor: theme.green + '1A', opacity: busy ? 0.5 : 1 }]}
                        accessibilityLabel={`${a.applicantName} 수락`}>
                        {busy ? (
                          <ActivityIndicator size="small" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={15} color={theme.green} />
                            <ThemedText type="small" style={{ color: theme.green, fontWeight: '700' }}>수락</ThemedText>
                          </>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </BottomSheet>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <ThemedText type="small" style={[styles.chipText, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="default" style={styles.sectionTitle}>
      {children}
    </ThemedText>
  );
}

function Info({ label, value, theme }: { label: string; value?: string | null; theme: ReturnType<typeof useTheme> }) {
  if (!value) return null;
  return (
    <View style={styles.info}>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={styles.infoValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  body: { paddingTop: 10 },
  section: { paddingHorizontal: 16, paddingVertical: 16, marginBottom: 10 },
  sectionTitle: { fontWeight: '800', fontSize: 16, marginBottom: 10, letterSpacing: -0.2 },
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontWeight: '700', fontSize: 11 },
  title: { marginBottom: 6 },
  summary: { lineHeight: 21 },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  info: { width: '50%', gap: 2, paddingRight: 8 },
  infoValue: { fontWeight: '700' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  roleBody: { flex: 1, gap: 2 },
  roleName: { fontWeight: '700' },
  roleCount: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  paragraph: { lineHeight: 22 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  progressLabel: { flex: 1 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  leaderBody: { flex: 1, gap: 2 },
  memberName: { flex: 1, fontWeight: '600' },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  ctaBtn: { width: '100%' },
  ctaCol: { gap: 8 },
  ctaNote: { textAlign: 'center' },
  applyBody: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  applyTitle: { textAlign: 'center', fontWeight: '700' },
  applyRoles: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  applyRole: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  applyInput: { minHeight: 84, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  locMapWrap: { marginTop: 12, gap: 8 },
  locMapBox: { height: 180, borderRadius: 12, overflow: 'hidden' },
  locMap: { flex: 1, backgroundColor: 'transparent' },
  locMapChip: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 11, borderRadius: 999, backgroundColor: 'rgba(9,18,36,0.9)' },
  locMapChipText: { color: '#DCEBFF', fontWeight: '700' },
  locLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  acceptedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 14 },
  joinBanner: { borderRadius: 16, marginHorizontal: 16, gap: 10 },
  joinTitle: { fontWeight: '800', fontSize: 16 },
  appsBody: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  appsSpinner: { paddingVertical: 30 },
  appsEmpty: { alignItems: 'center', gap: 6, paddingVertical: 26 },
  appsList: { maxHeight: 440 },
  appRow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 8, marginBottom: 8 },
  appHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex1c: { flex: 1, gap: 1 },
  appNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  appName: { fontWeight: '700', flexShrink: 1 },
  appChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  appMsg: { borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 2 },
  appActions: { flexDirection: 'row', gap: 8 },
  appActBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
});

const qa = StyleSheet.create({
  wrap: { gap: 12 },
  flex1: { flex: 1 },
  item: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  asker: { fontWeight: '700' },
  body: { lineHeight: 20 },
  answer: { borderRadius: 10, padding: 10, gap: 4, marginTop: 2 },
  answerCta: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 3 },
  answerForm: { gap: 6 },
  answerBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  maskedBody: { fontStyle: 'italic' },
  authorInfo: { borderRadius: 10, padding: 12, marginTop: 4 },
  form: { gap: 8, marginTop: 4 },
  formFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { minHeight: 64, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
  askBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
});
