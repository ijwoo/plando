/**
 * DM 내부 전용 커스텀 이벤트 — 열려 있는 대화방을 사이드바 목록(마스터)과 본문(디테일)이 공유하기 위한 것.
 * 선택 상태의 소유자는 DmPage 하나이고, 사이드바는 이 이벤트로 따라간다.
 * detail: { roomId: number | null }
 */
export const DM_ROOM_OPENED = "plando:dm-room-opened";
