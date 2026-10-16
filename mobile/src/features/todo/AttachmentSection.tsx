import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { secureUrl } from '@/shared/ui/Avatar';
import { ListGroup, ListRow } from '@/shared/ui/List';
import { exceedsUploadLimit, MAX_UPLOAD_LABEL, toJpegUpload } from '@/shared/utils/upload';
import { useAttachments, useDeleteAttachment, useUploadAttachment } from './attachments';

const ICON_FOR = (type?: string): keyof typeof Ionicons.glyphMap => {
  if (type?.startsWith('image')) return 'image-outline';
  if (type?.startsWith('video')) return 'videocam-outline';
  return 'document-outline';
};

/** 이미지 첨부 판별 — mime 우선, 없으면 확장자로 */
const isImageAttachment = (fileType?: string, fileName?: string, fileUrl?: string) =>
  fileType?.startsWith('image') || /\.(png|jpe?g|gif|webp|heic|heif|bmp)$/i.test(fileName ?? fileUrl ?? '');

/** 첨부 탭 — 목록 + 추가(사진/동영상) + 삭제. 이미지는 썸네일 + 탭하면 인앱 전체화면 미리보기. */
export function AttachmentSection({ todoId, readonly }: { todoId: number; readonly?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: items, isLoading } = useAttachments(todoId);
  const upload = useUploadAttachment(todoId);
  const del = useDeleteAttachment(todoId);
  // 전체화면 이미지 미리보기 (DM 갤러리 뷰어와 동일 톤 — 로컬 최소 구현)
  const [viewer, setViewer] = useState<{ uri: string; name?: string } | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진 접근 권한을 허용해주세요.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    if (exceedsUploadLimit(a.fileSize)) {
      Alert.alert('파일이 너무 큽니다', `${MAX_UPLOAD_LABEL} 이하만 첨부할 수 있어요.`);
      return;
    }
    if (a.type === 'video') {
      upload.mutate({ uri: a.uri, name: a.fileName ?? `video_${Date.now()}.mov`, type: a.mimeType ?? 'video/quicktime' });
    } else {
      // HEIC(아이폰 기본)는 서버가 못 읽으므로 JPEG로 변환
      upload.mutate(await toJpegUpload(a.uri, 'image'));
    }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    if (exceedsUploadLimit(a.size)) {
      Alert.alert('파일이 너무 큽니다', `${MAX_UPLOAD_LABEL} 이하만 첨부할 수 있어요.`);
      return;
    }
    upload.mutate({ uri: a.uri, name: a.name ?? `file_${Date.now()}`, type: a.mimeType ?? 'application/octet-stream' });
  };

  const add = () =>
    Alert.alert('첨부 추가', undefined, [
      { text: '사진·동영상', onPress: pickPhoto },
      { text: '파일', onPress: pickFile },
      { text: '취소', style: 'cancel' },
    ]);

  const confirmDelete = (id: number, name?: string) =>
    Alert.alert('첨부 삭제', `"${name ?? '파일'}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => del.mutate(id) },
    ]);

  return (
    <View style={styles.container}>
      {/* 읽기 전용이면 추가·삭제가 서버에서 403 이다 — 버튼 자체를 숨긴다 */}
      {!readonly ? (
      <Pressable onPress={add} disabled={upload.isPending} style={[styles.addBtn, { borderColor: theme.border }]}>
        {upload.isPending ? (
          <ActivityIndicator />
        ) : (
          <>
            <Ionicons name="add" size={18} color={theme.primary} />
            <ThemedText type="default" style={{ color: theme.primary, fontWeight: '700' }}>
              첨부 추가
            </ThemedText>
          </>
        )}
      </Pressable>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : !items?.length ? (
        <ThemedText type="small" style={styles.empty}>
          첨부가 없어요.
        </ThemedText>
      ) : (
        <ListGroup card>
          {items.map((it, i) => {
            const last = i === items.length - 1;
            // 읽기 전용이면 삭제도 서버에서 403 — 추가 버튼과 함께 숨긴다
            // (예전엔 추가만 숨겨서, 샘플·VIEWER 상세에서 휴지통을 눌러야 실패를 알 수 있었다)
            const deleteBtn = readonly ? undefined : (
              <Pressable
                onPress={() => it.id != null && confirmDelete(it.id, it.fileName)}
                hitSlop={8}
                accessibilityLabel="첨부 삭제">
                <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
              </Pressable>
            );
            const imgUri = isImageAttachment(it.fileType, it.fileName, it.fileUrl) ? secureUrl(it.fileUrl) : undefined;
            if (imgUri) {
              // 이미지 — 썸네일 행 + 탭하면 인앱 뷰어 (ListRow 레이아웃 미러)
              return (
                <Pressable
                  key={it.id}
                  onPress={() => setViewer({ uri: imgUri, name: it.fileName })}
                  accessibilityLabel={`이미지 미리보기: ${it.fileName ?? '이미지'}`}
                  style={({ pressed }) => [
                    styles.imgRow,
                    { borderBottomColor: theme.divider, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
                    pressed && { backgroundColor: theme.surfaceSelected },
                  ]}>
                  <Image source={{ uri: imgUri }} style={[styles.thumb, { backgroundColor: theme.surfaceSelected }]} contentFit="cover" />
                  <View style={styles.imgBody}>
                    <ThemedText type="default" numberOfLines={1}>
                      {it.fileName ?? '이미지'}
                    </ThemedText>
                    {it.uploaderName ?? it.uploaderEmail ? (
                      <ThemedText type="small" style={styles.dim} numberOfLines={1}>
                        {it.uploaderName ?? it.uploaderEmail}
                      </ThemedText>
                    ) : null}
                  </View>
                  {deleteBtn}
                </Pressable>
              );
            }
            return (
              <ListRow dense
                key={it.id}
                icon={ICON_FOR(it.fileType)}
                label={it.fileName ?? '파일'}
                desc={it.uploaderName ?? it.uploaderEmail ?? undefined}
                last={last}
                onPress={() => it.fileUrl && Linking.openURL(it.fileUrl)}
                right={deleteBtn}
              />
            );
          })}
        </ListGroup>
      )}

      {/* 전체화면 이미지 뷰어 — 어두운 배경 + 닫기, 화면 탭으로도 닫힘 */}
      <Modal visible={viewer != null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerBackdrop}>
          <View style={[styles.viewerHeader, { top: insets.top + 8 }]} pointerEvents="box-none">
            <ThemedText type="default" style={styles.viewerName} numberOfLines={1}>
              {viewer?.name ?? ''}
            </ThemedText>
            <Pressable onPress={() => setViewer(null)} hitSlop={10} accessibilityLabel="닫기" accessibilityRole="button">
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
          <Pressable style={styles.viewerPage} onPress={() => setViewer(null)}>
            {viewer ? <Image source={{ uri: viewer.uri }} style={styles.viewerImage} contentFit="contain" /> : null}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
  loading: { marginVertical: 16 },
  empty: { opacity: 0.5, textAlign: 'center', paddingVertical: 16 },
  dim: { opacity: 0.6 },
  // 이미지 행 — ListRow와 동일 패딩/디바이더 톤
  imgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  imgBody: { flex: 1, gap: 2 },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  viewerHeader: { position: 'absolute', left: 20, right: 20, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  viewerName: { color: '#fff', fontWeight: '700', flex: 1 },
  viewerPage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
});
