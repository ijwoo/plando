/** DM 방별 입력 초안(메모리) — 방을 나갔다 와도 작성 중 내용 유지. 전송 시 비운다. */
const drafts = new Map<number, string>();

export const dmDraft = {
  get: (roomId: number) => drafts.get(roomId) ?? '',
  set: (roomId: number, value: string) => {
    if (value) drafts.set(roomId, value);
    else drafts.delete(roomId);
  },
};
