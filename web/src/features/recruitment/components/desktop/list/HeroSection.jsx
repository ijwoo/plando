import { Box, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { CAT_CFG } from "../../../constants/recruitmentConfig";
import { searchFieldSx } from "../../common/recruitmentSx";
import { CatPill } from "../DesktopUI";

const CATEGORY_LIST = Object.keys(CAT_CFG);

/**
 * 둘러보기 탭 hero — 헤드라인 + 검색 + 카테고리 칩.
 * tab="browse"일 때만 사용처에서 렌더.
 */
export default function HeroSection({ search, onSearchChange, catF, onCatChange, showSearchAndCats }) {
    const theme = useTheme();

    return (
        <Box sx={{
            position: "relative",
            mb: 3.25,
            pt: 1,
        }}>
            <Box sx={{ maxWidth: 720 }}>
                <Typography sx={{
                    fontSize: { xs: 26, xl: 32 },
                    fontWeight: 700,
                    color: "text.primary",
                    letterSpacing: "-0.035em",
                    lineHeight: 1.15,
                    mb: 1,
                }}>
                    함께할 팀을 찾아봐요.
                </Typography>
                <Typography sx={{
                    fontSize: 15,
                    color: "text.secondary",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.6,
                    mb: 2.25,
                }}>
                    사이드 프로젝트와 스터디, 함께할 팀원을 찾아보세요.
                </Typography>

                {showSearchAndCats && (
                    <>
                        <Box sx={{ maxWidth: 560, mb: 1.75 }}>
                            <TextField
                                fullWidth
                                placeholder="프로젝트명, 기술 스택, 역할로 검색해보세요"
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchRoundedIcon sx={{ fontSize: 19, color: "text.disabled" }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={searchFieldSx(theme)}
                            />
                        </Box>

                        <Stack direction="row" gap={0.75} flexWrap="wrap">
                            <CatPill
                                label="전체"
                                active={catF === "전체"}
                                onClick={() => onCatChange("전체")}
                            />
                            {CATEGORY_LIST.map((cat) => (
                                <CatPill
                                    key={cat}
                                    label={cat}
                                    icon={CAT_CFG[cat]?.icon}
                                    active={catF === cat}
                                    onClick={() => onCatChange(catF === cat ? "전체" : cat)}
                                />
                            ))}
                        </Stack>
                    </>
                )}
            </Box>
        </Box>
    );
}
