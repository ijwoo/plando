import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { LinearTransition, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { AvatarStack } from '@/shared/ui/Avatar';
import { projectIcon } from '@/features/project/projectIcons';
import { priorityColor, PRIORITY_LABEL, readableOn, type TodoPriority } from '@/shared/ui/tone';
import { impactHaptic } from '@/shared/ui/haptics';
import { stripMarkdown } from '@/shared/utils/markdown';
import { useStatusMap , isTodoDone } from '@/features/status/queries';
import { formatMonthDay, getDueTone } from './todoFilters';
import type { Todo } from './api';

const ACTION_W = 76;

/**
 * 오른쪽 풀스와이프 완료 액션 — 초록 패널이 스와이프 거리(drag)를 따라 차오르며
 * 끝까지 밀면 onSwipeableWillOpen에서 즉시 완료된다(Apple 미리알림 스타일).
 * drag(appliedTranslation)는 왼쪽 액션 노출 시 양수. 고정폭 스페이서로 snap용 leftWidth를 측정.
 */
function LeftCompleteAction({ drag, done, color, threshold }: { drag: SharedValue<number>; done: boolean; color: string; threshold: number }) {
  const fillStyle = useAnimatedStyle(() => ({ width: Math.max(drag.value, 0) }));
  // 완료 지점을 넘는 순간 한 번만 햅틱(다시 내려가면 재무장 → 재진입 시 또 울림)
  const armed = useSharedValue(false);
  useAnimatedReaction(
    () => drag.value,
    (v) => {
      if (v >= threshold && !armed.value) {
        armed.value = true;
        runOnJS(impactHaptic)();
      } else if (v < threshold - 12 && armed.value) {
        armed.value = false;
      }
    },
  );
  return (
    <>
      <Animated.View style={[styles.leftFill, fillStyle, { backgroundColor: color }]}>
        <Ionicons name={done ? 'arrow-undo' : 'checkmark'} size={22} color="#fff" />
        <Text style={styles.actionLabel}>{done ? '되돌리기' : '완료'}</Text>
      </Animated.View>
      <View style={styles.leftSpacer} />
    </>
  );
}

/** 서브태스크 칩 (보드 카드 등 비인터랙티브 표시용) — ⑂ n/m */
export function SubtaskChip({ done, total }: { done: number; total: number }) {
  const theme = useTheme();
  const complete = total > 0 && done >= total;
  const color = complete ? theme.green : theme.textSecondary;
  return (
    <View
      style={[styles.clChip, { backgroundColor: complete ? theme.green + '1A' : theme.surfaceAlt }]}
      accessibilityLabel={`서브태스크 ${total}개 중 ${done}개 완료`}>
      <Ionicons name="git-branch-outline" size={11} color={color} />
      <Text style={[styles.clText, { color }]}>
        {done}/{total}
      </Text>
    </View>
  );
}

/**
 * 할 일 리스트 행 — 웹 MobileListView.TaskRow 미러.
 * 좌측 priority 막대 / 체크박스 / 제목·진행중 배지 / 본문 / 메타(프로젝트·우선순위·마감 톤).
 * 오른쪽 스와이프 = 완료(끝까지 밀면 즉시), 왼쪽 스와이프 = 보관·삭제.
 */
export function TaskListRow({
  todo,
  isLast,
  onToggle,
  onArchive,
  onDelete,
  onOpen,
  projectName,
  projectColor,
  projectIconKey,
  subtasks,
  expanded,
  onToggleExpand,
  selectMode,
  selected,
  onLongPress,
  onToggleSelect,
  simple,
}: {
  todo: Todo;
  isLast?: boolean;
  onToggle?: (done: boolean) => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
  projectName?: string;
  projectColor?: string;
  projectIconKey?: string;
  /** 서브태스크 진행률(N/M) — 있을 때만 배지+확장 쉐브론 표시 */
  subtasks?: { done: number; total: number };
  /** 서브태스크 확장 상태 (배지 탭 = onToggleExpand) */
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** 다중 선택 모드 */
  selectMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
  /** 간단히 보기(설정) — 제목·마감만 남기고 나머지를 접는다.
      예전엔 '콤팩트 모드'로 여백만 줄였는데, 메타 줄에 최대 6종이 조건부로 흐르는 게
      혼잡의 원인이라 여백을 줄이면 오히려 더 빽빽해졌다. 줄이는 대상을 밀도가 아니라
      정보량으로 바꾼다. */
  simple?: boolean;
}) {
  const theme = useTheme();
  const ref = useRef<SwipeableMethods>(null);
  const openRef = useRef(false); // 보관·삭제 메뉴가 열려 있는지
  const lastDragAt = useRef(0); // 직전 스와이프 시각 — 스와이프가 탭으로 잡혀 상세로 가는 충돌 방지
  const statusMap = useStatusMap();
  const { width } = useWindowDimensions();
  const completeThreshold = Math.round(width * 0.4);
  const done = isTodoDone(todo);

  /* 완료 체크의 튀어오름 — **방금 완료한 것에만.**
     마운트 시점(이미 완료된 채로 화면에 들어옴)에는 애니메이션이 없어야 한다. 그래서
     entering 대신 직전 값과 비교한다: false→true 로 바뀐 순간에만 튄다.
     처음 값을 done 으로 두는 게 핵심 — 그래야 완료된 항목이 스크롤로 들어와도 조용하다. */
  const doneScale = useSharedValue(1);
  const prevDone = useRef(done);
  useEffect(() => {
    if (done && !prevDone.current) {
      doneScale.value = 0.4;
      doneScale.value = withSpring(1, { damping: 12, stiffness: 220 });
    }
    prevDone.current = done;
  }, [done, doneScale]);
  const doneStyle = useAnimatedStyle(() => ({ transform: [{ scale: doneScale.value }] }));

  // 'IN_PROGRESS' 키를 직접 비교하면 그 상태를 지우고 "검토중" 등을 만든 워크스페이스에서
  // 배지가 영원히 안 뜬다. 보드·완료판정은 이미 category 기준으로 옮겼는데 여기만 남아 있었다.
  const inProgress = statusMap.category(todo.status) === 'IN_PROGRESS';
  const pColor = priorityColor(theme, todo.priority);
  const showBar = !done && todo.priority && todo.priority !== 'LOW';
  const dueTone = !done ? getDueTone(todo.dueDate) : null;
  const dueText = todo.dueDate
    ? dueTone?.label
      ? `${dueTone.label} · ${formatMonthDay(todo.dueDate)}`
      : formatMonthDay(todo.dueDate)
    : null;
  const assignees = todo.assignees ?? [];

  const close = () => ref.current?.close();

  // 행 탭: 메뉴가 열려 있으면 닫기, 방금 스와이프한 직후면 무시, 아니면 상세로
  const handlePress = () => {
    if (openRef.current) {
      close();
      return;
    }
    if (Date.now() - lastDragAt.current < 250) return;
    onOpen?.();
  };

  // 왼쪽 스와이프(오른쪽에서 등장) = 보관·삭제
  const renderRightActions = () => (
    <View style={styles.actions}>
      {onArchive ? (
        <Pressable
          onPress={() => {
            close();
            onArchive();
          }}
          style={[styles.action, { backgroundColor: theme.textTertiary }]}>
          <Ionicons name="archive" size={18} color="#fff" />
          <Text style={styles.actionLabel}>보관</Text>
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable
          onPress={() => {
            close();
            onDelete();
          }}
          style={[styles.action, { backgroundColor: theme.danger }]}>
          <Ionicons name="trash" size={18} color="#fff" />
          <Text style={styles.actionLabel}>삭제</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const content = (
      <Pressable
        onPress={selectMode ? onToggleSelect : handlePress}
        onLongPress={onLongPress}
        disabled={!onOpen && !selectMode}
        style={({ pressed }) => [
          styles.row,
          simple && styles.rowSimple,
          // 라이트: 리스트를 흰 콘텐츠 시트로(회색 위 flat → 서비스 앱 느낌). 다크: 기존 유지.
          { backgroundColor: theme.isDark ? theme.background : theme.surface, borderBottomColor: theme.divider, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth },
          selected && { backgroundColor: theme.primary + '14' },
          pressed && { backgroundColor: theme.surfaceSelected },
        ]}>
        {showBar ? <View style={[styles.prioBar, { backgroundColor: pColor }]} /> : null}

        {/* 선택 모드에서만 선택 원, 평소엔 완료 시 작은 체크만(탭 토글 없음 → 완료는 스와이프) */}
        {selectMode ? (
          <View style={styles.check}>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={26}
              color={selected ? theme.primary : theme.textSecondary}
            />
          </View>
        ) : done ? (
          /* 완료는 이 앱에서 유일한 보상 순간이라 스프링을 준다. 다만 **방금 완료한 것에만**.
             [고치는 결함] entering 으로 붙였더니 마운트마다 돌았다 — 이미 완료된 항목이
             스크롤로 들어오거나 탭을 오갈 때마다 전부 튀어올라서 난잡했다.
             화면에 나타나는 것과 방금 해낸 것은 다르다. 이제 done 이 실제로 false→true 로
             바뀐 순간에만 튄다. */
          <Animated.View style={[styles.check, doneStyle]}>
            <Ionicons name="checkmark-circle" size={22} color={theme.green} />
          </Animated.View>
        ) : null}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            {todo.focused ? <Ionicons name="flash" size={15} color={theme.primary} style={styles.bolt} /> : null}
            <ThemedText
              type="default"
              style={[styles.title, done && { color: theme.textSecondary, textDecorationLine: 'line-through' }]}
              numberOfLines={simple ? 1 : 2}>
              {todo.title}
            </ThemedText>
            {/* 간단히 보기: 마감을 오른쪽 끝 고정 위치로. 훑을 때 눈이 고정될 열이 생긴다.
                마감이 없어도 가운뎃점을 놓아 열이 무너지지 않게 한다. */}
            {simple ? (
              dueText ? (
                <Text
                  style={[styles.simpleDue, { color: dueTone?.color ?? theme.textSecondary, fontWeight: dueTone?.weight ?? '500' }]}
                  numberOfLines={1}>
                  {dueText}
                </Text>
              ) : (
                <Text style={[styles.simpleDue, { color: theme.textTertiary }]}>·</Text>
              )
            ) : inProgress ? (
              <View style={styles.ipBadge}>
                <View style={[styles.ipDot, { backgroundColor: theme.orange }]} />
                <Text style={[styles.ipText, { color: theme.orange }]}>진행 중</Text>
              </View>
            ) : null}
          </View>

          {!simple && todo.content ? (
            <ThemedText type="small" style={[styles.content, { color: theme.textSecondary }]} numberOfLines={2}>
              {stripMarkdown(todo.content)}
            </ThemedText>
          ) : null}

          {simple ? null : (
          <View style={styles.meta}>
            {projectName ? (
              <View style={styles.metaItem}>
                <View style={[styles.projBadge, { backgroundColor: projectColor ?? theme.textSecondary }]}>
                  <Ionicons name={projectIcon(projectIconKey)} size={10} color="#fff" />
                </View>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '600' }}>
                  {projectName}
                </ThemedText>
              </View>
            ) : null}
            {!done && todo.priority ? (
              <View style={[styles.pill, { backgroundColor: pColor }]}>
                <Text style={[styles.pillText, { color: readableOn(pColor) }]}>{PRIORITY_LABEL[todo.priority as TodoPriority]}</Text>
              </View>
            ) : null}
            {subtasks && subtasks.total > 0 ? (
              <Pressable
                onPress={onToggleExpand}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`서브태스크 ${subtasks.total}개 중 ${subtasks.done}개 완료, ${expanded ? '접기' : '펼치기'}`}
                style={[styles.clChip, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="git-branch-outline" size={11} color={theme.textSecondary} />
                <Text style={[styles.clText, { color: theme.textSecondary }]}>
                  {subtasks.done}/{subtasks.total}
                </Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={11} color={theme.textTertiary} />
              </Pressable>
            ) : null}
            {dueText ? (
              <Text style={[styles.due, { color: dueTone?.color ?? theme.textSecondary, fontWeight: dueTone?.weight ?? '500' }]}>
                {dueText}
              </Text>
            ) : null}
            {assignees.length ? <AvatarStack people={assignees} size={20} /> : null}
            {(todo.tags ?? []).map((tg) => {
              const c = tg.color ?? theme.textTertiary;
              return (
                <View key={tg.id} style={[styles.tagChip, { backgroundColor: c + '22' }]}>
                  <View style={[styles.tagDot, { backgroundColor: c }]} />
                  <Text style={[styles.tagText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {tg.name}
                  </Text>
                </View>
              );
            })}
          </View>
          )}
        </View>
      </Pressable>
  );

  /* 목록이 바뀔 때 미끄러지게 한다.
     [고치는 결함] 할 일을 추가·완료·필터하면 목록이 툭 바뀌어서, 무엇이 새로 생기고
     무엇이 사라졌는지 눈이 못 따라갔다. layout 만 붙여도 남은 행들이 부드럽게 자리를
     메운다 — 완료해서 목록에서 빠질 때가 특히 그렇다.

     exiting 은 일부러 안 붙인다. FlatList 에서 사라지는 항목 애니메이션은 데이터가 먼저
     바뀌면 잔상이나 깜빡임으로 남는 일이 있어서, 확실한 것만 쓴다. */
  const wrap = (node: React.ReactNode) => (
    /* layout 만 쓴다. entering 을 붙였더니 스크롤로 들어오는 행마다 페이드가 돌아서
       체크 스프링과 같은 종류의 소음이 됐다 — 목록이 **재배치될 때**만 움직이면 된다. */
    <Animated.View layout={LinearTransition.springify().damping(18).stiffness(180)}>
      {node}
    </Animated.View>
  );

  // 선택 모드에선 스와이프 비활성(선택 탭이 우선), 평소엔 양방향 스와이프 액션
  if (selectMode) return wrap(content);
  return wrap(
    <ReanimatedSwipeable
      ref={ref}
      friction={1}
      leftThreshold={completeThreshold}
      rightThreshold={36}
      overshootRight={false}
      onSwipeableOpenStartDrag={() => { lastDragAt.current = Date.now(); }}
      onSwipeableCloseStartDrag={() => { lastDragAt.current = Date.now(); }}
      // direction은 손가락 이동 방향: 'right'=오른쪽 스와이프(완료 패널). 끝까지 밀면 즉시 완료.
      onSwipeableWillOpen={(direction) => {
        if (direction === 'right') {
          onToggle?.(!done);
          ref.current?.close();
        } else {
          openRef.current = true; // 보관·삭제 메뉴 열림
        }
      }}
      onSwipeableWillClose={() => { openRef.current = false; }}
      // 핸들러가 없으면(권한 없음·샘플) 패널을 그리지 않는다. 예전엔 패널이 그려져
      // 끝까지 밀어도 아무 일이 없어 "스와이프가 고장났다"로 읽혔다.
      renderLeftActions={
        onToggle
          ? (_, drag) => (
              <LeftCompleteAction drag={drag} done={done} color={done ? theme.textSecondary : theme.green} threshold={completeThreshold} />
            )
          : undefined
      }
      renderRightActions={onArchive || onDelete ? renderRightActions : undefined}>
      {content}
    </ReanimatedSwipeable>
  );
}

/**
 * 목록 인라인 서브태스크 행 — 부모 행 확장 시 들여쓰기(~44px)로 렌더되는 간소 행.
 * 체크박스(탭=완료 토글) + 제목 + 마감 톤 칩. 행 탭 = 자식 자체 상세로.
 */
export function SubtaskListRow({
  todo,
  isLast,
  onToggle,
  onOpen,
  compact,
}: {
  todo: Todo;
  isLast?: boolean;
  onToggle?: (done: boolean) => void;
  onOpen?: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  const done = isTodoDone(todo);
  const dueTone = !done ? getDueTone(todo.dueDate) : null;
  const dueText = todo.dueDate
    ? dueTone?.label
      ? `${dueTone.label} · ${formatMonthDay(todo.dueDate)}`
      : formatMonthDay(todo.dueDate)
    : null;
  return (
    <View
      style={[
        styles.subRow,
        compact && styles.subRowCompact,
        { backgroundColor: theme.isDark ? theme.background : theme.surface, borderBottomColor: theme.divider, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth },
      ]}>
      <Pressable
        hitSlop={10}
        onPress={() => onToggle?.(!done)}
        accessibilityRole="button"
        accessibilityLabel={done ? '완료 해제' : '완료'}>
        <Ionicons
          name={done ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color={done ? theme.green : theme.textTertiary}
        />
      </Pressable>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`서브태스크 ${todo.title ?? ''} 상세로 이동`}
        style={({ pressed }) => [styles.subBody, pressed && { opacity: 0.6 }]}>
      <ThemedText
        type="default"
        numberOfLines={1}
        style={[styles.subTitle, done && { color: theme.textSecondary, textDecorationLine: 'line-through' }]}>
        {todo.title}
      </ThemedText>
      {(todo.assignees ?? []).length ? <AvatarStack people={todo.assignees ?? []} size={18} max={2} /> : null}
      {dueText ? (
        <Text style={[styles.due, { color: dueTone?.color ?? theme.textSecondary, fontWeight: dueTone?.weight ?? '500' }]}>
          {dueText}
        </Text>
      ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'flex-start' },
  // 간단히 보기: 한 줄짜리 행이라 여백을 조금 줄여야 목록다워진다(정보량 축소가 주목적).
  rowSimple: { paddingVertical: 11, gap: 10, alignItems: 'center' },
  simpleDue: { fontSize: 12, marginLeft: 8 },
  prioBar: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 999 },
  check: { paddingTop: 1 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bolt: { marginTop: 2 },
  title: { flex: 1, fontWeight: '600', lineHeight: 21 },
  content: { lineHeight: 19 },
  ipBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 3 },
  ipDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: '#fb923c' },
  ipText: { fontSize: 11, fontWeight: '700', color: '#fb923c' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  projBadge: { width: 16, height: 16, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  clChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  clText: { fontSize: 11, fontWeight: '700' },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, maxWidth: 120 },
  tagDot: { width: 7, height: 7, borderRadius: 4 },
  tagText: { fontSize: 11, fontWeight: '600' },
  due: { fontSize: 12 },
  // 인라인 서브태스크 행 — 부모 체크박스 라인에 맞춘 leading inset
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 44, paddingRight: 18, paddingVertical: 10 },
  subRowCompact: { paddingVertical: 6 },
  subBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  subTitle: { flex: 1, fontSize: 15 },
  actions: { flexDirection: 'row' },
  // 초록 채움 패널: 왼쪽 끝(left:0)에 붙어 스와이프 거리만큼 너비가 늘어남
  leftFill: { position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' },
  leftSpacer: { width: ACTION_W },
  action: { width: ACTION_W, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
