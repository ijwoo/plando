import { useState, useCallback } from "react";

/**
 * 파일 미리보기 모달 상태를 관리하는 공통 훅.
 * DmChatRoom, TodoAttachmentSection 등에서 공유.
 */
export function useFilePreview() {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewFiles, setPreviewFiles] = useState([]);
    const [previewIndex, setPreviewIndex] = useState(-1);

    const openPreview = useCallback((file, files = []) => {
        if (!file?.fileUrl) return;
        let safeFiles = files?.length ? files.filter((f) => f?.fileUrl) : [file];
        let index = safeFiles.findIndex(
            (f) => f.fileUrl === file.fileUrl && f.fileName === file.fileName
        );
        // 클릭한 파일이 목록(예: DM의 그룹화된 previewFiles)에 없으면 직접 포함해 빈 화면 방지
        if (index < 0) {
            safeFiles = [file, ...safeFiles];
            index = 0;
        }
        setPreviewFiles(safeFiles);
        setPreviewIndex(index);
        setPreviewOpen(true);
    }, []);

    const closePreview = useCallback(() => {
        setPreviewOpen(false);
        setPreviewFiles([]);
        setPreviewIndex(-1);
    }, []);

    const handlePrevPreview = useCallback(() => {
        setPreviewIndex((prev) => Math.max(prev - 1, 0));
    }, []);

    const handleNextPreview = useCallback((length) => {
        // onClick={onNext} 로 직접 연결되면 클릭 이벤트가 length 자리에 들어오므로
        // 숫자일 때만 사용하고, 아니면 현재 previewFiles 길이를 쓴다.
        const max = (typeof length === "number" ? length : previewFiles.length) - 1;
        setPreviewIndex((prev) => Math.min(prev + 1, max));
    }, [previewFiles.length]);

    const previewFile = previewIndex > -1 ? previewFiles[previewIndex] : null;

    return {
        previewOpen,
        previewFile,
        previewFiles,
        previewIndex,
        openPreview,
        closePreview,
        handlePrevPreview,
        handleNextPreview,
    };
}
