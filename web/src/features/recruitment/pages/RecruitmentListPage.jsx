import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useLocation } from "react-router-dom";
import { useRecruitmentTheme } from "../components/desktop/tokens";
import { useKakaoLoader } from "react-kakao-maps-sdk";
import RecruitmentListDesktop from "../components/desktop/RecruitmentListDesktop";
import RecruitmentListMobile from "../components/mobile/RecruitmentListMobile";
import RecruitmentCreateModal from "../components/common/RecruitmentCreateModal";
import { isGuestEmail } from "../../../shared/utils/guestUtils.js";
import RecruitmentDetailModal from "../components/mobile/RecruitmentDetailModal";
import {
    createRecruitment,
    updateRecruitment,
    fetchRecruitmentDetail,
    fetchRecruitments,
    toggleApply,
    toggleBookmark,
} from "../api/recruitmentApi.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { getUser } from "../../../shared/utils/tokenUtils.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { normalizeMeetType, toServerMeetType } from "../constants/recruitmentConfig.js";

// 데스크탑 모달은 목록과 같은 radius 톤을 쓰도록 파생 테마로 감쌈.
// (팔레트는 앱 테마 그대로 — 예전엔 여기서 라이트 고정 테마를 씌워 다크모드가 깨졌음)
function DesktopThemed({ isMobile, children }) {
    const recruitmentTheme = useRecruitmentTheme();
    if (isMobile) return children;
    return <ThemeProvider theme={recruitmentTheme}>{children}</ThemeProvider>;
}

function isGuestBlock(err) {
    return (
        err?.response?.status === 403 &&
        err?.response?.data?.message === "GUEST_NOT_ALLOWED"
    );
}

function buildReq(payload) {
    // 폼은 online/offline/hybrid를 쓰지만 백엔드는 online/offline/mixed로 해석한다.
    // 정규화한 값으로 위치 여부를 판단하고, 전송은 서버 어휘로 변환한다.
    const meetType = normalizeMeetType(payload.meetType) || "online";
    return {
        category: payload.category,
        title: payload.title,
        summary: payload.desc || payload.summary || "",
        techStacks: payload.techStacks || payload.stacks || [],
        roles: (payload.roles || []).map((r) => ({
            name: r.name,
            count: r.count || 1,
            description: r.desc || r.description || "",
        })),
        maxMembers: payload.maxMembers || 4,
        meetType: toServerMeetType(meetType),
        locationText: payload.locationText || (meetType === "online" ? "어디서든 참여 가능" : ""),
        locationLat: payload.locationLat || null,
        locationLng: payload.locationLng || null,
        hasLocation: payload.hasLocation ?? (meetType !== "online"),
        frequency: payload.frequency || null,
        duration: payload.duration || null,
        deadline: payload.deadline || null,
        tools: payload.tools || [],
        leaderRole: payload.leaderRole || null,
        leaderBio: payload.leaderBio || null,
        requirements: payload.requirements || null,
        workspaceId: payload.workspaceId || null,
    };
}

