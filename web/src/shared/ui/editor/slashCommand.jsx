import React, { useEffect, useRef } from "react";
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { Box, Paper, Popper, Typography } from "@mui/material";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import TitleRoundedIcon from "@mui/icons-material/TitleRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import FormatListNumberedRoundedIcon from "@mui/icons-material/FormatListNumberedRounded";
import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import HorizontalRuleRoundedIcon from "@mui/icons-material/HorizontalRuleRounded";
import { Z } from "../zIndex.js";

// 슬래시 명령으로 삽입 가능한 블록 — 마크다운으로 표현 가능한 것만(밑줄/정렬/색 제외).
// command: 선택 시 "/쿼리"를 지운 뒤 해당 블록으로 변환.
const cmd = (fn) => ({ editor, range }) => fn(editor.chain().focus().deleteRange(range)).run();

export const SLASH_ITEMS = [
    { key: "text",  title: "텍스트",        subtitle: "일반 본문",          icon: <NotesRoundedIcon sx={{ fontSize: 18 }} />,              keywords: ["텍스트", "본문", "문단", "text", "paragraph", "p"], command: cmd((c) => c.setParagraph()) },
    { key: "h2",    title: "큰 제목",        subtitle: "섹션 제목",          icon: <TitleRoundedIcon sx={{ fontSize: 19 }} />,              keywords: ["제목", "큰제목", "heading", "title", "h1", "h2"],   command: cmd((c) => c.toggleHeading({ level: 2 })) },
    { key: "h3",    title: "작은 제목",      subtitle: "하위 제목",          icon: <TitleRoundedIcon sx={{ fontSize: 16 }} />,              keywords: ["제목", "작은제목", "부제목", "subheading", "h3"],    command: cmd((c) => c.toggleHeading({ level: 3 })) },
    { key: "bullet", title: "글머리 목록",   subtitle: "• 목록",             icon: <FormatListBulletedRoundedIcon sx={{ fontSize: 18 }} />, keywords: ["목록", "글머리", "리스트", "bullet", "list", "ul"],  command: cmd((c) => c.toggleBulletList()) },
    { key: "ordered", title: "번호 목록",    subtitle: "1. 목록",            icon: <FormatListNumberedRoundedIcon sx={{ fontSize: 18 }} />, keywords: ["번호", "순서", "목록", "ordered", "number", "ol"],   command: cmd((c) => c.toggleOrderedList()) },
    { key: "quote", title: "인용구",         subtitle: "인용 블록",          icon: <FormatQuoteRoundedIcon sx={{ fontSize: 18 }} />,        keywords: ["인용", "인용구", "quote", "blockquote"],            command: cmd((c) => c.toggleBlockquote()) },
    { key: "code",  title: "코드 블록",      subtitle: "고정폭 코드",        icon: <CodeRoundedIcon sx={{ fontSize: 18 }} />,               keywords: ["코드", "code", "codeblock", "pre"],                 command: cmd((c) => c.toggleCodeBlock()) },
    { key: "hr",    title: "구분선",         subtitle: "가로 줄",            icon: <HorizontalRuleRoundedIcon sx={{ fontSize: 18 }} />,     keywords: ["구분선", "divider", "hr", "rule", "line"],          command: cmd((c) => c.setHorizontalRule()) },
];

export function filterSlashItems(query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return SLASH_ITEMS;
    return SLASH_ITEMS.filter(
        (it) => it.title.toLowerCase().includes(q) || it.keywords.some((k) => k.toLowerCase().includes(q))
    );
}

/**
 * 슬래시("/") 커맨드 확장. render 라이프사이클을 외부 handlers로 위임해
 * RichTextEditor의 React 상태가 팝업을 그리도록 한다.
 */
export function createSlashCommand(handlers) {
    return Extension.create({
        name: "slashCommand",
        addProseMirrorPlugins() {
            return [
                Suggestion({
                    editor: this.editor,
                    char: "/",
                    allowSpaces: false,
                    startOfLine: false,
                    command: ({ editor, range, props }) => props.command({ editor, range }),
                    items: ({ query }) => filterSlashItems(query),
                    render: () => ({
                        onStart: handlers.onStart,
                        onUpdate: handlers.onUpdate,
                        onKeyDown: handlers.onKeyDown,
                        onExit: handlers.onExit,
                    }),
                }),
            ];
        },
    });
}

/**
 * 슬래시 커맨드 팝업 — 캐럿 위치(anchorRect)에 MUI Popper로 띄운다.
 * 키보드 내비게이션(↑/↓/Enter/Esc)은 에디터 쪽 onKeyDown이 처리하고 index만 내려받는다.
 */
export function SlashCommandMenu({ open, anchorRect, items, index, onSelect, onHover }) {
    const itemRefs = useRef([]);

    // 선택 항목이 보이도록 스크롤
    useEffect(() => {
        const el = itemRefs.current[index];
        if (el) el.scrollIntoView({ block: "nearest" });
    }, [index, open, items]);

    const anchorEl = anchorRect ? { getBoundingClientRect: anchorRect } : null;
    if (!open || !anchorEl) return null;

    return (
        <Popper
            open={open}
            anchorEl={anchorEl}
            placement="bottom-start"
            style={{ zIndex: Z.EDITOR_POPUP }}
            modifiers={[
                { name: "offset", options: { offset: [0, 6] } },
                { name: "flip", options: { fallbackPlacements: ["top-start"] } },
                { name: "preventOverflow", options: { padding: 8 } },
            ]}
        >
            <Paper
                elevation={0}
                onMouseDown={(e) => e.preventDefault()}
                sx={{
                    width: 260,
                    maxHeight: 300,
                    overflowY: "auto",
                    p: 0.75,
                    borderRadius: "12px",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "var(--plando-shadow-card, 0 10px 30px rgba(15,23,42,0.18))",
                    bgcolor: "background.paper",
                }}
                className="plando-scroll"
            >
                {items.length === 0 ? (
                    <Typography sx={{ px: 1.25, py: 1, fontSize: 12.5, color: "text.disabled" }}>
                        결과가 없어요
                    </Typography>
                ) : (
                    items.map((it, i) => (
                        <Box
                            key={it.key}
                            ref={(el) => (itemRefs.current[i] = el)}
                            onClick={() => onSelect(it)}
                            onMouseEnter={() => onHover(i)}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.25,
                                px: 1,
                                py: 0.75,
                                borderRadius: "8px",
                                cursor: "pointer",
                                bgcolor: i === index ? "action.hover" : "transparent",
                            }}
                        >
                            <Box
                                sx={{
                                    width: 30,
                                    height: 30,
                                    flexShrink: 0,
                                    display: "grid",
                                    placeItems: "center",
                                    borderRadius: "7px",
                                    border: "1px solid",
                                    borderColor: "divider",
                                    color: "text.secondary",
                                    bgcolor: "var(--plando-surface-low)",
                                }}
                            >
                                {it.icon}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary", lineHeight: 1.2 }} noWrap>
                                    {it.title}
                                </Typography>
                                <Typography sx={{ fontSize: 11, color: "text.disabled" }} noWrap>
                                    {it.subtitle}
                                </Typography>
                            </Box>
                        </Box>
                    ))
                )}
            </Paper>
        </Popper>
    );
}
