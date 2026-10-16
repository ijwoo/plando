/**
 * 한국어 할 일 문장에서 날짜·장소·우선순위를 뽑는 **순수 함수**.
 *
 * 입력창 위에 "AI 가 알아듣고 있다" 를 미리 보여주기 위한 것이라, 서버(LLM) 파싱과
 * 경쟁하지 않는다. 여기서 틀려도 실제 저장값은 서버 결과를 따른다.
 *
 * 설계 원칙 하나만 기억하면 된다: **확신이 없으면 아무것도 내놓지 않는다.**
 * 틀린 칩 하나가 안 뜬 칩 셋보다 훨씬 나쁘다 — 한 번 틀리면 그 뒤로는 맞아도 안 믿는다.
 * 그래서 "3시" 처럼 오전·오후를 알 수 없는 표현은 시각을 비워 둔다(날짜만 내놓는다).
 *
 * now 를 인자로 받는 이유는 테스트 때문이다. 내부에서 new Date() 를 부르면
 * "내일" 이 언제인지가 실행 시각에 따라 달라져 고정할 수가 없다.
 */

export interface ParsedHints {
  datetime?: Date;
  /**
   * 시각까지 알아냈는가.
   * 날짜만 찾았을 때 datetime 은 그날 00:00 이 되는데, 그대로 "내일 00:00" 이라고
   * 쓰면 사용자가 말하지 않은 자정을 우리가 지어낸 것이 된다.
   */
  hasTime?: boolean;
  location?: string;
  priority?: 'high' | 'low';
}

/** 장소로 인정할 접미사. 여기 없으면 장소로 보지 않는다(과잉 인식 방지). */
const PLACE_SUFFIXES = [
  '역', '점', '마트', '카페', '사무실', '회의실', '학교', '병원', '공항', '공원',
  '센터', '타워', '빌딩', '호텔', '식당', '도서관', '체육관', '헬스장', '미용실',
  '은행', '약국', '편의점', '백화점', '시장', '휴게소', '주차장', '지점',
];

/** 그 자체로 장소인 낱말. */
const PLACE_WORDS = ['집', '회사', '학교', '사무실', '본사', '지사'];

/** 장소 자리에 오지만 장소가 아닌 것들 — 시간 표현이 조사와 붙는 경우가 많다. */
const NOT_PLACE = [
  '오늘', '내일', '모레', '글피', '어제', '이번주', '다음주', '이번달', '다음달',
  '오전', '오후', '아침', '점심', '저녁', '밤', '새벽', '지금', '나중',
  '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일',
];

const WEEKDAYS: Record<string, number> = {
  일요일: 0, 월요일: 1, 화요일: 2, 수요일: 3, 목요일: 4, 금요일: 5, 토요일: 6,
};

