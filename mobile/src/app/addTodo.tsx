import { Redirect } from 'expo-router';

/** 위젯 딥링크(plando://addTodo) → 작성 화면 (기존 Capacitor 위젯 URL 계약 유지) */
export default function AddTodoRedirect() {
  return <Redirect href="/todo/new" />;
}
