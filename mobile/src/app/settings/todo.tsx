import { useEffect } from 'react';
import { Switch } from 'react-native';

import type { UserSettingsUpdate } from '@/features/settings/api';
import { useSettings, useUpdateSettings } from '@/features/settings/queries';
import { ARCHIVE_OPTIONS, DUE_OPTIONS, SettingsShell } from '@/features/settings/shared';
import { useAutoRollover } from '@/features/todo/autoRollover';
import { ListGroup, ListRow } from '@/shared/ui/List';
import { Segmented } from '@/shared/ui/Segmented';
import { PRIORITY_OPTIONS } from '@/shared/ui/tone';

/** 설정 > 할 일 — 새 할 일 기본값·자동 보관·미완료 이월 */
export default function TodoSettingsScreen() {
  const { data: s, isLoading, isError, error } = useSettings();
  const update = useUpdateSettings();
  const set = (payload: UserSettingsUpdate) => update.mutate(payload);

  const rollover = useAutoRollover((st) => st.enabled);
  const setRollover = useAutoRollover((st) => st.setEnabled);
  const hydrateRollover = useAutoRollover((st) => st.hydrate);
  useEffect(() => {
    void hydrateRollover();
  }, [hydrateRollover]);

  return (
    <SettingsShell title="할 일" loading={isLoading} error={isError ? error : undefined}>
      {s ? (
        <ListGroup>
          <ListRow
            label="기본 우선순위"
            desc="새 할 일에 자동으로 들어갈 우선순위"
            vertical
            right={
              <Segmented
                options={PRIORITY_OPTIONS}
                value={(s.defaultPriority as 'HIGH' | 'MEDIUM' | 'LOW') ?? 'MEDIUM'}
                onChange={(v) => set({ defaultPriority: v })}
              />
            }
          />
          <ListRow
            label="기본 마감일"
            desc="새 할 일에 자동으로 들어갈 마감일"
            vertical
            right={<Segmented options={DUE_OPTIONS} value={s.defaultDue ?? 'none'} onChange={(v) => set({ defaultDue: v })} />}
          />
          <ListRow
            label="완료 항목 자동 보관"
            desc="완료한 할 일을 일정 기간 후 보관함으로"
            vertical
            right={<Segmented options={ARCHIVE_OPTIONS} value={String(s.autoArchiveDays ?? 0)} onChange={(v) => set({ autoArchiveDays: Number(v) })} />}
          />
          <ListRow
            label="미완료 자동 이월"
            desc="마감이 지난 내 할 일을 하루 한 번 오늘로 옮겨요 (담당자가 나 혼자인 것만)"
            last
            right={<Switch value={rollover} onValueChange={(v) => void setRollover(v)} />}
          />
        </ListGroup>
      ) : null}
    </SettingsShell>
  );
}
