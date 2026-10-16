import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayYmd } from './calendarUtils';

/**
 * 오늘 날짜("YYYY-MM-DD") — 자정을 넘기면 스스로 갱신된다.
 *
 * 렌더 시점에 `todayYmd()`를 한 번 계산해 쓰면, 앱을 켜둔 채 자정을 넘겼을 때 어제가 계속
 * '오늘'로 강조된다(월 그리드 오늘 링·주 뷰 현재시간선·목록 뷰 "오늘/내일" 라벨 전부).
 * 웹(CalendarPageMobile)도 같은 이유로 자정 타이머를 둔다.
 *
 * 1분 폴링이 아니라 **다음 자정까지 타이머 하나**만 걸어 경계에서 딱 한 번 갱신한다
 * (갱신 후 effect가 다시 돌며 그다음 자정을 예약). 백그라운드에선 JS 타이머가 멈추므로
 * 포그라운드 복귀 시에도 한 번 맞춘다 — 날짜가 그대로면 같은 문자열이라 리렌더도 없다.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayYmd);

  useEffect(() => {
    const sync = () => setToday(todayYmd());
    const now = new Date();
    // +1초 여유 — 타이머가 자정 '직전'에 깨어 같은 날짜를 다시 세팅하고 끝나는 것을 방지
    const ms =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 1000;
    const id = setTimeout(sync, ms);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, [today]);

  return today;
}
