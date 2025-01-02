import { fetchPost } from "../util/fetch";

const 知识单元avID = "20250101005818-yb4stwq";
const 知识单元目录 = "20250101010126-gjm1cwx";
const 关系笔记avID = "20250101233539-mitgexi";
const 关系笔记目录 = "20250101010038-81wd8r8";

export function afterAddedFileToDatabase(file_ids: Array<string>, avID: string) {
    console.log("添加文档到数据库callback: ", file_ids, avID);

    // 如果是添加到知识单元 / 关系笔记数据库，那么分别移动笔记到目录下
    if (avID === 知识单元avID) {
        fetchPost("/api/filetree/moveDocsByID", {
            "fromIDs": file_ids,
            "toID": 知识单元目录
        });
    }

    if (avID === 关系笔记avID) {
        fetchPost("/api/filetree/moveDocsByID", {
            "fromIDs": file_ids,
            "toID": 关系笔记目录
        });
    }
}