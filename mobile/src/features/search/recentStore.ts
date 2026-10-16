import * as SecureStore from 'expo-secure-store';

/** 최근 검색어 (기기 로컬, 최대 8개) — 웹 recentSearches 미러. 프로젝트 표준 저장소(SecureStore) 사용. */
const KEY = 'plando_recent_searches';
const MAX = 8;

export async function loadRecents(): Promise<string[]> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    const arr = v ? (JSON.parse(v) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function save(list: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // 저장 실패는 조용히 무시
  }
}

/** 맨 앞 삽입 + 중복 제거 + 개수 제한. 갱신된 목록 반환. */
export async function pushRecent(q: string): Promise<string[]> {
  const v = q.trim();
  if (!v) return loadRecents();
  const cur = await loadRecents();
  const next = [v, ...cur.filter((x) => x !== v)].slice(0, MAX);
  await save(next);
  return next;
}

export async function removeRecent(q: string): Promise<string[]> {
  const next = (await loadRecents()).filter((x) => x !== q);
  await save(next);
  return next;
}
