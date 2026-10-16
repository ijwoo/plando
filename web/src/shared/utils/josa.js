/**
 * 한국어 조사 붙이기.
 *
 * "시작일을(를) …로 변경했어요" 처럼 괄호를 그대로 내보내면 기계가 쓴 글로 읽힌다.
 * 받침만 보면 되는 규칙이라 라이브러리를 들이지 않고 여기서 끝낸다.
 *
 * 유니코드 한글 음절은 (초성×21 + 중성)×28 + 종성 으로 배치돼 있어서,
 * 코드포인트를 28로 나눈 나머지가 곧 종성 번호다(0이면 받침 없음, 8이면 ㄹ).
 */

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** 종성 번호. 한글이 아니면 null(조사를 고를 근거가 없다). */
function finalConsonant(word) {
  if (!word) return null;
  const code = String(word).trim().slice(-1).charCodeAt(0);
  if (Number.isNaN(code) || code < HANGUL_START || code > HANGUL_END) return null;
  return (code - HANGUL_START) % 28;
}

/** 받침이 있으면 앞쪽, 없으면 뒤쪽. 판단할 수 없으면 뒤쪽(모음형)으로 둔다. */
function pick(word, withBatchim, withoutBatchim) {
  const jong = finalConsonant(word);
  if (jong === null) return withoutBatchim;
  return jong === 0 ? withoutBatchim : withBatchim;
}

/** 을/를 */
export function eulReul(word) {
  return pick(word, "을", "를");
}

/** 이/가 */
export function iGa(word) {
  return pick(word, "이", "가");
}

/** 은/는 */
export function eunNeun(word) {
  return pick(word, "은", "는");
}

/**
 * 으로/로.
 * ㄹ 받침(종성 8)은 예외로 "로" 를 쓴다 — "서울로", "높음으로".
 */
export function euRo(word) {
  const jong = finalConsonant(word);
  if (jong === null || jong === 0 || jong === 8) return "로";
  return "으로";
}

/** 낱말 + 조사를 한 번에. `josa("우선순위", eulReul)` → "우선순위를" */
export function josa(word, fn) {
  return `${word}${fn(word)}`;
}
