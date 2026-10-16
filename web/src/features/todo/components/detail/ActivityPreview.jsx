import React, { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { fetchTodoLogs } from "../../api/todoApi.js";
import { formatTimeAgo } from "../../../../shared/utils/formatters.js";
import { getLogActor, getLogActivityText, collapseLogs } from "../../utils/todoLogFormatters.js";
import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import UserAvatar from "../../../../shared/ui/common/UserAvatar.jsx";

/**
 * 디테일 패널 개요 탭 최하단의 "최근 활동" 미리보기 카드.
 * fetchTodoLogs 호출 → 최신 2건만 표시.
 * "모두 보기" 버튼은 외곽 카드 헤더(`pdp-card-head`)에 있으므로 본 컴포넌트에선 렌더하지 않음.
 *
 * @param {{
 *   todoId: string|number,
 *   users?: Array  // actor lookup용 워크스페이스 사용자 목록 (백엔드 응답에 이름/이미지가 누락된 경우 fallback)
 * }} props
 */
export default function ActivityPreview({ todoId, users = [] }) {
    const { label: statusLabel } = useStatuses();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let alive = true;
        if (!todoId) return;
        setLoading(true);
        fetchTodoLogs(todoId)
            .then((res) => { if (alive) setLogs(res.data ?? []); })
            .catch(() => { if (alive) setLogs([]); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [todoId]);

    const recent = useMemo(() => {
        const sorted = [...logs].sort((a, b) => {
            const at = new Date(a.modifiedAt || a.createdAt).getTime() || 0;
            const bt = new Date(b.modifiedAt || b.createdAt).getTime() || 0;
            return bt - at;
        });
        return collapseLogs(sorted).slice(0, 2);
    }, [logs]);

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={18} />
            </Box>
        );
    }
    if (recent.length === 0) {
        return (
            <Typography sx={{ px: 0.5, py: 1.25, fontSize: 12.5, color: "var(--plando-text-tertiary)" }}>
                최근 활동이 없어요.
            </Typography>
        );
    }
    return (
        <Box sx={{ pt: 0.5, pb: 1.25 }}>
            {recent.map((item, idx) => {
                const actor = getLogActor(item, users);
                const message = getLogActivityText(item, statusLabel);
                const when = item.modifiedAt || item.createdAt;
                return (
                    <div className="pdp-activity" key={item.id ?? idx}>
                        <UserAvatar name={actor.name} src={actor.profileImageUrl} size={24} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ color: "var(--plando-text-primary)", fontWeight: 700 }}>{actor.name}</span>
                            {" "}
                            {message}
                            <div className="pdp-activity-time">{when ? formatTimeAgo(when) : ""}</div>
                        </div>
                    </div>
                );
            })}
        </Box>
    );
}
