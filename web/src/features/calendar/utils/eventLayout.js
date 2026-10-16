/**
 * 일간 타임라인 겹침 레이아웃 — 순수함수 3개.
 *
 * sanitize  → assignColumns → (렌더러가 _col/_ncol 읽어서 위치 계산)
 */

// ─── 1. sanitize ────────────────────────────────────────────
/**
 * rawEvents 배열을 정규화.
 * 각 이벤트에 startMin / endMin (0-1440 분) + _invalid 플래그 부여.
 * 당일 범위 밖이거나 숫자가 아닌 이벤트는 스킵(반환 배열에서 제외).
 *
 * @param {Array<{start: Date|*, end?: Date|*, [k:string]:*}>} rawEvents
 * @returns {Array<{...원본, startMin:number, endMin:number, _invalid:boolean}>}
 */
export function sanitize(rawEvents) {
    const out = [];
    for (const ev of rawEvents) {
        let s = toMinutes(ev.start);
        let e = ev.end != null ? toMinutes(ev.end) : null;

        if (!Number.isFinite(s)) continue;
        if (s > 1440) continue;

        let invalid = false;

        if (s < 0) { s = 0; invalid = true; }
        if (e == null || !Number.isFinite(e)) { e = Math.min(s + 60, 1440); }
        if (e > 1440) { e = 1440; invalid = true; }
        if (e <= s) { e = Math.min(s + 30, 1440); invalid = true; }

        out.push({ ...ev, startMin: s, endMin: e, _invalid: invalid });
    }
    return out;
}

function toMinutes(v) {
    if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
    if (typeof v === "number") return v;
    return NaN;
}

// ─── 2. assignColumns ───────────────────────────────────────
/**
 * 겹치는 이벤트를 클러스터로 묶고, 클러스터 안에서 그리디 컬럼 배정.
 * 부수효과 없음 — 새 배열을 반환.
 *
 * @param {Array<{startMin:number, endMin:number, [k:string]:*}>} events
 * @returns {Array<{...원본, _col:number, _ncol:number}>}
 */
export function assignColumns(events) {
    if (!events.length) return [];

    const sorted = [...events].sort(
        (a, b) => a.startMin - b.startMin || b.endMin - a.endMin
    );

    // 클러스터 분리 + 컬럼 배정 한 패스
    const result = [];
    let clusterEnd = -1;
    let clusterStart = -1;
    let columns = [];       // columns[c] = 해당 컬럼이 비는 시각(endMin)
    let clusterItems = [];  // 현재 클러스터에 속한 result 인덱스

    for (const item of sorted) {
        if (item.startMin >= clusterEnd) {
            // 새 클러스터 — 이전 클러스터 _ncol 확정
            finalizeCluster(result, clusterItems, columns.length);
            columns = [];
            clusterItems = [];
            clusterEnd = item.endMin;
            clusterStart = item.startMin;
        } else {
            clusterEnd = Math.max(clusterEnd, item.endMin);
        }

        // 그리디: 끝난 컬럼 중 가장 앞 것 재사용
        let col = -1;
        for (let c = 0; c < columns.length; c++) {
            if (columns[c] <= item.startMin) {
                col = c;
                break;
            }
        }
        if (col === -1) {
            col = columns.length;
            columns.push(0);
        }
        columns[col] = item.endMin;

        const idx = result.length;
        result.push({ ...item, _col: col, _ncol: 0 });
        clusterItems.push(idx);
    }
    finalizeCluster(result, clusterItems, columns.length);

    return result;
}

function finalizeCluster(result, items, ncol) {
    const n = Math.max(ncol, 1);
    for (const idx of items) {
        result[idx]._ncol = n;
    }
}
