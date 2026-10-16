import { useCallback, useEffect, useMemo, useState } from "react";
import {
    fetchQuestions,
    postQuestion,
    deleteQuestion,
    upsertAnswer,
    deleteAnswer,
    pinQuestion,
} from "../api/recruitmentQaApi";
import { APP_EVENTS } from "../../../shared/constants/events.js";

/** 토스트 헬퍼 — 공용 이벤트 dispatch */
function toast(message, severity = "success") {
    window.dispatchEvent(
        new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message, severity } })
    );
}

/** 서버 에러 메시지를 우선 추출 */
function errMessage(err, fallback) {
    return err?.response?.data?.message || fallback;
}

/** 정렬: 핀 우선 → 최신 createdAt 우선 */
function sortQuestions(items) {
    return [...items].sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
}

/**
 * Recruitment Q&A hook.
 * @param recruitmentId
 * @param options.open  탭/모달이 열려있을 때만 fetch — 닫힌 상태에서 불필요한 호출 방지
 */
export default function useRecruitmentQuestions(recruitmentId, { open = true } = {}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [loadError, setLoadError] = useState(false);

    const load = useCallback(() => {
        if (!recruitmentId) return;
        setLoading(true);
        setLoadError(false);
        fetchQuestions(recruitmentId)
            .then((res) => {
                // 서버가 빈 응답/HTML/객체를 반환하는 엣지케이스 방어 (items.map 에러 예방)
                const data = res?.data;
                setItems(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                setItems([]);
                setLoadError(true);
            })
            .finally(() => setLoading(false));
    }, [recruitmentId]);

    useEffect(() => {
        if (open && recruitmentId) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, recruitmentId]);

    const post = useCallback(async (body, { isPrivate = false } = {}) => {
        setPosting(true);
        try {
            const res = await postQuestion(recruitmentId, body, isPrivate);
            setItems((prev) => sortQuestions([res.data, ...prev]));
            toast(isPrivate ? "비공개 질문이 등록되었어요." : "질문이 등록되었어요.");
            return res.data;
        } catch (err) {
            toast(errMessage(err, "질문 등록에 실패했어요."), "error");
            throw err;
        } finally {
            setPosting(false);
        }
    }, [recruitmentId]);

    const remove = useCallback(async (qId) => {
        setBusyId(qId);
        try {
            await deleteQuestion(recruitmentId, qId);
            setItems((prev) => prev.filter((q) => q.id !== qId));
            toast("질문이 삭제되었어요.");
        } catch (err) {
            toast(errMessage(err, "질문 삭제에 실패했어요."), "error");
        } finally {
            setBusyId(null);
        }
    }, [recruitmentId]);

    const answerUpsert = useCallback(async (qId, body) => {
        setBusyId(qId);
        try {
            const res = await upsertAnswer(recruitmentId, qId, body);
            setItems((prev) => prev.map((q) => (q.id === qId ? { ...q, answer: res.data } : q)));
            toast("답변이 등록되었어요.");
            return res.data;
        } catch (err) {
            toast(errMessage(err, "답변 등록에 실패했어요."), "error");
            throw err;
        } finally {
            setBusyId(null);
        }
    }, [recruitmentId]);

    const answerRemove = useCallback(async (qId) => {
        setBusyId(qId);
        try {
            await deleteAnswer(recruitmentId, qId);
            setItems((prev) => prev.map((q) => (q.id === qId ? { ...q, answer: null } : q)));
            toast("답변이 삭제되었어요.");
        } catch (err) {
            toast(errMessage(err, "답변 삭제에 실패했어요."), "error");
        } finally {
            setBusyId(null);
        }
    }, [recruitmentId]);

    const togglePin = useCallback(async (qId, pinned) => {
        setBusyId(qId);
        try {
            const res = await pinQuestion(recruitmentId, qId, pinned);
            setItems((prev) =>
                sortQuestions(prev.map((q) => (q.id === qId ? res.data : q)))
            );
            return res.data;
        } catch (err) {
            toast(errMessage(err, "핀 처리에 실패했어요."), "error");
        } finally {
            setBusyId(null);
        }
    }, [recruitmentId]);

    /**
     * 클라이언트에서 derived count.
     * 백엔드 응답이 한 박자 늦으니, items 기준 즉시 계산값으로 헤더/배지를 갱신할 수 있게 노출.
     */
    const counts = useMemo(() => ({
        total: items.length,
        unanswered: items.filter((q) => !q.answer).length,
    }), [items]);

    return {
        items,
        loading,
        loadError,
        posting,
        busyId,
        counts,
        load,
        post,
        remove,
        answerUpsert,
        answerRemove,
        togglePin,
    };
}
