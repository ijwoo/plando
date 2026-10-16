import { describe, it, expect } from "vitest";
import { sanitize, assignColumns } from "./eventLayout.js";

// ─── sanitize ───────────────────────────────────────────────

describe("sanitize", () => {
    it("정상 이벤트를 분 단위로 변환", () => {
        const raw = [{ start: new Date(2026, 0, 1, 9, 30), end: new Date(2026, 0, 1, 10, 0), id: 1 }];
        const out = sanitize(raw);
        expect(out).toHaveLength(1);
        expect(out[0].startMin).toBe(570);
        expect(out[0].endMin).toBe(600);
        expect(out[0]._invalid).toBe(false);
    });

    it("end 없으면 start+60", () => {
        const out = sanitize([{ start: new Date(2026, 0, 1, 14, 0), id: 1 }]);
        expect(out[0].startMin).toBe(840);
        expect(out[0].endMin).toBe(900);
    });

    it("end <= start → end = start+30, _invalid", () => {
        const out = sanitize([{
            start: new Date(2026, 0, 1, 10, 0),
            end: new Date(2026, 0, 1, 9, 0),
            id: 1,
        }]);
        expect(out[0].endMin).toBe(630);
        expect(out[0]._invalid).toBe(true);
    });

    it("end == start (0분 이벤트) → end = start+30, _invalid", () => {
        const out = sanitize([{
            start: new Date(2026, 0, 1, 12, 0),
            end: new Date(2026, 0, 1, 12, 0),
            id: 1,
        }]);
        expect(out[0].endMin).toBe(750);
        expect(out[0]._invalid).toBe(true);
    });

    it("자정 넘김 → 1440으로 클램프, _invalid", () => {
        const out = sanitize([{
            start: new Date(2026, 0, 1, 23, 0),
            end: new Date(2026, 0, 2, 1, 0),  // 다음날 1시
            id: 1,
        }]);
        // end의 toMinutes는 Date 기준 hours*60+minutes = 1*60=60 이므로 end(60) < start(1380)
        // → end <= start 조건에 걸림 → end = start+30 = 1410
        expect(out[0].startMin).toBe(1380);
        expect(out[0]._invalid).toBe(true);
    });

    it("음수 start → 0으로 클램프, _invalid", () => {
        const out = sanitize([{ start: -30, end: 60, id: 1 }]);
        expect(out[0].startMin).toBe(0);
        expect(out[0].endMin).toBe(60);
        expect(out[0]._invalid).toBe(true);
    });

    it("start > 1440 → 스킵", () => {
        const out = sanitize([{ start: 1500, end: 1560, id: 1 }]);
        expect(out).toHaveLength(0);
    });

    it("NaN start → 스킵", () => {
        const out = sanitize([{ start: NaN, end: 600, id: 1 }]);
        expect(out).toHaveLength(0);
    });

    it("start가 문자열 → 스킵", () => {
        const out = sanitize([{ start: "invalid", end: 600, id: 1 }]);
        expect(out).toHaveLength(0);
    });

    it("end > 1440 → 1440으로 클램프", () => {
        const out = sanitize([{ start: 1400, end: 1500, id: 1 }]);
        expect(out[0].endMin).toBe(1440);
        expect(out[0]._invalid).toBe(true);
    });
});

// ─── assignColumns ──────────────────────────────────────────

describe("assignColumns", () => {
    it("빈 배열 → 빈 배열", () => {
        expect(assignColumns([])).toEqual([]);
    });

    it("안 겹침 → 모두 1컬럼", () => {
        const events = [
            { startMin: 60, endMin: 120, id: 1 },
            { startMin: 180, endMin: 240, id: 2 },
            { startMin: 300, endMin: 360, id: 3 },
        ];
        const out = assignColumns(events);
        expect(out).toHaveLength(3);
        out.forEach((e) => {
            expect(e._col).toBe(0);
            expect(e._ncol).toBe(1);
        });
    });

    it("2개 부분 겹침 → 2컬럼", () => {
        const events = [
            { startMin: 60, endMin: 150, id: 1 },
            { startMin: 120, endMin: 210, id: 2 },
        ];
        const out = assignColumns(events);
        expect(out).toHaveLength(2);
        expect(out[0]._col).toBe(0);
        expect(out[1]._col).toBe(1);
        expect(out[0]._ncol).toBe(2);
        expect(out[1]._ncol).toBe(2);
    });

    it("A 안에 B 완전 포함 → 2컬럼", () => {
        const events = [
            { startMin: 60, endMin: 300, id: 1 },  // A: 1:00-5:00
            { startMin: 120, endMin: 180, id: 2 },  // B: 2:00-3:00 (A 안에 포함)
        ];
        const out = assignColumns(events);
        expect(out).toHaveLength(2);
        const cols = out.map((e) => e._col);
        expect(cols).toContain(0);
        expect(cols).toContain(1);
        expect(out[0]._ncol).toBe(2);
        expect(out[1]._ncol).toBe(2);
    });

    it("3개 동시 겹침 → 3컬럼", () => {
        const events = [
            { startMin: 60, endMin: 180, id: 1 },
            { startMin: 60, endMin: 180, id: 2 },
            { startMin: 60, endMin: 180, id: 3 },
        ];
        const out = assignColumns(events);
        expect(out).toHaveLength(3);
        const cols = new Set(out.map((e) => e._col));
        expect(cols.size).toBe(3);
        out.forEach((e) => expect(e._ncol).toBe(3));
    });

    it("컬럼 재사용: A끝나고 C가 A 자리에", () => {
        // A: 0-60, B: 30-90, C: 60-120
        // A와 B 겹침(2컬럼), B와 C 겹침, A끝나면 C는 col0 재사용
        const events = [
            { startMin: 0, endMin: 60, id: "A" },
            { startMin: 30, endMin: 90, id: "B" },
            { startMin: 60, endMin: 120, id: "C" },
        ];
        const out = assignColumns(events);
        const a = out.find((e) => e.id === "A");
        const b = out.find((e) => e.id === "B");
        const c = out.find((e) => e.id === "C");
        expect(a._col).toBe(0);
        expect(b._col).toBe(1);
        expect(c._col).toBe(0); // A 끝났으므로 재사용
    });

    it("겹치지 않는 별개 클러스터는 독립 _ncol", () => {
        const events = [
            { startMin: 0, endMin: 60, id: 1 },
            { startMin: 30, endMin: 90, id: 2 },
            // gap
            { startMin: 200, endMin: 260, id: 3 },
        ];
        const out = assignColumns(events);
        const e1 = out.find((e) => e.id === 1);
        const e2 = out.find((e) => e.id === 2);
        const e3 = out.find((e) => e.id === 3);
        expect(e1._ncol).toBe(2);
        expect(e2._ncol).toBe(2);
        expect(e3._ncol).toBe(1); // 별개 클러스터
        expect(e3._col).toBe(0);
    });

    it("원본 배열 변경하지 않음", () => {
        const events = [
            { startMin: 0, endMin: 60, id: 1 },
            { startMin: 30, endMin: 90, id: 2 },
        ];
        const copy = JSON.parse(JSON.stringify(events));
        assignColumns(events);
        expect(events).toEqual(copy);
    });
});
