import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Snackbar } from "@mui/material";

import ConfirmDialog from "../../../../shared/ui/common/ConfirmDialog";
import {
    enrichForDetail,
    formatDueDateKorean,
    getCategory,
    getMemberText,
    getDueText,
    getLocationText,
} from "../../utils/recruitmentUtils";
import ApplyDialog from "./ApplyDialog";
import { getToken } from "../../../../shared/utils/tokenUtils.js";
import { APP_EVENTS } from "../../../../shared/constants/events.js";
import MapDetailDialog from "./MapDetailDialog";
import ApplicantsDialog from "./ApplicantsDialog";
import useApplicants from "../../hooks/useApplicants";
import useDeleteRecruitment from "../../hooks/useDeleteRecruitment";
import { updateRecruitmentStatus } from "../../api/recruitmentApi";
import { MEET_TYPE_CFG, inferMeetType } from "../../constants/recruitmentConfig";

import DetailHero from "./detail/DetailHero";
import DetailActionBar from "./detail/DetailActionBar";
import DetailOverview from "./detail/DetailOverview";
import DetailRoles from "./detail/DetailRoles";
import DetailLocation from "./detail/DetailLocation";
import DetailQa from "./detail/DetailQa";
import DetailSidebar from "./detail/DetailSidebar";

/**
 * RecruitmentDetailDesktop — 모집 상세 페이지 orchestrator
 *
 * 책임:
 *  - 상위(item / detailFull) 받아서 enrichForDetail로 정규화
 *  - derived values 계산 (인원/마감/위치 등)
 *  - dialog/toast/menu state 관리
 *  - 자식 컴포넌트(Hero/ActionBar/Overview/Roles/Location/Qa/Sidebar) 조립
 *
 * 자식 컴포넌트는 모두 desktop/detail/ 디렉토리.
 */
