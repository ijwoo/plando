import { formatTimeAmPm } from "../../../../shared/utils/formatters.js";

export const HOUR_HEIGHT = 60;
export const TOTAL_MINUTES = 24 * 60;
export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const SNAP = 30;
export const LONG_PRESS_MS = 400;
export const CANCEL_MOVE_PX = 6;
export const AUTO_SCROLL_ZONE = 48;
export const AUTO_SCROLL_SPEED = 4;
export const BOTTOM_PAD = 120;
export const SWIPE_RATIO = 0.22;
export const EVENT_LEFT = 56;
export const EVENT_RIGHT_PAD = 12;
export const TIME_COL_WIDTH = 52;

export const minToPx = (m) => m * (HOUR_HEIGHT / 60);
export const pxToMin = (px) => px / (HOUR_HEIGHT / 60);
export const snap = (m) => Math.round(m / SNAP) * SNAP;

export const fmtHHmm = (m) => {
    const h = Math.floor(m / 60) % 24;
    const mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export const fmtAmPm = (min) => formatTimeAmPm(fmtHHmm(min));

export const GRID_LABEL_SX = {
    width: 44,
    fontSize: 10.5,
    fontWeight: 400,
    color: "var(--plando-text-tertiary)",
    textAlign: "right",
    pr: 1,
    mt: "-6px",
    letterSpacing: "0.01em",
};

export const DRAG_LABEL_SX = {
    ...GRID_LABEL_SX,
    position: "absolute", zIndex: 11,
};
