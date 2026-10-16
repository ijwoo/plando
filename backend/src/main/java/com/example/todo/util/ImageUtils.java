package com.example.todo.util;

import com.example.todo.exception.ApiException;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Set;

public class ImageUtils {

    // 허용 MIME 타입 (모바일 HEIC/HEIF, WebP 포함)
    private static final Set<String> ALLOWED_IMAGE_MIME = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/gif",
            "image/webp", "image/bmp", "image/tiff", "image/tif",
            "image/heic", "image/heif",
            "image/heic-sequence", "image/heif-sequence"
    );

    // 허용 확장자 (content-type 이 null 이거나 application/octet-stream 인 경우 폴백)
    private static final Set<String> ALLOWED_IMAGE_EXT = Set.of(
            ".jpg", ".jpeg", ".png", ".gif",
            ".webp", ".bmp", ".tiff", ".tif",
            ".heic", ".heif"
    );

    /**
     * 이미지 파일 타입 검증.
     * content-type 과 확장자를 모두 확인하여 둘 중 하나라도 이미지 형식이면 통과.
     */
    public static void validateImageFile(MultipartFile file) {
        String contentType = file.getContentType();
        String originalFilename = file.getOriginalFilename();

        boolean validByMime = contentType != null
                && ALLOWED_IMAGE_MIME.contains(contentType.toLowerCase().split(";")[0].trim());

        boolean validByExt = false;
        if (originalFilename != null && originalFilename.contains(".")) {
            String ext = originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase();
            validByExt = ALLOWED_IMAGE_EXT.contains(ext);
        }

        if (!validByMime && !validByExt) {
            throw new ApiException(400, "이미지 파일만 업로드할 수 있어요. (JPG, PNG, GIF, WEBP, HEIC 등 지원)");
        }
    }

    /**
     * 이미지를 지정한 최대 크기로 리사이즈 후 JPEG 로 변환.
     * HEIC 등 Thumbnailator 가 처리 못하는 포맷은 명확한 에러 메시지 반환.
     */
    public static InputStream resizeToJpeg(MultipartFile file, int maxSize) throws IOException {
        validateImageFile(file);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            Thumbnails.of(file.getInputStream())
                    .size(maxSize, maxSize)
                    .keepAspectRatio(true)
                    .outputFormat("jpg")
                    .outputQuality(0.85)
                    .toOutputStream(out);
        } catch (IOException e) {
            // Thumbnailator 가 읽지 못하는 포맷 (HEIC 등) 처리
            String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
            if (msg.contains("no readers") || msg.contains("unsupported") || msg.contains("cannot read")) {
                throw new ApiException(400,
                        "이 이미지 형식은 처리할 수 없어요. 카메라 앱 설정에서 사진 포맷을 'JPEG'으로 변경하거나, JPEG/PNG 파일로 변환 후 다시 시도해주세요.");
            }
            throw e;
        }
        return new ByteArrayInputStream(out.toByteArray());
    }
}
