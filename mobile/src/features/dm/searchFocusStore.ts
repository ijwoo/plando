/**
 * DM 방 내 검색 → 해당 메시지로 점프.
 * 방을 새로 열지 않고(모달 검색 → router.back) 기존 방이 focus 시 소비한다.
 */
let pending: { roomId: number; sentAt: string } | null = null;

export const dmSearchFocus = {
  set: (roomId: number, sentAt: string) => {
    pending = { roomId, sentAt };
  },
  take: (roomId: number): string | null => {
    if (pending && pending.roomId === roomId) {
      const s = pending.sentAt;
      pending = null;
      return s;
    }
    return null;
  },
};
