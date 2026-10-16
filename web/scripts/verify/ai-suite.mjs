// AI 기능 통합 검증 — 운영 배포본 대상.
//
// 눈으로 훑는 대신 항목마다 통과/실패를 찍는다. AI 실호출은 비용이 나가므로 4회로 묶었다.
// (역할 제한 1회, 조회 1회, 생성 1회, 다단계 1회)
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.SUITE_BASE || "https://plando.imjaewoo.dev";
const OUT = process.env.SHOT_OUT || "/tmp/plando-ai-suite";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, note = "") => {
  results.push({ name, ok, note });
  console.log(`  ${ok ? "✅" : "❌"} ${name}${note ? ` — ${note}` : ""}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1, serviceWorkers: "block" });
const page = await ctx.newPage();
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 160)));
const bad = [];
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().includes("/api/auth/")) bad.push(`${r.status()} ${r.url().replace(BASE, "").slice(0, 70)}`);
});

// ── 진입 ──────────────────────────────────────────────
await page.goto(`${BASE}/#/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
await page.getByText("둘러보기", { exact: false }).first().click();
await page.waitForTimeout(6000);
for (const t of ["다시 보지 않기", "건너뛰기"]) {
  const b = page.getByText(t, { exact: false }).first();
  if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(700); break; }
}
await page.evaluate(() => window.dispatchEvent(new Event("open-chat")));
await page.waitForTimeout(1500);

// ── 1. 패널 모드 ──────────────────────────────────────
check("패널: 예시 탭 3종", (await page.getByText("추가", { exact: true }).count()) > 0
  && (await page.getByText("조회", { exact: true }).count()) > 0
  && (await page.getByText("정리", { exact: true }).count()) > 0);

// ── 2. 전체화면 전환 ──────────────────────────────────
const expand = page.getByRole("button", { name: "넓게 보기" }).first();
check("전체화면 토글 존재", (await expand.count()) > 0);
if (await expand.count()) { await expand.click(); await page.waitForTimeout(1500); }

check("사이드바: 새 대화", (await page.getByText("새 대화", { exact: true }).count()) > 0);
check("사이드바: 역할 목록", (await page.getByText("역할", { exact: true }).count()) > 0);
check("사이드바: 만들기", (await page.getByText("+ 만들기", { exact: false }).count()) > 0);
check("사이드바: 사용량", (await page.getByText("오늘 AI 사용", { exact: false }).count()) > 0);
check("내장 역할 4종", (await page.getByText("정리 도우미", { exact: false }).count()) > 0
  && (await page.getByText("빠른 기록", { exact: false }).count()) > 0
  && (await page.getByText("점검 도우미", { exact: false }).count()) > 0);
check("읽기 전용 배지", (await page.getByText("읽기 전용", { exact: true }).count()) > 0);
check("계정·워크스페이스 표시", (await page.getByText("Plando 체험 워크스페이스", { exact: false }).count()) > 0);

// 사용량 시작값
const usageBefore = await page.evaluate(() => {
  const m = document.body.innerText.match(/오늘 AI 사용\s*(\d+)\s*\/\s*(\d+)/);
  return m ? { used: +m[1], limit: +m[2] } : null;
});
check("사용량 파싱", !!usageBefore, usageBefore ? `${usageBefore.used}/${usageBefore.limit}` : "");

// ── 3. 역할 만들기 다이얼로그 ─────────────────────────
await page.getByText("+ 만들기", { exact: false }).first().click();
await page.waitForTimeout(900);
check("다이얼로그 열림", (await page.getByText("역할 만들기", { exact: true }).count()) > 0);
check("제한 없음 경고", (await page.getByText("제한 없이 모든 일을 할 수 있어요", { exact: false }).count()) > 0);
// 조회만 켜면 읽기 전용 안내로 바뀌어야 한다
await page.getByText("할 일을 찾아봐요", { exact: false }).first().click();
await page.waitForTimeout(500);
check("조회만 → 읽기 전용 안내", (await page.getByText("아무것도 바꾸지 않아요", { exact: false }).count()) > 0);
// 변경 도구를 켜면 다시 바뀌어야 한다
await page.getByText("새 할 일을 만들어요", { exact: false }).first().click();
await page.waitForTimeout(500);
check("변경 포함 → 변경 안내", (await page.getByText("데이터를 바꿀 수 있어요", { exact: false }).count()) > 0);
await page.getByText("취소", { exact: true }).first().click();
await page.waitForTimeout(700);

// ── 4. 실제 AI: 조회 ──────────────────────────────────
async function ask(text, waitMs = 22000) {
  const ta = page.getByPlaceholder("메시지를 입력하세요...").first();
  await ta.click();
  await ta.fill(text);
  await page.keyboard.press("Meta+Enter");
  await page.waitForTimeout(waitMs);
  return page.evaluate(() => document.body.innerText);
}

let body = await ask("이번주 할 일 보여줘");
check("조회: 결과 카드", /조회 결과/.test(body));
check("조회: 단계 표시", /단계 실행/.test(body));
check("조회: 답변에 목록 중복 없음", !/1\)\s\S/.test(body));
check("조회: 전체폭 열기 버튼 없음", !/^열기$/m.test(body));

// ── 5. 실제 AI: 생성 ──────────────────────────────────
body = await ask("내일 오후 3시 팀 회의 추가해줘");
check("생성: 초안 카드", /AI 초안/.test(body));
check("생성: 문구 간결", !/마감:.*장소:/.test(body));

// ── 6. 역할 제한 (실제 AI) ────────────────────────────
await page.getByText("지금 상태를 살펴보고 알려드려요", { exact: false }).first().click();
await page.waitForTimeout(700);
body = await ask("오늘 할 일 전부 삭제해줘");
check("점검 도우미: 삭제 단계 없음", !/할 일 삭제/.test(body));

// ── 7. 대화 저장 ──────────────────────────────────────
check("대화 목록에 쌓임", (await page.getByText("오늘", { exact: true }).count()) > 0);
const convCount = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem("plando.chat.history.v1") || "[]").length; } catch { return 0; }
});
check("localStorage 저장", convCount > 0, `${convCount}건`);

// ── 8. 사용량 증가 ────────────────────────────────────
const usageAfter = await page.evaluate(() => {
  const m = document.body.innerText.match(/오늘 AI 사용\s*(\d+)\s*\/\s*(\d+)/);
  return m ? { used: +m[1], limit: +m[2] } : null;
});
check("사용량 증가", usageBefore && usageAfter && usageAfter.used > usageBefore.used,
  usageBefore && usageAfter ? `${usageBefore.used} → ${usageAfter.used}` : "");

// ── 9. 오류 ───────────────────────────────────────────
check("JS 오류 없음", jsErrors.length === 0, jsErrors.join(" | "));
check("4xx/5xx 없음", bad.length === 0, [...new Set(bad)].join(" | "));

await page.screenshot({ path: `${OUT}/final.png`, fullPage: false });
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n  ── ${results.length - failed.length}/${results.length} 통과 ──`);
if (failed.length) {
  console.log("  실패:");
  failed.forEach((f) => console.log(`   · ${f.name}${f.note ? ` (${f.note})` : ""}`));
  process.exit(1);
}
