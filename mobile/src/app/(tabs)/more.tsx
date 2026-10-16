import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { EmailVerifyBanner } from '@/features/auth/EmailVerifyBanner';
import { useMe } from '@/features/auth/queries';
import { getMyAccountMeta } from '@/features/settings/api';
import { useSettings } from '@/features/settings/queries';
import { useMyWorkspaces } from '@/features/workspace/queries';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset } from '@/constants/theme';
import { useAuthStore } from '@/shared/store/authStore';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { Avatar } from '@/shared/ui/Avatar';
import { ListGroup, ListRow, ListSectionHeader } from '@/shared/ui/List';
import { radius } from '@/shared/ui/tokens';

/** "더보기" 허브 — iOS 그룹 리스트 (프로필·워크스페이스·기능·관리·설정). */
/** 사용 안내서 · 문의처. 문의 주소는 인증 메일 발신 주소와 같다(사용자가 이미 보고 있는 주소). */
const DOCS_URL = 'https://plando.imjaewoo.dev/docs/';
const SUPPORT_EMAIL = 'wawa9972@gmail.com';

/**
 * 메일 앱으로 문의를 연다.
 *
 * mailto 는 메일 앱이 설정돼 있지 않으면 **아무 일도 일어나지 않는다** — 사용자에겐 버튼이
 * 고장 난 것으로 보인다. 실패하면 주소를 직접 알려줘서 복사할 수 있게 한다.
 */
async function openSupportMail() {
  const subject = encodeURIComponent('[Plan Do!] 문의');
  const body = encodeURIComponent(
    '어떤 상황에서 무엇이 안 되었는지 적어주시면 빠르게 확인할 수 있어요.\n\n' +
      '- 무엇을 하려 했나:\n- 무슨 일이 일어났나:\n',
  );
  const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('메일 앱을 열지 못했어요', `${SUPPORT_EMAIL} 으로 보내주세요.`);
  }
}

type Feature = { icon: keyof typeof Ionicons.glyphMap; label: string; desc: string; color: string; onPress: () => void };