const HIGH_WORDS = ['급하게', '급함', '급히', '급한', '시급', '중요', '반드시', 'asap'];
const LOW_WORDS = ['나중에', '천천히', '여유있게', '여유롭게', '급하지 않'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** 날짜만 뽑는다. 못 찾으면 null. */
function parseDate(text: string, now: Date): Date | null {
  if (/모레/.test(text)) return addDays(startOfDay(now), 2);
  if (/내일/.test(text)) return addDays(startOfDay(now), 1);
  if (/오늘/.test(text)) return startOfDay(now);

  // N월 N일 — 이미 지난 날짜면 내년으로 본다("1월 5일" 을 8월에 말하면 내년이다)
  const md = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (md) {
    const month = Number(md[1]) - 1;
    const day = Number(md[2]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      let d = new Date(now.getFullYear(), month, day);
      if (d.getTime() < startOfDay(now).getTime()) d = new Date(now.getFullYear() + 1, month, day);
      return d;
    }
  }

  // (이번주|다음주)? X요일
  const wd = text.match(/(이번\s*주|다음\s*주|담주)?\s*([월화수목금토일]요일)/);
  if (wd) {
    const target = WEEKDAYS[wd[2]];
    if (target === undefined) return null;
    // 이번 주 월요일을 기준으로 잡는다(한국에서 한 주는 월요일에 시작한다)
    const today = startOfDay(now);
    const mondayOffset = (today.getDay() + 6) % 7;
    const thisMonday = addDays(today, -mondayOffset);
    const base = wd[1] && /다음|담/.test(wd[1]) ? addDays(thisMonday, 7) : thisMonday;
    const targetOffset = (target + 6) % 7; // 월=0 … 일=6
    const picked = addDays(base, targetOffset);
    // "금요일" 처럼 주 지정이 없고 이미 지났으면 다음 주로 본다
    if (!wd[1] && picked.getTime() < today.getTime()) return addDays(picked, 7);
    return picked;
  }
  return null;
}

/** 시각만 뽑는다. 오전·오후를 확정할 수 없으면 null(= 시각 없음). */
function parseTime(text: string): { hour: number; minute: number } | null {
  const hm = text.match(/(오전|오후|아침|점심|저녁|밤|새벽)?\s*(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?/);
  if (hm) {
    const marker = hm[1];
    let hour = Number(hm[2]);
    const minute = hm[3] === '반' ? 30 : hm[4] ? Number(hm[4]) : 0;
    if (hour > 24 || minute > 59) return null;

    if (marker === '오후' || marker === '저녁' || marker === '밤') {
      if (hour < 12) hour += 12;
    } else if (marker === '오전' || marker === '아침' || marker === '새벽') {
      if (hour === 12) hour = 0;
    } else if (marker === '점심') {
      if (hour < 12) hour += 12;
    } else if (hour <= 12) {
      /* 표시를 포기하는 자리.
         "3시 팀 미팅" 이 오전인지 오후인지 문장만으로는 알 수 없다. 통계적으로 오후가
         많다고 15:00 이라고 우기면, 아침 회의를 적은 사람에게 대놓고 틀린 칩을 보여주게
         된다. 시각을 비우면 날짜 칩은 그대로 뜨고 시간만 서버가 정한다. */
      return null;
    }
    if (hour > 23) return null;
    return { hour, minute };
  }

  // 시각 없는 때 표현 — 이건 관용적으로 굳어 있어 확신할 수 있다
  if (/점심/.test(text)) return { hour: 12, minute: 0 };
  if (/저녁/.test(text)) return { hour: 19, minute: 0 };
  if (/아침/.test(text)) return { hour: 8, minute: 0 };
  return null;
}

function parseLocation(text: string): string | undefined {
  // "~에서 / ~으로 / ~로 / ~까지 / ~ 들러" 앞의 낱말
  // 1글자도 받는다 — "집에서" 의 '집' 이 걸러지면 안 된다. 진짜 장소인지는 아래에서 가린다.
  const re = /([가-힣A-Za-z0-9]{1,12})\s*(?:에서|에|으로|로|까지)?\s*(?:들러|들려)|([가-힣A-Za-z0-9]{1,12})(?:에서|으로|로|까지)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = (m[1] ?? m[2] ?? '').trim();
    if (!raw) continue;
    if (NOT_PLACE.includes(raw)) continue;
    if (/^\d+$/.test(raw)) continue;
    // 시간·날짜 조각이 조사와 붙은 경우 (예: "3시까지", "5일까지")
    if (/\d\s*(시|분|일|월|주)$/.test(raw)) continue;

    /* 접미사 길이에 따라 잣대를 달리한다.
       '마트'·'카페' 처럼 두 글자 이상인 접미사는 그 자체로 장소라 정확히 같아도 받는다.
       '역'·'점' 같은 한 글자는 너무 헐거워서(지역·영역·시점…) 세 글자 이상일 때만 받는다.
       '서점' 처럼 놓치는 것이 생기지만, 틀린 칩을 띄우는 쪽이 훨씬 해롭다. */
    const isPlace =
      PLACE_WORDS.includes(raw) ||
      PLACE_SUFFIXES.some((sfx) => raw.endsWith(sfx) && (sfx.length >= 2 || raw.length >= 3));
    if (isPlace) return raw;
  }
  return undefined;
}

function parsePriority(text: string): 'high' | 'low' | undefined {
  const lower = text.toLowerCase();
  // 낮음을 먼저 본다 — "급하지 않게" 가 '급하' 로 높음에 걸리면 정반대가 된다
  if (LOW_WORDS.some((w) => lower.includes(w))) return 'low';
  if (HIGH_WORDS.some((w) => lower.includes(w))) return 'high';
  return undefined;
}

export function parseKoreanTask(text: string, now: Date = new Date()): ParsedHints {
  const out: ParsedHints = {};
  if (!text || !text.trim()) return out;

  const date = parseDate(text, now);
  const time = parseTime(text);

  if (date && time) {
    const dt = new Date(date);
    dt.setHours(time.hour, time.minute, 0, 0);
    out.datetime = dt;
    out.hasTime = true;
  } else if (date) {
    out.datetime = date;
    out.hasTime = false;
  } else if (time) {
    // 날짜를 말하지 않았으면 오늘로 본다 — "3시에 회의" 는 오늘 얘기다
    const dt = startOfDay(now);
    dt.setHours(time.hour, time.minute, 0, 0);
    out.datetime = dt;
    out.hasTime = true;
  }

  const location = parseLocation(text);
  if (location) out.location = location;

  const priority = parsePriority(text);
  if (priority) out.priority = priority;

  return out;
}

/** 칩에 쓸 표기. "내일 15:00" 처럼 사용자가 말한 상대 표현을 살린다. */
export function formatHintDate(d: Date, hasTime: boolean, now: Date = new Date()): string {
  const dayDiff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000);
  const dayLabel =
    dayDiff === 0 ? '오늘' : dayDiff === 1 ? '내일' : dayDiff === 2 ? '모레' : `${d.getMonth() + 1}/${d.getDate()}`;
  if (!hasTime) return dayLabel;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dayLabel} ${hh}:${mm}`;
}
