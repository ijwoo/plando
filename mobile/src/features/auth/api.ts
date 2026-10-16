import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

export type LoginResponse = Schemas['LoginResponseDto'];

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', { email, password });
  return data;
}

export async function signup(input: Schemas['AuthDto']): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/signup', input);
  return data;
}

export async function guestLogin(): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/guest');
  return data;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/api/auth/forgot-password', { email });
}

/** 이메일로 받은 재설정 토큰 + 새 비밀번호로 재설정 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/api/auth/reset-password', { token, newPassword });
}

/** Apple 네이티브 로그인 — identityToken을 백엔드에서 검증·교환 (웹 Capacitor 앱과 동일 엔드포인트) */
export async function appleLogin(
  identityToken: string,
  firstName?: string | null,
  lastName?: string | null,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/apple', {
    identityToken,
    firstName: firstName ?? undefined,
    lastName: lastName ?? undefined,
  });
  return data;
}

/**
 * 현재 사용자 이메일(JWT principal) + 이메일 인증 여부.
 * 예: DM 메시지 버블 정렬, 미인증 안내 배너(EmailVerifyBanner).
 */
export async function getMe(): Promise<{ email: string; emailVerified: boolean }> {
  const { data } = await api.get<{ email: string; emailVerified: boolean }>('/api/auth/me');
  return data;
}

/** 메일 링크의 토큰으로 이메일 인증 완료. 비로그인 상태(다른 기기)에서도 호출 가능 */
/**
 * 인증 결과. 가입 때 초대코드를 넣었다면 서버가 합류 처리 결과까지 함께 내려준다
 * (합류 실패는 인증 자체를 막지 않으므로 예외가 아니라 이 필드로 온다).
 */
export type VerifyEmailResult = {
  joinedWorkspaceName?: string | null;
  joinError?: string | null;
};

export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  const { data } = await api.post<VerifyEmailResult>('/api/auth/verify-email', { token });
  return data ?? {};
}

/** 인증 메일 재발송. 서버가 3분 쿨다운을 처리하므로 200이어도 실제 발송은 생략될 수 있다. */
export async function resendVerificationEmail(): Promise<void> {
  await api.post('/api/auth/verify-email/resend');
}

/** 회원 탈퇴 (관리자 워크스페이스·할 일 삭제, 되돌릴 수 없음) */
export async function deleteAccount(): Promise<void> {
  await api.delete('/api/auth/me');
}
