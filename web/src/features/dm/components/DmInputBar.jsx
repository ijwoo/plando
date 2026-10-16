import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, Typography, CircularProgress, IconButton } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import TextFieldsRoundedIcon from "@mui/icons-material/TextFieldsRounded";
import EmojiEmotionsRoundedIcon from "@mui/icons-material/EmojiEmotionsRounded";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { blurSx } from "../../../shared/ui/glassSx.js";
import { Z } from "../../../shared/ui/zIndex.js";
import MentionPicker from "../../../shared/ui/common/MentionPicker.jsx";
import TodoMentionPicker from "../../../shared/ui/common/TodoMentionPicker.jsx";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { getWorkspaceMembers } from "../../workspace/api/workspaceMemberApi.js";
import { fetchTodos } from "../../todo/api/todoApi.js";
import { NOTICE_COLOR } from "../constants/dmTags.js";

const SlashIcon = ({ color = "#666" }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.8" />
        <path d="M15 8l-6 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

export default function DmInputBar({ room, state, actions, refs, ui, isDesktop = false }) {
    const displayName = room?.isGroup
        ? (room?.groupName || "그룹 채팅")
        : (room?.partnerName || "");
    const {
        text,
        sending,
        inputFocused,
        emojiOpen,
        kbOffset,
    } = state;

    const {
        setText,
        setInputFocused,
        setEmojiOpen,
        handleKeyDown,
        handleSend,
        openInput,
        insertAtCursor,
        wrapSelection,
        sendFile,
        onAttachTodo,
        onSelectTodo,
    } = actions;

    const { inputRef } = refs;

    const fileInputRef = useRef(null);
    const [localFile, setLocalFile] = useState(null); // { file, previewUrl }
    const [selectedTag, setSelectedTag] = useState(null);
    const isNotice = selectedTag === "NOTICE";

    const toggleNotice = useCallback(() => {
        setSelectedTag((cur) => (cur === "NOTICE" ? null : "NOTICE"));
    }, []);

    const sendWithExtras = useCallback(() => {
        handleSend?.({ tag: selectedTag });
        setSelectedTag(null);
    }, [handleSend, selectedTag]);

    // ── @ 자동완성 (그룹 톡방에서만 활성) ──
    // 1:1은 받을 사람이 한 명뿐이라 멘션 자체가 의미 없음. picker/@ 버튼 모두 비활성.
    const { currentWorkspace } = useWorkspace();
    const [members, setMembers] = useState([]);
    const [mentionQuery, setMentionQuery] = useState(null);
    const isGroupRoom = !!room?.isGroup;

    useEffect(() => {
        const wsId = currentWorkspace?.workspaceId;
        if (!wsId || !isGroupRoom) {
            setMembers([]);
            return;
        }
        getWorkspaceMembers(wsId)
            .then((data) => setMembers(Array.isArray(data) ? data : []))
            .catch(() => setMembers([]));
    }, [currentWorkspace?.workspaceId, isGroupRoom]);

    // 그룹 톡방의 참가자만 후보로 (워크스페이스 다른 멤버 제외)
    const memberCandidates = React.useMemo(() => {
        if (!isGroupRoom) return [];
        const ids = Array.isArray(room?.memberIds) ? room.memberIds : null;
        if (!ids) return members;
        const idSet = new Set(ids);
        return members.filter((m) => idSet.has(m.userId));
    }, [isGroupRoom, room?.memberIds, members]);

    // text가 어떤 경로로 바뀌든(@-버튼/직접 입력/이모지) 동일하게 @-감지. 단 그룹일 때만.
    useEffect(() => {
        if (!isGroupRoom) {
            setMentionQuery(null);
            return;
        }
        const value = text || "";
        const atIdx = value.lastIndexOf("@");
        if (atIdx !== -1) {
            const afterAt = value.slice(atIdx + 1);
            if (!afterAt.includes(" ") && !afterAt.includes("\n")) {
                setMentionQuery(afterAt);
                return;
            }
        }
        setMentionQuery(null);
    }, [text, isGroupRoom]);

    const handleMentionSelect = useCallback((name) => {
        const value = text || "";
        const atIdx = value.lastIndexOf("@");
        const next = (atIdx === -1 ? value : value.slice(0, atIdx)) + "@" + name + " ";
        setText(next);
        setMentionQuery(null);
        setTimeout(() => inputRef.current?.focus(), 0);
    }, [text, setText, inputRef]);

    // ── # 인라인 할 일 첨부 ── (모든 톡방)
    const [todoList, setTodoList] = useState([]);
    const [hashQuery, setHashQuery] = useState(null);

    useEffect(() => {
        const value = text || "";
        const idx = value.lastIndexOf("#");
        if (idx !== -1) {
            const after = value.slice(idx + 1);
            if (!after.includes(" ") && !after.includes("\n")) { setHashQuery(after); return; }
        }
        setHashQuery(null);
    }, [text]);

    // 첫 # 입력 시 할 일 목록 lazy 로드
    useEffect(() => {
        if (hashQuery != null && todoList.length === 0) {
            fetchTodos().then((r) => setTodoList(r.data || [])).catch(() => {});
        }
    }, [hashQuery, todoList.length]);

    const handleTodoSelect = useCallback((todo) => {
        const value = text || "";
        const idx = value.lastIndexOf("#");
        setText(idx === -1 ? value : value.slice(0, idx)); // #query 제거
        setHashQuery(null);
        onSelectTodo?.(todo);
        setTimeout(() => inputRef.current?.focus(), 0);
    }, [text, setText, inputRef, onSelectTodo]);

    const handleFileChange = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) return;
        const isImage = file.type.startsWith("image/");
        setLocalFile({ file, previewUrl: isImage ? URL.createObjectURL(file) : null });
        e.target.value = "";
    }, []);

    const handleFileSend = useCallback(() => {
        if (!localFile?.file) return;
        sendFile?.(localFile.file, text);
        if (localFile.previewUrl) URL.revokeObjectURL(localFile.previewUrl);
        setLocalFile(null);
    }, [localFile, sendFile, text]);

    const cancelFile = useCallback(() => {
        if (localFile?.previewUrl) URL.revokeObjectURL(localFile.previewUrl);
        setLocalFile(null);
    }, [localFile]);

    const {
        isDark,
        border,
        headerBg,
        inputCardBg,
        pillBg,
        iconColor,
        textColor,
        placeholderColor,
        primaryColor,
        iconBtnSx,
    } = ui;

    // ── 데스크탑: 항상 펼쳐진 서식 툴바 ──────────────────────────
    if (isDesktop) {
        const toolbarButtons = [
            { content: <Typography sx={{ fontWeight: 900, fontSize: 13, lineHeight: 1 }}>B</Typography>, title: "굵게 (**text**)", onClick: () => wrapSelection?.("**") },
            { content: <Typography sx={{ fontStyle: "italic", fontSize: 13, lineHeight: 1 }}>I</Typography>, title: "기울임 (*text*)", onClick: () => wrapSelection?.("*") },
            ...(isGroupRoom ? [{ content: <AlternateEmailRoundedIcon sx={{ fontSize: 18 }} />, title: "멘션", onClick: () => insertAtCursor("@") }] : []),
            { content: <EmojiEmotionsRoundedIcon sx={{ fontSize: 18, color: emojiOpen ? primaryColor : undefined }} />, title: "이모지", onClick: () => setEmojiOpen((v) => !v) },
            { content: <AttachFileRoundedIcon sx={{ fontSize: 18 }} />, title: "파일 첨부", onClick: () => fileInputRef.current?.click() },
            { content: <AssignmentRoundedIcon sx={{ fontSize: 18 }} />, title: "할 일 첨부", onClick: () => onAttachTodo?.() },
            { content: <PushPinOutlinedIcon sx={{ fontSize: 18, color: isNotice ? NOTICE_COLOR : undefined, transform: "rotate(45deg)" }} />, title: isNotice ? "고정 해제" : "고정하기", onClick: toggleNotice },
        ];

        return (
            <Box
                sx={{
                    flexShrink: 0,
                    px: 2,
                    pt: 1.5,
                    pb: "calc(16px + env(safe-area-inset-bottom))",
                    borderTop: `1px solid ${border}`,
                    bgcolor: isDark ? "rgba(19,19,23,0.95)" : "rgba(255,255,255,0.92)",
                    position: "relative",
                }}
            >
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
                {/* 이모지 팝업 */}
                {emojiOpen && (
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: "calc(100% + 4px)",
                            left: 16,
                            bgcolor: inputCardBg,
                            ...blurSx("blur(20px)"),
                            border: `1px solid ${border}`,
                            borderRadius: "14px",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                            p: "10px 8px",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.5,
                            maxWidth: 240,
                            zIndex: Z.EMOJI_PICKER,
                        }}
                    >
                        {["😊","😂","❤️","👍","🙏","🔥","✅","😎","🎉","😅","🤔","👀"].map((em) => (
                            <Box
                                key={em}
                                component="button"
                                onPointerDown={(ev) => ev.preventDefault()}
                                onClick={() => { insertAtCursor(em); setEmojiOpen(false); }}
                                sx={{
                                    width: 36, height: 36, border: "none", background: "transparent",
                                    cursor: "pointer", fontSize: 22, borderRadius: "8px",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
                                }}
                            >{em}</Box>
                        ))}
                    </Box>
                )}

                <Box
                    sx={{
                        border: `1px solid ${inputFocused ? primaryColor : border}`,
                        borderRadius: 2,
                        overflow: "hidden",
                        bgcolor: isDark ? "rgba(19,19,23,0.88)" : "#FFFFFF",
                        boxShadow: inputFocused ? `0 0 0 3px ${primaryColor}22` : "none",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                >
                    {/* 서식 툴바 */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.25,
                            px: 1.25,
                            pt: 0.75,
                            pb: 0.5,
                            borderBottom: `1px solid ${border}`,
                        }}
                    >
                        {toolbarButtons.map((btn, i) => (
                            <IconButton
                                key={i}
                                size="small"
                                title={btn.title}
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={btn.onClick}
                                sx={{
                                    width: 28, height: 28, borderRadius: 1,
                                    color: iconColor,
                                    "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", color: textColor },
                                }}
                            >
                                {btn.content}
                            </IconButton>
                        ))}
                    </Box>

                    {/* 파일 미리보기 */}
                    {localFile && (
                        <Box sx={{
                            display: "flex", alignItems: "center", gap: 1,
                            px: 1.5, py: 1, borderBottom: `1px solid ${border}`,
                        }}>
                            {localFile.previewUrl ? (
                                <Box
                                    component="img"
                                    src={localFile.previewUrl}
                                    sx={{ height: 56, width: 56, objectFit: "cover", borderRadius: 1.5, flexShrink: 0 }}
                                />
                            ) : (
                                <Box sx={{
                                    width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                                    bgcolor: "var(--plando-surface-mid)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <AttachFileRoundedIcon sx={{ fontSize: 18, color: iconColor }} />
                                </Box>
                            )}
                            <Typography sx={{ flex: 1, fontSize: 12.5, color: textColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {localFile.file.name}
                            </Typography>
                            <Box
                                component="button"
                                onClick={cancelFile}
                                sx={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, color: iconColor, lineHeight: 1, px: 0.5 }}
                            >✕</Box>
                        </Box>
                    )}

                    {/* 텍스트 입력 + 전송 */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1 }}>
                        <textarea
                            ref={inputRef}
                            value={text}
                            onChange={(e) => {
                                setText(e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    // IME 조합 중 Enter 무시 — 한글 마지막 글자 중복 전송 방지
                                    if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                                    e.preventDefault();
                                    if (localFile) handleFileSend();
                                    else sendWithExtras();
                                }
                            }}
                            onFocus={() => setInputFocused(true)}
                            onBlur={() => setInputFocused(false)}
                            placeholder={localFile ? `${displayName}에게 메시지와 함께 파일 전송...` : `${displayName}에게 메시지 보내기...`}
                            rows={1}
                            style={{
                                flex: 1, border: "none", outline: "none", resize: "none",
                                fontSize: 14, color: textColor, background: "transparent",
                                caretColor: primaryColor, lineHeight: 1.55, padding: 0,
                                minHeight: 22, maxHeight: 120, overflowY: "hidden",
                                fontFamily: "-apple-system, BlinkMacSystemFont, 'Pretendard', 'Noto Sans KR', sans-serif",
                            }}
                        />
                        <Box
                            component="button"
                            onClick={() => localFile ? handleFileSend() : sendWithExtras()}
                            onPointerDown={(e) => e.preventDefault()}
                            sx={{
                                width: 36, height: 36, borderRadius: "10px", border: "none",
                                cursor: (text.trim() || localFile) ? "pointer" : "default",
                                bgcolor: (text.trim() || localFile) ? primaryColor : (isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                                transition: "background 0.18s",
                                boxShadow: (text.trim() || localFile) ? `0 4px 12px ${primaryColor}55` : "none",
                            }}
                        >
                            {sending ? (
                                <CircularProgress size={15} sx={{ color: (text.trim() || localFile) ? "#fff" : iconColor }} />
                            ) : (
                                <SendRoundedIcon sx={{ fontSize: 17, color: (text.trim() || localFile) ? "#fff" : (isDark ? "rgba(255,255,255,0.25)" : "#aaa") }} />
                            )}
                        </Box>
                    </Box>

                    {/* 하단 힌트 */}
                    <Box sx={{ display: "flex", justifyContent: "space-between", px: 1.75, pb: 0.875 }}>
                        <Typography sx={{ fontSize: 10.5, color: isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.38)" }}>
                            Enter로 전송 · Shift+Enter 줄바꿈
                        </Typography>
                        <Typography sx={{ fontSize: 10.5, color: isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.38)" }}>
                            {text.length}/2000
                        </Typography>
                    </Box>
                </Box>
                <MentionPicker
                    members={memberCandidates}
                    query={mentionQuery}
                    onSelect={handleMentionSelect}
                    anchorEl={inputRef.current}
                />
                <TodoMentionPicker
                    todos={todoList}
                    query={hashQuery}
                    onSelect={handleTodoSelect}
                    anchorEl={inputRef.current}
                />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                flexShrink: 0,
                position: "relative",
                background: headerBg,
                ...blurSx("blur(20px)"),
                borderTop: inputFocused ? "none" : `0.5px solid ${border}`,
                px: inputFocused ? 0 : 1.5,
                pt: inputFocused ? 0 : 1,
                pb: kbOffset > 0 ? 0 : "env(safe-area-inset-bottom, 10px)",
                transition: "padding 0.2s ease",
            }}
        >
            <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
            {emojiOpen && inputFocused && (
                <Box
                    sx={{
                        position: "absolute",
                        bottom: "calc(100% + 4px)",
                        left: 8,
                        bgcolor: inputCardBg,
                        ...blurSx("blur(20px)"),
                        border: `0.5px solid ${border}`,
                        borderRadius: "14px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                        p: "10px 8px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                        maxWidth: 240,
                        zIndex: Z.EMOJI_PICKER,
                    }}
                >
                    {["😊", "😂", "❤️", "👍", "🙏", "🔥", "✅", "😎", "🎉", "😅", "🤔", "👀"].map(
                        (em) => (
                            <Box
                                key={em}
                                component="button"
                                onPointerDown={(ev) => ev.preventDefault()}
                                onClick={() => {
                                    insertAtCursor(em);
                                    setEmojiOpen(false);
                                }}
                                sx={{
                                    width: 36,
                                    height: 36,
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    fontSize: 22,
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    "&:hover": {
                                        bgcolor: isDark
                                            ? "rgba(255,255,255,0.08)"
                                            : "rgba(0,0,0,0.05)",
                                    },
                                }}
                            >
                                {em}
                            </Box>
                        )
                    )}
                </Box>
            )}

            {!inputFocused && (
                <Box
                    onClick={openInput}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.25,
                        bgcolor: pillBg,
                        borderRadius: 24,
                        px: "14px",
                        py: "10px",
                        border: `0.5px solid ${border}`,
                        boxShadow: isDark ? "none" : "0 1px 6px rgba(0,0,0,0.06)",
                        cursor: "text",
                    }}
                >
                    <AddRoundedIcon sx={{ fontSize: 22, color: iconColor, flexShrink: 0 }} />
                    <Typography
                        sx={{ flex: 1, fontSize: 15, color: placeholderColor, lineHeight: 1 }}
                    >
                        {displayName}에게 메시지 보내기
                    </Typography>
                </Box>
            )}

            {inputFocused && (
                <Box
                    sx={{
                        bgcolor: inputCardBg,
                        ...blurSx("blur(24px)"),
                        borderRadius: "16px",
                        border: `0.5px solid ${border}`,
                        boxShadow: "0 -6px 24px rgba(0,0,0,0.12)",
                        overflow: "hidden",
                    }}
                >
                    {localFile && (
                        <Box sx={{
                            display: "flex", alignItems: "center", gap: 1,
                            px: 2, py: 1, borderBottom: `0.5px solid ${border}`,
                        }}>
                            {localFile.previewUrl ? (
                                <Box
                                    component="img"
                                    src={localFile.previewUrl}
                                    sx={{ height: 48, width: 48, objectFit: "cover", borderRadius: 1.5, flexShrink: 0 }}
                                />
                            ) : (
                                <Box sx={{
                                    width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
                                    bgcolor: "var(--plando-surface-mid)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <AttachFileRoundedIcon sx={{ fontSize: 16, color: iconColor }} />
                                </Box>
                            )}
                            <Typography sx={{ flex: 1, fontSize: 12, color: textColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {localFile.file.name}
                            </Typography>
                            <Box component="button" onClick={cancelFile}
                                sx={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, color: iconColor, lineHeight: 1, px: 0.5 }}
                            >✕</Box>
                        </Box>
                    )}

                    <Box sx={{ px: 2, pt: "12px", pb: "8px", minHeight: 46 }}>
                        <textarea
                            ref={inputRef}
                            value={text}
                            autoFocus
                            onChange={(e) => {
                                setText(e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                            }}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setInputFocused(true)}
                            onBlur={() => {
                                setTimeout(() => {
                                    if (document.activeElement !== inputRef.current && !text.trim()) {
                                        setInputFocused(false);
                                    }
                                }, 150);
                            }}
                            placeholder={`${displayName}에게 메시지 보내기`}
                            rows={1}
                            style={{
                                width: "100%",
                                border: "none",
                                outline: "none",
                                resize: "none",
                                fontSize: 16,
                                lineHeight: 1.5,
                                color: textColor,
                                background: "transparent",
                                padding: 0,
                                minHeight: 24,
                                maxHeight: 120,
                                overflowY: "hidden",
                                caretColor: primaryColor,
                                fontFamily:
                                    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Noto Sans KR', sans-serif",
                            }}
                        />
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            px: 1.5,
                            pt: "6px",
                            pb: "8px",
                            borderTop: `0.5px solid ${border}`,
                            gap: 0.25,
                            position: "relative",
                        }}
                    >
                        <Box
                            component="button"
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => onAttachTodo?.()}
                            sx={iconBtnSx}
                            title="할 일 첨부"
                        >
                            <AddRoundedIcon sx={{ fontSize: 22, color: iconColor }} />
                        </Box>

                        <Box
                            component="button"
                            onPointerDown={(e) => e.preventDefault()}
                            sx={iconBtnSx}
                        >
                            <TextFieldsRoundedIcon sx={{ fontSize: 22, color: iconColor }} />
                        </Box>

                        <Box
                            component="button"
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => setEmojiOpen((v) => !v)}
                            sx={iconBtnSx}
                        >
                            <EmojiEmotionsRoundedIcon
                                sx={{ fontSize: 22, color: emojiOpen ? primaryColor : iconColor }}
                            />
                        </Box>

                        <Box
                            component="button"
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={toggleNotice}
                            sx={iconBtnSx}
                            title={isNotice ? "고정 해제" : "고정하기"}
                        >
                            <PushPinOutlinedIcon
                                sx={{ fontSize: 20, color: isNotice ? NOTICE_COLOR : iconColor, transform: "rotate(45deg)" }}
                            />
                        </Box>

                        {isGroupRoom && (
                            <Box
                                component="button"
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() => insertAtCursor("@")}
                                sx={iconBtnSx}
                            >
                                <AlternateEmailRoundedIcon
                                    sx={{ fontSize: 22, color: iconColor }}
                                />
                            </Box>
                        )}

                        <Box
                            component="button"
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => insertAtCursor("/")}
                            sx={iconBtnSx}
                        >
                            <SlashIcon color={iconColor} />
                        </Box>

                        <Box
                            component="button"
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                            sx={iconBtnSx}
                        >
                            <AttachFileRoundedIcon sx={{ fontSize: 22, color: iconColor }} />
                        </Box>

                        <Box sx={{ flex: 1 }} />

                        <Box
                            component="button"
                            onClick={() => localFile ? handleFileSend() : sendWithExtras()}
                            onPointerDown={(e) => e.preventDefault()}
                            sx={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                bgcolor: (text.trim() || localFile)
                                    ? primaryColor
                                    : isDark
                                        ? "rgba(255,255,255,0.10)"
                                        : "#e5e5ea",
                                border: "none",
                                cursor: (text.trim() || localFile) ? "pointer" : "default",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "background 0.18s ease",
                                flexShrink: 0,
                            }}
                        >
                            {sending ? (
                                <CircularProgress
                                    size={15}
                                    sx={{ color: (text.trim() || localFile) ? "#fff" : iconColor }}
                                />
                            ) : (
                                <SendRoundedIcon
                                    sx={{
                                        fontSize: 17,
                                        color: (text.trim() || localFile)
                                            ? "#fff"
                                            : isDark
                                                ? "rgba(255,255,255,0.25)"
                                                : "#aaa",
                                    }}
                                />
                            )}
                        </Box>
                    </Box>
                </Box>
            )}
            <MentionPicker
                members={memberCandidates}
                query={mentionQuery}
                onSelect={handleMentionSelect}
                anchorEl={inputRef.current}
            />
            <TodoMentionPicker
                todos={todoList}
                query={hashQuery}
                onSelect={handleTodoSelect}
                anchorEl={inputRef.current}
            />
        </Box>
    );
}