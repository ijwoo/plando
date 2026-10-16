import { useState, useRef, useEffect, useMemo } from "react";
import { useTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { resolveImageUrl } from "../shared/utils/urlUtils.js";
import { PRIORITY_LABEL, STATUS_LABEL } from "../shared/ui/tone.js";
import { formatTimeAgo } from "../shared/utils/formatters.js";
import { Z } from "../shared/ui/zIndex.js";
import useSearch from "../features/search/hooks/useSearch.js";
import useCommands, { filterCommands } from "../features/search/hooks/useCommands.js";
import { useOpenTodoDetail } from "../features/todo/hooks/useOpenTodoDetail.jsx";
import { loadRecents, pushRecent, dropRecent, clearRecents as clearRecentsStore } from "../features/search/utils/recentSearches.js";
import { loadRecentTodos, removeRecentTodo } from "../features/todo/utils/recentTodos.js";
import { ROLE_LABEL } from "../features/workspace/hooks/useWorkspacePermissions.js";
import TagChips from "../shared/ui/common/TagChips.jsx";

// 백엔드 enum → MUI palette key 매핑
const PRIO = {
    HIGH:   { colorKey:"error",   label: PRIORITY_LABEL.HIGH   },
    MEDIUM: { colorKey:"warning", label: PRIORITY_LABEL.MEDIUM },
    LOW:    { colorKey:"default", label: PRIORITY_LABEL.LOW    },
};
const STATUS = {
    TODO:        { colorKey:"default", label: STATUS_LABEL.TODO        },
    IN_PROGRESS: { colorKey:"primary", label: STATUS_LABEL.IN_PROGRESS },
    DONE:        { colorKey:"success", label: STATUS_LABEL.DONE        },
};

// ─────────────────────────────────────────────────────────────────
// GlobalSearch — Command Palette
// ─────────────────────────────────────────────────────────────────
export function GlobalSearch({ open, onClose }) {
    const theme  = useTheme();
    const isDark = theme.palette.mode === "dark";
    const navigate = useNavigate();

    const [tab, setTab]       = useState("all");
    const [selIdx, setSelIdx] = useState(0);
    const inputRef            = useRef(null);

    const { q, setQ, results, loading, error, retry, totalCount, tooShort, hasMoreTasks, loadMore, loadingMore } = useSearch(open);
    const openTodoDetail = useOpenTodoDetail();

    // ── 최근 검색어 / 최근 본 항목 (모바일과 동일, 워크스페이스별) ──
    const [recents, setRecents] = useState(loadRecents);
    const [recentTodos, setRecentTodos] = useState(loadRecentTodos);
    const recordSearch = () => setRecents(pushRecent(q));
    const removeRecent = (query) => setRecents(dropRecent(query));
    const clearRecents = () => setRecents(clearRecentsStore());

    const goTo = (path, state) => { recordSearch(); navigate(path, state ? { state } : undefined); onClose(); };
    const openTask   = (id)     => { recordSearch(); openTodoDetail(id); onClose(); };
    const openMsg    = (roomId) => goTo("/dm", { openRoomId: roomId });
    const openMember = (userId) => goTo("/dm", { openPartnerId: userId });
    const openProject = (id)    => goTo(`/projects/${id}`);
    // 태그 → 할 일 목록 + 그 태그로 필터 (TaskListPage가 location.state.tagId를 소비)
    const openTag     = (id)    => goTo("/tasklist", { tagId: id });

    // 최근 본 항목 — 못 열면(삭제 등) 목록에서 제거
    const openRecentTodo = async (id) => {
        const ok = await openTodoDetail(id);
        if (!ok) { removeRecentTodo(id); setRecentTodos(loadRecentTodos()); return; }
        onClose();
    };

    // ── 명령(Command) 팔레트 — 공용 레지스트리 ───────────────────
    const commands = useCommands();
    const exec = (cmd) => { cmd?.run?.(); onClose(); };
    const cmdMatches = useMemo(() => filterCommands(commands, q), [commands, q]);

    // Palette 열릴 때 초기화 + 포커스
    useEffect(() => {
        if (open) {
            setTab("all");
            setSelIdx(0);
            setRecents(loadRecents());
            setRecentTodos(loadRecentTodos());
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    useEffect(() => { setSelIdx(0); }, [q, tab]);

    // ── 테마에서 색상 추출 ────────────────────────────────────────
    const pc = (key) => {
        if (key === "default") return theme.palette.text.secondary;
        return theme.palette[key]?.main ?? theme.palette.primary.main;
    };

    const surface   = theme.palette.background.paper;
    const divider   = theme.palette.divider;
    const textPri   = theme.palette.text.primary;
    const textSec   = theme.palette.text.secondary;
    const primary   = theme.palette.primary.main;
    const hoverBg   = theme.palette.action.hover;
    const kbdBg     = alpha(textPri, isDark ? 0.07 : 0.04);
    const footerBg  = alpha(textPri, isDark ? 0.03 : 0.015);

    // ── 키보드 네비게이션 ─────────────────────────────────────────
    const showQuick = !q;
    const cmdList   = (q && tab === "all") ? cmdMatches : [];
    // 렌더 순서(할 일 → 프로젝트 → 태그 → 메시지 → 멤버)와 반드시 같아야 선택 인덱스가 어긋나지 않는다
    const dataList  = tab === "all"
        ? [...results.tasks.slice(0,4), ...results.projects.slice(0,3), ...results.tags.slice(0,3), ...results.messages.slice(0,3), ...results.members.slice(0,4)]
        : results[tab] ?? [];
    // 빈 상태: 최근 본 항목 + 최근 검색어 (키보드 네비 대상)
    const quickList = showQuick
        ? [
            ...recentTodos.map((t) => ({ kind:"recentTodo", ...t })),
            ...recents.map((query) => ({ kind:"recentQuery", query })),
        ]
        : [];
    const flatList  = showQuick ? quickList : [...cmdList, ...dataList];

    useEffect(() => {
        const fn = (e) => {
            if (!open) return;
            if (e.key === "Escape")    { e.preventDefault(); onClose(); return; }
            if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i + 1, flatList.length - 1)); }
            if (e.key === "ArrowUp")   { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)); }
            if (e.key === "Enter") {
                // IME 조합 중 Enter는 조합 확정용 — 항목 실행/preventDefault 하지 않는다.
                // 네이티브 KeyboardEvent라 nativeEvent가 없어 e.isComposing을 직접 본다.
                if (e.isComposing || e.keyCode === 229) return;
                e.preventDefault();
                const item = flatList[selIdx];
                if (!item) return;
                if (item.kind === "recentTodo") { openRecentTodo(item.id); }
                else if (item.kind === "recentQuery") { setQ(item.query); }
                else if (typeof item.run === "function") { exec(item); }
                else if ("priority" in item || "status" in item) { openTask(item.id); }
                // 프로젝트는 id/name만 있어 할 일과 겹친다 — openCount로 구분 (할 일 판별 뒤에 둔다)
                else if ("openCount" in item) { openProject(item.id); }
                // 태그도 id/name/color라 프로젝트와 겹친다 — todoCount로 구분
                else if ("todoCount" in item) { openTag(item.id); }
                else if ("roomId" in item) { openMsg(item.roomId); }
                else if ("userId" in item) { openMember(item.userId); }
            }
        };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, flatList, selIdx, onClose]);

    if (!open) return null;

    // ── 인라인 서브 컴포넌트 (테마 클로저 사용) ───────────────────

    const Kbd = ({ children }) => (
        <kbd style={{ fontSize:9, color:textSec, background:kbdBg, border:`1px solid ${divider}`, borderRadius:4, padding:"2px 6px", fontFamily:"inherit" }}>
            {children}
        </kbd>
    );

    const PrioBadge = ({ priority }) => {
        const p = PRIO[priority];
        if (!p) return null;
        const color = pc(p.colorKey);
        return (
            <span style={{ fontSize:9, color, fontWeight:800, flexShrink:0, background:alpha(color, isDark ? 0.15 : 0.10), border:`1px solid ${alpha(color, 0.28)}`, borderRadius:4, padding:"2px 7px" }}>
                {p.label}
            </span>
        );
    };

    /* 보관된 할 일도 검색 결과에 섞여 나오므로 살아 있는 항목과 눈으로 구분되게 표시.
       (어느 것이 보관인지는 검색 응답이 아니라 훅이 별도로 받아 둔 id 집합으로 판별) */
    const ArchivedBadge = () => (
        <span style={{ fontSize:9, color:textSec, fontWeight:700, flexShrink:0, background:alpha(textSec, isDark ? 0.16 : 0.10), border:`1px solid ${alpha(textSec, 0.24)}`, borderRadius:4, padding:"2px 7px" }}>
            보관
        </span>
    );

    const StatusBadge = ({ status }) => {
        const s = STATUS[status];
        if (!s) return null;
        const color = pc(s.colorKey);
        return (
            <span style={{ fontSize:9, color, fontWeight:700, flexShrink:0, background:alpha(color, isDark ? 0.15 : 0.10), border:`1px solid ${alpha(color, 0.28)}`, borderRadius:4, padding:"2px 7px" }}>
                {s.label}
            </span>
        );
    };

    const EmptyTab = ({ label }) => (
        <div style={{ textAlign:"center", padding:"32px 0", color:textSec }}>
            <div style={{ fontSize:24, marginBottom:8, opacity:0.4 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:"inline-block" }}>
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
            </div>
            <div style={{ fontSize:13, fontWeight:600 }}>{label} 결과 없음</div>
            <div style={{ fontSize:11, marginTop:4, opacity:0.7 }}>"{q}"와 일치하는 {label}이(가) 없습니다</div>
        </div>
    );

    const ResultRow = ({ children, onClick, isSelected }) => (
        <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, cursor:"pointer", transition:"background 0.1s", marginBottom:2, background: isSelected ? hoverBg : "transparent" }}
            onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = isSelected ? hoverBg : "transparent"; }}
        >
            {children}
            {isSelected && (
                <kbd style={{ fontSize:9, color:textSec, background:kbdBg, border:`1px solid ${divider}`, borderRadius:4, padding:"2px 5px", fontFamily:"inherit", flexShrink:0 }}>↵</kbd>
            )}
        </div>
    );

    const SectionHeader = ({ label, count }) => (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, padding:"0 2px" }}>
            <span style={{ fontSize:10, color:textSec, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</span>
            <span style={{ fontSize:9, color:primary, background:alpha(primary, 0.12), borderRadius:99, padding:"1px 6px", fontWeight:700 }}>{count}</span>
        </div>
    );

    const highlight = (text) => {
        if (!q || !text) return text ?? "";
        const lower = text.toLowerCase();
        const idx = lower.indexOf(q.toLowerCase());
        if (idx === -1) return text;
        return (
            <>
                {text.slice(0, idx)}
                <span style={{ color:primary, fontWeight:800, background:alpha(primary, 0.12) }}>
                    {text.slice(idx, idx + q.length)}
                </span>
                {text.slice(idx + q.length)}
            </>
        );
    };

    // 할 일은 페이징되므로 "지금까지 받은 개수 + 더 있음(+)"으로 표기 — 이게 전부라는 오해 방지
    const taskCountLabel = `${results.tasks.length}${hasMoreTasks ? "+" : ""}`;
    const TABS = [
        { id:"all",      label:`전체 (${totalCount}${hasMoreTasks ? "+" : ""})` },
        { id:"tasks",    label:`할 일 (${taskCountLabel})` },
        { id:"projects", label:`프로젝트 (${results.projects.length})` },
        { id:"tags",     label:`태그 (${results.tags.length})` },
        { id:"messages", label:`메시지 (${results.messages.length})` },
        { id:"members",  label:`멤버 (${results.members.length})` },
    ];

    // ── flatList 내 섹션별 시작 인덱스 (tab all일 때 명령이 맨 앞) ──
    const cmdCount   = (q && tab === "all") ? cmdMatches.length : 0;
    const taskBase   = cmdCount;
    const projBase   = tab === "all" ? taskBase + Math.min(4, results.tasks.length) : 0;
    const tagBase    = tab === "all" ? projBase + Math.min(3, results.projects.length) : 0;
    const msgBase    = tab === "all" ? tagBase  + Math.min(3, results.tags.length) : 0;
    const memberBase = tab === "all" ? msgBase  + Math.min(3, results.messages.length) : 0;

    // ── Render ────────────────────────────────────────────────────

    return (
        <div
            onClick={onClose}
            style={{ position:"fixed", inset:0, zIndex:Z.OVERLAY_TOP, background: isDark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.08)", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:"max(calc(env(safe-area-inset-top, 0px) + 16px), 80px)" }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ width:"min(640px, calc(100vw - 24px))", maxHeight:"70vh", background:surface, border:`1px solid ${divider}`, borderRadius:16, overflow:"hidden", boxShadow: isDark ? "0 32px 80px rgba(0,0,0,0.55)" : "0 16px 48px rgba(0,0,0,0.10)", display:"flex", flexDirection:"column" }}
            >
                {/* 검색 입력 */}
                <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 18px", borderBottom:`1px solid ${divider}`, flexShrink:0 }}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                        <circle cx="9" cy="9" r="6.5" stroke={textSec} strokeWidth="1.8"/>
                        <path d="M14 14l4 4" stroke={textSec} strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    <input
                        ref={inputRef}
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="명령 실행 또는 할 일·메시지·멤버 검색..."
                        style={{ flex:1, background:"none", border:"none", outline:"none", fontSize:16, color:textPri, caretColor:primary, fontFamily:"inherit" }}
                    />
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        {loading && (
                            <div style={{ width:16, height:16, border:`2px solid ${alpha(primary, 0.3)}`, borderTopColor:primary, borderRadius:"50%", animation:"spin 0.6s linear infinite" }}/>
                        )}
                        {q && !loading && (
                            <button onClick={() => setQ("")} style={{ background:"none", border:"none", cursor:"pointer", color:textSec, fontSize:16, lineHeight:1 }}>✕</button>
                        )}
                        <Kbd>ESC</Kbd>
                    </div>
                </div>

                {/* 탭 (쿼리 있을 때만) */}
                {q && (
                    <div style={{ display:"flex", padding:"0 14px", borderBottom:`1px solid ${divider}`, flexShrink:0 }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"9px 14px", border:"none", cursor:"pointer", background:"none", fontSize:11, fontWeight:700, color: tab === t.id ? primary : textSec, borderBottom: tab === t.id ? `2px solid ${primary}` : "2px solid transparent", transition:"color 0.15s" }}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* 컨텐츠 */}
                <div style={{ flex:1, overflow:"auto" }}>

                    {/* 최근 기록 (쿼리 없을 때) — 최근 본 항목 + 최근 검색 */}
                    {showQuick && (
                        <div style={{ padding:"12px 16px" }}>
                            {quickList.length === 0 ? (
                                <div style={{ textAlign:"center", padding:"40px 0", color:textSec }}>
                                    <div style={{ fontSize:13, fontWeight:600 }}>최근 기록이 없어요</div>
                                    <div style={{ fontSize:11, marginTop:4, opacity:0.7 }}>할 일·메시지·멤버를 검색해 보세요</div>
                                </div>
                            ) : (
                                <>
                                    {/* 최근 본 항목 */}
                                    {recentTodos.length > 0 && (
                                        <div style={{ marginBottom:16 }}>
                                            <SectionHeader label="최근 본 항목" count={recentTodos.length} />
                                            {recentTodos.map((t, i) => (
                                                <ResultRow key={`rt-${t.id}`} onClick={() => openRecentTodo(t.id)} isSelected={selIdx === i}>
                                                    <div style={{ width:6, height:6, borderRadius:"50%", flexShrink:0, background: pc((STATUS[t.status] ?? STATUS.TODO).colorKey) }}/>
                                                    <span style={{ flex:1, minWidth:0, fontSize:13, fontWeight:600, color:textPri, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</span>
                                                    {t.status && <StatusBadge status={t.status} />}
                                                </ResultRow>
                                            ))}
                                        </div>
                                    )}

                                    {/* 최근 검색 */}
                                    {recents.length > 0 && (
                                        <div>
                                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, padding:"0 2px" }}>
                                                <span style={{ fontSize:10, color:textSec, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>최근 검색</span>
                                                <button onClick={clearRecents} style={{ border:"none", background:"none", cursor:"pointer", fontSize:11, color:textSec, fontWeight:600 }}>전체 삭제</button>
                                            </div>
                                            {recents.map((query, j) => {
                                                const idx = recentTodos.length + j;
                                                return (
                                                    <ResultRow key={`rq-${query}`} onClick={() => setQ(query)} isSelected={selIdx === idx}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={textSec} strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0 }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                                                        <span style={{ flex:1, minWidth:0, fontSize:13, color:textPri, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{query}</span>
                                                        <button onClick={(e) => { e.stopPropagation(); removeRecent(query); }} style={{ border:"none", background:"none", cursor:"pointer", fontSize:15, color:textSec, lineHeight:1, padding:"0 4px", flexShrink:0 }} aria-label="삭제">×</button>
                                                    </ResultRow>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* 검색 결과 */}
                    {q && !loading && (
                        <div style={{ padding:"10px 16px" }}>
                            {/* 요청 실패는 "결과 없음"과 구분한다 — 서버 오류·오프라인일 때 results가 빈 값으로
                                리셋되면서 사용자가 "그런 항목이 없다"고 오해했고 재시도할 방법도 없었다.
                                (로컬에서 매칭되는 명령은 검색 실패와 무관하므로 아래에서 계속 렌더한다) */}
                            {error && (
                                <div style={{ textAlign:"center", padding:"32px 0", color:textSec }}>
                                    <div style={{ fontSize:14, color:theme.palette.error.main, fontWeight:600 }}>검색하지 못했어요</div>
                                    <div style={{ fontSize:12, marginTop:4 }}>잠시 후 다시 시도해주세요</div>
                                    <button onClick={retry} style={{ marginTop:14, padding:"7px 16px", borderRadius:999, border:"none", cursor:"pointer", background:alpha(primary, isDark ? 0.18 : 0.10), color:primary, fontSize:12.5, fontWeight:700, fontFamily:"inherit" }}>
                                        다시 시도
                                    </button>
                                </div>
                            )}
                            {!error && (totalCount === 0 && cmdCount === 0) ? (
                                <div style={{ textAlign:"center", padding:"40px 0", color:textSec }}>
                                    <div style={{ fontSize:14 }}>
                                        {tooShort ? "두 글자 이상 입력해주세요" : `"${q}"에 대한 결과가 없습니다`}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* 명령 */}
                                    {tab === "all" && cmdMatches.length > 0 && (
                                        <div style={{ marginBottom:16 }}>
                                            <SectionHeader label="명령" count={cmdMatches.length} />
                                            {cmdMatches.map((c, i) => {
                                                const Icon = c.icon;
                                                return (
                                                    <ResultRow key={c.id} onClick={() => exec(c)} isSelected={selIdx === i}>
                                                        <div style={{ width:26, height:26, borderRadius:7, flexShrink:0, background:alpha(textPri, isDark ? 0.06 : 0.04), display:"flex", alignItems:"center", justifyContent:"center", color:textSec }}>
                                                            {Icon && <Icon size={15} strokeWidth={1.75} />}
                                                        </div>
                                                        <div style={{ flex:1, minWidth:0 }}>
                                                            <div style={{ fontSize:13, fontWeight:600, color:textPri, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                                                {highlight(c.label)}
                                                            </div>
                                                        </div>
                                                        <span style={{ fontSize:9, fontWeight:700, flexShrink:0, color:textSec, background:alpha(textSec, isDark ? 0.12 : 0.08), borderRadius:99, padding:"2px 8px" }}>
                                                            {c.group}
                                                        </span>
                                                    </ResultRow>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* 할 일 */}
                                    {(tab==="all"||tab==="tasks") && (
                                        results.tasks.length > 0 ? (
                                            <div style={{ marginBottom:16 }}>
                                                <SectionHeader label="할 일" count={taskCountLabel} />
                                                {results.tasks.slice(0, tab==="all" ? 4 : 999).map((t, i) => {
                                                    const isArchived = t.archived === true; // 서버 값 (예전엔 보관 목록을 따로 받아 대조했다)
                                                    return (
                                                    <ResultRow key={t.id} onClick={() => openTask(t.id)} isSelected={selIdx === taskBase + i}>
                                                        <div style={{ width:6, height:6, borderRadius:"50%", background: pc((PRIO[t.priority] ?? PRIO.LOW).colorKey), flexShrink:0, opacity: isArchived ? 0.45 : 1 }}/>
                                                        <div style={{ flex:1, minWidth:0 }}>
                                                            {/* 보관 항목은 제목 톤을 낮춰 배지를 못 봐도 구분되게 */}
                                                            <div style={{ fontSize:13, fontWeight:600, color: isArchived ? textSec : textPri, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                                                {highlight(t.title)}
                                                            </div>
                                                            {(t.dueDate || t.assignees?.length > 0) && (
                                                                <div style={{ fontSize:10, color:textSec, marginTop:2 }}>
                                                                    {t.dueDate}{t.assignees?.length > 0 && ` · ${t.assignees[0].name}${t.assignees.length > 1 ? ` 외 ${t.assignees.length - 1}명` : ""}`}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {isArchived && <ArchivedBadge />}
                                                        <PrioBadge priority={t.priority} />
                                                        <StatusBadge status={t.status} />
                                                    </ResultRow>
                                                    );
                                                })}
                                                {/* '더 보기'는 전체 목록을 보는 할 일 탭에서만 — 전체 탭은 4건만 미리보기라 의미가 없다.
                                                    불러오는 동안에도 기존 행은 그대로 두고 버튼 라벨만 바뀐다. */}
                                                {tab === "tasks" && hasMoreTasks && (
                                                    <div style={{ display:"flex", justifyContent:"center", paddingTop:6 }}>
                                                        <button
                                                            onClick={loadMore}
                                                            disabled={loadingMore}
                                                            style={{ padding:"7px 18px", borderRadius:999, border:"none", cursor: loadingMore ? "default" : "pointer", background:alpha(primary, isDark ? 0.18 : 0.10), color:primary, fontSize:12, fontWeight:700, fontFamily:"inherit", opacity: loadingMore ? 0.6 : 1 }}
                                                        >
                                                            {loadingMore ? "불러오는 중…" : "더 보기"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (!error && tab === "tasks") && <EmptyTab label="할 일" />
                                    )}

                                    {/* 프로젝트 */}
                                    {(tab==="all"||tab==="projects") && (
                                        results.projects.length > 0 ? (
                                            <div style={{ marginBottom:16 }}>
                                                <SectionHeader label="프로젝트" count={results.projects.length} />
                                                {results.projects.slice(0, tab==="all" ? 3 : 999).map((p, i) => (
                                                    <ResultRow key={p.id} onClick={() => openProject(p.id)} isSelected={selIdx === projBase + i}>
                                                        {/* 점 색은 프로젝트가 지정한 색 그대로 — 없으면 테마 중립색 */}
                                                        <div style={{ width:8, height:8, borderRadius:3, background: p.color || textSec, flexShrink:0 }}/>
                                                        <div style={{ flex:1, minWidth:0, fontSize:13, fontWeight:600, color:textPri, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                                            {highlight(p.name)}
                                                        </div>
                                                        <span style={{ fontSize:10, color:textSec, flexShrink:0, whiteSpace:"nowrap" }}>
                                                            미완료 {p.openCount ?? 0}
                                                        </span>
                                                    </ResultRow>
                                                ))}
                                            </div>
                                        ) : (!error && tab === "projects") && <EmptyTab label="프로젝트" />
                                    )}

                                    {/* 태그 */}
                                    {(tab==="all"||tab==="tags") && (
                                        results.tags.length > 0 ? (
                                            <div style={{ marginBottom:16 }}>
                                                <SectionHeader label="태그" count={results.tags.length} />
                                                {results.tags.slice(0, tab==="all" ? 3 : 999).map((tg, i) => (
                                                    <ResultRow key={tg.id} onClick={() => openTag(tg.id)} isSelected={selIdx === tagBase + i}>
                                                        {/* 태그는 자기 색 칩이 곧 식별자 — 목록/카드와 같은 TagChips를 그대로 쓴다 */}
                                                        <div style={{ flex:1, minWidth:0 }}>
                                                            <TagChips tags={[tg]} max={1} size="md" />
                                                        </div>
                                                        <span style={{ fontSize:10, color:textSec, flexShrink:0, whiteSpace:"nowrap" }}>
                                                            할 일 {tg.todoCount ?? 0}
                                                        </span>
                                                    </ResultRow>
                                                ))}
                                            </div>
                                        ) : (!error && tab === "tags") && <EmptyTab label="태그" />
                                    )}

                                    {/* 메시지 */}
                                    {(tab==="all"||tab==="messages") && (
                                        results.messages.length > 0 ? (
                                            <div style={{ marginBottom:16 }}>
                                                <SectionHeader label="메시지" count={results.messages.length} />
                                                {results.messages.slice(0, tab==="all" ? 3 : 999).map((m, i) => (
                                                    <ResultRow key={m.roomId} onClick={() => openMsg(m.roomId)} isSelected={selIdx === msgBase + i}>
                                                        {m.partnerProfileImageUrl ? (
                                                            <img src={resolveImageUrl(m.partnerProfileImageUrl)} style={{ width:28, height:28, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} alt="" />
                                                        ) : (
                                                            <div style={{ width:28, height:28, borderRadius:"50%", background:alpha(primary, 0.75), display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:800, flexShrink:0 }}>
                                                                {m.partnerName?.[0] ?? "?"}
                                                            </div>
                                                        )}
                                                        <div style={{ flex:1, minWidth:0 }}>
                                                            <div style={{ fontSize:13, fontWeight:700, color:textPri }}>{highlight(m.partnerName)}</div>
                                                            <div style={{ fontSize:11, color:textSec, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                                                {highlight(m.lastMessage)}
                                                            </div>
                                                        </div>
                                                        <span style={{ fontSize:10, color:textSec, flexShrink:0, whiteSpace:"nowrap" }}>
                                                            {m.sentAt ? formatTimeAgo(m.sentAt) : ""}
                                                        </span>
                                                    </ResultRow>
                                                ))}
                                            </div>
                                        ) : (!error && tab === "messages") && <EmptyTab label="메시지" />
                                    )}

                                    {/* 멤버 */}
                                    {(tab==="all"||tab==="members") && (
                                        results.members.length > 0 ? (
                                            <div style={{ marginBottom:16 }}>
                                                <SectionHeader label="멤버" count={results.members.length} />
                                                {results.members.slice(0, tab==="all" ? 4 : 999).map((u, i) => (
                                                    <ResultRow key={u.userId} onClick={() => openMember(u.userId)} isSelected={selIdx === memberBase + i}>
                                                        <div style={{ flexShrink:0 }}>
                                                            {u.profileImageUrl ? (
                                                                <img src={resolveImageUrl(u.profileImageUrl)} style={{ width:28, height:28, borderRadius:"50%", objectFit:"cover" }} alt="" />
                                                            ) : (
                                                                <div style={{ width:28, height:28, borderRadius:"50%", background:alpha(primary, isDark ? 0.5 : 0.4), display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:800 }}>
                                                                    {u.name?.[0] ?? "?"}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ flex:1, minWidth:0 }}>
                                                            <div style={{ fontSize:13, fontWeight:700, color:textPri }}>{highlight(u.name)}</div>
                                                            <div style={{ fontSize:10, color:textSec }}>{u.email}</div>
                                                        </div>
                                                        {/* 역할이 없거나 모르는 값이면 잘못된 라벨 대신 배지 자체를 숨김 */}
                                                        {ROLE_LABEL[u.role] && (
                                                            <span style={{ fontSize:9, fontWeight:700, flexShrink:0, color: textSec, background:alpha(textSec, isDark ? 0.12 : 0.08), borderRadius:99, padding:"2px 8px" }}>
                                                                {ROLE_LABEL[u.role]}
                                                            </span>
                                                        )}
                                                    </ResultRow>
                                                ))}
                                            </div>
                                        ) : (!error && tab === "members") && <EmptyTab label="멤버" />
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* 로딩 스켈레톤 */}
                    {q && loading && (
                        <div style={{ padding:"10px 16px" }}>
                            {[...Array(4)].map((_, i) => (
                                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", marginBottom:4 }}>
                                    <div style={{ width:6, height:6, borderRadius:"50%", background:alpha(textSec, 0.2), flexShrink:0 }}/>
                                    <div style={{ flex:1, height:13, borderRadius:4, background:alpha(textSec, 0.1), animation:"pulse 1.2s ease-in-out infinite" }}/>
                                    <div style={{ width:32, height:13, borderRadius:4, background:alpha(textSec, 0.08) }}/>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 18px", borderTop:`1px solid ${divider}`, background:footerBg, flexShrink:0 }}>
                    <div style={{ display:"flex", gap:14 }}>
                        {[["↑↓","탐색"], ["↵","선택"], ["ESC","닫기"]].map(([k, l]) => (
                            <div key={k} style={{ display:"flex", alignItems:"center", gap:5 }}>
                                <Kbd>{k}</Kbd>
                                <span style={{ fontSize:10, color:textSec }}>{l}</span>
                            </div>
                        ))}
                    </div>
                    <span style={{ fontSize:10, color:textSec }}>
                        {q ? `${totalCount + cmdCount}${hasMoreTasks ? "+" : ""}개 결과` : "PlanDo! 명령 팔레트"}
                    </span>
                </div>
            </div>

            {/* 스피너 / 펄스 애니메이션 */}
            <style>{`
                @keyframes spin  { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
            `}</style>
        </div>
    );
}
