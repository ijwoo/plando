import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { updateTodoField, propagateRecurrenceChange } from "../api/todoApi.js";
import { fetchAllUsers } from "../../../shared/api/userApi.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";

export default function useTodoDetailPanel({ todo, onPatchLocal, recurrenceScope = "SINGLE" }) {
    // ==============================
    // 탭 / 편집 상태
    // ==============================
    const [tab, setTab] = useState(0);
    const [editable, setEditable] = useState(null);

    // ==============================
    // 참여자 관련 상태
    // ==============================
    const [userList, setUserList] = useState([]);
    const [selectedAssignees, setSelectedAssignees] = useState([]);

    // ==============================
    // 저장 상태
    // - idle | saving | saved | error
    // ==============================
    const [saveState, setSaveState] = useState("idle");
    const lastFailedSave = useRef(null);
    // 마지막으로 서버 저장에 성공한 값 스냅샷 — 저장 실패 시 롤백 기준
    const lastSavedRef = useRef(null);
    /* "저장됨" 표시를 1초 뒤 지우는 타이머.
       예전엔 취소하지 않고 setTimeout만 걸어서, 저장 성공 직후 1초 안에 다른 저장이 실패하면
       (또는 403으로 읽기 전용이 되면) 앞선 타이머가 뒤늦게 깨어나 "저장 실패"/"읽기 전용"
       표시를 idle로 지워 버렸다 — 사용자는 저장이 안 된 걸 모른 채 화면을 떠났다. */
    const savedTimerRef = useRef(null);
    const clearSavedTimer = useCallback(() => {
        if (savedTimerRef.current) {
            clearTimeout(savedTimerRef.current);
            savedTimerRef.current = null;
        }
    }, []);
    // 언마운트 후 setState 호출 방지 겸, 남은 타이머 정리
    useEffect(() => clearSavedTimer, [clearSavedTimer]);

    // ==============================
    // 삭제 / 에러 다이얼로그 상태
    // ==============================
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // ==============================
    // todo 변경 시 편집 상태 초기화
    // ==============================
    useEffect(() => {
        // 다른 할 일로 넘어가면 이전 항목의 "저장됨→idle" 타이머는 의미가 없다
        clearSavedTimer();
        if (!todo) {
            setEditable(null);
            setSelectedAssignees([]);
            setSaveState("idle");
            lastSavedRef.current = null;
            return;
        }

        setEditable({ ...todo });
        lastSavedRef.current = { ...todo };

        const assignees = todo.assignees ?? [];
        setSelectedAssignees(
            Array.isArray(assignees)
                ? assignees.map((a) => (typeof a === "string" ? a : a.email)).filter(Boolean)
                : String(assignees).split(",").filter(Boolean)
        );

        setSaveState("idle");
    }, [todo, clearSavedTimer]);

    // ==============================
    // 참여자 목록 조회
    // ==============================
    useEffect(() => {
        if (!todo) return;

        fetchAllUsers()
            .then((res) => setUserList(res.data ?? []))
            .catch((err) => console.error("유저 목록 실패", err));
    }, [todo]);

    const assigneeOptions = useMemo(() => userList ?? [], [userList]);

    // 한 필드가 화면 state에 남길 patch 모양.
    // 주의: assignees는 API에 comma-string으로 보내지만 로컬 state/dispatch는
    // enriched 객체 배열로 변환. 그래야 resolveAssigneeList가 string fallback으로
    // 떨어져 stale assigneeNames를 보여주는 버그를 막을 수 있음.
    const toLocalPatch = useCallback(
        (field, value) => {
            if (field !== "assignees") return { [field]: value };
            const emails = typeof value === "string"
                ? value.split(",").map((s) => s.trim()).filter(Boolean)
                : (Array.isArray(value) ? value.filter(Boolean) : []);
            const enriched = emails.map((email) => {
                const u = userList.find((x) => x.email === email);
                return u
                    ? { email, name: u.name, profileImageUrl: u.profileImageUrl }
                    : { email, name: email.split("@")[0] };
            });
            // assigneeNames도 함께 갱신해서 stale fallback 방지
            return {
                assignees: enriched,
                assigneeNames: enriched.map((e) => e.name || e.email),
            };
        },
        [userList]
    );

    // ==============================
    // 필드 저장 (1개 이상)
    // - 로컬 상태 / 상위 로컬 상태 먼저 반영 → 이후 서버 저장
    //
    // 여러 필드를 **한 번에** 저장할 수 있어야 한다. commit()을 연달아 두 번 부르면
    // 두 호출이 같은 tick에 같은 base 스냅샷(lastSavedRef)을 캡처하고, 나중에 끝난 쪽이
    // `{...base, ...자기 patch}`로 lastSavedRef를 덮어써서 먼저 끝난 쪽의 저장 결과가
    // 롤백 기준값에서 사라졌다. ("하루종일" 토글이 startTime/endTime을 연속 커밋했다 →
    // 이후 저장이 실패하면 이미 지운 시간이 되살아나며 롤백)
    // ==============================
    const commitEntries = useCallback(
        async (entries) => {
            if (!todo || !entries.length) return;

            const localPatch = Object.assign({}, ...entries.map(([f, v]) => toLocalPatch(f, v)));

            /* 시작일이 마감일보다 뒤면 저장하지 않는다.
               생성 모달에는 검증이 있었지만 상세에는 없었다 — input[type=date] 의 min/max 는
               달력 UI 만 제한할 뿐, 값이 들어오면 onChange 가 그대로 돌아 저장된다.
               그렇게 저장된 할 일은 캘린더에서 통째로 사라져서(끝이 시작보다 앞) 목록에만
               남고, 사용자는 왜 안 보이는지 알 수 없다. */
            // 실패 시 롤백용 — 낙관 반영 전에 마지막 저장 성공값을 한 번만 캡처
            const base = lastSavedRef.current ?? todo;

            /* 비교 기준은 화면 상태(editable)가 아니라 **마지막 저장값**이다.
               editable 을 보면 의존성에서 빠져 낡은 값으로 판단할 수 있고, 애초에 우리가
               막으려는 건 "서버에 뒤집힌 채로 저장되는 것" 이다. */
            const nextStart = "startAt" in localPatch ? localPatch.startAt : base?.startAt;
            const nextDue = "dueDate" in localPatch ? localPatch.dueDate : base?.dueDate;
            if (nextStart && nextDue && nextStart > nextDue) {
                setErrorMessage("시작일이 마감일보다 늦을 수 없어요.");
                setSaveState("error");
                return;
            }
            const prevPatch = {};
            for (const key of Object.keys(localPatch)) prevPatch[key] = base?.[key];

            setEditable((prev) => ({ ...prev, ...localPatch }));
            onPatchLocal?.(localPatch);

            try {
                // 앞선 저장의 "저장됨→idle" 타이머가 살아 있으면 여기서 끊는다 —
                // 그대로 두면 이번 저장이 실패해도 1초 뒤 표시가 idle로 지워진다.
                clearSavedTimer();
                setSaveState("saving");
                lastFailedSave.current = null;

                for (const [field, value] of entries) {
                    await updateTodoField(todo.id, field, value);
                    if (recurrenceScope !== "SINGLE" && (todo.hasRecurrence || todo.recurrenceSourceId)) {
                        await propagateRecurrenceChange(todo.id, recurrenceScope, field, value);
                    }
                }

                lastSavedRef.current = { ...base, ...localPatch };
                setSaveState("saved");
                savedTimerRef.current = setTimeout(() => {
                    savedTimerRef.current = null;
                    setSaveState("idle");
                }, 1000);
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: todo.id, patch: localPatch } }));
            } catch (e) {
                // 롤백 — 로컬 편집 상태 + 상위 목록 + 다른 surface(보드/캘린더/홈)에 퍼진 낙관 반영을 원래 값으로 되돌림
                setEditable((prev) => (prev ? { ...prev, ...prevPatch } : prev));
                onPatchLocal?.(prevPatch);
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: todo.id, patch: prevPatch } }));
                toast.error(getApiError(e, "저장 중 오류가 발생했어요."));
                if (e?.response?.status === 403) {
                    setSaveState("readonly");
                } else {
                    lastFailedSave.current = entries;
                    setSaveState("error");
                }
            }
        },
        [todo, onPatchLocal, recurrenceScope, toLocalPatch, clearSavedTimer]
    );

    /** 단일 필드 저장. */
    const commit = useCallback(
        (field, value) => commitEntries([[field, value]]),
        [commitEntries]
    );

    /** 여러 필드를 한 묶음으로 저장 — 롤백 기준값(base)을 한 번만 캡처한다. */
    const commitMany = useCallback(
        (fields) => commitEntries(Object.entries(fields ?? {})),
        [commitEntries]
    );

    const retryCommit = useCallback(async () => {
        if (!lastFailedSave.current) return;
        await commitEntries(lastFailedSave.current);
    }, [commitEntries]);

    // 필드의 마지막 저장 성공값 — 반복 범위 모달 취소 시 되돌리기 기준으로 사용
    const getLastSaved = useCallback(
        (field) => (lastSavedRef.current ?? todo ?? {})[field],
        [todo]
    );

    return {
        tab,
        setTab,

        editable,
        setEditable,

        userList,
        assigneeOptions,

        selectedAssignees,
        setSelectedAssignees,

        saveState,

        deleteOpen,
        setDeleteOpen,
        errorOpen,
        setErrorOpen,
        errorMessage,
        setErrorMessage,

        commit,
        commitMany,
        retryCommit,
        getLastSaved,
    };
}