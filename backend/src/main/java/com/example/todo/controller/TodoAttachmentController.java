package com.example.todo.controller;

import com.example.todo.dto.TodoAttachmentResponse;
import com.example.todo.entity.Todo;
import com.example.todo.entity.TodoAttachment;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.TodoAttachmentRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/todos/{todoId}/attachments")
@RequiredArgsConstructor
public class TodoAttachmentController {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    private final TodoAttachmentRepository todoAttachmentRepository;
    private final TodoRepository todoRepository;
    private final UserRepository userRepository;
    private final WorkspaceResolver workspaceResolver;
    private final com.example.todo.service.PermissionService permissionService;

    @GetMapping
    public ResponseEntity<List<TodoAttachmentResponse>> getAttachments(
            @PathVariable Long todoId,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {

        requireSameWorkspace(todoId, authentication.getName(), workspaceId);
        List<TodoAttachmentResponse> list = todoAttachmentRepository
                .findByTodoIdOrderByCreatedAtAsc(todoId)
                .stream()
                .map(TodoAttachmentResponse::from)
                .toList();
        return ResponseEntity.ok(list);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<TodoAttachmentResponse> upload(
            @PathVariable Long todoId,
            @RequestPart("file") MultipartFile file,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) throws IOException {

        requireSameWorkspace(todoId, authentication.getName(), workspaceId);
        Todo todo = todoRepository.findById(todoId)
                .orElseThrow(() -> new ApiException(404, "작업을 찾을 수 없습니다."));
        // 첨부 업로드 = 부모 할 일 편집 권한(MEMBER 이상, 샘플 차단)
        permissionService.requireCanEditTodo(authentication.getName(), todo);

        User uploader = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : "";
        String storedName = UUID.randomUUID() + ext;

        Path dir = Paths.get(uploadDir).toAbsolutePath().resolve("todo-attachments");
        Files.createDirectories(dir);
        Files.copy(file.getInputStream(), dir.resolve(storedName), StandardCopyOption.REPLACE_EXISTING);

        String fileUrl = "/uploads/todo-attachments/" + storedName;
        String uploaderName = uploader.getName() != null ? uploader.getName()
                : authentication.getName().split("@")[0];

        TodoAttachment attachment = TodoAttachment.builder()
                .todoId(todoId)
                .uploaderEmail(authentication.getName())
                .uploaderName(uploaderName)
                .fileUrl(fileUrl)
                .fileName(originalFilename)
                .fileType(file.getContentType())
                .fileSize(file.getSize())
                .build();

        TodoAttachment saved = todoAttachmentRepository.save(attachment);
        return ResponseEntity.ok(TodoAttachmentResponse.from(saved));
    }

    @DeleteMapping("/{attachId}")
    public ResponseEntity<Void> delete(
            @PathVariable Long todoId,
            @PathVariable Long attachId,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {

        requireSameWorkspace(todoId, authentication.getName(), workspaceId);

        TodoAttachment attachment = todoAttachmentRepository.findById(attachId)
                .orElseThrow(() -> new ApiException(404, "첨부파일을 찾을 수 없습니다."));

        if (!attachment.getTodoId().equals(todoId)) {
            throw new ApiException(400, "잘못된 요청입니다.");
        }

        Todo todo = todoRepository.findById(todoId)
                .orElseThrow(() -> new ApiException(404, "작업을 찾을 수 없습니다."));

        // 첨부 삭제 = 업로더 본인 || 할 일 작성자 || ADMIN 이상
        permissionService.requireCanDeleteAttachment(authentication.getName(), attachment, todo);

        // 파일 삭제
        try {
            String filename = attachment.getFileUrl().substring(attachment.getFileUrl().lastIndexOf("/") + 1);
            Path filePath = Paths.get(uploadDir).toAbsolutePath().resolve("todo-attachments").resolve(filename);
            Files.deleteIfExists(filePath);
        } catch (IOException ignored) {}

        todoAttachmentRepository.delete(attachment);
        return ResponseEntity.noContent().build();
    }

    private void requireSameWorkspace(Long todoId, String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        Todo todo = todoRepository.findById(todoId)
                .orElseThrow(() -> new ApiException(404, "작업을 찾을 수 없습니다."));
        if (todo.getWorkspace() == null ||
                !java.util.Objects.equals(todo.getWorkspace().getId(), workspace.getId())) {
            throw new ApiException(403, "다른 워크스페이스의 작업입니다.");
        }
    }
}
