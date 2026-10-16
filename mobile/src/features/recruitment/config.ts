/** 웹 recruitmentConfig 미러 — 카테고리 톤, 목록 필터, 신청 상태 필터 */

export const CAT_CFG: Record<string, { icon: string; color: string }> = {
  토이프로젝트: { icon: '🚀', color: '#5B8AF5' },
  사이드프로젝트: { icon: '⚡', color: '#9B7BF5' },
  스터디: { icon: '📚', color: '#2DD4A0' },
  기타: { icon: '✨', color: '#F5A623' },
};

export function getCategory(typeLabel?: string | null) {
  return CAT_CFG[typeLabel ?? ''] ?? CAT_CFG['기타'];
}

/**
 * 모임 방식 — 웹 MEET_TYPE_CFG 미러.
 *
 * 서버 데이터에 대소문자가 섞여 있다(id 16 = "hybrid", id 23/24/26 = "OFFLINE"). 예전엔 상세가
 * 원값을 그대로 찍어 "OFFLINE"이 노출됐고, 위저드는 소문자 id로만 비교해 수정 화면이 미선택으로
 * 열렸다. 읽는 쪽에서 전부 소문자로 정규화한 뒤 한국어 라벨로 바꾼다.
 */
export const MEET_TYPE_CFG: Record<string, { icon: string; label: string; longLabel: string }> = {
  online: { icon: '🌐', label: '온라인', longLabel: '온라인 전용' },
  offline: { icon: '📍', label: '오프라인', longLabel: '오프라인 전용' },
  hybrid: { icon: '⚡', label: '온/오프', longLabel: '온/오프 혼합' },
};

/** meetType 원값 → 소문자 id. 모르는 값/빈 값은 'online'(서버 기본값과 동일). */
/**
 * 서버 어휘 → 앱 키. 서버는 저장 시점에 online/offline/**mixed** 로 맞추는데(백엔드
 * Recruitment.normalizeMeetType), 앱·웹은 같은 뜻을 'hybrid' 라는 키로 부른다. 이 대응을
 * 빼두면 혼합 모임이 MEET_TYPE_CFG 미스로 'online' 으로 떨어져 **"온라인"으로 잘못 표시**된다.
 */
const MEET_TYPE_ALIAS: Record<string, string> = { mixed: 'hybrid' };

export function normalizeMeetType(meetType?: string | null): string {
  const raw = (meetType ?? '').trim().toLowerCase();
  const k = MEET_TYPE_ALIAS[raw] ?? raw;
  return MEET_TYPE_CFG[k] ? k : 'online';
}

/** meetType 원값 → 한국어 라벨 (없으면 null — 호출부에서 행 자체를 숨긴다) */
export function meetTypeLabel(meetType?: string | null): string | null {
  if (!meetType) return null;
  return MEET_TYPE_CFG[normalizeMeetType(meetType)].label;
}

/** 목록 탭 — 웹 RECRUITMENT_TABS mobileLabel/순서 동일 */
export const RECRUITMENT_TABS = [
  { id: 'browse', label: '둘러보기' },
  { id: 'applied', label: '내 신청' },
  { id: 'mine', label: '내가 만든' },
  { id: 'bookmarked', label: '북마크' },
] as const;

/** 위치 필터 (browse/bookmarked, 클라이언트 필터) */
export const RECRUITMENT_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'online', label: '온라인' },
  { id: 'offline', label: '오프라인' },
  { id: 'nearby', label: '내 근처' },
] as const;
export type LocFilter = (typeof RECRUITMENT_FILTERS)[number]['id'];

export const NEARBY_KM_OPTIONS = [3, 5, 7] as const;

/** 내 신청 탭 상태 필터 */
export const APPLICATION_STATUS_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'accepted', label: '수락됨' },
  { id: 'pending', label: '대기 중' },
  { id: 'rejected', label: '거절' },
] as const;
export type AppStatusFilter = (typeof APPLICATION_STATUS_FILTERS)[number]['id'];

export const RECRUITMENT_LIMITS = { APPLY_MESSAGE: 300, QUESTION: 500, ANSWER: 1000 } as const;
