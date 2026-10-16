package com.example.todo.util;

import com.example.todo.entity.User;

import java.util.Collection;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 댓글/DM 등 텍스트 본문에서 "@닉네임" 또는 "@이메일" 토큰을 추출하여
 * 후보 사용자(워크스페이스 멤버 / DM 룸 참가자 등) 중 매치되는 사용자의 이메일 셋을 반환.
 *
 * 단일 source of truth — CommentService, DmService 등이 같은 규칙으로 멘션을 인식하도록 함.
 *
 * 정규식 {@code @([\w가-힣]+)} 는 영문/숫자/underscore + 한국어 음절 조합.
 * 한국어 표시 이름 + 조사(예: "@김철수님")는 매치 안 됨 — 공백/문장부호로 끝나야 함.
 */
public final class MentionExtractor {

    private static final Pattern MENTION_PATTERN = Pattern.compile("@([\\w가-힣]+)");

    private MentionExtractor() {}

    public static Set<String> extractMentionedEmails(
            String content,
            Collection<User> candidates,
            String excludeEmail
    ) {
        if (content == null || content.isEmpty() || candidates == null || candidates.isEmpty()) {
            return Set.of();
        }

        Matcher matcher = MENTION_PATTERN.matcher(content);
        Set<String> tokens = new HashSet<>();
        while (matcher.find()) {
            tokens.add(matcher.group(1));
        }
        if (tokens.isEmpty()) return Set.of();

        return candidates.stream()
                .filter(Objects::nonNull)
                .filter(u -> u.getEmail() != null)
                .filter(u -> excludeEmail == null || !u.getEmail().equalsIgnoreCase(excludeEmail))
                .filter(u -> {
                    String displayName = (u.getName() != null && !u.getName().isBlank())
                            ? u.getName()
                            : (u.getEmail().contains("@") ? u.getEmail().split("@")[0] : u.getEmail());
                    // 토큰은 공백을 포함할 수 없으므로("@게스트 1" 불가) 공백 제거 이름과
                    // 이메일 로컬파트도 허용 — 클라이언트 자동완성이 넣는 형태와 일치
                    String nameNoSpace = displayName.replaceAll("\\s+", "");
                    String localPart = u.getEmail().contains("@") ? u.getEmail().split("@")[0] : u.getEmail();
                    return tokens.contains(displayName)
                            || tokens.contains(nameNoSpace)
                            || tokens.contains(localPart)
                            || tokens.contains(u.getEmail());
                })
                .map(User::getEmail)
                .collect(Collectors.toSet());
    }
}
