import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * AI 가 실행한 단계 목록 (웹 ChatSteps 미러).
 *
 * 왜 보여주는가: 결과 문장만으로는 "어떤 조건으로 찾았는지", "무엇을 바꿨는지" 알 수 없다.
 * 결과가 이상해도 사용자는 고칠 단서를 못 얻고 AI 를 못 믿게 될 뿐이다.
 *
 * 기본은 접어 둔다 — 잘 돌아갈 때 매번 펼쳐져 있으면 답변을 가린다.
 * 다만 **실패한 단계가 있으면 처음부터 펼친다.** 문제가 났을 때 한 번 더 누르게 하면 안 된다.
 */

/** 테마에 soft 계열 토큰이 없어 직접 만든다. #RRGGBB 만 처리하고, 그 외는 원본을 돌려준다. */
function withAlpha(hex: string, alpha: number): string {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

export type AgentStep = {
  tool?: string;
  summary?: string;
  args?: Record<string, unknown>;
  result?: { count?: number };
  mutating?: boolean;
  ok?: boolean;
  error?: string | null;
  durationMs?: number;
};

const TOOL_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  search_tasks: 'search',
  create_task: 'add',
  update_task: 'create-outline',
  delete_task: 'trash-outline',
};

/** 인자 키를 사람 말로. 모르는 키는 그대로 둔다(빈칸보다 낫다). */
const ARG_LABEL: Record<string, string> = {
  query: '검색어',
  status: '상태',
  priority: '우선순위',
  dueDate: '마감일',
  overdue: '마감 지남',
  limit: '최대',
  title: '제목',
  taskId: '대상',
  projectName: '프로젝트',
  statusKey: '상태',
};

function fmtValue(v: unknown): string {
  if (v === true) return '예';
  if (v === false) return '아니오';
  return String(v);
}

function fmtMs(ms?: number): string {
  if (!ms) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}초`;
}

export function ChatSteps({ steps }: { steps?: AgentStep[] | null }) {
  const theme = useTheme();
  const hasFailure = Array.isArray(steps) && steps.some((s) => s && s.ok === false);
  const [open, setOpen] = useState(hasFailure);

  if (!Array.isArray(steps) || steps.length === 0) return null;

  const totalMs = steps.reduce((sum, s) => sum + (s?.durationMs ?? 0), 0);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={open ? '실행 단계 접기' : '실행 단계 펼치기'}
        style={[
          styles.pill,
          { backgroundColor: hasFailure ? withAlpha(theme.danger, 0.14) : theme.surfaceAlt },
        ]}
      >
        <Text style={[styles.pillText, { color: hasFailure ? theme.danger : theme.textSecondary }]}>
          {hasFailure ? '일부 단계가 실패했어요' : `${steps.length}단계 실행`}
          {!hasFailure && totalMs > 0 ? ` · ${fmtMs(totalMs)}` : ''}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={13}
          color={hasFailure ? theme.danger : theme.textSecondary}
        />
      </Pressable>

      {open ? (
        <View style={styles.list}>
          {steps.map((s, i) => {
            if (!s) return null;
            const failed = s.ok === false;
            const icon = TOOL_ICON[s.tool ?? ''] ?? 'search';
            const argEntries = Object.entries(s.args ?? {});
            return (
              <View
                key={`${s.tool}-${i}`}
                style={[
                  styles.step,
                  {
                    backgroundColor: failed ? (withAlpha(theme.danger, 0.08)) : theme.surfaceAlt,
                    borderColor: failed ? theme.danger : 'transparent',
                  },
                ]}
              >
                <View style={styles.stepHead}>
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor: failed
                          ? (withAlpha(theme.danger, 0.14))
                          : s.mutating
                            ? (withAlpha(theme.orange, 0.16))
                            : (theme.primarySoft),
                      },
                    ]}
                  >
                    <Ionicons
                      name={icon}
                      size={11}
                      color={failed ? theme.danger : s.mutating ? theme.orange : theme.primary}
                    />
                  </View>

                  <Text style={[styles.summary, { color: theme.text }]} numberOfLines={2}>
                    {s.summary || s.tool}
                  </Text>

                  {/* 데이터를 바꾼 단계는 눈에 띄게 — 조회와 삭제가 같아 보이면 위험을 못 알아챈다 */}
                  {s.mutating && !failed ? (
                    <View style={[styles.badge, { backgroundColor: withAlpha(theme.orange, 0.16) }]}>
                      <Text style={[styles.badgeText, { color: theme.orange }]}>변경</Text>
                    </View>
                  ) : null}

                  <Ionicons
                    name={failed ? 'close' : 'checkmark'}
                    size={13}
                    color={failed ? theme.danger : theme.green}
                  />
                </View>

                {argEntries.length > 0 ? (
                  <View style={styles.args}>
                    {argEntries.map(([k, v]) => (
                      <View key={k} style={[styles.argChip, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                        <Text style={[styles.argText, { color: theme.textSecondary }]}>
                          {ARG_LABEL[k] ?? k} <Text style={styles.argValue}>{fmtValue(v)}</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {failed ? (
                  <Text style={[styles.error, { color: theme.danger }]}>
                    {s.error || '처리하지 못했어요.'}
                  </Text>
                ) : s.result?.count != null || s.durationMs ? (
                  <Text style={[styles.meta, { color: theme.textTertiary }]}>
                    {s.result?.count != null ? `결과 ${s.result.count}건` : ''}
                    {s.result?.count != null && s.durationMs ? ' · ' : ''}
                    {fmtMs(s.durationMs)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: '600' },
  list: { marginTop: 6, gap: 5 },
  step: { padding: 10, borderRadius: 12, borderWidth: 1 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  iconBox: { width: 18, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  summary: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  args: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6, paddingLeft: 25 },
  argChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1 },
  argText: { fontSize: 11 },
  argValue: { fontWeight: '700' },
  error: { marginTop: 6, paddingLeft: 25, fontSize: 12, lineHeight: 17 },
  meta: { marginTop: 5, paddingLeft: 25, fontSize: 11 },
});
