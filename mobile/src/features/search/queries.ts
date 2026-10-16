import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { search } from './api';

export function useSearch(q: string) {
  const query = q.trim();
  return useInfiniteQuery({
    queryKey: ['search', query],
    queryFn: ({ pageParam }) => search(query, pageParam),
    initialPageParam: 0,
    // 다음 페이지 유무는 서버가 hasMoreTasks로 직접 알려준다.
    // 개수로 추정하면(30건 꽉 찼으니 더 있겠지) 마지막 페이지에서 빈 요청이 한 번 더 나간다.
    getNextPageParam: (last, _pages, lastParam) => (last.hasMoreTasks ? lastParam + 1 : undefined),
    enabled: query.length > 0,
    // 타이핑으로 쿼리키가 바뀌어도 이전 결과를 유지 — 글자마다 목록이 깜빡/언마운트되지 않게
    placeholderData: keepPreviousData,
  });
}