export default function RecruitmentDetailDesktop({
    item: rawItem,
    allItems,
    detailFull,
    detailLoading,
    onBack,
    onOpenProject,
    onBookmark,
    onApply,
    onDelete,
    onStatusChange,
    onReview,
    onEdit,
    onGuestBlock,
    onQuestionsCountsChange,
}) {
    const rootRef = useRef(null);
    const qaSectionRef = useRef(null);
    const [myLocation, setMyLocation] = useState(null);
    const [applyOpen, setApplyOpen] = useState(false);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
    const [statusLoading, setStatusLoading] = useState(false);
    const [mapDialogOpen, setMapDialogOpen] = useState(false);
    const [qaDefaultPrivate, setQaDefaultPrivate] = useState(false);

    const handleAskQuestion = () => {
        setQaDefaultPrivate(true);
        // 스크롤 — DetailQa 섹션이 보이게
        qaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        // 다음 진입을 위해 초기화 (한 번만 작동)
        setTimeout(() => setQaDefaultPrivate(false), 600);
    };

    const item = detailFull ? enrichForDetail(detailFull) : enrichForDetail(rawItem);

    // scroll to top when item changes
    useEffect(() => {
        let el = rootRef.current?.parentElement;
        while (el) {
            const { overflow, overflowY } = getComputedStyle(el);
            if (overflow === "auto" || overflow === "scroll" || overflowY === "auto" || overflowY === "scroll") {
                el.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }
            el = el.parentElement;
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [item.id]);

    const handleToggleStatus = async () => {
        const next = item.statusLabel === "모집중" ? "마감" : "모집중";
        setStatusLoading(true);
        try {
            await updateRecruitmentStatus(item.id, next);
            onStatusChange?.(item.id, next);
            setToast({ open: true, message: `상태를 '${next}'으로 변경했어요.`, severity: "success" });
        } catch {
            setToast({ open: true, message: "상태 변경에 실패했습니다.", severity: "error" });
        } finally {
            setStatusLoading(false);
        }
    };

    const {
        apps, appsLoading, reviewing,
        dialogOpen: applicantsOpen,
        openApplicants, closeApplicants, handleReviewApp,
    } = useApplicants({ onReview });

    const {
        deleteLoading, deleteConfirmOpen,
        openDeleteConfirm, closeDeleteConfirm, handleConfirmDelete,
    } = useDeleteRecruitment({
        onDelete, onBack,
        onError: (msg) => setToast({ open: true, message: msg, severity: "error" }),
    });

    const cat = getCategory(item.typeLabel);

    const relatedProjects = useMemo(() => {
        if (!allItems || allItems.length === 0) return [];
        const myTags = new Set(item.tags || item.techStacks || []);
        return allItems
            .filter((p) => p.id !== item.id && p.typeLabel === item.typeLabel)
            .map((p) => {
                const pTags = p.tags || p.techStacks || [];
                return { ...p, _shared: pTags.filter((t) => myTags.has(t)).length };
            })
            .sort((a, b) => b._shared - a._shared)
            .slice(0, 3);
    }, [allItems, item.id, item.typeLabel, item.tags, item.techStacks]);

    const isPending  = item.appliedStatus === "PENDING";
    const isAccepted = item.appliedStatus === "ACCEPTED";

    const handleApplyClick = () => {
        if (!getToken()) {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.GUEST_BLOCK_REQUEST, {
                detail: {
                    description: (
                        <>회원가입하고 팀을 찾아보세요.<br />지원 신청, 북마크, 모집글 작성은<br />회원만 이용할 수 있어요.</>
                    ),
                },
            }));
            return;
        }
        if (isPending) setCancelConfirmOpen(true);
        else if (!isAccepted) setApplyOpen(true);
    };

    const handleShare = () => {
        const url = `${window.location.origin}${window.location.pathname}#/recruitments/?detail=${item.id}`;
        navigator.clipboard?.writeText(url).catch(() => {});
        setToast({ open: true, message: "공유 링크를 복사했어요.", severity: "success" });
    };

    // ── derived values ──
    const isOpen         = item.statusLabel === "모집중";
    const memberText     = getMemberText(item);
    const [rawCur, rawMax] = String(memberText).replace(/[^0-9/]/g, "").split("/");
    const curM           = parseInt(rawCur) || 0;
    const maxM           = parseInt(rawMax) || 0;
    const memberPct      = maxM > 0 ? Math.min(Math.round((curM / maxM) * 100), 100) : 0;
    const dueText        = getDueText(item);
    const isUrgent       = String(dueText).match(/D-[0-3](?!\d)/);
    const locationText   = getLocationText(item);
    const toolsStr       = (item.tools || []).length > 0 ? (item.tools || []).join(" · ") : null;
    const deadlineStr    = item.deadline ? formatDueDateKorean(String(item.deadline).slice(5, 10)) : null;
    // 원시 비교(=== "offline")는 레거시 대문자 값("OFFLINE")·백엔드 어휘("mixed")를 놓쳐서
    // 오프라인 모집을 "온라인"이라고 잘못 표시했다 — 정규화 후 공용 라벨을 쓴다.
    const meetLabel      = MEET_TYPE_CFG[inferMeetType(item)].label;
    const stacks         = item.techStacks || item.tags || [];
    const applicantCount = item.applicants || 0;
    // applicants 는 PENDING + ACCEPTED 합계(총 지원자)라 "검토 대기"로 쓸 수 없다.
    // 서버가 pendingApplicants(=PENDING 만)를 따로 내려주므로 대기 안내는 이 값을 쓴다.
    // rawItem 은 목록 항목이라 이 필드가 없다(목록 DTO 에 없음). 상세 응답에서 읽는다.
    const pendingCount = detailFull?.pendingApplicants ?? item.pendingApplicants ?? 0;
    const authorName     = item.leader?.name || item.author || "-";
    const authorInitial  = authorName !== "-" ? authorName.slice(0, 1) : "?";

    return (
        <Box ref={rootRef} sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
            <DetailHero
                item={item}
                cat={cat}
                detailLoading={detailLoading}
                onBack={onBack}
                curM={curM}
                maxM={maxM}
                memberPct={memberPct}
                dueText={dueText}
                isUrgent={isUrgent}
                meetLabel={meetLabel}
                locationText={locationText}
                deadlineStr={deadlineStr}
                toolsStr={toolsStr}
                isOpen={isOpen}
            />

            <DetailActionBar
                item={item}
                rawItem={rawItem}
                isPending={isPending}
                isAccepted={isAccepted}
                statusLoading={statusLoading}
                isOpen={isOpen}
                applicantCount={applicantCount}
                pendingCount={pendingCount}
                onApplyClick={handleApplyClick}
                onBookmark={onBookmark}
                onShare={handleShare}
                onOpenApplicants={openApplicants}
                onToggleStatus={handleToggleStatus}
                onEdit={onEdit}
                onOpenDeleteConfirm={openDeleteConfirm}
            />

            {/* ── Content grid ─────────────────────────────────── */}
            <Box sx={{
                maxWidth: 1100,
                mx: "auto",
                px: 4,
                pb: 6,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1fr 320px" },
                gap: "20px",
                alignItems: "start",
            }}>
                {/* Main column */}
                <Box>
                    <DetailOverview item={item} />
                    <DetailRoles item={item} stacks={stacks} />
                    {item.hasLocation && (
                        <DetailLocation
                            item={item}
                            meetLabel={meetLabel}
                            locationText={locationText}
                            onOpenMapDialog={() => setMapDialogOpen(true)}
                        />
                    )}
                    <DetailQa
                        item={item}
                        onGuestBlock={onGuestBlock}
                        onQuestionsCountsChange={onQuestionsCountsChange}
                        sectionRef={qaSectionRef}
                        defaultPrivate={qaDefaultPrivate}
                    />
                </Box>

                <DetailSidebar
                    item={item}
                    authorName={authorName}
                    authorInitial={authorInitial}
                    toolsStr={toolsStr}
                    deadlineStr={deadlineStr}
                    relatedProjects={relatedProjects}
                    onOpenProject={onOpenProject}
                    onAskQuestion={handleAskQuestion}
                />
            </Box>

            {/* ── Dialogs / Snackbar ───────────────────────────── */}
            <MapDetailDialog
                open={mapDialogOpen}
                onClose={() => setMapDialogOpen(false)}
                item={item}
                allItems={allItems}
                myLocation={myLocation}
                setMyLocation={setMyLocation}
                isPending={isPending}
                isAccepted={isAccepted}
                onApplyClick={() => { setMapDialogOpen(false); handleApplyClick(); }}
                onCopyToast={(msg) => setToast({ open: true, message: msg, severity: "success" })}
                onDetailNav={(target) => { setMapDialogOpen(false); onOpenProject?.(target); }}
                cat={cat}
                isUrgent={isUrgent}
                dueText={dueText}
                locationText={locationText}
                memberText={memberText}
                meetLabel={meetLabel}
            />

            <ApplyDialog
                open={applyOpen}
                onClose={() => setApplyOpen(false)}
                item={item}
                onApply={onApply}
                onDone={(msg) => setToast({ open: true, message: msg, severity: "success" })}
            />

            <ConfirmDialog
                open={cancelConfirmOpen}
                title="신청 취소"
                message={`'${item.title}'에 대한 신청을 취소하시겠어요?`}
                confirmText="취소하기"
                cancelText="아니요"
                confirmColor="error"
                onClose={() => setCancelConfirmOpen(false)}
                onConfirm={async () => {
                    await onApply?.(item.id, "");
                    setCancelConfirmOpen(false);
                }}
            />

            <ConfirmDialog
                open={deleteConfirmOpen}
                title="모집글 삭제"
                message={`'${item.title}' 모집글을 삭제하시겠어요?\n삭제 후에는 복구할 수 없어요.`}
                confirmText="삭제하기"
                cancelText="취소"
                confirmColor="error"
                onClose={() => !deleteLoading && closeDeleteConfirm()}
                onConfirm={() => handleConfirmDelete(item.id)}
                loading={deleteLoading}
            />

            <Snackbar
                open={toast.open}
                autoHideDuration={2200}
                onClose={() => setToast((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    severity={toast.severity}
                    variant="filled"
                    onClose={() => setToast((prev) => ({ ...prev, open: false }))}
                >
                    {toast.message}
                </Alert>
            </Snackbar>

            <ApplicantsDialog
                open={applicantsOpen}
                onClose={closeApplicants}
                apps={apps}
                appsLoading={appsLoading}
                reviewing={reviewing}
                recruitmentId={item.id}
                onReviewApp={handleReviewApp}
            />
        </Box>
    );
}
