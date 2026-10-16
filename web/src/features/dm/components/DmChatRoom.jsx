import React, { useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import DmChatHeader from "./DmChatHeader.jsx";
import DmInputBar from "./DmInputBar.jsx";
import DmMessageList from "./DmMessageList.jsx";
import DmCreateTodoModal from "./DmCreateTodoModal.jsx";
import DmEditMessageModal from "./DmEditMessageModal.jsx";
import DmNoticePin from "./DmNoticePin.jsx";
import DmSearchSheet from "./DmSearchSheet.jsx";
import DmTodoPickerSheet from "./DmTodoPickerSheet.jsx";
import { useOpenTodoDetail } from "../../todo/hooks/useOpenTodoDetail.jsx";
import { getDmColors } from "../../../shared/ui/glassSx.js";
import useDmChatRoom from "../hooks/useDmChatRoom.js";
import { Z } from "../../../shared/ui/zIndex.js";
import FilePreviewModal from "../../../shared/ui/common/FilePreviewModal.jsx";

export default function DmChatRoom({ room, onBack, fullscreen = false, isDesktop = false, onRoomUpdated }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const openTodoDetail = useOpenTodoDetail();
    const [createTodoMsg, setCreateTodoMsg] = useState(null);
    const [editingMsg, setEditingMsg] = useState(null);
    const [todoPickerOpen, setTodoPickerOpen] = useState(false);

    const {
        messages,
        loading,
        text,
        setText,
        sending,
        inputFocused,
        setInputFocused,
        profileOpen,
        setProfileOpen,
        emojiOpen,
        setEmojiOpen,
        kbOffset,
        bottomRef,
        inputRef,
        messagesBoxRef,
        onScroll,
        loadingOlder,
        typingName,
        highlightId,
        firstUnreadId,
        atBottom,
        newCount,
        scrollToBottom,
        retrySend,
        replyTarget,
        setReplyTarget,
        attachedTodo,
        setAttachedTodo,
        searchOpen,
        setSearchOpen,
        searchResults,
        searchLoading,
        runSearch,
        jumpToMessage,
        handleKeyDown,
        handleSend,
        openInput,
        insertAtCursor,
        wrapSelection,
        sendFile,
        groups,
        lastReadIdx,
        previewOpen,
        previewFile,
        previewFiles,
        previewIndex,
        openPreview,
        closePreview,
        handlePrevPreview,
        handleNextPreview,
        deleteMessage,
        editMessage,
        reactToMessage,
        pinNotice,
    } = useDmChatRoom({ room, fullscreen });

    const dmC = getDmColors(theme);
    const border = "var(--plando-surface-strong)";
    const headerBg = dmC.headerBg;
    const inputCardBg = dmC.inputCardBg;
    const pillBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)";
    const iconColor = dmC.iconColor;
    const textColor = dmC.textPrimary;
    const placeholderColor = dmC.textDisabled;
    const primaryColor = dmC.primaryColor;
    const myBubble = dmC.myBubble;
    const theirBubble = dmC.theirBubble;

    const iconBtnSx = {
        border: "none",
        background: "none",
        cursor: "pointer",
        p: "6px",
        borderRadius: 1.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: iconColor,
        "&:hover": {
            bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        },
    };

    return (
        <>
            {fullscreen && (
                <Box
                    sx={{
                        position: "fixed",
                        inset: 0,
                        zIndex: Z.DM_ROOM_BACKDROP,
                        bgcolor: "background.default",
                        touchAction: "none",
                    }}
                />
            )}

            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    position: "relative",
                    ...(fullscreen && {
                        position: "fixed",
                        top: "env(safe-area-inset-top)",
                        left: 0,
                        right: 0,
                        // Keyboard.resize=none이라 다른 페이지는 키보드가 컨텐츠 위에 그냥 띄워짐.
                        // DM 채팅방만 자체적으로 키보드 위로 input bar 끌어올림.
                        height: kbOffset > 0
                            ? `calc(100dvh - env(safe-area-inset-top) - ${kbOffset}px)`
                            : "calc(100dvh - env(safe-area-inset-top))",
                        transition: "height 0.15s ease",
                        zIndex: Z.DM_ROOM,
                        bgcolor: dmC.pageBg,
                        overscrollBehavior: "none",
                    }),
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Noto Sans KR', sans-serif",
                }}
            >
                <DmChatHeader
                    room={room}
                    onBack={onBack}
                    profileOpen={profileOpen}
                    setProfileOpen={setProfileOpen}
                    isDark={isDark}
                    border={border}
                    primaryColor={primaryColor}
                    textColor={textColor}
                    isDesktop={isDesktop}
                    openPreview={openPreview}
                    onRoomUpdated={onRoomUpdated}
                    onSearch={() => setSearchOpen(true)}
                />

                <DmNoticePin messages={messages} isDark={isDark} isDesktop={isDesktop} />

                <DmMessageList
                    room={room}
                    loading={loading}
                    groups={groups}
                    lastReadIdx={lastReadIdx}
                    bottomRef={bottomRef}
                    messagesBoxRef={messagesBoxRef}
                    onScroll={onScroll}
                    loadingOlder={loadingOlder}
                    typingName={typingName}
                    highlightId={highlightId}
                    firstUnreadId={firstUnreadId}
                    onRetry={retrySend}
                    onJumpToMessage={jumpToMessage}
                    onReply={(msg) => setReplyTarget(msg)}
                    textColor={textColor}
                    primaryColor={primaryColor}
                    isDark={isDark}
                    myBubble={myBubble}
                    theirBubble={theirBubble}
                    isDesktop={isDesktop}
                    openPreview={openPreview}
                    onDeleteMessage={deleteMessage}
                    onCreateTodo={(msg) => setCreateTodoMsg(msg)}
                    onEditMessage={(msg) => setEditingMsg(msg)}
                    onReactMessage={reactToMessage}
                    onPinNotice={pinNotice}
                    onOpenTodo={(todoId) => openTodoDetail(todoId)}
                />

                {/* 맨 아래로 점프 버튼 — 위로 스크롤했을 때만 노출, 새 메시지 도착 시 배지 */}
                {!atBottom && (
                    <Box
                        component="button"
                        onClick={scrollToBottom}
                        aria-label="맨 아래로"
                        sx={{
                            position: "absolute", right: 14, bottom: 78, zIndex: Z.STICKY,
                            width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            bgcolor: "var(--plando-surface-card)",
                            color: textColor,
                            boxShadow: "var(--plando-elev-2, 0 4px 12px rgba(0,0,0,0.18))",
                            "&:active": { transform: "scale(0.94)" },
                        }}
                    >
                        <KeyboardArrowDownRoundedIcon sx={{ fontSize: 24 }} />
                        {newCount > 0 && (
                            <Box sx={{
                                position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, px: 0.5,
                                borderRadius: 9, bgcolor: primaryColor, color: "#fff",
                                fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                {newCount > 99 ? "99+" : newCount}
                            </Box>
                        )}
                    </Box>
                )}

                {/* 작성 보조 — 답장 인용 / 첨부된 할 일 */}
                {(replyTarget || attachedTodo) && (
                    <Box sx={{ px: 1.5, pt: 0.75, display: "flex", flexDirection: "column", gap: 0.5, bgcolor: headerBg }}>
                        {replyTarget && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.25, py: 0.75, borderRadius: 2, bgcolor: "var(--plando-surface-low)", borderLeft: `3px solid ${primaryColor}` }}>
                                <ReplyRoundedIcon sx={{ fontSize: 16, color: primaryColor, flexShrink: 0 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: primaryColor }} noWrap>{replyTarget.senderName}에게 답장</Typography>
                                    <Typography sx={{ fontSize: 12.5, color: "text.secondary" }} noWrap>{replyTarget.content || "[파일]"}</Typography>
                                </Box>
                                <Box component="button" onClick={() => setReplyTarget(null)} sx={{ border: "none", background: "none", cursor: "pointer", color: "text.disabled", display: "flex", p: 0.25 }}>
                                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                                </Box>
                            </Box>
                        )}
                        {attachedTodo && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.25, py: 0.75, borderRadius: 2, bgcolor: "var(--plando-surface-low)" }}>
                                <AssignmentRoundedIcon sx={{ fontSize: 16, color: primaryColor, flexShrink: 0 }} />
                                <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600, color: textColor }} noWrap>할 일: {attachedTodo.title}</Typography>
                                <Box component="button" onClick={() => setAttachedTodo(null)} sx={{ border: "none", background: "none", cursor: "pointer", color: "text.disabled", display: "flex", p: 0.25 }}>
                                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}

                <DmInputBar
                    room={room}
                    state={{
                        text,
                        sending,
                        inputFocused,
                        emojiOpen,
                        kbOffset,
                    }}
                    actions={{
                        setText,
                        setInputFocused,
                        setEmojiOpen,
                        handleKeyDown,
                        handleSend,
                        openInput,
                        insertAtCursor,
                        wrapSelection,
                        sendFile,
                        onAttachTodo: () => setTodoPickerOpen(true),
                        onSelectTodo: (t) => setAttachedTodo(t),
                    }}
                    refs={{
                        inputRef,
                    }}
                    ui={{
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
                    }}
                    isDesktop={isDesktop}
                />
            </Box>
            <FilePreviewModal
                open={previewOpen}
                file={previewFile}
                files={previewFiles}
                currentIndex={previewIndex}
                onPrev={handlePrevPreview}
                onNext={handleNextPreview}
                onClose={closePreview}
            />
            <DmCreateTodoModal
                open={!!createTodoMsg}
                onClose={() => setCreateTodoMsg(null)}
                sourceMessage={createTodoMsg}
                room={room}
            />
            <DmEditMessageModal
                open={!!editingMsg}
                onClose={() => setEditingMsg(null)}
                message={editingMsg}
                onSave={editMessage}
            />
            <DmSearchSheet
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
                results={searchResults}
                loading={searchLoading}
                onSearch={runSearch}
                onJump={jumpToMessage}
                isDesktop={isDesktop}
            />
            <DmTodoPickerSheet
                open={todoPickerOpen}
                onClose={() => setTodoPickerOpen(false)}
                onSelect={(t) => setAttachedTodo(t)}
                isDesktop={isDesktop}
            />
        </>
    );
}