import { Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * 입력 필드 공용 스타일 (로그인 · 회원가입 · 설정).
 *
 * 왜 만들었나: 기본 MUI outlined 는 라벨이 테두리를 파고드는 플로팅 방식이라, 값이 차면
 * 선이 끊겨 보인다. 라벨을 필드 위로 빼고(FieldLabel) 테두리·포커스를 직접 잡는다.
 * 포커스는 색만 바꾸지 않고 얇은 링을 더한다 — 어디에 커서가 있는지 한눈에 보인다.
 *
 * **CSS 변수(--plando-border 등)를 쓰지 않고 MUI 테마에서 색을 꺼내는 이유:**
 * CSS 변수는 documentElement 의 data-theme(=앱 테마)를 따른다. 그런데 로그인·회원가입은
 * ThemeProvider 로 항상 라이트를 강제한다. 다크로 쓰다 로그아웃한 사용자는 밝은 폼에
 * 어두운 테두리가 붙은 화면을 보게 된다(같은 원인으로 로그인 목업 그림자가 어긋난 적 있다).
 * MUI 테마는 그 ThemeProvider 를 그대로 타므로 두 경우 모두 맞는다.
 */
export const fieldSx = (t) => {
    const dark = t.palette.mode === "dark";
    // 처음엔 #E3E8EF 였는데 흰 배경 위에서 테두리가 거의 안 보여 입력칸인지조차
    // 알기 어려웠다. 한 단계 진하게.
    const line = dark ? alpha("#fff", 0.18) : "#CBD5E1";
    const lineHover = dark ? alpha("#fff", 0.30) : "#94A3B8";
    return {
        "& .MuiOutlinedInput-root": {
            borderRadius: "12px",
            bgcolor: dark ? alpha("#fff", 0.04) : "#fff",
            transition: "border-color .15s, box-shadow .15s",
            "& fieldset": { borderColor: line, borderWidth: "1px" },
            "&:hover fieldset": { borderColor: lineHover },
            "&.Mui-focused": { boxShadow: `0 0 0 4px ${alpha(t.palette.primary.main, dark ? 0.22 : 0.12)}` },
            // theme.js 의 MuiOutlinedInput 에도 포커스 링이 있어 두 겹으로 그려진다.
            // 게다가 그 값은 CSS 변수라 앱 테마를 따라가서, 라이트 강제 화면에서 어긋난다.
            // 여기서 한 겹만 남긴다.
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { boxShadow: "none" },
            "&.Mui-focused fieldset": { borderColor: t.palette.primary.main, borderWidth: "1px" },
            "&.Mui-disabled": { bgcolor: dark ? alpha("#fff", 0.02) : "#F7F8FA" },
        },
        "& .MuiOutlinedInput-input": { padding: "14px 14px", fontSize: 15 },
        // select 는 padding 을 자체 규칙으로 잡아 위 규칙이 안 먹는다
        "& .MuiSelect-select": { padding: "14px 14px", fontSize: 15 },
        "& .MuiInputAdornment-root": { color: t.palette.text.disabled },
    };
};

/** 필드 위에 놓는 라벨. htmlFor 로 실제 input 과 연결해 라벨 클릭이 동작하게 한다. */
export function FieldLabel({ children, htmlFor, sx }) {
    return (
        <Typography
            component="label"
            htmlFor={htmlFor}
            sx={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: "text.primary",
                mb: 0.75,
                ...sx,
            }}
        >
            {children}
        </Typography>
    );
}
