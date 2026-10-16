import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Box, CircularProgress, IconButton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

import { APP_EVENTS } from "../shared/constants/events.js";
import { resolveImageUrl } from "../shared/utils/urlUtils.js";
import { formatTimeAgo, formatAbsoluteDue } from "../shared/utils/formatters.js";
import { PriorityPill, StatusChip } from "../shared/ui/common/Chips.jsx";
import TextTabs from "../shared/ui/common/TextTabs.jsx";
import TagChips from "../shared/ui/common/TagChips.jsx";
import Press from "../shared/ui/primitives/Press.jsx";
import { Z } from "../shared/ui/zIndex.js";
import useSearch from "../features/search/hooks/useSearch.js";
import useCommands, { filterCommands } from "../features/search/hooks/useCommands.js";
import { useOpenTodoDetail } from "../features/todo/hooks/useOpenTodoDetail.jsx";
import { loadRecentTodos, removeRecentTodo } from "../features/todo/utils/recentTodos.js";
import { loadRecents, pushRecent, dropRecent, clearRecents as clearRecentsStore } from "../features/search/utils/recentSearches.js";
import { useActiveProject } from "../features/project/context/ActiveProjectContext.jsx";
import { ROLE_LABEL } from "../features/workspace/hooks/useWorkspacePermissions.js";

/**
 * 모바일 전역 검색 — 풀스크린 (데스크탑 GlobalSearch 커맨드 팔레트의 모바일 버전).
 * 상단 검색바 + underline 탭 + 풀폭 결과 행. 키보드 힌트/선택 인덱스 없음(터치 전용).
 */
