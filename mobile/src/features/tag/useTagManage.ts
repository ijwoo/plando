import { useCallback } from 'react';
import { Alert, type AlertButton } from 'react-native';

import type { TagLite } from '@/api/typesExt';
import { useWorkspacePermissions } from '@/features/workspace/permissions';
import { toast } from '@/shared/ui/toast';
import { useDeleteTag, useUpdateTag } from './queries';

/** 백엔드 TagController와 동일 제한 — 넘으면 400 "태그 이름은 40자 이하로 해주세요." */
const MAX_NAME = 40;

/**
 * 태그 관리(이름 변경·삭제) 공통 액션 — 태그 피커(할 일 상세)와 필터 시트가 함께 쓴다.
 *
 * 권한은 백엔드 TagController 그대로:
 *  - PATCH /api/tags/{id} → requireCanCreateContent = **MEMBER 이상** (이름·색 변경)
 *  - DELETE /api/tags/{id} → requireRole(ADMIN)     = **ADMIN 이상** (모든 할 일에서 떨어져 나가는 공유 자산)
 * 두 권한이 다르므로 따로 계산한다. 할 수 없는 동작은 메뉴에 넣지 않되, 왜 없는지는
 * 메시지로 알려준다 — 눌러도 403으로 끝나는 버튼을 만들지 않기 위해서다.
 */
export function useTagManage() {
  const perms = useWorkspacePermissions();
  const rename = useUpdateTag();
  const del = useDeleteTag();

  const canRename = perms.canEditContent; // MEMBER+
  const canDelete = perms.isAdmin; // ADMIN+
  const canManage = canRename || canDelete; // 뷰어는 둘 다 없어 진입점 자체를 그리지 않는다

  const promptRename = useCallback(
    (tag: TagLite) => {
      Alert.prompt(
        '태그 이름 변경',
        '이 태그가 붙은 모든 할 일에 함께 반영돼요.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '저장',
            onPress: (v?: string) => {
              const name = (v ?? '').trim();
              // 이름을 비우거나 너무 길면 서버가 400을 준다 — 보내기 전에 같은 문구로 안내
              if (!name) {
                toast.error('태그 이름을 입력해주세요');
                return;
              }
              if (name.length > MAX_NAME) {
                toast.error(`태그 이름은 ${MAX_NAME}자 이하로 해주세요`);
                return;
              }
              if (name === tag.name) return; // 그대로면 요청하지 않는다
              rename.mutate({ id: tag.id, name });
            },
          },
        ],
        'plain-text',
        tag.name,
      );
    },
    [rename],
  );

  const confirmDelete = useCallback(
    (tag: TagLite) => {
      Alert.alert(
        '태그 삭제',
        `'${tag.name}' 태그를 삭제하면 이 태그가 붙은 모든 할 일에서 함께 떨어져요. 삭제할까요?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '삭제', style: 'destructive', onPress: () => del.mutate(tag.id) },
        ],
      );
    },
    [del],
  );

  /** 태그 하나에 대한 관리 메뉴. 권한이 없는 항목은 아예 넣지 않고 사유만 남긴다. */
  const promptManage = useCallback(
    (tag: TagLite) => {
      if (!canManage) return; // 호출부가 진입점을 그리지 않으므로 여기 오지 않는다(방어)
      const buttons: AlertButton[] = [];
      if (canRename) buttons.push({ text: '이름 변경', onPress: () => promptRename(tag) });
      if (canDelete) buttons.push({ text: '삭제', style: 'destructive', onPress: () => confirmDelete(tag) });
      buttons.push({ text: '취소', style: 'cancel' });
      Alert.alert(
        tag.name,
        canDelete
          ? '태그는 워크스페이스 전체가 함께 쓰는 항목이에요.'
          : '태그 삭제는 관리자만 할 수 있어요.',
        buttons,
      );
    },
    [canManage, canRename, canDelete, promptRename, confirmDelete],
  );

  return { canManage, canRename, canDelete, promptManage };
}