export default function RecruitmentListPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const { loadWorkspaces, currentWorkspace } = useWorkspace();
    const location = useLocation();
    // 현재 워크스페이스 멤버 수 (임시 - settings 처럼 별도 API 없이 worskpace list로 추정)
    const workspaceMemberCount = currentWorkspace?.memberCount ?? 1;

    const [kakaoLoading] = useKakaoLoader({
        appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
        libraries: ["services"],
    });
    const kakaoReady = !kakaoLoading;

    const userEmail = getUser()?.email ?? "";
    const isGuest = isGuestEmail(userEmail);

    const [items, setItems] = useState([]);            // 현재 활성 탭의 결과
    const [statsItems, setStatsItems] = useState([]);   // 항상 browse 응답 — "활성 모집" / "마감 임박" 계산용
    const [appliedCount, setAppliedCount] = useState(0); // 정확한 내 신청 수 (applied 탭 응답 기준 — 마감된 것 포함)
    const [bookmarkedCount, setBookmarkedCount] = useState(0); // 정확한 북마크 수 (bookmarked 탭 응답 기준)
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState(false);     // 목록 로드 실패 — 빈 상태와 구분해서 표시
    const [detailError, setDetailError] = useState(false); // 상세 로드 실패
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [detailItem, setDetailItem] = useState(null);
    const [detailFull, setDetailFull] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [initialDetailTab, setInitialDetailTab] = useState(0);
    const currentTabRef = useRef("browse");

    // ── 게스트 차단 콜백 — 자식 컴포넌트(TabQuestions 등)에서 게스트 액션 시 호출 ──
    // 전역 Layout GuestBlockModal 을 이벤트로 트리거. 모집 컨텍스트 메시지를 함께 전달.
    const openGuestBlock = useCallback(() => {
        window.dispatchEvent(new CustomEvent(APP_EVENTS.GUEST_BLOCK_REQUEST, {
            detail: {
                description: (
                    <>회원가입하고 팀을 찾아보세요.<br />지원 신청, 북마크, 모집글 작성은<br />회원만 이용할 수 있어요.</>
                ),
            },
        }));
    }, []);
    const handleGuestBlock = openGuestBlock;

    // ── Q&A 카운트 동기화 — TabQuestions가 items.length / 미답변 수를 알려주면 헤더 배지/카드 배지 즉시 갱신 ──
    const handleQuestionsCountsChange = useCallback((id, counts) => {
        setDetailFull((prev) =>
            prev?.id === id
                ? { ...prev, questionCount: counts.total, unansweredCount: counts.unanswered }
                : prev
        );
        setItems((prev) =>
            prev.map((it) =>
                it.id === id && it.unansweredCount != null
                    ? { ...it, unansweredCount: counts.unanswered }
                    : it
            )
        );
    }, []);

    // ── 목록 로드 ─────────────────────────────────────────────

    const loadList = useCallback((tab = "browse") => {
        setLoading(true);
        setListError(false);
        fetchRecruitments(tab)
            .then((res) => {
                setItems(res.data);
                // browse 응답은 stats 카운트 기준 데이터로도 저장 — 탭 변경 시 stats가 흔들리지 않게.
                if (tab === "browse") setStatsItems(res.data);
            })
            // 실패를 삼키면 "모집글 없음" 빈 상태와 구분이 안 됨 → 에러 상태로 표시하고 재시도 제공
            .catch(() => setListError(true))
            .finally(() => setLoading(false));
    }, []);

    const handleRetryList = useCallback(() => {
        loadList(currentTabRef.current);
    }, [loadList]);

    useEffect(() => {
        loadList("browse");
        // stats 카운트용 추가 fetch — applied/bookmarked는 browse에 누락된 마감 건도 포함되어야 정확
        fetchRecruitments("applied")
            .then((res) => {
                const cnt = (res.data || []).filter(
                    (it) => it.appliedStatus && it.appliedStatus !== "CANCELLED"
                ).length;
                setAppliedCount(cnt);
            })
            .catch(() => {});
        fetchRecruitments("bookmarked")
            .then((res) => setBookmarkedCount((res.data || []).length))
            .catch(() => {});
    }, [loadList]);

    // ── 탭 변경 시 재로드 ──────────────────────────────────────

    const handleTabChange = useCallback((tab) => {
        currentTabRef.current = tab;
        loadList(tab);
    }, [loadList]);

    // ── 상세 모달 오픈 ────────────────────────────────────────

    const refreshDetail = useCallback((id) => {
        setDetailLoading(true);
        setDetailError(false);
        fetchRecruitmentDetail(id)
            .then((res) => setDetailFull(res.data))
            .catch(() => setDetailError(true))
            .finally(() => setDetailLoading(false));
    }, []);

    const handleDetail = useCallback((item) => {
        setDetailItem(item);
        setDetailFull(null);
        refreshDetail(item.id);
    }, [refreshDetail]);

    const handleRetryDetail = useCallback(() => {
        const id = detailFull?.id ?? detailItem?.id;
        if (id != null) refreshDetail(id);
    }, [detailFull, detailItem, refreshDetail]);

    // 공유 링크 / 알림 클릭: ?detail=ID 파라미터로 상세 자동 오픈
    // ?tab=qa 같이 전달되면 모달의 해당 탭으로 진입 (Q&A 알림 클릭 → Q&A 탭)
    const TAB_NAME_TO_INDEX = { info: 0, qa: 1, members: 2, applicants: 3 };
    const detailParamHandled = useRef(null);
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const detailId = params.get("detail");
        const tabName = params.get("tab");
        if (!detailId) return;
        if (detailParamHandled.current === detailId) return; // 동일 ID 중복 실행 방지
        detailParamHandled.current = detailId;
        const numId = Number(detailId);
        setInitialDetailTab(TAB_NAME_TO_INDEX[tabName] ?? 0);
        const found = items.find((it) => it.id === numId);
        if (found) {
            handleDetail(found);
        } else {
            setDetailLoading(true);
            setDetailError(false);
            fetchRecruitmentDetail(numId)
                .then((res) => {
                    setDetailItem(res.data);
                    setDetailFull(res.data);
                })
                .catch(() => setDetailError(true))
                .finally(() => setDetailLoading(false));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search, items, handleDetail]);

    const handleCloseDetail = useCallback(() => {
        setDetailItem(null);
        setDetailFull(null);
    }, []);

    // ── 지원 신청/취소 ─────────────────────────────────────────

    const handleApply = useCallback(async (id, message = "", roleId = null) => {
        if (!getUser()) {
            openGuestBlock();
            throw new Error("AUTH_REQUIRED");
        }
        try {
            const res = await toggleApply(id, message, roleId);
            const newStatus = res.data.status; // "PENDING" | "CANCELLED"
            setItems((prev) =>
                prev.map((it) => it.id === id ? { ...it, appliedStatus: newStatus } : it)
            );
            setStatsItems((prev) =>
                prev.map((it) => it.id === id ? { ...it, appliedStatus: newStatus } : it)
            );
            // 정확한 stats 카운트 동기화 — PENDING/ACCEPTED → +1, CANCELLED → -1
            if (newStatus === "CANCELLED") {
                setAppliedCount((c) => Math.max(0, c - 1));
            } else if (newStatus === "PENDING" || newStatus === "ACCEPTED") {
                setAppliedCount((c) => c + 1);
            }
            refreshDetail(id);
            const msg = newStatus === "CANCELLED" ? "지원이 취소되었습니다." : "신청이 완료됐어요! 팀장의 응답을 기다려주세요.";
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: msg, severity: "success" } }));
        } catch (err) {
            if (isGuestBlock(err)) openGuestBlock();
            else window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "지원 처리에 실패했습니다.", severity: "error" } }));
            throw err;
        }
    }, [refreshDetail]);

    // ── 신청자 수락/거절 후 콜백 (작성자 전용) ───────────────

    const handleReview = useCallback(async (recruitmentId) => {
        // 상세 최신화 (팀원 목록, 지원자 수)
        refreshDetail(recruitmentId);
        // 워크스페이스 목록 갱신 (수락된 경우 백엔드가 워크스페이스 참가 처리)
        loadWorkspaces();
        // 리스트 최신화
        loadList(currentTabRef.current);
    }, [refreshDetail, loadWorkspaces, loadList]);

    // ── 북마크 토글 ───────────────────────────────────────────

    const handleBookmark = useCallback(async (id) => {
        if (!getUser()) {
            openGuestBlock();
            return;
        }
        try {
            const res = await toggleBookmark(id);
            setItems((prev) =>
                prev.map((item) =>
                    item.id === id ? { ...item, bookmarked: res.data.bookmarked } : item
                )
            );
            setStatsItems((prev) =>
                prev.map((item) =>
                    item.id === id ? { ...item, bookmarked: res.data.bookmarked } : item
                )
            );
            // 정확한 stats 카운트 동기화
            setBookmarkedCount((c) => res.data.bookmarked ? c + 1 : Math.max(0, c - 1));
            const msg = res.data.bookmarked ? "북마크에 추가되었습니다." : "북마크가 해제되었습니다.";
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: msg, severity: "success" } }));
        } catch (err) {
            if (isGuestBlock(err)) openGuestBlock();
            else window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "북마크 처리에 실패했습니다.", severity: "error" } }));
            throw err;
        }
    }, []);

    // ── 상태 변경 (모집중 ↔ 마감) ────────────────────────────────

    const handleStatusChange = useCallback((id, newStatus) => {
        setItems((prev) =>
            prev.map((it) => it.id === id ? { ...it, statusLabel: newStatus } : it)
        );
        setStatsItems((prev) =>
            prev.map((it) => it.id === id ? { ...it, statusLabel: newStatus } : it)
        );
        setDetailFull((prev) =>
            prev?.id === id ? { ...prev, statusLabel: newStatus } : prev
        );
    }, []);

    // ── 모집글 삭제 ───────────────────────────────────────────

    const handleDelete = useCallback((id) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
        setStatsItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    // ── 모집글 수정 ───────────────────────────────────────────

    const handleOpenEdit = useCallback((item) => {
        setEditItem(item);
        setEditOpen(true);
    }, []);

    const editInitialValues = useMemo(() => {
        if (!editOpen || !editItem) return null;
        const d = detailFull?.id === editItem.id ? detailFull : editItem;
        return {
            category: d.typeLabel || d.category || "토이프로젝트",
            title: d.title || "",
            desc: d.summary || "",
            stacks: d.techStacks || d.tags || [],
            roles: (d.roles || []).map((r) => ({
                id: r.id || Date.now() + Math.random(),
                name: typeof r === "string" ? r : r.name,
                count: r.count || 1,
                desc: r.description || r.desc || "",
            })),
            currentMembers: d.currentMembers ?? d.members?.length ?? 1,
            maxMembers: d.maxMembers ?? 3,
            // 레거시 대문자("OFFLINE")·서버 어휘("mixed")를 그대로 폼에 넣으면
            // 진행 방식 카드가 아무것도 선택되지 않은 것처럼 보이고, 위치 입력칸도 사라진다.
            meetType: normalizeMeetType(d.meetType) || "online",
            location: d.hasLocation ? {
                locationLat: d.locationLat,
                locationLng: d.locationLng,
                locationName: d.locationText,
                locationAddress: d.locationText,
            } : null,
            locationLat: d.locationLat || null,
            locationLng: d.locationLng || null,
            frequency: d.frequency || "주 2회",
            duration: d.duration || "3개월",
            deadline: d.deadline || "",
            tools: d.tools || [],
            requirements: d.requirements || "",
            leaderRole: d.leaderRole || d.leader?.role || "",
            leaderBio: d.leaderBio || d.leader?.bio || "",
            workspaceId: d.workspaceId || null,
        };
    }, [editOpen, editItem, detailFull]);

    const handleSubmitEdit = useCallback(async (payload) => {
        const id = payload._editId;
        if (!id) return;
        try {
            const res = await updateRecruitment(id, buildReq(payload));
            setItems((prev) => prev.map((item) => item.id === id ? res.data : item));
            setStatsItems((prev) => prev.map((item) => item.id === id ? res.data : item));
            if (detailFull?.id === id) setDetailFull(res.data);
            setEditOpen(false);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "모집 공고가 수정되었습니다.", severity: "success" } }));
        } catch {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "수정에 실패했습니다.", severity: "error" } }));
        }
    }, [detailFull]);

    // ── 모집글 생성 ───────────────────────────────────────────

    // 반환값: 성공 여부 — 모달이 실패 시 "생성된 워크스페이스 재사용" 안내에 사용
    const handleSubmitCreate = useCallback(async (payload) => {
        try {
            const res = await createRecruitment(buildReq(payload));
            setItems((prev) => [res.data, ...prev]);
            setStatsItems((prev) => [res.data, ...prev]);
            setCreateOpen(false);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "모집 공고가 등록되었습니다.", severity: "success" } }));
            return true;
        } catch (err) {
            if (isGuestBlock(err)) {
                setCreateOpen(false);
                openGuestBlock();
                return; // 모달이 닫히고 게스트 차단 모달이 뜨므로 별도 실패 안내 생략 (undefined ≠ false)
            }
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "공고 등록에 실패했습니다.", severity: "error" } }));
            return false;
        }
    }, []);

    return (
        <>
            {isMobile ? (
                <RecruitmentListMobile
                    items={items}
                    loading={loading}
                    loadError={listError}
                    onRetry={handleRetryList}
                    onOpenCreate={() => (!getUser() || isGuest) ? openGuestBlock() : setCreateOpen(true)}
                    kakaoReady={kakaoReady}
                    onDetail={handleDetail}
                    onTabChange={handleTabChange}
                    onBookmark={handleBookmark}
                />

            ) : (
                <RecruitmentListDesktop
                    items={items}
                    statsItems={statsItems}
                    appliedCount={appliedCount}
                    bookmarkedCount={bookmarkedCount}
                    loading={loading}
                    loadError={listError}
                    onRetry={handleRetryList}
                    onOpenCreate={() => (!getUser() || isGuest) ? openGuestBlock() : setCreateOpen(true)}
                    kakaoReady={kakaoReady}
                    onDetail={handleDetail}
                    onTabChange={handleTabChange}
                    onBookmark={handleBookmark}
                    detailFull={detailFull}
                    detailLoading={detailLoading}
                    detailError={detailError}
                    onRetryDetail={handleRetryDetail}
                    onApply={handleApply}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                    onReview={handleReview}
                    onEdit={handleOpenEdit}
                    onCloseDetail={handleCloseDetail}
                    openDetailItem={detailItem}
                    onGuestBlock={handleGuestBlock}
                    onQuestionsCountsChange={handleQuestionsCountsChange}
                />
            )}

            <DesktopThemed isMobile={isMobile}>
                <RecruitmentCreateModal
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    onSubmit={handleSubmitCreate}
                    workspaceMemberCount={workspaceMemberCount}
                    kakaoReady={kakaoReady}
                />
            </DesktopThemed>

            {isMobile && (
                <RecruitmentDetailModal
                    open={!!detailItem}
                    onClose={handleCloseDetail}
                    item={detailFull || detailItem}
                    detailLoading={detailLoading}
                    detailError={detailError}
                    onRetryDetail={handleRetryDetail}
                    kakaoReady={kakaoReady}
                    onApply={handleApply}
                    onReview={handleReview}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                    onEdit={handleOpenEdit}
                    onGuestBlock={handleGuestBlock}
                    initialTabIndex={initialDetailTab}
                    onQuestionsCountsChange={handleQuestionsCountsChange}
                />
            )}

            {/* 수정 모달 */}
            {editInitialValues && (
                <DesktopThemed isMobile={isMobile}>
                    <RecruitmentCreateModal
                        open={editOpen}
                        onClose={() => setEditOpen(false)}
                        onSubmit={handleSubmitEdit}
                        initialValues={editInitialValues}
                        workspaceMemberCount={editInitialValues.currentMembers}
                        kakaoReady={kakaoReady}
                        editMode
                        editId={editItem.id}
                    />
                </DesktopThemed>
            )}
        </>
    );
}
