import axios from 'axios';

/**
 * 백엔드가 문구 대신 **고정 코드**로 내려주는 에러 → 사용자 문구.
 * (클라이언트가 분기할 수 있게 코드로 오는 것들이라 그대로 노출하면 안 된다)
 */
const CODE_MESSAGES: Record<string, string> = {
  // 워크스페이스 초대 코드 참여 — 이메일 미인증이면 서버가 403 EMAIL_NOT_VERIFIED
  EMAIL_NOT_VERIFIED: '이메일 인증을 완료해야 팀에 참여할 수 있어요. 메일함에서 인증 링크를 확인해주세요.',
  // 둘러보기(게스트) 제한 — 워크스페이스 생성·회원 탈퇴·팀 모집에서 온다.
  // 예전엔 이 코드가 그대로 화면에 노출됐다("GUEST_NOT_ALLOWED").
  GUEST_NOT_ALLOWED: '둘러보기에서는 쓸 수 없는 기능이에요. 계정을 만들면 바로 이용할 수 있어요.',
};

/**
 * 백엔드는 사용자向 에러를 `{ "message": "<한국어>" }` 형태로 반환한다.
 * 어떤 에러든 그 메시지를 안전하게 추출하고, 없으면 폴백을 쓴다.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = '문제가 발생했습니다. 다시 시도해주세요.',
): string {
  if (axios.isAxiosError(error)) {
    // 대부분 { message } 지만 이미지 업로드 계열(프로필·워크스페이스 아이콘)만 { error } 를 쓴다.
    // 예전엔 message 만 봐서 "이미지 파일만 업로드할 수 있어요" 같은 사유가 통째로 버려졌다.
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    const raw = data?.message ?? data?.error;
    if (raw) return CODE_MESSAGES[raw] ?? raw;

    // 서버가 본문 없이 상태코드만 준 경우에도 최소한 원인을 구분해준다.
    const status = error.response?.status;
    if (status === 429) return '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.';
    if (status === 413) return '파일이 너무 커요.';
    if (status === 403) return '권한이 없어요.';
    if (!error.response) return '연결이 불안정해요. 네트워크를 확인해주세요.';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * 네트워크 때문에 실패했는가(서버가 거절한 게 아니라 **닿지 못한** 것).
 *
 * 이 구분이 중요한 이유: 서버가 400/403 으로 거절한 것을 큐에 담아 재전송하면 영원히
 * 실패하며 쌓인다. 닿지 못한 것만 다시 보낼 값어치가 있다.
 */
export function isOfflineError(error: unknown): boolean {
  const e = error as { response?: unknown; code?: string; message?: string };
  if (e?.response) return false;                 // 응답이 왔으면 서버가 판단한 것
  const code = e?.code ?? '';
  if (code === 'ERR_NETWORK' || code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
  return /network|timeout|Failed to fetch/i.test(e?.message ?? '');
}
