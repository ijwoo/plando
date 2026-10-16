import type { UserSettingsUpdate } from '@/features/settings/api';
import { useSettings, useUpdateSettings } from '@/features/settings/queries';
import { CALENDAR_VIEWS, SettingsShell, WEEK_START } from '@/features/settings/shared';
import { ListGroup, ListRow } from '@/shared/ui/List';
import { Segmented } from '@/shared/ui/Segmented';

/** 설정 > 캘린더 — 기본 보기·주 시작 요일 */
export default function CalendarSettingsScreen() {
  const { data: s, isLoading, isError, error } = useSettings();
  const update = useUpdateSettings();
  const set = (payload: UserSettingsUpdate) => update.mutate(payload);

  return (
    <SettingsShell title="캘린더" loading={isLoading} error={isError ? error : undefined}>
      {s ? (
        <ListGroup>
          <ListRow
            label="기본 보기"
            desc="캘린더를 열 때 처음 보여줄 형태"
            vertical
            right={<Segmented options={CALENDAR_VIEWS} value={s.calendarDefaultView ?? 'month'} onChange={(v) => set({ calendarDefaultView: v })} />}
          />
          <ListRow
            label="주 시작 요일"
            vertical
            last
            right={<Segmented options={WEEK_START} value={s.weekStartDay ?? 'sun'} onChange={(v) => set({ weekStartDay: v })} />}
          />
        </ListGroup>
      ) : null}
    </SettingsShell>
  );
}
