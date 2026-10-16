import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";

/** 프로젝트 아이콘 후보 (생성 시 선택). key를 프로젝트에 저장. */
export const PROJECT_ICONS = [
    { key: "folder", Icon: FolderRoundedIcon },
    { key: "work", Icon: WorkRoundedIcon },
    { key: "rocket", Icon: RocketLaunchRoundedIcon },
    { key: "flag", Icon: FlagRoundedIcon },
    { key: "star", Icon: StarRoundedIcon },
    { key: "bolt", Icon: BoltRoundedIcon },
    { key: "code", Icon: CodeRoundedIcon },
    { key: "insights", Icon: InsightsRoundedIcon },
    { key: "palette", Icon: PaletteRoundedIcon },
    { key: "calendar", Icon: CalendarMonthRoundedIcon },
    { key: "groups", Icon: GroupsRoundedIcon },
    { key: "lightbulb", Icon: LightbulbRoundedIcon },
];

const MAP = Object.fromEntries(PROJECT_ICONS.map((i) => [i.key, i.Icon]));

/** iconKey → MUI 아이콘 컴포넌트 (없으면 폴더). */
export function getProjectIcon(key) {
    return MAP[key] || FolderRoundedIcon;
}
