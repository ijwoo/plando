import React, { useEffect, useMemo, useReducer, useRef } from "react";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";
import { Box } from "@mui/material";
import { createSlashCommand, SlashCommandMenu } from "./slashCommand.jsx";
import FormatBoldRoundedIcon from "@mui/icons-material/FormatBoldRounded";
import FormatItalicRoundedIcon from "@mui/icons-material/FormatItalicRounded";
import StrikethroughSRoundedIcon from "@mui/icons-material/StrikethroughSRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import FormatListNumberedRoundedIcon from "@mui/icons-material/FormatListNumberedRounded";
import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import TitleRoundedIcon from "@mui/icons-material/TitleRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import "./richText.css";

/**
 * 공용 마크다운 WYSIWYG 에디터 (TipTap v3 + tiptap-markdown).
 * - 저장 포맷은 마크다운 문자열 (백엔드 텍스트 컬럼 그대로 사용 — 스키마 변경 없음).
 * - 한글 IME는 ProseMirror가 안전하게 처리.
 * - 마크다운으로 표현 가능한 기능만 노출(밑줄/정렬/색 제외).
 *
 * @param {string}   value       마크다운 문자열 (외부 소스 = todo.content 등)
 * @param {Function} onChange    (markdown:string) => void
 * @param {boolean}  editable    편집 가능 여부 (false = 읽기 전용 렌더)
 * @param {string}   placeholder 빈 상태 안내문
 * @param {number}   minHeight   최소 높이(px)
 * @param {string[]} toolbar     노출할 버튼 키 (생략 시 전체)
 * @param {boolean}  slashMenu   true면 상시 툴바 대신 "/" 슬래시 커맨드 메뉴 사용
 */
const ALL_TOOLS = ["heading", "bold", "italic", "strike", "code", "bulletList", "orderedList", "blockquote", "link"];

