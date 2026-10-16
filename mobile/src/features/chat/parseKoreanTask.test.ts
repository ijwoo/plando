import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatHintDate, parseKoreanTask } from './parseKoreanTask.ts';

/*
 * 기준 시각은 고정한다 — 내부에서 new Date() 를 부르면 "내일" 이 실행 시각에 따라
 * 달라져 아무것도 못 박을 수 없다.
 * 2026-08-04(화) 10:00 KST.
 */
const NOW = new Date(2026, 7, 4, 10, 0, 0);

const hints = (text: string) => parseKoreanTask(text, NOW);
const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// ── 날짜 ────────────────────────────────────────────────
test('오늘', () => {
  const r = hints('오늘 보고서 쓰기');
  assert.equal(ymd(r.datetime!), '2026-8-4');
  assert.equal(r.hasTime, false);
});

test('내일', () => {
  assert.equal(ymd(hints('내일 팀 미팅').datetime!), '2026-8-5');
});

test('모레', () => {
  assert.equal(ymd(hints('모레까지 정산').datetime!), '2026-8-6');
});

test('N월 N일', () => {
  assert.equal(ymd(hints('9월 3일 워크샵').datetime!), '2026-9-3');
});

test('이미 지난 N월 N일은 내년으로 본다', () => {
  // 8월에 "1월 5일" 이라고 하면 지난 1월이 아니라 다가올 1월이다
  assert.equal(ymd(hints('1월 5일 신년회').datetime!), '2027-1-5');
});

test('이번주 금요일', () => {
  // 2026-08-04 는 화요일 → 같은 주 금요일은 8/7
  assert.equal(ymd(hints('이번주 금요일까지 기획서').datetime!), '2026-8-7');
});

test('다음주 월요일', () => {
  assert.equal(ymd(hints('다음주 월요일 회의').datetime!), '2026-8-10');
});

test('주 지정 없는 요일이 이미 지났으면 다음 주로 본다', () => {
  // 화요일에 "월요일" 이라고 하면 어제가 아니라 다음 월요일이다
  assert.equal(ymd(hints('월요일에 발표').datetime!), '2026-8-10');
});

// ── 시각 ────────────────────────────────────────────────
test('오후 N시', () => {
  const r = hints('내일 오후 3시 팀 미팅');
  assert.equal(hm(r.datetime!), '15:00');
  assert.equal(r.hasTime, true);
});

test('오전 N시 N분', () => {
  assert.equal(hm(hints('오전 9시 30분 스탠드업').datetime!), '09:30');
});

test('N시 반', () => {
  assert.equal(hm(hints('오후 2시 반 콜').datetime!), '14:30');
});

test('저녁 N시는 오후로 읽는다', () => {
  assert.equal(hm(hints('저녁 7시 약속').datetime!), '19:00');
});

test('시각 없는 때 표현', () => {
  assert.equal(hm(hints('내일 점심 약속').datetime!), '12:00');
  assert.equal(hm(hints('내일 아침 러닝').datetime!), '08:00');
});

test('오전·오후를 알 수 없는 "3시" 는 시각을 비운다', () => {
  /* [고정하는 결정] 통계적으로 오후가 많다고 15:00 이라 우기면, 아침 회의를 적은
     사람에게 대놓고 틀린 칩을 보여주게 된다. 틀린 칩 하나가 안 뜬 칩 셋보다 나쁘다. */
  const r = hints('3시 팀 미팅');
  assert.equal(r.datetime, undefined); // 날짜 단서도 없으니 아무것도 내놓지 않는다
  assert.equal(r.hasTime, undefined);
});

test('날짜만 있고 시각이 애매하면 날짜는 살린다', () => {
  const r = hints('내일 3시 회의');
  assert.equal(ymd(r.datetime!), '2026-8-5');
  assert.equal(r.hasTime, false);
});

