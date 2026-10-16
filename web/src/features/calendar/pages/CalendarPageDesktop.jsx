import React from "react";
import { Box, Chip, Divider, IconButton, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import RepeatIcon from "@mui/icons-material/Repeat";
import AddIcon from "@mui/icons-material/Add";
import moment from "moment";
import { Calendar } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import CalendarToolbar from "../components/CalendarToolbar.jsx";
import CalendarEventLabel from "../components/CalendarEventLabel.jsx";
import MiniMonthCalendar from "../components/MiniMonthCalendar.jsx";
import AddTodoModal from "../../todo/components/form/AddTodoModal.jsx";
import { getStatusLabel, statusColor } from "../../../shared/ui/tone.js";

const DnDCalendar = withDragAndDrop(Calendar);

const emptySelectedDateText = "선택한 날짜에 일정이 없습니다.";

export default function CalendarPageDesktop({ ctx }) {
    const theme = useTheme();
    const {
        isDark,
        filteredEvents,
        loaded,
        firstEventId,
        calendarSx,
        currentView,
        views,
        date,
        setDate,
        selectedDate,
        setSelectedDate,
        showOnlyRecurring,
        setShowOnlyRecurring,
        selectedDateEvents,
        onSelectEvent,
        onSelectSlot,
        onDrillDown,
        onNavigate,
        onNavigateMonth,
        onEventDrop,
        onEventResize,
        eventPropGetter,
        dayPropGetter,
        openAddWithDay,
        openAdd,
        setOpenAdd,
        task,
        setTask,
        handleAdd,
        setView,
        localizer,
        calendarMessages,
        calendarFormats,
    } = ctx;

    return (
        /* 데스크탑: 2컬럼 레이아웃 (메인 캘린더 + 오른쪽 패널) */
        <Box sx={{ px: { sm: 2.5, md: 3 }, pt: { sm: 2.5, md: 3 }, pb: { xs: 2, sm: 2.5, md: 3 } }}>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 292px",
                    gap: 2,
                    height: "calc(100dvh - 130px)",
                    minHeight: 0,
                }}
            >
                {/* 왼쪽: 메인 캘린더 */}
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        minHeight: 0,
                    }}
                >
                    <Box
                        data-tour="calendar-main"
                        sx={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", ...calendarSx, height: "100%" }}
                    >
                        {/* 날짜 지정된 일정이 하나도 없을 때 안내 (그리드 위 오버레이, 클릭은 통과).
                            loaded 전에는 띄우지 않는다 — 첫 조회가 끝나기 전엔 events가 항상 []라
                            화면 진입 때마다 이 안내가 한 프레임 번쩍였다. */}
                        {loaded && filteredEvents.length === 0 && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    top: 56,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 0.75,
                                    pointerEvents: "none",
                                    zIndex: 1,
                                    textAlign: "center",
                                    px: 2,
                                }}
                            >
                                <Box sx={{ fontSize: 40, lineHeight: 1 }}>🗓️</Box>
                                <Box sx={{ fontSize: 14.5, fontWeight: 800, color: "text.secondary" }}>표시할 일정이 없어요</Box>
                                <Box sx={{ fontSize: 12.5, color: "text.disabled", lineHeight: 1.6 }}>
                                    할 일에 <b>시작일·마감일</b>을 지정하면 이 달력에 나타나요.<br />빈 날짜를 클릭하거나 드래그해 새 일정을 만들 수도 있어요.
                                </Box>
                            </Box>
                        )}
                        <DnDCalendar
                            localizer={localizer}
                            messages={calendarMessages}
                            formats={calendarFormats}
                            events={filteredEvents}
                            startAccessor="start"
                            endAccessor="end"
                            popup
                            allDayMaxRows={2}
                            selectable
                            longPressThreshold={250}
                            draggableAccessor={() => true}
                            resizableAccessor={() => true}
                            resizable
                            view={currentView}
                            date={date}
                            onView={(v) => setView(v)}
                            onNavigate={onNavigate}
                            views={views}
                            onSelectEvent={onSelectEvent}
                            onSelectSlot={onSelectSlot}
                            onDrillDown={onDrillDown}
                            onEventDrop={onEventDrop}
                            onEventResize={onEventResize}
                            eventPropGetter={eventPropGetter}
                            dayPropGetter={dayPropGetter}
                            components={{
                                toolbar: (props) => (
                                    <CalendarToolbar {...props} isDark={isDark} isMobile={false} onAdd={() => openAddWithDay(selectedDate)} />
                                ),
                                event: (props) => (
                                    <CalendarEventLabel {...props} firstEventId={firstEventId} isMobile={false} />
                                ),
                            }}
                        />
                    </Box>
                </Box>

                {/* 오른쪽: 사이드 패널 */}
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        minHeight: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                    }}
                >
                    {/* 미니 달력 */}
                    <Box
                        sx={{
                            borderRadius: "12px",
                            boxShadow: "var(--plando-elev-1)",
                            bgcolor: "var(--plando-surface-alt)",
                            p: 1.5,
                            flexShrink: 0,
                        }}
                    >
                        <MiniMonthCalendar
                            date={date}
                            selectedDate={selectedDate}
                            events={filteredEvents}
                            isDark={isDark}
                            onSelectDate={(d) => {
                                setSelectedDate(d);
                                setDate(d);
                            }}
                            onNavigatePrev={() => onNavigateMonth(-1)}
                            onNavigateNext={() => onNavigateMonth(1)}
                        />
                    </Box>

                    {/* 선택된 날짜 일정 */}
                    <Box
                        sx={{
                            flex: 1,
                            minHeight: 160,
                            borderRadius: "12px",
                            boxShadow: "var(--plando-elev-1)",
                            bgcolor: "var(--plando-surface)",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                        }}
                    >
                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ px: 1.5, pt: 1.5, pb: 1, flexShrink: 0 }}
                        >
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                                <Typography sx={{ fontWeight: 800, fontSize: 12, color: "var(--plando-text-primary)", letterSpacing: "-0.01em" }}>
                                    {moment(selectedDate).format("M월 D일")}
                                </Typography>
                                <Box
                                    sx={{
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        color: "var(--plando-text-secondary)",
                                        px: 0.85,
                                        py: 0.2,
                                        borderRadius: 999,
                                        bgcolor: "var(--plando-gray-soft)",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {selectedDateEvents.length}개
                                </Box>
                                <Chip
                                    icon={<RepeatIcon sx={{ fontSize: "13px !important" }} />}
                                    label="반복만"
                                    size="small"
                                    onClick={() => setShowOnlyRecurring((v) => !v)}
                                    color={showOnlyRecurring ? "primary" : "default"}
                                    variant={showOnlyRecurring ? "filled" : "outlined"}
                                    sx={{ fontWeight: 600, fontSize: 11, height: 22, "& .MuiChip-icon": { ml: 0.75, mr: 0.25 }, "& .MuiChip-label": { pl: 0.5, pr: 1 } }}
                                />
                            </Stack>
                            <IconButton
                                size="small"
                                onClick={() => openAddWithDay(selectedDate)}
                                sx={{ width: 28, height: 28 }}
                            >
                                <AddIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Stack>

                        <Divider />

                        <Box sx={{ flex: 1, overflowY: "auto", p: "6px 8px" }}>
                            {selectedDateEvents.length === 0 ? (
                                <Typography
                                    sx={{ fontSize: 13, textAlign: "center", py: 3, color: "var(--plando-text-secondary)" }}
                                >
                                    {emptySelectedDateText}
                                </Typography>
                            ) : (
                                <Stack>
                                    {selectedDateEvents.map((event, i) => {
                                        const resource = event.resource ?? {};
                                        const status = resource.status ?? "TODO";
                                        const statusHex = statusColor(theme, status);
                                        const statusLabel = getStatusLabel(status);

                                        return (
                                            <Box
                                                key={event.id}
                                                onClick={() => onSelectEvent(event)}
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "10px",
                                                    p: "8px 4px",
                                                    cursor: "pointer",
                                                    borderBottom: i < selectedDateEvents.length - 1 ? "1px solid var(--plando-divider)" : "none",
                                                    "&:hover": {
                                                        bgcolor: "var(--plando-gray-soft)",
                                                        borderRadius: "8px",
                                                    },
                                                }}
                                            >
                                                <Box sx={{ width: 3, alignSelf: "stretch", borderRadius: 999, bgcolor: statusHex, flexShrink: 0 }} />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography
                                                        sx={{
                                                            fontWeight: 600,
                                                            fontSize: 12.5,
                                                            lineHeight: 1.3,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                            color: "var(--plando-text-primary)",
                                                            letterSpacing: "-0.01em",
                                                        }}
                                                    >
                                                        {event.title}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: 11, color: statusHex, fontWeight: 600, mt: 0.15 }}>
                                                        {statusLabel}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>

            <AddTodoModal
                open={openAdd}
                onClose={() => setOpenAdd(false)}
                task={task}
                setTask={setTask}
                onSave={handleAdd}
            />
        </Box>
    );
}
