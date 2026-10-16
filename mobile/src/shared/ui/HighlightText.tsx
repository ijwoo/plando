import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** 검색어 매칭 구간을 강조해서 렌더 (대소문자 무시, 첫 매칭만) */
export function HighlightText({
  text,
  query,
  ...rest
}: ThemedTextProps & { text: string; query: string }) {
  const theme = useTheme();
  const q = query.trim().toLowerCase();
  const idx = q ? text.toLowerCase().indexOf(q) : -1;
  if (idx < 0) return <ThemedText {...rest}>{text}</ThemedText>;
  return (
    <ThemedText {...rest}>
      {text.slice(0, idx)}
      <ThemedText type={rest.type} style={[rest.style, { fontWeight: '800', color: theme.primary }]}>
        {text.slice(idx, idx + q.length)}
      </ThemedText>
      {text.slice(idx + q.length)}
    </ThemedText>
  );
}