export default function RichTextEditor({
    value = "",
    onChange,
    editable = true,
    placeholder = "내용을 입력하세요",
    minHeight = 96,
    toolbar = ALL_TOOLS,
    slashMenu = false,
    ariaLabel,
}) {
    // ── 슬래시 커맨드 팝업 모델 — 라이브 값(ref)으로 onKeyDown이 동기 처리, 렌더는 forceRender로 ──
    const menuRef = useRef({ open: false, items: [], index: 0, command: null, rect: null });
    const [, forceRender] = useReducer((x) => x + 1, 0);
    const patchMenu = (patch) => { menuRef.current = { ...menuRef.current, ...patch }; forceRender(); };

    // 확장에 넘길 handlers — 한 번만 생성(ref), 항상 최신 menuRef를 참조
    const slashHandlers = useRef({
        onStart: (props) => patchMenu({ open: true, items: props.items, index: 0, command: props.command, rect: props.clientRect }),
        onUpdate: (props) => patchMenu({
            items: props.items,
            command: props.command,
            rect: props.clientRect,
            index: Math.min(menuRef.current.index, Math.max(0, props.items.length - 1)),
        }),
        onKeyDown: ({ event }) => {
            const m = menuRef.current;
            if (!m.open) return false;
            // IME 조합 중 키는 조합 확정용(한글 "/제목" 검색어) — 메뉴가 삼키면 조합이 깨진다.
            // ProseMirror 네이티브 KeyboardEvent라 nativeEvent 없이 isComposing을 직접 본다.
            // false를 반환해 그대로 흘려보내면 이 Enter는 조합만 확정하고, 다음 Enter가 항목을 선택한다.
            if (event.isComposing || event.keyCode === 229) return false;
            const n = m.items.length;
            if (event.key === "ArrowDown") { patchMenu({ index: n ? (m.index + 1) % n : 0 }); return true; }
            if (event.key === "ArrowUp") { patchMenu({ index: n ? (m.index - 1 + n) % n : 0 }); return true; }
            if (event.key === "Enter") { const it = m.items[m.index]; if (it && m.command) m.command(it); return true; }
            if (event.key === "Escape") { patchMenu({ open: false }); return true; }
            return false;
        },
        onExit: () => patchMenu({ open: false }),
    }).current;

    const slashExtension = useMemo(
        () => (slashMenu ? createSlashCommand(slashHandlers) : null),
        [slashMenu, slashHandlers]
    );

    const editor = useEditor({
        editable,
        immediatelyRender: true,
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
                // 에디터 안에서 링크 클릭 시 이동 막기(편집 중 오작동 방지)
                link: { openOnClick: false, autolink: true },
            }),
            Markdown.configure({ html: false, transformPastedText: true, linkify: true }),
            Placeholder.configure({ placeholder }),
            ...(slashExtension ? [slashExtension] : []),
        ],
        content: value || "",
        onUpdate: ({ editor }) => {
            const md = editor.storage.markdown?.getMarkdown?.() ?? "";
            onChange?.(md);
        },
        editorProps: {
            attributes: {
                class: "plando-rte-content",
                ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
            },
        },
    });

    // editable prop 변경 동기화
    useEffect(() => {
        if (editor) editor.setEditable(editable);
    }, [editor, editable]);

    // 외부 value 변경(다른 todo 진입/서버 갱신) 시에만 콘텐츠 리셋 — 타이핑 중엔 동일값이라 skip(커서 유지)
    useEffect(() => {
        if (!editor) return;
        const current = editor.storage.markdown?.getMarkdown?.() ?? "";
        if ((value || "") !== current) {
            editor.commands.setContent(value || "", { emitUpdate: false });
        }
    }, [value, editor]);

    const st = useEditorState({
        editor,
        selector: (ctx) => {
            const e = ctx.editor;
            if (!e) return {};
            return {
                bold: e.isActive("bold"),
                italic: e.isActive("italic"),
                strike: e.isActive("strike"),
                code: e.isActive("code"),
                bulletList: e.isActive("bulletList"),
                orderedList: e.isActive("orderedList"),
                blockquote: e.isActive("blockquote"),
                heading: e.isActive("heading", { level: 2 }),
                link: e.isActive("link"),
            };
        },
    }) ?? {};

    if (!editor) return null;

    const run = (fn) => () => fn(editor.chain().focus()).run();
    const setLink = () => {
        const prev = editor.getAttributes("link")?.href ?? "";
        const url = window.prompt("링크 URL", prev);
        if (url === null) return;
        if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };

    const TOOLS = {
        heading:     { icon: <TitleRoundedIcon sx={{ fontSize: 17 }} />, title: "제목", active: st.heading, onClick: run((c) => c.toggleHeading({ level: 2 })) },
        bold:        { icon: <FormatBoldRoundedIcon sx={{ fontSize: 18 }} />, title: "굵게", active: st.bold, onClick: run((c) => c.toggleBold()) },
        italic:      { icon: <FormatItalicRoundedIcon sx={{ fontSize: 18 }} />, title: "기울임", active: st.italic, onClick: run((c) => c.toggleItalic()) },
        strike:      { icon: <StrikethroughSRoundedIcon sx={{ fontSize: 18 }} />, title: "취소선", active: st.strike, onClick: run((c) => c.toggleStrike()) },
        code:        { icon: <CodeRoundedIcon sx={{ fontSize: 18 }} />, title: "코드", active: st.code, onClick: run((c) => c.toggleCode()) },
        bulletList:  { icon: <FormatListBulletedRoundedIcon sx={{ fontSize: 18 }} />, title: "목록", active: st.bulletList, onClick: run((c) => c.toggleBulletList()) },
        orderedList: { icon: <FormatListNumberedRoundedIcon sx={{ fontSize: 18 }} />, title: "번호 목록", active: st.orderedList, onClick: run((c) => c.toggleOrderedList()) },
        blockquote:  { icon: <FormatQuoteRoundedIcon sx={{ fontSize: 18 }} />, title: "인용", active: st.blockquote, onClick: run((c) => c.toggleBlockquote()) },
        link:        { icon: <LinkRoundedIcon sx={{ fontSize: 18 }} />, title: "링크", active: st.link, onClick: setLink },
    };

    const m = menuRef.current;
    const selectSlash = (item) => { if (m.command) m.command(item); };

    return (
        <Box className="plando-rte" sx={{ "--plando-rte-min-h": `${minHeight}px` }}>
            {editable && !slashMenu && (
                <Box className="plando-rte-toolbar">
                    {toolbar.map((key) => {
                        const t = TOOLS[key];
                        if (!t) return null;
                        return (
                            <button
                                key={key}
                                type="button"
                                title={t.title}
                                aria-label={t.title}
                                aria-pressed={t.active || undefined}
                                className={`plando-rte-btn${t.active ? " is-active" : ""}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={t.onClick}
                            >
                                {t.icon}
                            </button>
                        );
                    })}
                </Box>
            )}
            <EditorContent editor={editor} className="plando-rte-editor" />
            {slashMenu && (
                <SlashCommandMenu
                    open={m.open}
                    anchorRect={m.rect}
                    items={m.items}
                    index={m.index}
                    onSelect={selectSlash}
                    onHover={(i) => patchMenu({ index: i })}
                />
            )}
        </Box>
    );
}
