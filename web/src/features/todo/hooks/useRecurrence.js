import { useCallback, useEffect, useState } from "react";
import { fetchRecurrence, upsertRecurrence } from "../api/todoRecurrenceApi.js";
import { toast } from "../../../shared/utils/toast.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";

/**
 * 단일 todo의 반복 설정 fetch + persist 로직.
 *
 * 기존에 TodoRecurrenceSection(모바일)과 TodoDetailDesktop의 RecurrenceInlinePopover에
 * 같은 fetch/upsert/에러 처리 코드가 각각 있던 걸 통합.
 *
 * @param {string|number} todoId
 * @param {{ enabled?: boolean }} options — enabled=false면 fetch를 보류 (팝오버처럼 lazy load 시).
 *   기본 true.
 *
 * @returns {{
 *   type: string,                    // NONE/DAILY/WEEKLY/MONTHLY
 *   endDate: string,                 // yyyy-MM-dd 또는 ""
 *   loading: boolean,
 *   saving: boolean,
 *   feedback: "saved"|"error"|null,
 *   setType: (t: string) => void,    // 로컬만 변경 (저장 X)
 *   setEndDate: (d: string) => void, // 로컬만 변경 (저장 X)
 *   save: (nextType, nextEndDate) => Promise<boolean>, // 저장 + 상태 갱신 + 토스트
 *   reload: () => void,
 * }}
 */
export default function useRecurrence(todoId, { enabled = true } = {}) {
    const [type, setType] = useState("NONE");
    const [endDate, setEndDate] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const load = useCallback(async () => {
        if (!todoId) {
            setType("NONE"); setEndDate("");
            return;
        }
        setLoading(true);
        try {
            const res = await fetchRecurrence(todoId);
            if (res.status === 204 || !res.data) {
                setType("NONE"); setEndDate("");
            } else {
                setType(res.data.recurrenceType ?? "NONE");
                setEndDate(res.data.endDate ?? "");
            }
        } catch {
            setType("NONE"); setEndDate("");
        } finally {
            setLoading(false);
        }
    }, [todoId]);

    useEffect(() => {
        if (!enabled) return;
        load();
    }, [enabled, load]);

    const save = useCallback(async (nextType, nextEndDate) => {
        if (!todoId) return false;
        setSaving(true);
        try {
            await upsertRecurrence(todoId, {
                recurrenceType: nextType,
                endDate: nextType === "NONE" ? null : (nextEndDate || null),
            });
            setType(nextType);
            setEndDate(nextType === "NONE" ? "" : (nextEndDate || ""));
            setFeedback("saved");
            setTimeout(() => setFeedback(null), 2000);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, {
                detail: { id: todoId, patch: { hasRecurrence: nextType !== "NONE" } },
            }));
            return true;
        } catch (e) {
            setFeedback("error");
            setTimeout(() => setFeedback(null), 2000);
            toast.error(e?.response?.data?.message || "반복 설정 저장 중 오류가 발생했어요.");
            return false;
        } finally {
            setSaving(false);
        }
    }, [todoId]);

    return {
        type, endDate,
        loading, saving, feedback,
        setType, setEndDate,
        save,
        reload: load,
    };
}
