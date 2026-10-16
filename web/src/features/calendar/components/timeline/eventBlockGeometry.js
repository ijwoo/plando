import { minToPx } from "./timelineConstants.js";

/**
 * 타임라인 이벤트 블록의 절대 위치 (top, height, left, width) 계산.
 * - 겹침 레이아웃의 `_col` / `_ncol`을 기준으로 컬럼 분할
 * - ghost(드래그 미리보기)는 단일 컬럼 + override 사용
 *
 * @param {Object} item - sanitize/assignColumns 거친 이벤트
 * @param {Object} opts
 *   - ghost: boolean
 *   - overrideTop?: number (px)         - ghost일 때 위치
 *   - overrideDur?: number (분)          - ghost일 때 길이
 *   - eventLeft: number                  - 좌측 패딩 (px)
 *   - eventRightPad: number              - 우측 패딩 (px)
 *   - colGap: number                     - 컬럼 간 간격 (px)
 * @returns {{ top, height, leftCss, widthCss, zIndex }}
 */
export function calcBlockGeometry(item, {
    ghost,
    overrideTop,
    overrideDur,
    eventLeft,
    eventRightPad,
    colGap,
}) {
    const { startMin, endMin, _col, _ncol } = item;
    const dur = endMin - startMin;
    const top = ghost ? overrideTop : minToPx(startMin);
    const height = ghost ? minToPx(overrideDur) : minToPx(dur);

    const totalAvail = `(100% - ${eventLeft + eventRightPad}px)`;
    const widthCss = ghost
        ? totalAvail
        : `(${totalAvail} - ${(_ncol - 1) * colGap}px) / ${_ncol}`;
    const leftCss = ghost
        ? `${eventLeft}px`
        : `${eventLeft}px + ${_col} * (${widthCss} + ${colGap}px)`;

    return {
        top,
        height,
        leftCss: `calc(${leftCss})`,
        widthCss: `calc(${widthCss})`,
        zIndex: ghost ? 10 : (2 + _col),
    };
}
