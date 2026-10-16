import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toDraft } from './shareDraft.ts';

/**
 * 공유받은 것 → 할 일 초안.
 *
 * [고정하는 결함] 아이폰 메모를 공유하면 제목이 **"icloud.com"** 인 할 일이 만들어졌다.
 * 메모는 본문 대신 iCloud 링크를 넘겨주는데, 링크뿐일 때 호스트를 제목으로 썼기 때문이다.
 * 도메인은 무슨 일인지 하나도 알려주지 않으면서 칸만 채워서, 사용자가 지우고 다시 써야 한다.
 */

test('링크만 공유되면 제목을 비운다 (도메인을 넣지 않는다)', () => {
  const d = toDraft({ url: 'https://www.icloud.com/notes/037kSqgnKg', sharedAt: '' });
  assert.equal(d.title, '', '"icloud.com" 같은 도메인이 제목이 되면 안 된다');
  assert.match(d.content ?? '', /icloud\.com\/notes/, '링크는 본문에 남아야 한다');
});

test('첫 줄이 링크인 텍스트도 제목으로 쓰지 않는다', () => {
  // 링크만 공유하면 text 에도 같은 링크가 들어오는 앱이 있다
  const d = toDraft({ text: 'https://example.com/a', url: 'https://example.com/a', sharedAt: '' });
  assert.equal(d.title, '');
});

test('사람이 쓴 글이면 첫 줄이 제목이 된다', () => {
  const d = toDraft({ text: '킥오프 미팅 준비\n장소는 강남 사무실', sharedAt: '' });
  assert.equal(d.title, '킥오프 미팅 준비');
  assert.match(d.content ?? '', /강남 사무실/, '나머지 줄은 본문에 남아야 한다');
});

test('제목과 링크가 함께 오면 제목은 글에서, 링크는 본문에', () => {
  const d = toDraft({ text: '분기 보고서 초안', url: 'https://example.com/doc', sharedAt: '' });
  assert.equal(d.title, '분기 보고서 초안');
  assert.match(d.content ?? '', /example\.com\/doc/);
});

test('제목이 길면 60자에서 자른다', () => {
  const d = toDraft({ text: '가'.repeat(80), sharedAt: '' });
  assert.equal(d.title.length, 60);
  assert.match(d.content ?? '', /가{80}/, '잘린 뒤에도 전문은 본문에 남아야 한다');
});

test('아무것도 없으면 빈 초안', () => {
  const d = toDraft({ sharedAt: '' });
  assert.equal(d.title, '');
  assert.equal(d.content, undefined);
});
