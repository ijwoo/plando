/**
 * 초대 딥링크(plando://join?code=…)로 진입했지만 아직 비로그인일 때
 * 코드를 잠시 보관했다가 로그인 완료 후 자동 참여에 사용한다.
 * (웹 InvitePage의 sessionStorage pendingInviteCode 미러 — 앱은 딥링크 직후 세션이므로 인메모리로 충분)
 */
let pendingCode: string | null = null;

export const pendingInvite = {
  set(code: string) {
    pendingCode = code;
  },
  /** 조회만 — 참여가 성공한 뒤 clear()로 지운다 (실패 시 코드를 보존해 재시도 가능) */
  peek(): string | null {
    return pendingCode;
  },
  clear() {
    pendingCode = null;
  },
};
