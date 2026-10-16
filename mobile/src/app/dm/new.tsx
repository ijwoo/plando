import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useMe } from '@/features/auth/queries';
import { useCreateGroupRoom, useCreateRoom, useRooms } from '@/features/dm/queries';
import { useWorkspaceMembers } from '@/features/workspace/queries';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/shared/ui/Avatar';
import { GlassButton } from '@/shared/ui/GlassButton';
import { TextField } from '@/shared/ui/TextField';

export default function NewDmScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: me } = useMe();
  const { data: members, isLoading, isError, error, refetch } = useWorkspaceMembers();
  const { data: rooms } = useRooms();
  const createRoom = useCreateRoom();
  const createGroup = useCreateGroupRoom();

  // 자기 자신 제외
  const others = (members ?? []).filter((m) => m.email !== me?.email);
  const [selected, setSelected] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const isGroup = selected.length >= 2;
  const pending = createRoom.isPending || createGroup.isPending;

  const toggle = (userId: number) => {
    setSelected((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const goToRoom = (roomId?: number, title?: string) => {
    if (roomId == null) {
      router.back();
      return;
    }
    router.replace(`/dm/${roomId}?title=${encodeURIComponent(title ?? '대화')}`);
  };

  // 중복 생성 가드 — isPending은 상태 갱신 타이밍상 빠른 연속 탭을 못 막아 ref로 즉시 잠금
  const creatingRef = useRef(false);

  const doCreate = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setErr(null);
    try {
      if (isGroup) {
        const name = groupName.trim() || '그룹';
        const room = await createGroup.mutateAsync({ groupName: name, memberIds: selected });
        goToRoom(room.id, room.groupName ?? name);
      } else {
        // 1:1은 백엔드 getOrCreate라 중복 없음
        const room = await createRoom.mutateAsync(selected[0]);
        goToRoom(room.id, room.partnerName ?? '대화');
      }
    } catch (e) {
      setErr(getApiErrorMessage(e));
    } finally {
      creatingRef.current = false;
    }
  };

  const onCreate = () => {
    if (pending || creatingRef.current) return;
    if (selected.length === 0) {
      setErr('대화 상대를 선택해주세요.');
      return;
    }
    // 그룹 유효성 — 백엔드는 그룹을 매번 새로 만들므로(1:1과 달리 getOrCreate 아님),
    // 같은 이름·같은 인원의 그룹이 이미 있으면 확인을 거친다
    if (isGroup) {
      const name = groupName.trim() || '그룹';
      const dup = (rooms ?? []).find(
        (r) => r.isGroup && (r.groupName ?? '그룹') === name && r.memberCount === selected.length + 1,
      );
      if (dup) {
        Alert.alert('비슷한 그룹이 있어요', `"${name}" (멤버 ${dup.memberCount}명) 그룹이 이미 있어요.`, [
          { text: '취소', style: 'cancel' },
          { text: '기존 그룹 열기', onPress: () => goToRoom(dup.id, dup.groupName ?? name) },
          { text: '새로 만들기', style: 'destructive', onPress: () => void doCreate() },
        ]);
        return;
      }
    }
    void doCreate();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: true, title: '새 대화' }} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <ThemedText type="default" style={{ color: theme.danger }}>
            {getApiErrorMessage(error)}
          </ThemedText>
          <Pressable onPress={() => refetch()}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={others}
            keyExtractor={(item) => String(item.userId)}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              isGroup ? (
                <View style={styles.groupNameBox}>
                  <ThemedText type="small" style={styles.label}>
                    그룹 이름
                  </ThemedText>
                  <TextField placeholder="그룹 이름 (선택)" value={groupName} onChangeText={setGroupName} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <ThemedText type="small" style={styles.empty}>
                대화할 수 있는 멤버가 없어요.
              </ThemedText>
            }
            renderItem={({ item }) => {
              const active = item.userId != null && selected.includes(item.userId);
              return (
                <Pressable
                  onPress={() => item.userId != null && toggle(item.userId)}
                  style={[styles.member, { backgroundColor: active ? theme.primary + '14' : theme.backgroundElement }]}>
                  <Avatar person={{ name: item.name, email: item.email, profileImageUrl: item.profileImageUrl }} size={40} />
                  <View style={styles.body}>
                    <ThemedText type="default" numberOfLines={1}>{item.name ?? item.email}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                      {item.email}
                    </ThemedText>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={theme.primary} /> : null}
                </Pressable>
              );
            }}
          />

          {err ? (
            <ThemedText type="small" style={[styles.err, { color: theme.danger }]}>
              {err}
            </ThemedText>
          ) : null}

          <View style={styles.footer}>
            <GlassButton
              title={pending ? '생성 중…' : isGroup ? `그룹 만들기 (${selected.length})` : '대화 시작'}
              onPress={onCreate}
              disabled={pending}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  list: { padding: 16, gap: 8 },
  groupNameBox: { gap: 6, marginBottom: 12 },
  label: { opacity: 0.6 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12 },
  body: { flex: 1, gap: 2 },
  empty: { opacity: 0.5 },
  err: { paddingHorizontal: 16 },
  footer: { padding: 16 },
});
