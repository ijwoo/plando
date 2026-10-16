package com.example.todo.dto;

import com.example.todo.entity.DmRoom;
import com.example.todo.entity.User;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class DmRoomResponse {

    private Long id;

    @JsonProperty("isGroup")
    private boolean isGroup;

    // 1:1 전용 필드
    private Long partnerId;
    private String partnerName;
    private String partnerEmail;
    private String partnerProfileImageUrl;

    // 그룹 전용 필드
    private String groupName;
    private String groupImageUrl;
    private int memberCount;
    private List<Long> memberIds;

    // 공통 필드
    private String lastMessage;
    private LocalDateTime lastMessageAt;
    private long unreadCount;

    /** 1:1 DM 방 */
    public static DmRoomResponse of(DmRoom room, User me, User partner, long unreadCount) {
        return DmRoomResponse.builder()
                .id(room.getId())
                .isGroup(false)
                .partnerId(partner.getId())
                .partnerName(partner.getName())
                .partnerEmail(partner.getEmail())
                .partnerProfileImageUrl(partner.getProfileImageUrl())
                .memberCount(2)
                .lastMessage(room.getLastMessage())
                .lastMessageAt(room.getLastMessageAt())
                .unreadCount(unreadCount)
                .build();
    }

    /** 그룹 채팅 방 */
    public static DmRoomResponse ofGroup(DmRoom room, long unreadCount) {
        List<Long> memberIds = room.getParticipants().stream()
                .map(User::getId)
                .toList();
        return DmRoomResponse.builder()
                .id(room.getId())
                .isGroup(true)
                .groupName(room.getGroupName())
                .groupImageUrl(room.getGroupImageUrl())
                .memberCount(room.getParticipants().size())
                .memberIds(memberIds)
                .lastMessage(room.getLastMessage())
                .lastMessageAt(room.getLastMessageAt())
                .unreadCount(unreadCount)
                .build();
    }
}
