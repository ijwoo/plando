package com.example.todo.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

public class KakaoFriendDto {

    @Getter
    @NoArgsConstructor
    public static class FriendListResponse {
        private List<Friend> elements;

        @JsonAlias("total_count")
        private int totalCount;

        @JsonAlias("after_url")
        private String afterUrl;
    }

    @Getter
    @NoArgsConstructor
    public static class Friend {
        private Long id;
        private String uuid;

        @JsonAlias("profile_nickname")
        private String profileNickname;

        @JsonAlias("profile_thumbnail_image")
        private String profileThumbnailImage;

        private boolean favorite;

        @JsonAlias("allowed_msg")
        private boolean allowedMsg;
    }
}
