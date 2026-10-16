// 주간 회고 카드 mock 데이터. 백엔드 연동 전 UI 확인용.
// 추후 /api/wrap/weekly 응답으로 교체.

export const MOCK_WRAP = {
    weekIndex: 4,
    month: 5,
    year: 2026,
    rangeLabel: "5월 25일 ~ 5월 31일",
    userName: "재우",

    totalCount: 17,
    doneCount: 14,
    completionRate: 82,

    // 지난주 비교
    prevWeekTotalCount: 12,
    prevWeekCompletionRate: 76,

    // 요일별 분포 (일~토)
    busiestDay: { label: "목요일", count: 6, dayIndex: 4 },
    weekdayCounts: [1, 2, 3, 4, 6, 1, 0],

    // 시간대별 분포 — 오전/오후/저녁
    timeBuckets: {
        morning: 5,    // 06–12
        afternoon: 9,  // 12–18
        evening: 3,    // 18–24
    },

    // 함께한 멤버 top 3
    topPeople: [
        { name: "김민지", count: 3, profileImageUrl: null },
        { name: "이성호", count: 2, profileImageUrl: null },
        { name: "박지원", count: 2, profileImageUrl: null },
    ],

    topPlace: { name: "강남역", count: 4 },
    meetingMinutes: 750, // 12시간 30분

    // 마일스톤 / 뱃지
    milestones: [
        { id: "streak4", emoji: "🔥", label: "4주 연속 회고" },
        { id: "collab", emoji: "🤝", label: "협업 챔피언" },
        { id: "complete80", emoji: "🎯", label: "완료율 80% 돌파" },
    ],

    aiComment: "수요일 오후 회의 폭격, 이번 주 정말 고생하셨어요.",
};

// 호환: 기존 코드가 topPerson 단수로 참조 — top[0]을 가리킴
MOCK_WRAP.topPerson = MOCK_WRAP.topPeople[0];

export const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
