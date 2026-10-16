import { Box, Stack, Typography } from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";

import { BoardMockup, AiParseMockup, MapMockup } from "../../onboarding/components/tour/TourMockups.jsx";
import { AUTH_PAGE_BG_GLASS } from "../utils/pageBg.js";

/**
 * 로그인·회원가입 오른쪽 비주얼 패널.
 *
 * 로그인에서만 쓰다가 회원가입도 같은 2분할로 바꾸면서 공용으로 뺐다. 두 화면이 구조가
 * 다르면 로그인 → 회원가입으로 넘어갈 때 화면이 통째로 바뀐 것처럼 보인다.
 *
 * 캡처 이미지 대신 온보딩 투어의 목업을 재사용한다 — 코드로 그린 것이라 UI 가 바뀌어도
 * 안 낡고, 새 이미지를 만들 필요도 없다.
 */
const BLUE       = "#1976d2";
const BLUE_LIGHT = "#EFF6FF";
const PAGE_BG    = AUTH_PAGE_BG_GLASS;

const LIGHT_SHADOW_VARS = {
    "--plando-shadow-3": "0 4px 12px rgba(17,24,39,0.06), 0 8px 24px rgba(17,24,39,0.05)",
    "--plando-shadow-4": "0 8px 24px rgba(17,24,39,0.08), 0 16px 40px rgba(17,24,39,0.06)",
    "--plando-elev-3": "0 2px 4px rgba(0,0,0,0.03)",
};

// 오른쪽 패널 하단 요약 — 예전 BrandPanel의 3가지 소개를 아이콘+제목만 남겨 한 줄로 압축.
// 움직이는 보드 목업이 이미 "무엇을 하는 앱인지"를 보여주므로 설명 문장까지 두면 시선이 갈린다.
const FEATURES = [
    { icon: <DashboardRoundedIcon sx={{ fontSize: 16, color: BLUE }} />, title: "대시보드" },
    { icon: <GroupsRoundedIcon sx={{ fontSize: 16, color: BLUE }} />, title: "팀 협업" },
    // 칸반·AI 는 다른 도구에도 있지만 "그 장소에 도착하면 알려주는 할 일"은 흔치 않다 —
    // Plan Do! 를 구별해 주는 지점이라 칩에도 세운다.
    { icon: <PlaceOutlinedIcon sx={{ fontSize: 16, color: BLUE }} />, title: "위치 알림" },
];

