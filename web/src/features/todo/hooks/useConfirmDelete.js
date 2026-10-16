import { useCallback, useRef, useState } from "react";
import { deleteTodo } from "../api/todoApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";

export function useConfirmDelete({ onAfterDelete }) {
    const onAfterDeleteRef = useRef(onAfterDelete);
    onAfterDeleteRef.current = onAfterDelete;

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const requestDelete = useCallback((e, item) => {
        e?.stopPropagation?.();
        setDeleteTarget({ id: item.id, title: item.title });
        setDeleteOpen(true);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!deleteTarget?.id) return;
        try {
            await deleteTodo(deleteTarget.id);
            setDeleteOpen(false);
            setDeleteTarget(null);
            toast.success("삭제됐어요.");
            await onAfterDeleteRef.current?.();
        } catch (e) {
            setDeleteOpen(false);
            /* 403을 "작성자만…"으로 뭉뚱그리지 않는다 — 실제 서버 규칙은 "작성자 또는 관리자"이고,
               샘플 할 일은 역할과 무관하게 거부된다("샘플 할 일은 삭제할 수 없습니다.").
               사유가 여러 가지라 클라이언트가 지어내면 반드시 어긋난다 → 서버의 한국어 메시지를 그대로 쓴다.
               (워크스페이스 불일치처럼 본문이 { message } 가 아니라 문자열로 오는 응답도 있어 함께 처리) */
            const raw = e?.response?.data;
            const serverText = typeof raw === "string" && raw.trim() ? raw : null;
            const msg = getApiError(e, serverText || "삭제 중 오류가 발생했습니다.");
            // 게스트 차단처럼 이미 전용 UI로 처리된 에러는 빈 문자열 — 내용 없는 창을 띄우지 않는다
            if (!msg) return;
            setErrorMessage(msg);
            setErrorOpen(true);
        }
    }, [deleteTarget]);

    return {
        deleteOpen,
        setDeleteOpen,
        deleteTarget,
        setDeleteTarget,
        errorOpen,
        setErrorOpen,
        errorMessage,
        requestDelete,
        confirmDelete,
    };
}
