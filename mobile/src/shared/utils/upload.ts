/** 업로드 파일 크기 한도 — 백엔드 multipart 설정(spring.servlet.multipart.max-file-size=10MB)과 동일. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '10MB';

/** 한도 초과 여부 (크기를 알 수 없으면 통과시켜 서버 검증에 맡긴다) */
export function exceedsUploadLimit(bytes?: number | null): boolean {
  return typeof bytes === 'number' && bytes > MAX_UPLOAD_BYTES;
}

export type UploadFile = { uri: string; name: string; type: string };

/**
 * 아이폰 사진은 기본이 HEIC인데 서버 이미지 처리(Java ImageIO/Thumbnailator)는 HEIC 디코더가
 * 없어 "No suitable ImageReader found"로 업로드가 실패한다. 폰에서 업로드 전 JPEG로 재인코딩해
 * 서버가 항상 읽을 수 있게 만든다. (프로필/워크스페이스 아이콘 등 이미지 업로드 공통 사용)
 */
export async function toJpegUpload(uri: string, namePrefix = 'image'): Promise<UploadFile> {
  try {
    // 네이티브 모듈이라 지연 로드 — 구 dev client(모듈 미포함)에서 import 시 크래시하는 것을 방지.
    const ImageManipulator = await import('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: result.uri, name: `${namePrefix}-${Date.now()}.jpg`, type: 'image/jpeg' };
  } catch {
    // 모듈이 없거나 변환 실패 시 원본 그대로 (프로덕션 빌드엔 모듈이 포함되어 이 경로를 타지 않음)
    return { uri, name: `${namePrefix}-${Date.now()}.jpg`, type: 'image/jpeg' };
  }
}
