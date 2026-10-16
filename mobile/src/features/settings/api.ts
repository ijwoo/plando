import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

// dmSuggestionEnabled: 신규 필드 — 생성 스키마(feat/openapi-spec) 갱신 전까지 로컬 확장
export type UserSettings = Schemas['UserSettingsResponse'] & { dmSuggestionEnabled?: boolean };
export type UserSettingsUpdate = Schemas['UserSettingsUpdateRequest'] & { dmSuggestionEnabled?: boolean };

export async function getMySettings(): Promise<UserSettings> {
  const { data } = await api.get<UserSettings>('/api/settings/me');
  return data;
}

/** 부분 업데이트 — 백엔드가 보낸 필드만 머지(웹 updateMySettings와 동일) */
export async function updateMySettings(payload: UserSettingsUpdate): Promise<UserSettings> {
  const { data } = await api.put<UserSettings>('/api/settings/me', payload);
  return data;
}

/**
 * 내 계정 메타(id·로그인 제공자·카카오 연동 여부·비밀번호 보유) — 웹 userApi.getMe 미러.
 *
 * hasPassword: 소셜(구글·카카오·애플)로만 가입하면 비밀번호가 없다. 이때 재설정 메일은
 * 서버가 (계정 열거 방지로) 조용히 무시하고, 카카오 연동 해제는 400으로 거절한다.
 * 화면이 미리 분기해 "될 수 없는 동작"을 권하지 않도록 UserDto가 내려준다.
 */
export type AccountMeta = {
  id?: number;
  email?: string;
  name?: string;
  provider?: string;
  kakaoLinked?: boolean;
  hasPassword?: boolean;
  guest?: boolean;
};

export async function getMyAccountMeta(): Promise<AccountMeta> {
  const { data } = await api.get<AccountMeta>('/api/users/me');
  return data;
}

/** 카카오 계정 연동 해제 */
export async function unlinkKakao(): Promise<void> {
  await api.delete('/api/users/me/link-kakao');
}

/** 전체 할 일 CSV 내보내기 — CSV 원문 텍스트 반환 */
export async function exportTodosCsv(): Promise<string> {
  const { data } = await api.get<string>('/api/todos/export', {
    responseType: 'text',
    transformResponse: (d) => d,
  });
  return typeof data === 'string' ? data : String(data);
}

/** 내 프로필 이미지 업로드 (multipart). RN 파일 형식 {uri,name,type}. */
export async function uploadProfileImage(file: { uri: string; name: string; type: string }): Promise<{ profileImageUrl?: string }> {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  const { data } = await api.post<{ profileImageUrl?: string }>('/api/users/me/profile-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