test('날짜 없이 시각만 있으면 오늘로 본다', () => {
  const r = hints('오후 4시에 콜');
  assert.equal(ymd(r.datetime!), '2026-8-4');
  assert.equal(hm(r.datetime!), '16:00');
});

test('24시를 넘는 값은 버린다', () => {
  assert.equal(hints('오후 30시 회의').datetime, undefined);
});

// ── 장소 ────────────────────────────────────────────────
test('~에서 앞의 장소', () => {
  assert.equal(hints('내일 오후 3시 강남역에서 팀 미팅').location, '강남역');
});

test('~들러 앞의 장소', () => {
  assert.equal(hints('퇴근길에 마트 들러 우유 사기').location, '마트');
});

test('장소 접미사가 없으면 장소로 보지 않는다', () => {
  // "회의" 는 장소가 아니다 — 조사만 보고 잡으면 아무 명사나 장소가 된다
  assert.equal(hints('회의에서 발표하기').location, undefined);
});

test('시간 표현은 장소로 새지 않는다', () => {
  assert.equal(hints('이번주 토요일 오전에 팀 미팅').location, undefined);
  assert.equal(hints('3시까지 보고서').location, undefined);
  assert.equal(hints('내일까지 정산').location, undefined);
});

test('그 자체로 장소인 낱말', () => {
  assert.equal(hints('집에서 정리하기').location, '집');
});

// ── 우선순위 ────────────────────────────────────────────
test('높음', () => {
  assert.equal(hints('다음주 금요일까지 보고서 초안 급하게').priority, 'high');
  assert.equal(hints('중요 계약서 검토').priority, 'high');
});

test('낮음', () => {
  assert.equal(hints('나중에 사진 정리').priority, 'low');
  assert.equal(hints('천천히 리팩터링').priority, 'low');
});

test('"급하지 않게" 를 높음으로 뒤집지 않는다', () => {
  /* [고정하는 결함이 될 뻔한 것] '급하' 로 매칭하면 정반대 칩이 뜬다.
     방향이 뒤집힌 칩은 안 뜬 것보다 훨씬 해롭다. */
  assert.equal(hints('급하지 않게 정리').priority, 'low');
});

test('단서가 없으면 우선순위를 만들지 않는다', () => {
  assert.equal(hints('보고서 쓰기').priority, undefined);
});

// ── 전체 / 경계 ─────────────────────────────────────────
test('빈 입력', () => {
  assert.deepEqual(parseKoreanTask('', NOW), {});
  assert.deepEqual(parseKoreanTask('   ', NOW), {});
});

test('아무 단서 없는 문장은 아무것도 내놓지 않는다', () => {
  assert.deepEqual(hints('ㅁㄴㅇㄹ'), {});
});

test('세 가지가 한 문장에 다 있는 경우', () => {
  const r = hints('내일 오후 3시 강남역에서 팀 미팅 급하게');
  assert.equal(ymd(r.datetime!), '2026-8-5');
  assert.equal(hm(r.datetime!), '15:00');
  assert.equal(r.location, '강남역');
  assert.equal(r.priority, 'high');
});

// ── 표기 ────────────────────────────────────────────────
test('표기는 상대 표현을 살린다', () => {
  assert.equal(formatHintDate(new Date(2026, 7, 5, 15, 0), true, NOW), '내일 15:00');
  assert.equal(formatHintDate(new Date(2026, 7, 4, 9, 5), true, NOW), '오늘 09:05');
  assert.equal(formatHintDate(new Date(2026, 7, 6), false, NOW), '모레');
  assert.equal(formatHintDate(new Date(2026, 8, 3), false, NOW), '9/3');
});

test('시각을 모르면 표기에도 시각을 쓰지 않는다', () => {
  // "내일 00:00" 은 사용자가 말하지 않은 자정을 우리가 지어낸 것이다
  assert.equal(formatHintDate(new Date(2026, 7, 5), false, NOW), '내일');
});
