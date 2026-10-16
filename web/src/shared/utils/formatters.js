/**
 * 두 날짜가 같은 날인지 비교. Date·ISO 문자열·타임스탬프 모두 허용.
 */
export function isSameDay(a, b) {
    if (!a || !b) return false;
    const da = a instanceof Date ? a : new Date(a);
    const db = b instanceof Date ? b : new Date(b);
    if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
    return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth()    === db.getMonth()    &&
        da.getDate()     === db.getDate()
    );
}

/**
 * 상대 시간 표시 (방금 전 / N분 전 / N시간 전 / N일 전 / N주 전 / N개월 전 / N년 전)
 */
export function formatTimeAgo(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.max(1, Math.floor(diffMs / 1000));
    if (diffSec < 60) return "방금 전";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}일 전`;
    const diffWeek = Math.floor(diffDay / 7);
    if (diffWeek < 5) return `${diffWeek}주 전`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 1) return `${diffWeek}주 전`;
    if (diffMonth < 12) return `${diffMonth}개월 전`;
    return `${Math.floor(diffDay / 365)}년 전`;
}

/**
 * 날짜 문자열을 "M월 D일" 형태로 변환.
 * 예: "2026-05-07" → "5월 7일"
 * 매칭 실패 시 입력값을 그대로 반환.
 */
export function formatMonthDay(dateStr) {
    if (!dateStr) return "";
    const m = String(dateStr).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return dateStr;
    return `${parseInt(m[2], 10)}월 ${parseInt(m[3], 10)}일`;
}

/**
 * "HH:mm" 또는 "HH:mm:ss" → "오전 3:30" / "오후 4:00"
 */
export function formatTimeAmPm(timeStr) {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h < 12 ? "오전" : "오후";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${ampm} ${h12}:${String(m).padStart(2, "0")}`;
}

export function formatDateLabel(value) {
    if (!value) return "-";
    try {
        const raw = String(value).slice(0, 10);
        const [y, m, d] = raw.split("-");
        if (!y || !m || !d) return value;
        return `${y}. ${Number(m)}. ${Number(d)}.`;
    } catch {
        return value;
    }
}

/**
 * dueDate(YYYY-MM-DD) → 절대 표시 ("오늘", "내일", "어제", "5월 13일").
 * 데스크탑 TaskList/Board 카드 등 "마감일" 라벨에 사용.
 */
export function formatAbsoluteDue(dateStr) {
    if (!dateStr) return "";
    const m = String(dateStr).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return dateStr;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(d.getTime())) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d - today) / 86400000);
    if (diffDays === 0) return "오늘";
    if (diffDays === 1) return "내일";
    if (diffDays === -1) return "어제";
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * dueDate → 상대 라벨 ("오늘", "+1일", "-1일", "지난 일정").
 * "+N일" / "지난 일정" 표시용. formatAbsoluteDue와 짝.
 */
export function formatRelativeDue(dateStr) {
    if (!dateStr) return "";
    const m = String(dateStr).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return "";
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(d.getTime())) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d - today) / 86400000);
    if (diffDays === 0) return "오늘";
    if (diffDays === 1) return "+1일";
    if (diffDays === -1) return "-1일";
    if (diffDays > 0) return `+${diffDays}일`;
    return "지난 일정";
}

/**
 * 알림/이벤트 시각을 "MM. DD. HH:MM" 형태로 표시
 * e.g. "04. 13. 오후 3:22"
 */
export function formatNotificationTime(value) {
    if (!value) return "";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
        return value;
    }
}

/**
 * 파일 크기를 사람이 읽기 쉬운 단위로 변환
 * @param {number} bytes
 * @returns {string}  예) "1.2 MB", "340.0 KB", "512 B"
 */
export function formatFileSize(bytes) {
    if (bytes == null || bytes === 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Date → "YYYY-MM-DD" 로컬 날짜 문자열.
 * 백엔드 LocalDate 비교용 / 쿼리스트링 from=&to= 등에서 사용.
 * toISOString()은 UTC 변환이라 timezone 오프 issue가 있어 로컬 기준 별도 포맷.
 */
export function toYmd(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * 최근 N분 이내 활동 여부. presence dot 표시용 (formatLastActive 의 2분 기준보다 관대).
 * @param {string|null} lastActiveAt ISO 8601
 * @param {number} withinMinutes 기본 5분
 */
export function isOnlineRecently(lastActiveAt, withinMinutes = 5) {
    if (!lastActiveAt) return false;
    const t = new Date(lastActiveAt).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t < withinMinutes * 60 * 1000;
}

/**
 * 마지막 활동 시각을 온라인 상태 레이블로 변환
 * @param {string|null} lastActiveAt  ISO 8601 문자열
 * @returns {{ online: boolean, label: string } | null}
 */
export function formatLastActive(lastActiveAt) {
    if (!lastActiveAt) return null;
    const diff = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000);
    // online(초록 점)은 '현재 활동 중'(2분 이내)일 때만 — "N분 전 활동"에 초록이 켜지던 모순 수정
    if (diff < 120)   return { online: true,  label: "현재 활동 중" };
    if (diff < 3600)  return { online: false, label: `${Math.floor(diff / 60)}분 전 활동` };
    if (diff < 86400) return { online: false, label: `${Math.floor(diff / 3600)}시간 전 활동` };
    return             { online: false, label: `${Math.floor(diff / 86400)}일 전 활동` };
}