export default function GlobalSearchMobile({ open, onClose }) {
    const theme = useTheme();
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const [tab, setTab] = useState("all");
    const [recents, setRecents] = useState(loadRecents);
    const [recentTodos, setRecentTodos] = useState(loadRecentTodos);
    const [scopeOnly, setScopeOnly] = useState(false);

    const { q, setQ, results, loading, error, retry, tooShort, hasMoreTasks, loadMore, loadingMore } = useSearch(open);

    // 명령 팔레트 (데스크탑과 공용 레지스트리) — early return 위에서 호출(rules-of-hooks)
    const commands = useCommands();
    const cmdMatches = useMemo(() => filterCommands(commands, q), [commands, q]);
    const openTodoDetail = useOpenTodoDetail();
    const { activeProjectId, activeProject, matchesActiveProject } = useActiveProject();

    // 결과를 연 시점에 검색어 기록 (맨 앞으로, 중복 제거)
    const recordSearch = () => setRecents(pushRecent(q));
    const removeRecent = (query) => setRecents(dropRecent(query));
    const clearRecents = () => setRecents(clearRecentsStore());

    const goTo = (path, state) => { recordSearch(); navigate(path, state ? { state } : undefined); onClose(); };
    const openTask   = (id)     => { recordSearch(); openTodoDetail(id); onClose(); };

    // 최근 본 항목 — 못 열면(삭제 등) 목록에서 제거하고 시트는 유지 (오류 토스트는 훅이 띄움)
    const openRecentTodo = async (id) => {
        const ok = await openTodoDetail(id);
        if (!ok) {
            removeRecentTodo(id);
            setRecentTodos(loadRecentTodos());
            return;
        }
        onClose();
    };
    const openMsg    = (roomId) => goTo("/dm", { openRoomId: roomId });
    const openMember = (userId) => goTo("/dm", { openPartnerId: userId });
    const openProject = (id)    => goTo(`/projects/${id}`);
    // 태그 → 할 일 목록 + 그 태그로 필터 (TaskListPage가 location.state.tagId를 소비)
    const openTag     = (id)    => goTo("/tasklist", { tagId: id });

    // 결과 없음 → 검색어를 제목으로 새 할 일 (ClickUp create-from-search 패턴)
    const addFromSearch = () => {
        window.dispatchEvent(new CustomEvent(APP_EVENTS.OPEN_ADD_TODO, { detail: { title: q.trim() } }));
        onClose();
    };

    useEffect(() => {
        if (open) {
            setTab("all");
            setScopeOnly(false); // 이전에 켜둔 스코프 필터가 몰래 남지 않게 — 열 때마다 전체 검색으로 시작
            setRecents(loadRecents());
            setRecentTodos(loadRecentTodos());
            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [open]);

    if (!open) return null;

    const primary = theme.palette.primary.main;
    const exec = (cmd) => { cmd?.run?.(); onClose(); };

    const highlight = (text) => {
        if (!q || !text) return text ?? "";
        const idx = text.toLowerCase().indexOf(q.toLowerCase());
        if (idx === -1) return text;
        return (
            <>
                {text.slice(0, idx)}
                <Box component="span" sx={{ color: "primary.main", fontWeight: 800, background: alpha(primary, 0.12) }}>
                    {text.slice(idx, idx + q.length)}
                </Box>
                {text.slice(idx + q.length)}
            </>
        );
    };

    const Row = ({ onClick, children }) => (
        <Press
            onClick={onClick}
            haptic="light"
            pressScale={0.99}
            activeBg="var(--plando-surface-faint)"
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "13px 20px",
                borderBottom: `1px solid ${theme.palette.divider}`,
            }}
        >
            {children}
        </Press>
    );

    const SectionLabel = ({ label, count }) => (
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ px: 2.5, pt: 2.5, pb: 0.75 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", color: "text.secondary" }}>
                {label}
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.disabled", letterSpacing: "-0.01em" }}>
                {count}
            </Typography>
        </Stack>
    );

    const CommandRow = ({ c }) => {
        const Icon = c.icon;
        return (
            <Row onClick={() => exec(c)}>
                <Box sx={{ width: 34, height: 34, borderRadius: "9px", flexShrink: 0, bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === "dark" ? 0.06 : 0.04), display: "flex", alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
                    {Icon && <Icon size={18} strokeWidth={1.75} />}
                </Box>
                <Typography sx={{ flex: 1, fontSize: 15, fontWeight: 600, color: "text.primary", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {highlight(c.label)}
                </Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled", flexShrink: 0 }}>{c.group}</Typography>
            </Row>
        );
    };

    const Avatar28 = ({ src, name }) =>
        src ? (
            <Box component="img" src={resolveImageUrl(src)} sx={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" />
        ) : (
            <Box sx={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                bgcolor: alpha(primary, 0.5), color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 800,
            }}>
                {name?.[0] ?? "?"}
            </Box>
        );

    /* 보관 배지 — 어느 항목이 보관인지는 검색 응답이 아니라 훅이 별도로 받아 둔 id 집합으로 판별 */
    const ArchivedBadge = () => (
        <Typography sx={{
            flexShrink: 0, fontSize: 11, fontWeight: 700, color: "text.secondary",
            px: 0.75, py: 0.125, borderRadius: "6px",
            bgcolor: (t) => alpha(t.palette.text.secondary, t.palette.mode === "dark" ? 0.16 : 0.10),
        }}>
            보관
        </Typography>
    );

    // 스코프 필터 — 프로젝트/인박스 스코프 안에서 "여기서만" 좁히기 (할 일 결과에만 적용)
    const scopedTasks = scopeOnly && activeProjectId != null
        ? results.tasks.filter(matchesActiveProject)
        : results.tasks;
    const visibleTotal = scopedTasks.length + results.projects.length + results.tags.length + results.messages.length + results.members.length;

    const taskList   = scopedTasks.slice(0, tab === "all" ? 4 : 999);
    const projList   = results.projects.slice(0, tab === "all" ? 3 : 999);
    const tagList    = results.tags.slice(0, tab === "all" ? 3 : 999);
    const msgList    = results.messages.slice(0, tab === "all" ? 3 : 999);
    const memberList = results.members.slice(0, tab === "all" ? 4 : 999);

    // 할 일은 페이징되므로 "지금까지 받은 개수 + 더 있음(+)" — 이게 전부라는 오해 방지
    const taskCountLabel = `${scopedTasks.length}${hasMoreTasks ? "+" : ""}`;
    const TABS = [
        { id: "all",       label: "전체",     count: `${visibleTotal}${hasMoreTasks ? "+" : ""}` },
        { id: "tasks",     label: "할 일",    count: taskCountLabel },
        { id: "projects",  label: "프로젝트", count: results.projects.length },
        { id: "tags",      label: "태그",     count: results.tags.length },
        { id: "messages",  label: "메시지",   count: results.messages.length },
        { id: "members",   label: "멤버",     count: results.members.length },
    ];

    const scopeLabel = activeProjectId === "inbox" ? "인박스" : activeProject?.name;

    return createPortal(
        <Box sx={{
            position: "fixed",
            inset: 0,
            zIndex: Z.MODAL,
            bgcolor: "background.default",
            display: "flex",
            flexDirection: "column",
        }}>
            {/* 헤더: 뒤로가기 + 검색바 */}
            <Box sx={{ flexShrink: 0, pt: "calc(env(safe-area-inset-top) + 8px)", pb: 1, borderBottom: q ? "none" : `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ pl: 0.75, pr: 2 }}>
                    <IconButton size="small" onClick={onClose} sx={{ color: "text.secondary" }} aria-label="뒤로">
                        <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Box sx={{
                        flex: 1, px: 1.5, height: 40, borderRadius: "12px",
                        background: "var(--plando-surface-low)",
                        display: "flex", alignItems: "center", gap: 1,
                    }}>
                        <SearchRoundedIcon sx={{ fontSize: 18, color: "text.disabled", flexShrink: 0 }} />
                        <input
                            ref={inputRef}
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="할 일, 메시지, 멤버 검색"
                            style={{
                                flex: 1, border: "none", outline: "none", background: "transparent",
                                fontSize: 16, fontFamily: "inherit", color: theme.palette.text.primary,
                                caretColor: primary, minWidth: 0,
                            }}
                        />
                        {loading && <CircularProgress size={15} sx={{ flexShrink: 0 }} />}
                        {q && !loading && (
                            <IconButton size="small" onClick={() => setQ("")} sx={{ p: 0.25, color: "text.disabled" }} aria-label="지우기">
                                <CloseRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        )}
                    </Box>
                </Stack>

                {/* 스코프 필터 칩 — 프로젝트/인박스 스코프 안에 있을 때만 */}
                {activeProjectId != null && scopeLabel && (
                    <Box sx={{ px: 2, pt: 1 }}>
                        <Press
                            onClick={() => setScopeOnly((v) => !v)}
                            haptic="light"
                            pressScale={0.96}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "5px 12px",
                                borderRadius: 999,
                                border: `1px solid ${scopeOnly ? alpha(primary, 0.4) : theme.palette.divider}`,
                                background: scopeOnly ? alpha(primary, 0.12) : "transparent",
                            }}
                        >
                            {scopeOnly && <CheckRoundedIcon sx={{ fontSize: 14, color: "primary.main" }} />}
                            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: scopeOnly ? "primary.main" : "text.secondary" }}>
                                {scopeLabel}에서만
                            </Typography>
                        </Press>
                    </Box>
                )}

                {/* 탭 — 쿼리 있을 때만 */}
                {q && !tooShort && (
                    <Box sx={{ mt: 0.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <TextTabs tabs={TABS} value={tab} onChange={setTab} />
                    </Box>
                )}
            </Box>

            {/* 콘텐츠 */}
            <Box sx={{ flex: 1, overflowY: "auto", pb: "calc(env(safe-area-inset-bottom) + 24px)" }}>

                {/* 빈 상태에선 명령 목록을 노출하지 않고 데스크탑과 통일 — 명령은 검색어 입력 시 cmdMatches로만 표출 */}

                {/* 최근 검색어 — 쿼리 없을 때 */}
                {!q && (
                    recents.length > 0 ? (
                        <>
                            <Stack direction="row" alignItems="baseline" sx={{ px: 2.5, pt: 2.5, pb: 0.75 }}>
                                <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", color: "text.secondary" }}>
                                    최근 검색
                                </Typography>
                                <Press onClick={clearRecents} haptic="light" pressScale={0.95}>
                                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.disabled" }}>
                                        전체 삭제
                                    </Typography>
                                </Press>
                            </Stack>
                            {recents.map((query) => (
                                <Box key={query} sx={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${theme.palette.divider}` }}>
                                    <Press
                                        onClick={() => setQ(query)}
                                        haptic="light"
                                        pressScale={0.99}
                                        activeBg="var(--plando-surface-faint)"
                                        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "13px 0 13px 20px" }}
                                    >
                                        <HistoryRoundedIcon sx={{ fontSize: 18, color: "text.disabled", flexShrink: 0 }} />
                                        <Typography sx={{ flex: 1, fontSize: 15, fontWeight: 500, color: "text.primary", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {query}
                                        </Typography>
                                    </Press>
                                    <IconButton size="small" onClick={() => removeRecent(query)} sx={{ mx: 1, color: "text.disabled" }} aria-label="삭제">
                                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Box>
                            ))}
                        </>
                    ) : recentTodos.length === 0 && (
                        <Typography sx={{ px: 2.5, py: 6, fontSize: 14, color: "text.disabled", textAlign: "center" }}>
                            할 일, 메시지, 멤버를 검색해보세요
                        </Typography>
                    )
                )}

                {/* 최근 본 항목 — 쿼리 없을 때 (ClickUp Recents 패턴) */}
                {!q && recentTodos.length > 0 && (
                    <>
                        <SectionLabel label="최근 본 항목" count="" />
                        {recentTodos.map((item) => (
                            <Row key={item.id} onClick={() => openRecentTodo(item.id)}>
                                <TaskAltRoundedIcon sx={{ fontSize: 18, color: "text.disabled", flexShrink: 0 }} />
                                <Typography
                                    sx={{
                                        flex: 1, fontSize: 15, fontWeight: 500, textAlign: "left",
                                        color: item.status === "DONE" ? "text.disabled" : "text.primary",
                                        textDecoration: item.status === "DONE" ? "line-through" : "none",
                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    }}
                                >
                                    {item.title}
                                </Typography>
                            </Row>
                        ))}
                    </>
                )}

                {/* 2글자 미만 안내 */}
                {tooShort && (
                    <Typography sx={{ px: 2.5, py: 6, fontSize: 13, color: "text.disabled", textAlign: "center" }}>
                        두 글자 이상 입력해주세요
                    </Typography>
                )}

                {/* 검색 결과 */}
                {q && !tooShort && !loading && (
                    <>
                    {/* 요청 실패는 "결과 없음"과 구분한다 — 서버 오류·오프라인일 때 results가 빈 값으로
                        리셋되면서 사용자가 "그런 항목이 없다"고 오해했고("할 일로 추가" CTA까지 떠서
                        중복 생성을 유도) 재시도할 방법도 없었다.
                        (로컬에서 매칭되는 명령은 검색 실패와 무관하므로 아래에서 계속 렌더한다) */}
                    {error && (
                        <Box sx={{ py: 4, textAlign: "center" }}>
                            <Typography sx={{ px: 2.5, fontSize: 14, fontWeight: 700, color: "error.main" }}>
                                검색하지 못했어요
                            </Typography>
                            <Typography sx={{ px: 2.5, mt: 0.5, fontSize: 12.5, color: "text.disabled" }}>
                                잠시 후 다시 시도해주세요
                            </Typography>
                            <Press
                                onClick={retry}
                                haptic="light"
                                pressScale={0.96}
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    marginTop: 16, padding: "10px 18px", borderRadius: 999,
                                    background: alpha(primary, 0.12),
                                }}
                            >
                                <Typography sx={{ fontSize: 14, fontWeight: 700, color: "primary.main" }}>
                                    다시 시도
                                </Typography>
                            </Press>
                        </Box>
                    )}
                    {!error && (visibleTotal === 0 && cmdMatches.length === 0) ? (
                        <Box sx={{ py: 5, textAlign: "center" }}>
                            <Typography sx={{ px: 2.5, fontSize: 14, color: "text.disabled" }}>
                                "{q}"에 대한 결과가 없어요
                            </Typography>
                            <Press
                                onClick={addFromSearch}
                                haptic="light"
                                pressScale={0.96}
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    marginTop: 16, padding: "10px 18px", borderRadius: 999,
                                    background: alpha(primary, 0.12),
                                }}
                            >
                                <AddRoundedIcon sx={{ fontSize: 17, color: "primary.main" }} />
                                <Typography sx={{ fontSize: 14, fontWeight: 700, color: "primary.main" }}>
                                    "{q}" 할 일로 추가
                                </Typography>
                            </Press>
                        </Box>
                    ) : (
                        <>
                            {/* 명령 */}
                            {tab === "all" && cmdMatches.length > 0 && (
                                <>
                                    <SectionLabel label="명령" count={cmdMatches.length} />
                                    {cmdMatches.map((c) => <CommandRow key={c.id} c={c} />)}
                                </>
                            )}

                            {/* 할 일 */}
                            {(tab === "all" || tab === "tasks") && (
                                scopedTasks.length > 0 ? (
                                    <>
                                        {tab === "all" && <SectionLabel label="할 일" count={taskCountLabel} />}
                                        {taskList.map((t) => {
                                            const isArchived = t.archived === true; // 서버 값 (예전엔 보관 목록을 따로 받아 대조했다)
                                            return (
                                            <Row key={t.id} onClick={() => openTask(t.id)}>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography sx={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: isArchived ? "text.secondary" : "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                                                        {highlight(t.title)}
                                                    </Typography>
                                                    {(t.dueDate || t.assignees?.length > 0) && (
                                                        <Typography sx={{ fontSize: 12, color: "text.disabled", mt: 0.25, textAlign: "left" }}>
                                                            {t.dueDate ? formatAbsoluteDue(t.dueDate) : ""}
                                                            {t.assignees?.length > 0 && `${t.dueDate ? " · " : ""}${t.assignees[0].name}${t.assignees.length > 1 ? ` 외 ${t.assignees.length - 1}명` : ""}`}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                {/* 보관된 할 일도 결과에 섞여 나온다 — 살아 있는 항목과 눈으로 구분되게 */}
                                                {isArchived && <ArchivedBadge />}
                                                {t.priority && <PriorityPill priority={t.priority} sx={{ flexShrink: 0 }} />}
                                                <StatusChip status={t.status} sx={{ flexShrink: 0 }} />
                                            </Row>
                                            );
                                        })}
                                        {/* '더 보기'는 전체 목록을 보는 할 일 탭에서만 — 전체 탭은 4건 미리보기라 의미가 없다.
                                            불러오는 동안에도 기존 행은 그대로 두고 버튼 라벨만 바뀐다. */}
                                        {tab === "tasks" && hasMoreTasks && (
                                            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                                                <Press
                                                    onClick={loadMore}
                                                    haptic="light"
                                                    pressScale={0.96}
                                                    style={{
                                                        display: "inline-flex", alignItems: "center", gap: 6,
                                                        padding: "10px 20px", borderRadius: 999,
                                                        background: alpha(primary, 0.12),
                                                        opacity: loadingMore ? 0.6 : 1,
                                                    }}
                                                >
                                                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: "primary.main" }}>
                                                        {loadingMore ? "불러오는 중…" : "더 보기"}
                                                    </Typography>
                                                </Press>
                                            </Box>
                                        )}
                                    </>
                                ) : (!error && tab === "tasks") && (
                                    <Box sx={{ py: 4, textAlign: "center" }}>
                                        <Typography sx={{ px: 2.5, fontSize: 13, color: "text.disabled" }}>
                                            일치하는 할 일이 없어요
                                        </Typography>
                                        <Press
                                            onClick={addFromSearch}
                                            haptic="light"
                                            pressScale={0.96}
                                            style={{
                                                display: "inline-flex", alignItems: "center", gap: 6,
                                                marginTop: 14, padding: "9px 16px", borderRadius: 999,
                                                background: alpha(primary, 0.12),
                                            }}
                                        >
                                            <AddRoundedIcon sx={{ fontSize: 16, color: "primary.main" }} />
                                            <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "primary.main" }}>
                                                "{q}" 할 일로 추가
                                            </Typography>
                                        </Press>
                                    </Box>
                                )
                            )}

                            {/* 프로젝트 */}
                            {(tab === "all" || tab === "projects") && (
                                results.projects.length > 0 ? (
                                    <>
                                        {tab === "all" && <SectionLabel label="프로젝트" count={results.projects.length} />}
                                        {projList.map((p) => (
                                            <Row key={p.id} onClick={() => openProject(p.id)}>
                                                {/* 점 색은 프로젝트가 지정한 색 그대로 — 없으면 테마 중립색 */}
                                                <Box sx={{ width: 10, height: 10, borderRadius: "3px", flexShrink: 0, bgcolor: p.color || "text.disabled" }} />
                                                <Typography sx={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: "text.primary", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {highlight(p.name)}
                                                </Typography>
                                                <Typography sx={{ fontSize: 12.5, color: "text.disabled", flexShrink: 0, whiteSpace: "nowrap" }}>
                                                    미완료 {p.openCount ?? 0}
                                                </Typography>
                                            </Row>
                                        ))}
                                    </>
                                ) : (!error && tab === "projects") && (
                                    <Typography sx={{ px: 2.5, py: 4, fontSize: 13, color: "text.disabled", textAlign: "center" }}>
                                        일치하는 프로젝트가 없어요
                                    </Typography>
                                )
                            )}

                            {/* 태그 */}
                            {(tab === "all" || tab === "tags") && (
                                results.tags.length > 0 ? (
                                    <>
                                        {tab === "all" && <SectionLabel label="태그" count={results.tags.length} />}
                                        {tagList.map((tg) => (
                                            <Row key={tg.id} onClick={() => openTag(tg.id)}>
                                                {/* 태그는 자기 색 칩이 곧 식별자 — 목록/카드와 같은 TagChips를 그대로 쓴다 */}
                                                <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>
                                                    <TagChips tags={[tg]} max={1} size="md" />
                                                </Box>
                                                <Typography sx={{ fontSize: 12.5, color: "text.disabled", flexShrink: 0, whiteSpace: "nowrap" }}>
                                                    할 일 {tg.todoCount ?? 0}
                                                </Typography>
                                            </Row>
                                        ))}
                                    </>
                                ) : (!error && tab === "tags") && (
                                    <Typography sx={{ px: 2.5, py: 4, fontSize: 13, color: "text.disabled", textAlign: "center" }}>
                                        일치하는 태그가 없어요
                                    </Typography>
                                )
                            )}

                            {/* 메시지 */}
                            {(tab === "all" || tab === "messages") && (
                                results.messages.length > 0 ? (
                                    <>
                                        {tab === "all" && <SectionLabel label="메시지" count={results.messages.length} />}
                                        {msgList.map((m) => (
                                            <Row key={m.roomId} onClick={() => openMsg(m.roomId)}>
                                                <Avatar28 src={m.partnerProfileImageUrl} name={m.partnerName} />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography sx={{ fontSize: 15, fontWeight: 600, color: "text.primary", textAlign: "left" }}>
                                                        {highlight(m.partnerName)}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: 12.5, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                                                        {highlight(m.lastMessage)}
                                                    </Typography>
                                                </Box>
                                                <Typography sx={{ fontSize: 11.5, color: "text.disabled", flexShrink: 0, whiteSpace: "nowrap" }}>
                                                    {m.sentAt ? formatTimeAgo(m.sentAt) : ""}
                                                </Typography>
                                            </Row>
                                        ))}
                                    </>
                                ) : (!error && tab === "messages") && (
                                    <Typography sx={{ px: 2.5, py: 4, fontSize: 13, color: "text.disabled", textAlign: "center" }}>
                                        일치하는 메시지가 없어요
                                    </Typography>
                                )
                            )}

                            {/* 멤버 */}
                            {(tab === "all" || tab === "members") && (
                                results.members.length > 0 ? (
                                    <>
                                        {tab === "all" && <SectionLabel label="멤버" count={results.members.length} />}
                                        {memberList.map((u) => (
                                            <Row key={u.userId} onClick={() => openMember(u.userId)}>
                                                <Avatar28 src={u.profileImageUrl} name={u.name} />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography sx={{ fontSize: 15, fontWeight: 600, color: "text.primary", textAlign: "left" }}>
                                                        {highlight(u.name)}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: 12, color: "text.disabled", textAlign: "left" }}>
                                                        {u.email}
                                                    </Typography>
                                                </Box>
                                                {/* 역할이 없거나 모르는 값이면 잘못된 라벨 대신 배지 자체를 숨김 */}
                                                {ROLE_LABEL[u.role] && (
                                                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "text.disabled", flexShrink: 0 }}>
                                                        {ROLE_LABEL[u.role]}
                                                    </Typography>
                                                )}
                                            </Row>
                                        ))}
                                    </>
                                ) : (!error && tab === "members") && (
                                    <Typography sx={{ px: 2.5, py: 4, fontSize: 13, color: "text.disabled", textAlign: "center" }}>
                                        일치하는 멤버가 없어요
                                    </Typography>
                                )
                            )}
                        </>
                    )}
                    </>
                )}

                {/* 로딩 */}
                {q && loading && (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                        <CircularProgress size={22} />
                    </Box>
                )}
            </Box>
        </Box>,
        document.body
    );
}
