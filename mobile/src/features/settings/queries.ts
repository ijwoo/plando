import { getApiErrorMessage } from '@/api/error';
import { toast } from '@/shared/ui/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as settingsApi from './api';
import type { UserSettings, UserSettingsUpdate } from './api';

const KEY = ['settings', 'me'] as const;

export function useSettings() {
  return useQuery({ queryKey: KEY, queryFn: settingsApi.getMySettings });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserSettingsUpdate) => settingsApi.updateMySettings(payload),
    // 낙관적 업데이트 — 토글이 즉시 반영되도록
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<UserSettings>(KEY);
      if (prev) qc.setQueryData<UserSettings>(KEY, { ...prev, ...payload });
      return { prev };
    },
    onError: (e, _payload, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      // 예전엔 롤백만 하고 아무 말도 하지 않았다. 오프라인·403·500 어디서든 스위치가
      // 슬쩍 되돌아가고 끝이라, 사용자는 설정을 바꿨다고 믿었다(테마·알림 5종·캘린더·
      // 기본 우선순위·자동보관 전부 이 훅을 쓴다).
      toast.error(getApiErrorMessage(e, '설정을 저장하지 못했어요'));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUploadProfileImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: { uri: string; name: string; type: string }) => settingsApi.uploadProfileImage(file),
    onSuccess: () => {
      // 내 정보·멤버·DM 등 아바타가 갱신되도록 폭넓게 무효화
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
