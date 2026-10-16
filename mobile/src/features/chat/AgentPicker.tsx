import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { type AiUsage, type ChatAgent } from '@/features/chat/api';
import { agentLook } from '@/features/chat/agentLook';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';

/**
 * 역할 아이콘 한 칸.
 *
 * 내장 역할은 단색 심볼 + 역할 색(타일은 같은 색 옅게), 직접 만든 역할은 그 사람이 고른
 * 이모지 + 중립 타일. 한 줄에 색은 하나다.
 */
function AgentIcon({ agent, theme }: { agent: ChatAgent; theme: ReturnType<typeof useTheme> }) {
  const look = agentLook(agent, theme.primary);
  if (!look.icon) {
    return (
      <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.iconText}>{look.emoji}</ThemedText>
      </View>
    );
  }
  return (
    <View style={[styles.icon, { backgroundColor: withAlpha(look.color, 0.14) }]}>
      <Ionicons name={look.icon} size={19} color={look.color} />
    </View>
  );
}

/** 테마에 soft 계열 토큰이 없어 알파를 직접 붙인다(ChatSteps 와 같은 방식). */
function withAlpha(hex: string, alpha: number): string {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

/**
 * AI 역할 고르기.
 *
 * 역할은 **무엇을 할 수 있는지**를 정한다. 그래서 이름보다 "이 역할이 데이터를 바꾸는가"
 * 가 먼저 보여야 한다 — 읽기 전용 뱃지를 이름 옆에 붙인다.
 *
 * 워크스페이스 전환 시트와 같은 모양(상단에서 내려오는 글래스)을 쓴다. 같은 앱에서
 * 고르는 동작이 화면마다 다르게 생기면 그 자체가 학습 비용이다.
 *
 * 역할 만들기·수정은 웹에서 한다 — 지침을 길게 쓰는 일이라 좁은 화면에서 할 일이 아니고,
 * 만든 역할은 워크스페이스 공유라 앱에서도 바로 보인다.
 */
export function AgentPicker({
  open,
  agents,
  selectedId,
  usage,
  onSelect,
  onEdit,
  onClose,
}: {
  open: boolean;
  agents: ChatAgent[];
  selectedId: string | null;
  usage: AiUsage | null;
  onSelect: (id: string | null) => void;
  /** 만들기(null) · 수정(해당 역할). 시트를 닫지 않고 위에 편집 화면을 띄운다. */
  onEdit: (agent: ChatAgent | null) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const glass = isLiquidGlassAvailable();

  const Sheet = glass ? GlassView : View;
  const sheetProps = glass ? { glassEffectStyle: 'regular' as const } : { style: { backgroundColor: theme.surface } };

  const pick = (id: string) => {
    // 'default' 는 서버 기본값이라 굳이 실어 보내지 않는다
    onSelect(id === 'default' ? null : id);
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(140)} style={StyleSheet.absoluteFill}>
          <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
        </Animated.View>
        <Animated.View entering={SlideInUp.duration(260)} exiting={SlideOutUp.duration(200)} style={styles.sheetWrap}>
          <Sheet
            {...sheetProps}
            style={[styles.sheet, { paddingTop: insets.top + 10 }, glass ? null : { backgroundColor: theme.surface }]}>
            <ThemedText type="label" style={[styles.title, { color: theme.textSecondary }]}>
              역할
            </ThemedText>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {agents.map((a) => {
                const sel = (selectedId ?? 'default') === a.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => pick(a.id)}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
                    <AgentIcon agent={a} theme={theme} />
                    <View style={styles.body}>
                      <View style={styles.nameRow}>
                        <ThemedText type="default" numberOfLines={1} style={styles.name}>
                          {a.name}
                        </ThemedText>
                        {/* 권한은 **모든 역할에** 붙인다.
                            [고치는 결함] 읽기 전용에만 뱃지를 달았더니, 나머지가 내 데이터를
                            고치고 지울 수 있다는 사실은 어디에도 안 적혀 있었다. 정리 도우미가
                            "마감을 다시 잡는다" 는 건 되돌리기 어려운 변경이다. 한쪽만 표시하면
                            표시가 없는 쪽이 더 안전해 보이는 착시까지 생긴다. */}
                        {/* 색은 **예외에만** 쓴다. 다섯 줄 중 넷이 읽기·쓰기라, 넷을 모두
                            주황으로 칠하면 색이 정보를 잃고 소음만 남는다(아이콘 색과도 부딪힌다).
                            글자는 모든 역할에 그대로 남으므로 위 설명의 이유는 지켜진다. */}
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: withAlpha(a.readOnly ? theme.green : theme.textSecondary, 0.12) },
                          ]}>
                          <ThemedText
                            type="small"
                            style={[styles.badgeText, { color: a.readOnly ? theme.green : theme.textSecondary }]}>
                            {a.readOnly ? '읽기 전용' : '읽기·쓰기'}
                          </ThemedText>
                        </View>
                      </View>
                      {a.description ? (
                        <ThemedText type="small" numberOfLines={2} style={{ color: theme.textSecondary }}>
                          {a.description}
                        </ThemedText>
                      ) : null}
                    </View>
                    {a.custom ? (
                      /* 커스텀만 고칠 수 있다. 내장 역할에 수정 버튼을 두면 눌렀다가
                         "안 된다" 를 보게 되므로 아예 그리지 않는다. */
                      <Pressable
                        onPress={() => {
                          tickHaptic();
                          onEdit(a);
                        }}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`${a.name} 수정`}
                        style={styles.editBtn}>
                        <Ionicons name="create-outline" size={17} color={theme.textSecondary} />
                      </Pressable>
                    ) : null}
                    {sel ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : null}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  tickHaptic();
                  onEdit(null);
                }}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="add" size={20} color={theme.primary} />
                </View>
                <View style={styles.body}>
                  <ThemedText type="default" style={[styles.name, { color: theme.primary }]}>
                    역할 만들기
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    우리 팀이 함께 쓸 역할을 직접 만들어요
                  </ThemedText>
                </View>
              </Pressable>
            </ScrollView>

            {usage && usage.limit > 0 ? (
              <>
                <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                <View style={styles.usage}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    오늘 AI 사용
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
                    {usage.used} / {usage.limit}
                  </ThemedText>
                </View>
                <View style={[styles.track, { backgroundColor: theme.divider }]}>
                  <View
                    style={[
                      styles.bar,
                      {
                        // 다 쓰면 색으로도 알린다 — 숫자만으로는 잘 안 읽힌다
                        backgroundColor: usage.used >= usage.limit ? theme.danger : theme.primary,
                        width: `${Math.min(100, Math.round((usage.used / usage.limit) * 100))}%`,
                      },
                    ]}
                  />
                </View>
                {/* 숫자만 있으면 불안만 준다 — 다 쓰면 무슨 일이 생기고 언제 풀리는지 적는다 */}
                <ThemedText type="small" style={[styles.usageNote, { color: theme.textTertiary }]}>
                  {usage.used >= usage.limit
                    ? '오늘 몫을 다 썼어요. 자정(KST)에 다시 채워져요.'
                    : '다 쓰면 대화가 멈춰요. 매일 자정(KST)에 다시 채워져요.'}
                </ThemedText>
              </>
            ) : null}

          </Sheet>
        </Animated.View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheetWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  sheet: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  title: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  icon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  body: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontWeight: '700', flexShrink: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  badgeText: { fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6, marginHorizontal: 16 },
  usage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 6 },
  track: { height: 4, borderRadius: 2, marginHorizontal: 18, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2 },
  usageNote: { paddingHorizontal: 18, paddingTop: 8 },
  editBtn: { padding: 4 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 2 },
});
