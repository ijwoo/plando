import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as recurrenceApi from './api';
import type { RecurrenceType } from './api';

const key = (todoId: number) => ['recurrence', todoId] as const;

export function useRecurrence(todoId: number) {
  return useQuery({
    queryKey: key(todoId),
    queryFn: () => recurrenceApi.getRecurrence(todoId),
  });
}

export function useUpsertRecurrence(todoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recurrenceType, endDate }: { recurrenceType: RecurrenceType; endDate?: string }) =>
      recurrenceApi.upsertRecurrence(todoId, recurrenceType, endDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(todoId) });
      qc.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
