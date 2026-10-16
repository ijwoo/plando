import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { type ChatAgent } from '@/features/chat/api';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * 역할별 색. 대화 배경 빛과 목록 아이콘이 같은 색을 쓴다 — 역할을 바꾸면 화면 공기가
 * 바뀌어야 "다른 역할로 말하고 있다" 가 느껴진다.
 *
 * 하드코딩이지만 서버가 색을 내려주지 않으므로 여기서 정한다 — id 가 바뀌면 기본색이 될 뿐
 * 화면이 깨지지는 않는다.
 */
export const AGENT_ACCENT: Record<string, string> = {
  default: '#3B82F6', // 파랑
  planner: '#8B5CF6', // 보라 — 정리 도우미
  capture: '#F59E0B', // 호박 — 빠른 기록
  review: '#10B981', // 초록 — 점검 도우미
};

/**
 * 내장 역할의 심볼.
 *
 * [고치는 결함] 예전에는 서버가 준 이모지(✨🧹⚡🔎)를 그대로 그렸다. 이모지는 저마다
 * 색과 굵기가 다른 그림이라, 다섯 줄이 모이면 팔레트가 다섯 개가 된다. 옆의 권한 뱃지까지
 * 색을 쓰니 한 줄에 색 체계가 둘이었다. 게다가 마지막 줄의 '역할 만들기' 만 선 아이콘이라
 * 아이콘 가족이 아예 섞여 있었다.
 *
 * 내장 역할은 굵기가 같은 단색 심볼로 통일하고, 색은 그 역할 색 하나만 쓴다.
 * **직접 만든 역할은 사용자가 고른 이모지를 그대로 존중한다** — 그건 그 사람의 표시다.
 */
const BUILT_IN_ICON: Record<string, IoniconName> = {
  default: 'sparkles-outline', // 넷 다 outline — 굵기가 섞이면 통일한 의미가 없다
  planner: 'brush-outline', // 🧹 를 잇는다
  capture: 'flash-outline',
  review: 'search-outline',
};

export type AgentLook = {
  /** 내장 역할이면 심볼, 직접 만든 역할이면 undefined */
  icon?: IoniconName;
  /** 심볼이 없을 때 그릴 이모지 */
  emoji?: string;
  /** 심볼·타일 배경에 쓰는 색 */
  color: string;
};

export function agentLook(agent: ChatAgent | undefined, fallbackColor: string): AgentLook {
  const icon = agent ? BUILT_IN_ICON[agent.id] : undefined;
  const color = (agent ? AGENT_ACCENT[agent.id] : undefined) ?? fallbackColor;
  if (icon) return { icon, color };
  return { emoji: agent?.emoji || '🤖', color };
}
