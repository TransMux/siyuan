import { Constants } from "../constants";

export const 知识单元avID = "20250101005818-yb4stwq";
export const 知识单元目录 = "20250101010126-gjm1cwx";

export const 关系笔记avID = "20250101233539-mitgexi";
export const 关系笔记目录 = "20250101010038-81wd8r8";

export const 标签之树avID = "20250101001630-x03k4te";
export const 标签之树目录 = "20250101005307-7384qo5";

export const 外部输入avID = "20250102171020-4cqqonx";
export const 外部输入目录 = "20250102171013-zzcyz96";

export const 已读目录 = "20241231233427-ge48qdq";

export const 主页ID = "20250206142847-cbvnc9o";

// key: 选中的文本如果全部属于同一个节点，并且color可以在下面的key中找到，那么升级到下一个颜色
// 需要处理冷启动的情况
export const altx上色顺序Keys = [
    "var(--b3-card-info-color)",
    "var(--b3-card-warning-color)",
    "var(--b3-card-error-color)",
    "var(--b3-font-color5)",
    "var(--b3-font-color13)",
    "clear"
];

export const altx上色顺序Values = [
    { "type": "style1", "color": `var(--b3-card-info-background)${Constants.ZWSP}var(--b3-card-info-color)` }, // 最弱
    { "type": "style1", "color": `var(--b3-card-warning-background)${Constants.ZWSP}var(--b3-card-warning-color)` },
    { "type": "style1", "color": `var(--b3-card-error-background)${Constants.ZWSP}var(--b3-card-error-color)` },
    // 在有背景的情况下进行设置，会导致背景颜色和字体颜色同时存在，目前使用这个方案
    { "type": "style1", "color": `${Constants.ZWSP}var(--b3-font-color5)` },
    { "type": "style1", "color": `${Constants.ZWSP}var(--b3-font-color13)` },
    // { "type": "color", "color": "var(--b3-font-color5)" },
    // { "type": "color", "color": "var(--b3-font-color13)" }, // 最强
    { "type": "clear" }
];
