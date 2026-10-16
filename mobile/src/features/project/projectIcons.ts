import { Ionicons } from '@expo/vector-icons';

/** 프로젝트 아이콘 키 → Ionicons. 웹 projectIcons.js 키와 동일. */
export const PROJECT_ICON_KEYS: { key: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'folder', icon: 'folder' },
  { key: 'work', icon: 'briefcase' },
  { key: 'rocket', icon: 'rocket' },
  { key: 'flag', icon: 'flag' },
  { key: 'star', icon: 'star' },
  { key: 'bolt', icon: 'flash' },
  { key: 'code', icon: 'code-slash' },
  { key: 'insights', icon: 'stats-chart' },
  { key: 'palette', icon: 'color-palette' },
  { key: 'calendar', icon: 'calendar' },
  { key: 'groups', icon: 'people' },
  { key: 'lightbulb', icon: 'bulb' },
];

const MAP: Record<string, keyof typeof Ionicons.glyphMap> = Object.fromEntries(
  PROJECT_ICON_KEYS.map((i) => [i.key, i.icon]),
);

/** iconKey → Ionicons 이름 (없으면 folder). */
export function projectIcon(key?: string): keyof typeof Ionicons.glyphMap {
  return (key && MAP[key]) || 'folder';
}
