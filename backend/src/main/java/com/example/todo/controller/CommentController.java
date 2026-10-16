package com.example.todo.controller;

import com.example.todo.dto.CommentCreateRequest;
import com.example.todo.dto.CommentResponse;
import com.example.todo.service.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/comments")
public class CommentController {

    private final CommentService commentService;

    @GetMapping("/{todoId}")
    public List<CommentResponse> getComments(
            @PathVariable Long todoId,
            Authentication authentication) {
        return commentService.getComments(todoId, authentication.getName());
    }

    @PostMapping
    public CommentResponse createComment(@Valid @RequestBody CommentCreateRequest request,
                                         Authentication authentication) {
        return commentService.createComment(request, authentication);
    }

    @DeleteMapping("/{commentId}")
    public void deleteComment(@PathVariable Long commentId,
                              Authentication authentication) {
        commentService.deleteComment(commentId, authentication);
    }
}