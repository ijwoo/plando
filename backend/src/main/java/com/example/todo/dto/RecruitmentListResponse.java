package com.example.todo.dto;

import com.example.todo.entity.Recruitment;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
public class RecruitmentListResponse {

    private Long id;
    private String title;
    private String summary;
    private String typeLabel;    // category
    private String statusLabel;  // status
    private List<String> tags;   // techStacks
    private List<String> roles;  // role names only
    private String locationText;
    private Double locationLat;
    private Double locationLng;
    private boolean hasLocation;
    private String members;      // "현재/최대명" ex) "2/4명"
    private String dueText;      // "N일 남음" or "마감됨"
    private String author;       // author name
    private Long authorId;       // author user id (DM 연결용)
    private boolean bookmarked;
    private Double distanceKm;   // nullable, 클라이언트에서 계산 가능
    private String appliedStatus; // 현재 사용자의 지원 상태: null / "PENDING" / "ACCEPTED" / "CANCELLED"

    /** 미답변 Q&A 수 — 작성자 본인의 mine 탭 카드에서만 주입 (setter 사용). 다른 경우 null. */
    private Integer unansweredCount;

    public RecruitmentListResponse(Recruitment r, boolean bookmarked, String appliedStatus) {
        this.id = r.getId();
        this.title = r.getTitle();
        this.summary = r.getSummary();
        this.typeLabel = r.getCategory();
        this.statusLabel = r.getStatus();
        this.tags = r.getTechStacks();
        this.roles = r.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toList());
        this.locationText = r.getLocationText();
        this.locationLat = r.getLocationLat();
        this.locationLng = r.getLocationLng();
        this.hasLocation = r.isHasLocation();
        this.members = r.getMembers().size() + "/" + r.getMaxMembers() + "명";
        this.dueText = computeDueText(r.getDeadline());
        this.author = r.getAuthor() != null ? r.getAuthor().getName() : "알 수 없음";
        this.authorId = r.getAuthor() != null ? r.getAuthor().getId() : null;
        this.bookmarked = bookmarked;
        this.appliedStatus = appliedStatus;
    }

    private static String computeDueText(LocalDate deadline) {
        if (deadline == null) return "마감일 미정";
        long days = ChronoUnit.DAYS.between(LocalDate.now(), deadline);
        if (days < 0) return "마감됨";
        if (days == 0) return "D-Day";
        return days + "일 남음";
    }
}
