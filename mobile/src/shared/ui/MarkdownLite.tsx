import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * 마크다운 라이트 렌더러 — 웹(TipTap)이 저장한 본문의 주요 문법을 서식으로 표시.
 * 지원: # 헤딩, - 목록, 1. 목록, > 인용, **굵게**, *기울임*, `코드`, ~~취소선~~.
 * (완전한 md 구현이 아니라 "원문 노출 방지 + 가독" 목적의 경량판)
 */
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~)/g;

/** TipTap(tiptap-markdown)이 저장 시 &lt;·&gt;를 엔티티로 이스케이프해 둔 것을 표시용으로 복원 */
export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&'); // &amp;는 마지막에 (이중 디코드 방지)
}

function InlineMd({ text, color }: { text: string; color: string }) {
  const theme = useTheme();
  const parts = text.split(INLINE);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith('**') && p.endsWith('**'))
          return (
            <Text key={i} style={{ fontWeight: '800', color }}>
              {p.slice(2, -2)}
            </Text>
          );
        if (p.startsWith('~~') && p.endsWith('~~'))
          return (
            <Text key={i} style={{ textDecorationLine: 'line-through', color }}>
              {p.slice(2, -2)}
            </Text>
          );
        if (p.startsWith('`') && p.endsWith('`'))
          return (
            <Text key={i} style={[styles.code, { backgroundColor: theme.surfaceSelected, color }]}>
              {p.slice(1, -1)}
            </Text>
          );
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2)
          return (
            <Text key={i} style={{ fontStyle: 'italic', color }}>
              {p.slice(1, -1)}
            </Text>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const theme = useTheme();
  const lines = decodeEntities(text.replace(/\r\n/g, '\n')).split('\n');
  return (
    <View style={styles.wrap}>
      {lines.map((raw, i) => {
        const h = /^(#{1,3})\s+(.*)$/.exec(raw);
        if (h)
          return (
            <Text key={i} style={[styles.line, styles[`h${h[1].length}` as 'h1'], { color: theme.text }]}>
              <InlineMd text={h[2]} color={theme.text} />
            </Text>
          );
        const li = /^\s*[-*+]\s+(.*)$/.exec(raw);
        if (li)
          return (
            <Text key={i} style={[styles.line, { color: theme.text }]}>
              {'  •  '}
              <InlineMd text={li[1]} color={theme.text} />
            </Text>
          );
        const ol = /^\s*(\d+)\.\s+(.*)$/.exec(raw);
        if (ol)
          return (
            <Text key={i} style={[styles.line, { color: theme.text }]}>
              {`  ${ol[1]}.  `}
              <InlineMd text={ol[2]} color={theme.text} />
            </Text>
          );
        const q = /^\s*>\s?(.*)$/.exec(raw);
        if (q)
          return (
            <View key={i} style={[styles.quote, { borderLeftColor: theme.border }]}>
              <Text style={[styles.line, { color: theme.textSecondary }]}>
                <InlineMd text={q[1]} color={theme.textSecondary} />
              </Text>
            </View>
          );
        return (
          <Text key={i} style={[styles.line, { color: theme.text }]}>
            <InlineMd text={raw} color={theme.text} />
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  line: { fontSize: 15, lineHeight: 22 },
  h1: { fontSize: 20, fontWeight: '800', lineHeight: 28, marginTop: 4 },
  h2: { fontSize: 18, fontWeight: '800', lineHeight: 26, marginTop: 3 },
  h3: { fontSize: 16, fontWeight: '700', lineHeight: 24, marginTop: 2 },
  code: { fontFamily: 'ui-monospace', fontSize: 13.5, borderRadius: 4 },
  quote: { borderLeftWidth: 3, paddingLeft: 10, marginVertical: 1 },
});
