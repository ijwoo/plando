import { useEffect, useState } from "react";
import { fetchUserQaStats } from "../api/recruitmentQaApi";

/** 분 단위 답변 지연 → 사람이 읽기 좋은 단위. null이면 null 반환 */
export function formatLatencyKor(minutes) {
    if (minutes == null) return null;
    const m = Math.max(0, Math.round(Number(minutes)));
    if (m < 60) return `${m}분`;
    if (m < 24 * 60) return `${Math.round(m / 60)}시간`;
    return `${Math.round(m / (24 * 60))}일`;
}

/**
 * 작성자 Q&A 응답 통계 fetch hook.
 * 백엔드 미구현(404/500) 또는 totalQuestionCount=0이면 stats=null → 컴포넌트가 라인 미렌더.
 *
 * @param userId            작성자 user id
 * @param options.enabled   userId가 있어도 호출 막고 싶을 때 false (default true)
 */
export default function useUserQaStats(userId, { enabled = true } = {}) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled || !userId) {
            setStats(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetchUserQaStats(userId)
            .then((res) => {
                if (cancelled) return;
                const data = res?.data;
                // totalQuestionCount > 0일 때만 의미 있는 라인 노출
                if (data && Number(data.totalQuestionCount) > 0) {
                    setStats(data);
                } else {
                    setStats(null);
                }
            })
            .catch(() => {
                if (!cancelled) setStats(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [userId, enabled]);

    return { stats, loading };
}
