import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    CircularProgress,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { fetchAttachments, uploadAttachment, deleteAttachment } from "../../api/todoAttachmentApi.js";
import { getApiError } from "../../../../shared/api/axiosInstance.js";
import { getUser } from "../../../../shared/utils/tokenUtils.js";
import { resolveImageUrl } from "../../../../shared/utils/urlUtils.js";
import FilePreviewModal from "../../../../shared/ui/common/FilePreviewModal.jsx";
import { useFilePreview } from "../../../../shared/hooks/useFilePreview.js";
import ConfirmDialog from "../../../../shared/ui/common/ConfirmDialog.jsx";

function formatBytes(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function FileIcon({ fileType }) {
    const isImage = fileType?.startsWith("image/");
    return isImage
        ? <ImageOutlinedIcon sx={{ fontSize: 20 }} />
        : <InsertDriveFileOutlinedIcon sx={{ fontSize: 20 }} />;
}

export default function TodoAttachmentSection({ todoId }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const fileInputRef = useRef(null);
    const currentUser = getUser();

    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [dragOver, setDragOver] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const {
        previewOpen, previewFile, previewFiles, previewIndex,
        openPreview, closePreview, handlePrevPreview, handleNextPreview,
    } = useFilePreview();

    const load = useCallback(async () => {
        if (!todoId) return;
        try {
            setLoading(true);
            const res = await fetchAttachments(todoId);
            setAttachments(res.data ?? []);
        } catch {
            setError("첨부파일을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [todoId]);

    useEffect(() => { load(); }, [load]);

    const handleUpload = async (file) => {
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
            setError("20MB 이하 파일만 첨부할 수 있습니다.");
            return;
        }
        try {
            setUploading(true);
            setError("");
            await uploadAttachment(todoId, file);
            await load();
        } catch (e) {
            setError(getApiError(e, "파일 업로드에 실패했습니다."));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (attachId) => {
        try {
            setError("");
            await deleteAttachment(todoId, attachId);
            await load();
        } catch (e) {
            setError(getApiError(e, "파일 삭제에 실패했습니다."));
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    };

    // 미리보기 가능 파일 목록 (이미지 + pdf)
    const previewableFiles = useMemo(() =>
        attachments
            .filter((a) => a.fileUrl)
            .map((a) => ({
                fileUrl: a.fileUrl,
                fileName: a.fileName,
                fileType: a.fileType,
                fileSize: a.fileSize,
            })),
        [attachments]
    );

    const handleFileClick = (att) => {
        const isPreviewable = att.fileType?.startsWith("image/") || att.fileType === "application/pdf";
        if (isPreviewable) {
            openPreview(
                { fileUrl: att.fileUrl, fileName: att.fileName, fileType: att.fileType, fileSize: att.fileSize },
                previewableFiles
            );
        } else {
            window.open(resolveImageUrl(att.fileUrl), "_blank", "noopener,noreferrer");
        }
    };

    return (
        <Box>
            {/* 드래그&드롭 업로드 영역 */}
            <Box
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                sx={{
                    border: "1.5px dashed",
                    borderColor: dragOver ? "primary.main" : alpha(theme.palette.text.primary, 0.15),
                    borderRadius: 2.5,
                    p: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    cursor: "pointer",
                    bgcolor: dragOver
                        ? alpha(theme.palette.primary.main, 0.06)
                        : "transparent",
                    transition: "all 0.15s",
                    "&:hover": {
                        borderColor: "primary.main",
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                    },
                    mb: 1.5,
                }}
            >
                {uploading ? (
                    <CircularProgress size={18} />
                ) : (
                    <>
                        <AttachFileRoundedIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                            탭하여 첨부 <Typography component="span" sx={{ fontSize: 11, color: "text.disabled" }}>(최대 20MB)</Typography>
                        </Typography>
                    </>
                )}
            </Box>

            <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={(e) => handleUpload(e.target.files?.[0])}
            />

            {error && (
                <Alert severity="error" sx={{ fontSize: 12, mb: 1.5 }} onClose={() => setError("")}>
                    {error}
                </Alert>
            )}

            {/* 파일 목록 */}
            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={22} />
                </Box>
            ) : attachments.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: "text.disabled", textAlign: "center", py: 1 }}>
                    첨부된 파일이 없어요
                </Typography>
            ) : (
                <Stack spacing={0.75}>
                    {attachments.map((att) => {
                        const isImage = att.fileType?.startsWith("image/");
                        const isMine = currentUser?.email === att.uploaderEmail;
                        const isPreviewable = isImage || att.fileType === "application/pdf";
                        return (
                            <Box
                                key={att.id}
                                onClick={() => handleFileClick(att)}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.25,
                                    px: 1.5,
                                    py: 1,
                                    borderRadius: 2,
                                    boxShadow: "var(--plando-elev-1)",
                                    bgcolor: isDark ? alpha("#fff", 0.03) : alpha("#000", 0.02),
                                    cursor: "pointer",
                                    "&:hover": { bgcolor: isDark ? alpha("#fff", 0.05) : alpha("#000", 0.035) },
                                    "&:hover .att-actions": { opacity: 1 },
                                }}
                            >
                                {/* 아이콘 or 이미지 썸네일 */}
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 1.5,
                                        overflow: "hidden",
                                        flexShrink: 0,
                                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "primary.main",
                                    }}
                                >
                                    {isImage ? (
                                        <Box
                                            component="img"
                                            src={resolveImageUrl(att.fileUrl)}
                                            alt={att.fileName}
                                            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        />
                                    ) : (
                                        <FileIcon fileType={att.fileType} />
                                    )}
                                </Box>

                                {/* 파일명 + 업로더 */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        sx={{
                                            fontSize: 13,
                                            fontWeight: 600,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {att.fileName}
                                    </Typography>
                                    <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
                                        {att.uploaderName} · {formatBytes(att.fileSize)}
                                    </Typography>
                                </Box>

                                {/* 액션 버튼 */}
                                <Stack
                                    className="att-actions"
                                    direction="row"
                                    spacing={0.25}
                                    sx={{ opacity: 0, transition: "opacity 0.15s" }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <IconButton
                                        size="small"
                                        component="a"
                                        href={resolveImageUrl(att.fileUrl)}
                                        download={att.fileName}
                                        target="_blank"
                                        sx={{ width: 28, height: 28, color: "text.secondary", "&:hover": { color: "primary.main" } }}
                                    >
                                        <DownloadRoundedIcon sx={{ fontSize: 15 }} />
                                    </IconButton>
                                    {isMine && (
                                        <IconButton
                                            size="small"
                                            onClick={() => setDeleteConfirmId(att.id)}
                                            sx={{ width: 28, height: 28, color: "text.secondary", "&:hover": { color: "error.main" } }}
                                        >
                                            <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                    )}
                                </Stack>
                            </Box>
                        );
                    })}
                </Stack>
            )}

            <FilePreviewModal
                open={previewOpen}
                file={previewFile}
                files={previewFiles}
                currentIndex={previewIndex}
                onPrev={handlePrevPreview}
                onNext={() => handleNextPreview(previewFiles.length)}
                onClose={closePreview}
            />

            <ConfirmDialog
                open={deleteConfirmId !== null}
                title="첨부파일 삭제"
                message="첨부파일을 삭제하시겠습니까?"
                confirmText="삭제"
                confirmColor="error"
                onClose={() => setDeleteConfirmId(null)}
                onConfirm={() => { handleDelete(deleteConfirmId); setDeleteConfirmId(null); }}
            />
        </Box>
    );
}
