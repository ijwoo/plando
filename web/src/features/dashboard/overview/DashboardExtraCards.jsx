import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RGL, { WidthProvider } from "react-grid-layout";
import { Box, Stack, Typography, IconButton, Menu, MenuItem, ListItemIcon, Tooltip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { useProjects } from "../../project/store/projectStore.js";
import { getProjectIcon } from "../../project/projectIcons.js";
import { getMySettings, updateMySettings } from "../../settings/api/settingsApi.js";
import EmptyState from "../../../shared/ui/common/EmptyState.jsx";

const readJSON = (k, fb) => { try { const r = JSON.parse(localStorage.getItem(k)); return Array.isArray(r) ? r : fb; } catch { return fb; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

const dashedBtnSx = {
    display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.25, py: 0.6, borderRadius: "10px",
    border: "1px dashed", borderColor: "divider", bgcolor: "transparent", cursor: "pointer",
    color: "primary.main", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
    "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
};
const inputSx = {
    flex: 1, minWidth: 0, height: 32, px: 1, borderRadius: "8px",
    border: "1px solid", borderColor: "divider", bgcolor: "var(--plando-surface-low)",
    color: "text.primary", fontFamily: "inherit", fontSize: 12.5, outline: "none",
};

function EmptyText({ children }) {
    return <Typography sx={{ fontSize: 12.5, color: "text.disabled", textAlign: "center", py: 2 }}>{children}</Typography>;
}

// ── 메모: 스티커 노트(추가 + 컬러 + 드래그 순서변경 + 크기조절), 워크스페이스별 localStorage ──
const NoteGrid = WidthProvider(RGL);
const STICKY_COLORS = ["#FEF08A", "#FBCFE8", "#BBF7D0", "#BFDBFE", "#DDD6FE", "#FED7AA"];
const NOTE_TEXT = "#3f3f46";
const NOTE_COLS = 2;
const NOTE_ROW_H = 24;
const NOTE_MARGIN = 8;
const uid = () => Math.random().toString(36).slice(2, 9);
// 카드 헤더의 + 버튼이 각 카드의 "추가"를 트리거 (단일 인스턴스가 구독)
export const ADD_STICKY_EVENT = "dashboard-add-sticky";
export const ADD_BOOKMARK_EVENT = "dashboard-add-bookmark";
export const ADD_FAVORITE_EVENT = "dashboard-add-favorite";

// 단일 스와치 + hover 시 팔레트(Tooltip 포털로 노트 overflow에 안 잘림)
function NoteColorPicker({ value, onPick }) {
    return (
        <Tooltip
            placement="top"
            slotProps={{
                tooltip: { sx: { bgcolor: "background.paper", border: "1px solid", borderColor: "divider", boxShadow: "var(--plando-shadow-card, 0 6px 20px rgba(15,23,42,0.18))", p: "5px", borderRadius: "10px" } },
            }}
            title={
                <Stack direction="row" spacing="4px">
                    {STICKY_COLORS.map((c) => (
                        <Box key={c} onClick={() => onPick(c)}
                            sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: c, cursor: "pointer", boxSizing: "border-box", border: value === c ? "2px solid rgba(0,0,0,0.5)" : "1px solid rgba(0,0,0,0.2)" }} />
                    ))}
                </Stack>
            }
        >
            <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: value, cursor: "pointer", flexShrink: 0, boxSizing: "border-box", border: "1px solid rgba(0,0,0,0.3)" }} />
        </Tooltip>
    );
}

// 저장된 노트를 {i,text,color,x,y,w,h}로 정규화(구버전/누락 좌표 보정)
function normalizeNotes(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((n, idx) => {
        const hasPos = Number.isFinite(n.x) && Number.isFinite(n.y);
        return {
            i: n.i || n.id || uid(),
            text: n.text || "",
            color: n.color || STICKY_COLORS[idx % STICKY_COLORS.length],
            x: hasPos ? n.x : idx % NOTE_COLS,
            y: hasPos ? n.y : Math.floor(idx / NOTE_COLS) * 4,
            w: n.w || 1,
            h: n.h || 4,
        };
    });
}

const stickyKey = (wsId) => `plando.dashStickies.${wsId}`;

