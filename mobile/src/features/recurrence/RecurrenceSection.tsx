import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { DateField } from '@/shared/ui/DateField';
import { Segmented } from '@/shared/ui/Segmented';
import { toast } from '@/shared/ui/toast';
import { RECURRENCE_OPTIONS, type RecurrenceType } from './api';
import { useRecurrence, useUpsertRecurrence } from './queries';

/** 반복 유형별 안내 문구 — 웹 constants/recurrence.js RECURRENCE_HINTS와 동일 */
const RECURRENCE_HINTS: Partial<Record<RecurrenceType, string>> = {
  DAILY: '매일 새 할 일이 자동으로 생성됩니다.',
  WEEKLY: '매주 같은 요일에 새 할 일이 생성됩니다.',
  MONTHLY: '매월 같은 날짜에 새 할 일이 생성됩니다.',
};

/** 반복 섹션 — 기존 TodoRecurrenceSection 매칭. 반복 유형 + 종료일. PUT /recurrence. */
export function RecurrenceSection({ todoId, readonly }: { todoId: number; readonly?: boolean }) {
  const theme = useTheme();
  const { data } = useRecurrence(todoId);
  const upsert = useUpsertRecurrence(todoId);

  /**
   * 서버 값을 그대로 렌더하고, 사용자가 건드린 뒤에만 draft 로 덮어쓴다.
   *
   * 예전엔 useState 초기값으로 data 를 넣었는데, 초기값은 **첫 렌더에만** 평가되고
   * 그때 쿼리는 아직 로딩 중이라 data 가 undefined 였다. 그래서 endDate 가 영원히
   * undefined 로 남았고, 유형을 다시 고르면 `endDate: undefined` 가 전송돼
   * **"12/31까지"가 무한 반복으로 조용히 바뀌었다.** type 도 'NONE' 에 묶여
   * 종료일 입력칸 자체가 렌더되지 않았다.
   *
   * effect 로 동기화하지 않는 이유: 렌더 중 setState 는 연쇄 렌더를 부른다(lint 규칙).
   * 서버를 기본값으로 두고 draft 유무로 갈라내면 동기화 자체가 필요 없다.
   */
  const serverType = (data?.recurrenceType as RecurrenceType) ?? 'NONE';
  const serverEnd = data?.endDate ?? undefined;
  const [draft, setDraft] = useState<{ type: RecurrenceType; endDate?: string } | null>(null);

  const type = draft ? draft.type : serverType;
  const endDate = draft ? draft.endDate : serverEnd;

  // 실패하면 draft 가 비워지며 화면이 서버 값으로 **소리 없이 되돌아간다** — 왜 되돌아갔는지 알린다.
  const onSaveError = (e: unknown) => toast.error(getApiErrorMessage(e, '반복 설정을 저장하지 못했어요'));

  const onChangeType = (t: RecurrenceType) => {
    const next = t === 'NONE' ? undefined : endDate;
    setDraft({ type: t, endDate: next });
    // 서버 응답이 정착하면 draft 를 비워 다시 서버를 따르게 한다(실패 시 원복 포함).
    upsert.mutate({ recurrenceType: t, endDate: next }, { onError: onSaveError, onSettled: () => setDraft(null) });
  };
  const onChangeEnd = (d: string | undefined) => {
    setDraft({ type, endDate: d });
    if (type !== 'NONE') {
      upsert.mutate({ recurrenceType: type, endDate: d }, { onError: onSaveError, onSettled: () => setDraft(null) });
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText type="default" style={styles.title}>
        반복
      </ThemedText>
      {/* 읽기 전용(샘플·VIEWER)인데 눌리면 서버가 403 을 준다 — 상세의 나머지는 이미 잠겨 있다 */}
      <Segmented options={RECURRENCE_OPTIONS} value={type} onChange={onChangeType} disabled={readonly} />
      {RECURRENCE_HINTS[type] ? (
        <ThemedText type="small" style={[styles.hint, { color: theme.textSecondary }]}>
          {RECURRENCE_HINTS[type]}
        </ThemedText>
      ) : null}
      {type !== 'NONE' ? (
        <>
          <ThemedText type="small" style={styles.label}>
            종료일 (선택)
          </ThemedText>
          {/* 읽기 전용이면 날짜 선택기를 아예 띄우지 않는다 — 고를 수는 있는데 저장은 403 나는
              '먹통 컨트롤'이 되기 때문. 값은 그대로 보여준다(상단 읽기 전용 배너가 이유를 설명). */}
          {readonly ? (
            <View style={[styles.readonlyField, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="default" style={endDate ? undefined : { color: theme.textSecondary }}>
                {endDate ?? '종료일 없음'}
              </ThemedText>
            </View>
          ) : (
            <DateField value={endDate} onChange={onChangeEnd} placeholder="종료일 없음" minimumDate={new Date()} />
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, marginTop: 8 },
  title: { fontWeight: '700' },
  hint: { marginTop: -2 },
  label: { opacity: 0.6, marginTop: 4 },
  // DateField(shared/ui)와 같은 규격 — 읽기 전용일 때 자리·높이가 흔들리지 않게
  readonlyField: { height: 50, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', opacity: 0.6 },
});