export default function MoreScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);

  const { data: me } = useMe();
  const { data: settings } = useSettings();
  const { data: workspaces } = useMyWorkspaces();
  const { data: meta } = useQuery({ queryKey: ['users', 'me', 'meta'], queryFn: getMyAccountMeta });

  // 게스트 → 회원 전환 유도: 게스트 세션 데이터는 계정 이관이 없어 가입 시 초기화됨을 고지
  const onConvertGuest = () => {
    Alert.alert('회원가입', '지금은 둘러보기(게스트) 모드예요.\n가입하면 내 계정으로 할 일을 안전하게 보관할 수 있어요.\n\n게스트 모드의 데이터는 가입 후 이어지지 않아요.', [
      { text: '취소', style: 'cancel' },
      { text: '가입하러 가기', onPress: () => void signOut() },
    ]);
  };
  const activeId = useWorkspaceStore((s) => s.activeId);

  const current = workspaces?.find((w) => w.workspaceId === activeId) ?? workspaces?.[0];
  const multi = (workspaces?.length ?? 0) > 1;

  // 주요 기능(경험)
  const features: Feature[] = [
    { icon: 'location', label: '지도 일정', desc: '위치 기반 할 일', color: '#EF4444', onPress: () => router.push('/map') },
    { icon: 'sparkles', label: 'AI 어시스턴트', desc: '말하듯 추가', color: '#7C5CF0', onPress: () => router.push('/chat') },
    { icon: 'people', label: '팀 모집', desc: '팀원 찾기', color: '#F59E0B', onPress: () => router.push('/recruitment') },
    { icon: 'stats-chart', label: '주간 회고', desc: '한 주 돌아보기', color: '#10B981', onPress: () => router.push('/wrap') },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <ThemedText type="subtitle">더보기</ThemedText>
      </View>

      {/* 마지막 행(로그아웃)이 플로팅 탭바에 가리지 않게 탭바 인셋만큼 하단 패딩 */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + insets.bottom + 24 }]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        {/* 이메일 미인증 안내 — 인증되면(소셜 로그인 포함) 아무것도 렌더하지 않음 */}
        <EmailVerifyBanner style={styles.verifyBanner} />
        {meta?.guest ? (
          <Pressable onPress={onConvertGuest} style={({ pressed }) => [styles.guestBanner, { backgroundColor: theme.primarySoft }, pressed && { opacity: 0.8 }]}>
            <Ionicons name="sparkles" size={16} color={theme.primary} />
            <View style={styles.guestBody}>
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800' }}>
                둘러보기 모드예요
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.primary, opacity: 0.8 }}>
                가입하고 내 할 일을 안전하게 보관하세요
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.primary} />
          </Pressable>
        ) : null}

        {/* 내 정보 — 그룹 리스트 첫 행 (iOS 설정 앱 패턴) */}
        <ListGroup>
          <ListRow
            label={settings?.displayName || me?.email || '내 계정'}
            desc={settings?.displayName && me?.email ? me.email : '내 정보 · 계정 관리'}
            last
            left={<Avatar person={{ name: settings?.displayName ?? me?.email, profileImageUrl: settings?.profileImageUrl }} size={44} />}
            onPress={() => router.push('/account')}
          />
        </ListGroup>

        {/* 워크스페이스 — 전환·관리 통합(/workspaces에서 탭으로 전환 + 생성·참여·관리) */}
        <ListSectionHeader>워크스페이스</ListSectionHeader>
        <ListGroup>
          <ListRow
            icon="business"
            iconBg="#6366F1"
            label={current?.workspaceName ?? '워크스페이스'}
            desc={`${current?.role === 'OWNER' ? '소유자' : '멤버'} · 멤버 ${current?.memberCount ?? 1}명${multi ? ` · ${workspaces?.length}개` : ''}`}
            last
            onPress={() => router.push('/workspaces')}
          />
        </ListGroup>

        {/* 주요 기능 — 그룹 리스트 (관리/설정과 동일 형식) */}
        <ListSectionHeader>둘러보기</ListSectionHeader>
        <ListGroup>
          {features.map((f, i) => (
            <ListRow
              key={f.label}
              icon={f.icon}
              iconBg={f.color}
              label={f.label}
              desc={f.desc}
              last={i === features.length - 1}
              onPress={f.onPress}
            />
          ))}
        </ListGroup>

        {/* 관리 */}
        <ListSectionHeader>관리</ListSectionHeader>
        <ListGroup>
          <ListRow icon="stats-chart" iconBg="#10B981" label="팀 통계" desc="주간 완료율·멤버 현황·히트맵" onPress={() => router.push('/stats')} />
          <ListRow icon="folder" iconBg="#0EA5E9" label="프로젝트" desc="프로젝트별로 할 일 관리" onPress={() => router.push('/projects')} />
          <ListRow icon="document-text" iconBg="#8B5CF6" label="할 일 템플릿" desc="자주 쓰는 할 일 양식" onPress={() => router.push('/templates')} />
          <ListRow icon="archive" iconBg="#64748B" label="아카이브" desc="완료·보관된 할 일" last onPress={() => router.push('/archive')} />
        </ListGroup>

        {/* 설정 */}
        <ListSectionHeader>설정</ListSectionHeader>
        <ListGroup>
          <ListRow icon="settings" iconBg="#3B82F6" label="환경설정" desc="알림·계정·워크스페이스" last onPress={() => router.push('/settings')} />
        </ListGroup>

        {/* 도움말 — 예전엔 앱에서 문제를 알릴 곳이 한 군데도 없었다.
            크래시 수집은 "터졌다"를 잡지만 "불편하다"는 못 잡는다. */}
        <ListSectionHeader>도움말</ListSectionHeader>
        <ListGroup>
          <ListRow
            icon="book"
            iconBg="#0EA5E9"
            label="사용 안내서"
            desc="기능별 사용법과 자주 묻는 질문"
            onPress={() => void Linking.openURL(DOCS_URL)}
          />
          <ListRow
            icon="mail"
            iconBg="#64748B"
            label="문의하기"
            desc="고장이나 불편한 점을 알려주세요"
            last
            onPress={openSupportMail}
          />
        </ListGroup>

        {__DEV__ ? (
          <ListGroup style={styles.devGroup}>
            <ListRow label="로그아웃 (dev)" destructive hideChevron last onPress={() => void signOut()} />
          </ListGroup>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // TopNav 타이틀과 세로 중심 일치(safe top + 31) — 탭 전환 시 헤더 라인이 튀지 않게
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  content: { padding: 16 },
  dim: { opacity: 0.6 },
  devGroup: { marginTop: 22 },
  verifyBanner: { marginBottom: 12 },
  guestBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: radius.card, marginBottom: 12 },
  guestBody: { flex: 1, gap: 1 },
});