export function MemoCard() {
    const { currentWorkspace } = useWorkspace();
    const wsId = currentWorkspace?.workspaceId ?? "none";
    const [notes, setNotes] = useState(() => normalizeNotes(readJSON(stickyKey(wsId), [])));
    const mapRef = useRef({});         // 서버 전체 맵 { wsId: notes[] } — 다른 ws 클로버 방지용
    const hydratedRef = useRef(false);
    const saveTimer = useRef(null);

    // 워크스페이스별 슬라이스 로드 (하이드레이션 후엔 서버 맵을 우선)
    useEffect(() => {
        const fromMap = hydratedRef.current ? mapRef.current[wsId] : null;
        setNotes(normalizeNotes(Array.isArray(fromMap) ? fromMap : readJSON(stickyKey(wsId), [])));
    }, [wsId]);

    // 변경 시: localStorage(현재 ws) 즉시 + 서버 맵 디바운스 저장
    const persist = useCallback((next) => {
        writeJSON(stickyKey(wsId), next);
        mapRef.current = { ...mapRef.current, [wsId]: next };
        if (!hydratedRef.current) return; // 하이드레이션 전엔 서버 저장 보류(다른 ws 덮어쓰기 방지)
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            updateMySettings({ dashboardStickies: JSON.stringify(mapRef.current) }).catch(() => {});
        }, 600);
    }, [wsId]);
    const update = (next) => { setNotes(next); persist(next); };

    // 서버에서 한 번 하이드레이션
    useEffect(() => {
        let alive = true;
        getMySettings().then((res) => {
            if (!alive) return;
            let map = {};
            try { const r = JSON.parse(res.data?.dashboardStickies || "null"); if (r && typeof r === "object" && !Array.isArray(r)) map = r; } catch { /* ignore */ }
            mapRef.current = map;
            hydratedRef.current = true;
            // 서버가 source of truth — 이 워크스페이스에 서버 메모가 없으면 빈 배열로 덮어써
            // 이전 사용자의 stale localStorage 메모가 남지 않게 한다.
            const serverNotes = Array.isArray(map[wsId]) ? map[wsId] : [];
            if (JSON.stringify(serverNotes) !== JSON.stringify(readJSON(stickyKey(wsId), []))) {
                const norm = normalizeNotes(serverNotes);
                setNotes(norm);
                writeJSON(stickyKey(wsId), norm);
            }
        }).catch(() => { hydratedRef.current = true; });
        return () => { alive = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const layout = useMemo(() => notes.map((n) => ({ i: n.i, x: n.x, y: n.y, w: n.w, h: n.h, minW: 1, minH: 2 })), [notes]);

    const onLayoutChange = (l) => {
        const byId = Object.fromEntries(l.map((it) => [it.i, it]));
        setNotes((prev) => {
            let changed = false;
            const next = prev.map((n) => {
                const it = byId[n.i];
                if (it && (it.x !== n.x || it.y !== n.y || it.w !== n.w || it.h !== n.h)) {
                    changed = true;
                    return { ...n, x: it.x, y: it.y, w: it.w, h: it.h };
                }
                return n;
            });
            if (changed) persist(next);
            return changed ? next : prev;
        });
    };

    // 함수형 업데이트 — 헤더 + 이벤트 리스너에서 호출돼도 최신 상태 보장
    const addNote = useCallback(() => {
        setNotes((prev) => {
            const maxY = prev.reduce((m, n) => Math.max(m, n.y + n.h), 0);
            const next = [...prev, { i: uid(), text: "", color: STICKY_COLORS[prev.length % STICKY_COLORS.length], x: 0, y: maxY, w: 1, h: 4 }];
            persist(next);
            return next;
        });
    }, [persist]);
    useEffect(() => {
        window.addEventListener(ADD_STICKY_EVENT, addNote);
        return () => window.removeEventListener(ADD_STICKY_EVENT, addNote);
    }, [addNote]);
    const setText = (i, text) => update(notes.map((n) => (n.i === i ? { ...n, text } : n)));
    const setColor = (i, color) => update(notes.map((n) => (n.i === i ? { ...n, color } : n)));
    const remove = (i) => update(notes.filter((n) => n.i !== i));

    // 메모가 0개면 카드가 통째로 백지였다 — 헤더 + 버튼으로 추가한다는 힌트가 없었다
    if (notes.length === 0) {
        return (
            <EmptyState
                emoji="🗒️"
                title="메모가 없어요"
                desc="떠오른 생각을 붙여두면 여기 모아 볼 수 있어요."
                action="메모 추가"
                onAction={addNote}
                size="sm"
            />
        );
    }

    return (
        <Box className="plando-scroll" sx={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}>
            <NoteGrid
                layout={layout}
                cols={NOTE_COLS}
                rowHeight={NOTE_ROW_H}
                margin={[NOTE_MARGIN, NOTE_MARGIN]}
                containerPadding={[0, 0]}
                draggableHandle=".note-drag-handle"
                resizeHandles={["se", "e", "s"]}
                compactType="vertical"
                onLayoutChange={onLayoutChange}
            >
                {notes.map((n) => (
                    <div key={n.i}>
                        <Box sx={{
                            height: "100%", bgcolor: n.color, borderRadius: "3px", p: 0.9,
                            display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
                            boxShadow: "0 6px 14px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12)",
                            backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(0,0,0,0.03))",
                            // 우하단 살짝 접힌 모서리 느낌
                            "&::after": {
                                content: '""', position: "absolute", right: 0, bottom: 0,
                                borderWidth: "0 0 14px 14px", borderStyle: "solid",
                                borderColor: "transparent transparent rgba(0,0,0,0.12) transparent",
                            },
                        }}>
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                                <Box className="note-drag-handle" sx={{ display: "flex", cursor: "grab", color: "rgba(0,0,0,0.35)", touchAction: "none", "&:active": { cursor: "grabbing" } }}>
                                    <DragIndicatorRoundedIcon sx={{ fontSize: 15 }} />
                                </Box>
                                <Box sx={{ flex: 1 }} />
                                <NoteColorPicker value={n.color} onPick={(c) => setColor(n.i, c)} />
                                <IconButton size="small" onClick={() => remove(n.i)} sx={{ p: 0.25, color: "rgba(0,0,0,0.45)" }}>
                                    <CloseRoundedIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                            </Stack>
                            <Box component="textarea" value={n.text} onChange={(e) => setText(n.i, e.target.value)} placeholder="메모…" className="plando-scroll"
                                sx={{ flex: 1, minHeight: 0, width: "100%", resize: "none", border: "none", outline: "none", bgcolor: "transparent", color: NOTE_TEXT, fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.5, "&::placeholder": { color: "rgba(0,0,0,0.32)" } }} />
                        </Box>
                    </div>
                ))}
            </NoteGrid>
        </Box>
    );
}

// ── 북마크: 외부 URL 목록(유저 전역, localStorage) ──────────────────────
const BM_KEY = "plando.dashBookmarks";
export function BookmarksCard() {
    const [items, setItems] = useState(() => readJSON(BM_KEY, []));
    const [adding, setAdding] = useState(false);
    const [url, setUrl] = useState("");
    const saveTimer = useRef(null);

    useEffect(() => {
        const open = () => setAdding(true);
        window.addEventListener(ADD_BOOKMARK_EVENT, open);
        return () => window.removeEventListener(ADD_BOOKMARK_EVENT, open);
    }, []);

    // 서버에서 하이드레이션 (DB = source of truth, 캐시와 다르면 적용)
    useEffect(() => {
        let alive = true;
        getMySettings().then((res) => {
            if (!alive) return;
            // 서버(UserSettings)가 source of truth. 서버에 없으면 빈 배열로 간주해
            // 이전 사용자의 stale localStorage가 남지 않도록 반드시 덮어쓴다.
            let parsed = [];
            try {
                const raw = res.data?.dashboardBookmarks;
                if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) parsed = p; }
            } catch { /* ignore */ }
            if (JSON.stringify(parsed) !== JSON.stringify(readJSON(BM_KEY, []))) {
                setItems(parsed);
                writeJSON(BM_KEY, parsed);
            }
        }).catch(() => {});
        return () => { alive = false; };
    }, []);

    // 변경 시: localStorage 즉시 + 서버 디바운스 저장
    const save = (next) => {
        setItems(next);
        writeJSON(BM_KEY, next);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            updateMySettings({ dashboardBookmarks: JSON.stringify(next) }).catch(() => {});
        }, 600);
    };
    const add = () => {
        const u = url.trim();
        if (!u) return;
        const full = /^https?:\/\//i.test(u) ? u : `https://${u}`;
        let label = full;
        try { label = new URL(full).hostname.replace(/^www\./, ""); } catch { /* keep */ }
        save([{ id: `${label}-${items.length}-${full.length}`, url: full, label }, ...items]);
        setUrl(""); setAdding(false);
    };

    return (
        <Stack sx={{ height: "100%", minHeight: 0 }}>
            <Box className="plando-scroll" sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {items.length === 0 ? <EmptyText>북마크가 없어요</EmptyText> : (
                    <Stack spacing={0.25}>
                        {items.map((b) => (
                            <Stack key={b.id} direction="row" alignItems="center" spacing={1}
                                sx={{ px: 1, py: 0.6, borderRadius: "8px", "&:hover": { bgcolor: "action.hover" } }}>
                                <BookmarkRoundedIcon sx={{ fontSize: 15, color: "primary.main", flexShrink: 0 }} />
                                <Typography component="a" href={b.url} target="_blank" rel="noopener noreferrer"
                                    sx={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: "text.primary", textDecoration: "none", "&:hover": { textDecoration: "underline" } }} noWrap>
                                    {b.label}
                                </Typography>
                                <IconButton size="small" component="a" href={b.url} target="_blank" rel="noopener noreferrer"
                                    aria-label="새 탭에서 열기" title="새 탭에서 열기"
                                    sx={{ color: "text.disabled", "&:hover": { color: "primary.main" } }}>
                                    <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                                <IconButton size="small" onClick={() => save(items.filter((x) => x.id !== b.id))} aria-label="북마크 삭제" sx={{ color: "text.disabled" }}>
                                    <CloseRoundedIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                            </Stack>
                        ))}
                    </Stack>
                )}
            </Box>
            {adding && (
                <Stack direction="row" spacing={0.5} sx={{ pt: 1 }}>
                    <Box component="input" autoFocus value={url} onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => {
                            // IME 조합 중 Enter 무시 — 조합 확정 Enter가 그대로 추가로 이어지지 않도록
                            if (e.key === "Enter") {
                                if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                                add();
                            }
                            if (e.key === "Escape") { setAdding(false); setUrl(""); }
                        }}
                        placeholder="https://..." sx={inputSx} />
                    <Box component="button" onClick={add} sx={{ ...dashedBtnSx, borderStyle: "solid", bgcolor: "var(--plando-primary-soft)" }}>추가</Box>
                </Stack>
            )}
        </Stack>
    );
}

