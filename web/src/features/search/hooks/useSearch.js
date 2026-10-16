import { useState, useEffect, useRef, useCallback } from "react";
import { searchAll } from "../api/searchApi.js";

const EMPTY_RESULTS = { tasks: [], messages: [], members: [], projects: [], tags: [] };
const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2; // 1글자는 노이즈가 많아 호출 안 함 (서버 검색 표준)

/** 페이지를 이어 붙일 때 id 중복 제거 — 페이지 경계에서 같은 항목이 겹칠 여지를 막는다 */
function appendTasks(prev, next) {
    const seen = new Set(prev.map((t) => t.id));
    return [...prev, ...(next ?? []).filter((t) => !seen.has(t.id))];
}

/**
 * 전체 검색 훅
 * @param {boolean} open - 검색 팔레트 열림 여부 (닫힐 때 상태 초기화)
 */
export default function useSearch(open) {
    const [q, setQ]           = useState("");
    const [results, setResults] = useState(EMPTY_RESULTS);
    const [loading, setLoading] = useState(false);
    const [error, setError]   = useState(null);
    // 할 일만 페이징된다 — 다음 페이지 유무는 서버가 hasMoreTasks로 알려주므로 개수로 추정하지 않는다
    const [hasMoreTasks, setHasMoreTasks] = useState(false);
    const [loadingMore, setLoadingMore]   = useState(false);
    // 재시도 트리거 — 실패하면 results가 비어 있어 검색어를 다시 치지 않는 한 재요청 기회가 없었다
    const [retryTick, setRetryTick] = useState(0);
    const timerRef            = useRef(null);
    const abortRef            = useRef(null);
    const pageRef             = useRef(0);
    // '더 보기' 응답이 늦게 도착했을 때 그 사이 검색어가 바뀌었는지 판별하기 위한 최신 검색어
    const qRef                = useRef("");

    qRef.current = q;

    const retry = useCallback(() => setRetryTick((n) => n + 1), []);

    // 팔레트 닫히면 전체 초기화
    useEffect(() => {
        if (!open) {
            clearTimeout(timerRef.current);
            abortRef.current?.abort();
            setQ("");
            setResults(EMPTY_RESULTS);
            setLoading(false);
            setError(null);
            setHasMoreTasks(false);
            setLoadingMore(false);
            pageRef.current = 0;
        }
    }, [open]);


    // 쿼리 변경 시 디바운스 검색 — 2글자 미만은 호출하지 않음
    useEffect(() => {
        if (q.trim().length < MIN_QUERY_LEN) {
            setResults(EMPTY_RESULTS);
            setLoading(false);
            setError(null);
            setHasMoreTasks(false);
            pageRef.current = 0;
            return;
        }

        setLoading(true);
        setError(null);
        clearTimeout(timerRef.current);
        abortRef.current?.abort();

        timerRef.current = setTimeout(async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                // 검색어가 바뀌면 항상 0페이지부터 — 이전 검색어의 페이지 위치를 물려받으면 안 된다
                const res = await searchAll(q.trim(), 0);
                if (!controller.signal.aborted) {
                    const data = res.data ?? EMPTY_RESULTS;
                    setResults({
                        tasks:    data.tasks    ?? [],
                        messages: data.messages ?? [],
                        members:  data.members  ?? [],
                        projects: data.projects ?? [],
                        tags:     data.tags     ?? [],
                    });
                    setHasMoreTasks(!!data.hasMoreTasks);
                    pageRef.current = 0;
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(err);
                    setResults(EMPTY_RESULTS);
                    setHasMoreTasks(false);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }, DEBOUNCE_MS);

        return () => {
            clearTimeout(timerRef.current);
        };
    }, [q, retryTick]);

    /**
     * 할 일 다음 페이지를 이어 붙인다.
     * loading(=0페이지 재검색 플래그)은 건드리지 않으므로 이미 그려진 결과가 비지 않는다.
     */
    const loadMore = useCallback(async () => {
        if (!hasMoreTasks || loadingMore) return;
        const query = qRef.current.trim();
        const next  = pageRef.current + 1;
        setLoadingMore(true);
        try {
            const res  = await searchAll(query, next);
            // 응답이 늦게 온 사이 검색어가 바뀌었다면 버린다 — 다른 검색어 결과가 섞이지 않게
            if (qRef.current.trim() !== query) return;
            const data = res.data ?? {};
            pageRef.current = next;
            setResults((prev) => ({ ...prev, tasks: appendTasks(prev.tasks, data.tasks) }));
            setHasMoreTasks(!!data.hasMoreTasks);
        } catch {
            // 더 보기 실패는 기존 결과를 지우지 않는다 — 버튼이 남아 있어 다시 누르면 재시도된다
        } finally {
            if (qRef.current.trim() === query) setLoadingMore(false);
        }
    }, [hasMoreTasks, loadingMore]);

    const totalCount = results.tasks.length + results.messages.length + results.members.length + results.projects.length + results.tags.length;
    const tooShort = q.trim().length > 0 && q.trim().length < MIN_QUERY_LEN;

    return { q, setQ, results, loading, error, retry, totalCount, tooShort, hasMoreTasks, loadMore, loadingMore };
}
