import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AppState, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { resendVerificationEmail } from '@/features/auth/api';
import { useMe } from '@/features/auth/queries';
import { getMyAccountMeta } from '@/features/settings/api';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/shared/ui/toast';
import { radius } from '@/shared/ui/tokens';

/** 닫기는 이 앱 실행(세션) 동안만 유지 — 다음 실행에는 다시 안내한다 (웹의 sessionStorage와 같은 수명) */
const useDismissed = create<{ dismissed: boolean; dismiss: () => void }>((set) => ({
  dismissed: false,
  dismiss: () => set({ dismissed: true }),
}));

/**
 * 이메일 미인증 안내 배너 — 홈·더보기 콘텐츠 상단에 인라인으로 렌더한다.
 *
 * 미인증이어도 앱은 정상 사용 가능하고(정책), 초대 코드로 팀에 참여할 때만 막힌다.
 * 그래서 UI를 넓게 잠그지 않고 이 배너로만 유도한다.
 * 오프라인 배너처럼 상단에 떠 있게 하지 않은 이유: 그 자리에 홈 헤더(워크스페이스·알림 버튼)가
 * 있어 배너가 눌러야 할 버튼을 덮어버린다. 더보기의 게스트 배너와 같은 인라인 카드로 둔다.
 * 소셜 로그인(카카오/구글/애플)은 가입 시 인증 완료 처리되므로 이 배너를 보지 않는다.
 */
export function EmailVerifyBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const dismissed = useDismissed((s) => s.dismissed);
  const dismiss = useDismissed((s) => s.dismiss);
  const [sending, setSending] = useState(false);

  const unverified = me?.emailVerified === false;
  // 게스트 계정은 메일함이 없다 — 안내해도 할 수 있는 게 없으니 숨긴다.
  // 더보기·계정 화면과 같은 쿼리 키라 캐시를 공유하고, 인증된 계정에선 요청조차 하지 않는다.
  const { data: meta } = useQuery({ queryKey: ['users', 'me', 'meta'], queryFn: getMyAccountMeta, enabled: unverified });

  /* 다른 기기(메일 링크 → 웹)에서 인증을 끝냈을 수 있으니 포그라운드 복귀 때 me를 다시 확인한다.
     useMe는 staleTime: Infinity라 이 갱신이 없으면 인증을 마쳐도 앱을 재시작할 때까지 배너가 남는다. */
  useEffect(() => {
    if (!unverified) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void qc.invalidateQueries({ queryKey: ['me'] });
    });
    return () => sub.remove();
  }, [unverified, qc]);

  if (!unverified || dismissed || meta?.guest) return null;

  const onResend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await resendVerificationEmail();
      // 서버가 3분 쿨다운 중이면 실제로 보내지 않고도 200 — 문구는 양쪽에 다 맞게 둔다
      toast.success('인증 메일을 보냈어요. 메일함을 확인해주세요');
    } catch (e) {
      toast.error(getApiErrorMessage(e, '인증 메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.banner, { backgroundColor: theme.primarySoft }, style]}>
      <Ionicons name="mail-unread-outline" size={16} color={theme.primary} />
      <View style={styles.body}>
        <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800' }}>
          이메일 인증이 필요해요
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.primary, opacity: 0.8 }}>
          {me?.email ? `${me.email}로 보낸 링크를 눌러주세요` : '메일로 보낸 인증 링크를 눌러주세요'}
        </ThemedText>
      </View>
      <Pressable
        onPress={onResend}
        disabled={sending}
        hitSlop={6}
        style={({ pressed }) => [styles.action, { borderColor: theme.primary }, pressed && { opacity: 0.6 }]}>
        <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
          {sending ? '보내는 중…' : '다시 받기'}
        </ThemedText>
      </Pressable>
      <Pressable onPress={dismiss} hitSlop={8} accessibilityLabel="닫기">
        <Ionicons name="close" size={16} color={theme.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // 더보기의 게스트 배너와 동일 규격 (padding 13 / radius.card)
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: radius.card },
  body: { flex: 1, gap: 1 },
  action: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
});