// ── 즐겨찾기: 즐겨찾는 프로젝트(워크스페이스별, localStorage) ─────────────
export function FavoritesCard() {
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspace();
    const wsId = currentWorkspace?.workspaceId ?? "none";
    const keyOf = (id) => `plando.dashFavProjects.${id}`;
    const projects = useProjects();
    const [favIds, setFavIds] = useState(() => readJSON(keyOf(wsId), []));
    const [anchor, setAnchor] = useState(null);
    const rootRef = useRef(null);

    useEffect(() => { setFavIds(readJSON(keyOf(wsId), [])); }, [wsId]);
    useEffect(() => {
        const open = () => setAnchor(rootRef.current);
        window.addEventListener(ADD_FAVORITE_EVENT, open);
        return () => window.removeEventListener(ADD_FAVORITE_EVENT, open);
    }, []);

    const save = (next) => { setFavIds(next); writeJSON(keyOf(wsId), next); };
    const favProjects = favIds.map((id) => projects.find((p) => p.id === id)).filter(Boolean);
    const addable = projects.filter((p) => !favIds.includes(p.id));

    return (
        <Stack ref={rootRef} sx={{ height: "100%", minHeight: 0 }}>
            <Box className="plando-scroll" sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {favProjects.length === 0 ? <EmptyText>즐겨찾는 프로젝트가 없어요</EmptyText> : (
                    <Stack spacing={0.25}>
                        {favProjects.map((p) => {
                            const Icon = getProjectIcon(p.icon);
                            return (
                                <Stack key={p.id} direction="row" alignItems="center" spacing={1}
                                    sx={{ px: 1, py: 0.6, borderRadius: "8px", "&:hover": { bgcolor: "action.hover" } }}>
                                    <Icon sx={{ fontSize: 16, color: p.color, flexShrink: 0 }} />
                                    <Typography onClick={() => navigate(`/projects/${p.id}`)}
                                        sx={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, cursor: "pointer", "&:hover": { color: "primary.main" } }} noWrap>
                                        {p.name}
                                    </Typography>
                                    <IconButton size="small" onClick={() => save(favIds.filter((id) => id !== p.id))} sx={{ color: "var(--plando-orange)" }}>
                                        <StarRoundedIcon sx={{ fontSize: 15 }} />
                                    </IconButton>
                                </Stack>
                            );
                        })}
                    </Stack>
                )}
            </Box>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                {addable.length === 0 ? (
                    <MenuItem disabled sx={{ fontSize: 13 }}>추가할 프로젝트가 없어요</MenuItem>
                ) : addable.map((p) => {
                    const Icon = getProjectIcon(p.icon);
                    return (
                        <MenuItem key={p.id} onClick={() => { save([...favIds, p.id]); setAnchor(null); }} sx={{ fontSize: 13, fontWeight: 600 }}>
                            <ListItemIcon sx={{ minWidth: 28 }}><Icon sx={{ fontSize: 17, color: p.color }} /></ListItemIcon>
                            {p.name}
                        </MenuItem>
                    );
                })}
            </Menu>
        </Stack>
    );
}
