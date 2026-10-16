import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useCreateTodo } from '@/features/todo/queries';
import { BottomSheet } from '@/features/todo/todoPickers';
import { useTheme } from '@/hooks/use-theme';
import { Button as AppButton } from '@/shared/ui/Button';
import { toast } from '@/shared/ui/toast';

import { extractTodos } from './api';

/**
 * 긴 메시지(회의록 등)에서 AI가 뽑은 할 일 후보를 멀티 선택 → 일괄 생성.
 * 추출은 비영속(서버 저장 없음) — 선택한 것만 기존 할 일 생성 API로 만든다.
 * 기본 전체 선택: 선택 상태를 '제외 집합'으로 들어 초기화 이펙트가 필요 없다.
 */
export function ExtractTodosSheet({
  roomId,
  messageId,
  onClose,
}: {
  roomId: number;
  /** null이면 닫힘 */
  messageId: number | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const create = useCreateTodo();
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: items, error, isFetching } = useQuery({
    queryKey: ['dm', 'extract', roomId, messageId],
    queryFn: () => extractTodos(roomId, messageId!),
    enabled: messageId != null,
    staleTime: Infinity, // 같은 메시지 재추출로 AI 중복 호출 방지
    retry: false,
  });

  const toggle = (i: number) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const close = () => {
    setExcluded(new Set());
    onClose();
  };

  const selectedCount = (items?.length ?? 0) - excluded.size;

  const onConfirm = async () => {
    if (!items || saving) return;
    const selected = items.filter((_, i) => !excluded.has(i));
    if (!selected.length) return;
    setSaving(true);
    let ok = 0;
    for (const it of selected) {
      try {
        await create.mutateAsync({
          title: it.title,
          // status 생략 — useCreateTodo 가 워크스페이스 기본 상태를 채운다.
          // 'TODO' 를 박아두면 기본 상태를 옮긴 워크스페이스에서 엉뚱한 칸에 생긴다.
          priority: 'MEDIUM',
          dueDate: it.dueDate || undefined,
        });
        ok += 1;
      } catch {
        // 개별 실패는 전역 토스트 — 나머지는 계속
      }
    }
    setSaving(false);
    if (ok > 0) toast.success(`할 일 ${ok}개를 만들었어요`);
    close();
  };

  return (
    <BottomSheet open={messageId != null} onClose={close}>
      <View style={styles.body}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={15} color={theme.primary} />
          <ThemedText type="label">메시지에서 찾은 할 일</ThemedText>
        </View>

        {error ? (
          <ThemedText type="default" style={{ color: theme.danger }}>
            {getApiErrorMessage(error)}
          </ThemedText>
        ) : isFetching || items == null ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              AI가 읽고 있어요…
            </ThemedText>
          </View>
        ) : items.length === 0 ? (
          <ThemedText type="default" style={{ color: theme.textSecondary }}>
            할 일로 만들 내용을 찾지 못했어요.
          </ThemedText>
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {items.map((it, i) => {
              const on = !excluded.has(i);
              return (
                <Pressable
                  key={`${i}-${it.title}`}
                  onPress={() => toggle(i)}
                  accessibilityLabel={`${it.title} ${on ? '선택 해제' : '선택'}`}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={on ? theme.primary : theme.textTertiary}
                  />
                  <View style={styles.rowBody}>
                    <ThemedText type="default" numberOfLines={2}>
                      {it.title}
                    </ThemedText>
                    {it.dueDate ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        마감 {it.dueDate}
                        {it.dueTime ? ` ${it.dueTime}` : ''}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {items?.length ? (
          <AppButton
            title={saving ? '추가 중…' : `할 일 ${selectedCount}개 추가`}
            onPress={onConfirm}
            disabled={saving || selectedCount === 0}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  list: { maxHeight: 360 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  rowBody: { flex: 1, gap: 2 },
});
