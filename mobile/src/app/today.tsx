import { Redirect } from 'expo-router';

/** 위젯 딥링크(plando://today) → 할일 탭 '오늘' */
export default function TodayRedirect() {
  return <Redirect href="/todo?tab=today" />;
}
