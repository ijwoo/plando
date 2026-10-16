import type { SharedInboxItem } from '@/native-modules/widget';

/**
 * 공유 항목 → 할 일 초안.
 *
 * 제목은 **사람이 쓴 글에서만** 뽑는다. 링크뿐일 때 호스트를 제목으로 넣었더니
 * 아이폰 메모를 공유하면 제목이 "icloud.com" 인 할 일이 만들어졌다 — 메모는 본문 대신
 * iCloud 링크를 넘겨주기 때문이다. 도메인은 무슨 일인지 하나도 알려주지 않으면서 칸만
 * 채워서, 사용자가 지우고 다시 써야 한다.
 *
 * 그래서 쓸 만한 제목이 없으면 **비워 둔다.** 작성 화면은 제목이 비면 저장이 잠기므로
 * 커서가 그 자리에 머물고, 링크는 본문에 남는다. 채워 넣는 것보다 비우는 쪽이 빠르다.
 */
export function toDraft(item: SharedInboxItem): { title: string; content?: string } {
  const text = item.text?.trim() ?? '';
  const url = item.url?.trim() ?? '';
  const firstLine = text.split('\n')[0]?.trim() ?? '';

  // 첫 줄이 링크면 제목이 아니다 — 링크만 공유되면 텍스트에도 같은 링크가 들어온다
  const looksLikeUrl = /^https?:\/\//i.test(firstLine);
  const title = looksLikeUrl ? '' : firstLine.slice(0, 60);

  const parts: string[] = [];
  if (text && text !== url && (text.length > firstLine.length || firstLine.length > 60)) parts.push(text);
  if (url) parts.push(url);
  return { title, content: parts.length ? parts.join('\n\n') : undefined };
}
