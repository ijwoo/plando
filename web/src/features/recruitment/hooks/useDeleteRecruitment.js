import { useState } from "react";
import { deleteRecruitment } from "../api/recruitmentApi";

export default function useDeleteRecruitment({ onDelete, onBack, onError } = {}) {
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const handleConfirmDelete = async (itemId) => {
        if (!onDelete) return;
        setDeleteLoading(true);
        try {
            await deleteRecruitment(itemId);
            onDelete(itemId);
            onBack();
        } catch {
            if (onError) {
                onError("삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
            }
        } finally {
            setDeleteLoading(false);
            setDeleteConfirmOpen(false);
        }
    };

    return {
        deleteLoading,
        deleteConfirmOpen,
        openDeleteConfirm:  () => setDeleteConfirmOpen(true),
        closeDeleteConfirm: () => setDeleteConfirmOpen(false),
        handleConfirmDelete,
    };
}