// ── 오른쪽 비주얼 패널 (md 이상) ───────────────────────────────────
// 예전 BrandPanel(왼쪽 카피 + 3가지 소개)을 대체한다. 캡쳐 이미지 대신 온보딩 투어의
// BoardMockup을 그대로 재사용 — 코드로 그린 목업이라 테마를 따라가고 UI가 바뀌어도 안 낡는다.
// 모션 gating은 목업 내부 useReduced()가 이미 처리하므로 여기서 다시 감싸지 않는다.
export default function AuthVisualPanel() {
    return (
        <Box
            sx={{
                display: { xs: "none", md: "flex" },
                alignItems: "center",
                justifyContent: "center",
                px: { md: 4, lg: 6 },
                py: 6,
                background: PAGE_BG,
                borderLeft: "1px solid rgba(25,118,210,0.10)",
                minWidth: 0,
                overflow: "hidden",
                ...LIGHT_SHADOW_VARS,
            }}
        >
            {/* 고정 폭 '무대'. 예전엔 목업 크기를 패널 비율(%)로 잡아, 와이드 모니터에서
                패널이 2000px 넘게 벌어지면 보드가 그만큼 거대해지고 아래 두 카드가
                900px 넘게 떨어져 구성이 흩어졌다. 무대 폭을 묶어야 어느 해상도에서든
                같은 구도가 나온다. 좌우 여백을 다르게 줘 가운데 정렬로 읽히지 않게 한다. */}
            <Box
                sx={{
                    width: "100%",
                    maxWidth: 760,
                    display: "flex",
                    flexDirection: "column",
                    gap: { md: 4, lg: 5 },
                    pl: { md: 1, lg: 2 },
                    pr: { md: 0, lg: 0 },
                }}
            >
            {/* 카피는 왼쪽 정렬. 헤드라인·목업·칩이 모두 한 중심축에 얌전히 쌓이면
                "구성"이 아니라 "나열"로 읽혀 밋밋하다. */}
            <Box sx={{ maxWidth: 460 }}>
                <Typography
                    sx={{
                        fontWeight: 900,
                        fontSize: { md: 26, lg: 32 },
                        lineHeight: 1.28,
                        letterSpacing: -0.6,
                        color: "rgba(0,0,0,0.88)",
                        mb: 1.25,
                    }}
                >
                    작업과 일정을
                    <br />한 곳에서 관리해요.
                </Typography>
                <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.52)", lineHeight: 1.7 }}>
                    팀 협업부터 개인 일정 관리까지, Plan Do! 하나면 충분해요.
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
                    {FEATURES.map((f) => (
                        <Stack
                            key={f.title}
                            direction="row"
                            alignItems="center"
                            spacing={0.75}
                            sx={{
                                px: 1.5,
                                py: 0.75,
                                borderRadius: 999,
                                bgcolor: BLUE_LIGHT,
                                border: "1px solid rgba(25,118,210,0.12)",
                            }}
                        >
                            {f.icon}
                            <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: "rgba(0,0,0,0.72)" }}>
                                {f.title}
                            </Typography>
                        </Stack>
                    ))}
                </Stack>
            </Box>

            {/* 목업 두 장을 겹친다. 나란히 세로로 쌓으면 크기만 다른 같은 것이 두 개 있는
                꼴이라 평면적이다. 큰 보드를 오른쪽 화면 밖으로 살짝 흘려보내고(더 큰 화면의
                일부처럼 보인다), AI 카드를 그 왼쪽 아래에 얹어 깊이를 만든다. */}
            <Box sx={{ position: "relative", width: "100%", minHeight: { md: 300, lg: 340 } }}>
                <Box
                    sx={{
                        width: { md: "104%", lg: "110%" },   // 오른쪽으로 흘려보내 잘리게
                        aspectRatio: "16 / 9",
                        minHeight: 210,
                        /* 원근 회전을 걸었다가 뺐다. 3D 변형이 붙으면 브라우저가 요소를
                           별도 레이어로 래스터화해 **글자 획이 번진다** — 확대해 보니 목업
                           제목이 실제로 뭉개져 있었다. 비대칭은 회전이 아니라 위치(오른쪽으로
                           흘려보내기)로 만들고, 분리는 그림자로 준다. */
                        filter: "drop-shadow(0 20px 44px rgba(20,50,100,0.20))",
                    }}
                >
                    <BoardMockup />
                </Box>

                {/* 아래 두 장은 **높이를 다르게** 둔다. 나란히 같은 선에 놓으면 다시
                    "가지런한 두 개"가 되어 방금 고친 문제가 그대로 돌아온다. */}
                <Box
                    sx={{
                        display: { md: "none", lg: "block" },
                        position: "absolute",
                        left: { lg: -28 },
                        bottom: { lg: -70 },
                        width: 330,
                        /* 16/7 로 뒀더니 본문이 118px 인데 내용이 140px 이라 22px 넘쳐,
                           입력창이 창 제목 줄을 파고들었다. MockWindow 는 제목 24px 이 고정이고
                           본문이 minHeight:0 이라 모자라면 밀려 올라온다. 내용이 들어갈 높이를 준다. */
                        aspectRatio: "16 / 9",
                        minHeight: 200,
                        filter: "drop-shadow(0 18px 38px rgba(20,50,100,0.22))",
                    }}
                >
                    <AiParseMockup />
                </Box>

                {/* 위치 알림 — 도착하면 알려주는 할 일. 다른 도구에 흔치 않은 기능이라
                    첫 화면에서 빠지면 Plan Do! 가 평범한 할 일 앱으로 읽힌다. */}
                <Box
                    sx={{
                        display: { md: "none", lg: "block" },
                        position: "absolute",
                        right: { lg: 4 },
                        bottom: { lg: -18 },
                        width: 300,
                        aspectRatio: "16 / 9",
                        filter: "drop-shadow(0 16px 34px rgba(20,50,100,0.20))",
                    }}
                >
                    <MapMockup />
                </Box>
            </Box>
            </Box>
        </Box>
    );
}
