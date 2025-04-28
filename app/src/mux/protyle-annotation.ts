import { Constants } from "../constants";
import { fetchPost, fetchSyncPost } from "../util/fetch";
import { showMessage } from "../dialog/message";

/**
 * Open annotation edit panel for a given annotation block ID.
 */
export function showAnnotationEditPanel(protyle: IProtyle, annotationBlockId: string) {
    // TODO: Implement UI panel rendering and instantiate Protyle for editing annotation block
    console.log("Opening annotation edit panel for block ID:", annotationBlockId);
}

/**
 * Create a new annotation block under today's daily note and return its block ID.
 */
export async function addAnnotationInline(protyle: IProtyle): Promise<string> {
    // Ensure today's daily note exists and get its block ID
    const localDailyNoteId = window.siyuan.storage[Constants.LOCAL_DAILYNOTEID];
    const ensureResp = await fetchSyncPost("/api/filetree/createDailyNote", {
        notebook: localDailyNoteId,
        app: Constants.SIYUAN_APPID,
    });
    const parentID = ensureResp.data.id;
    // Insert an empty paragraph block after the daily note root
    return new Promise((resolve) => {
        fetchPost(
            "/api/block/insertBlock",
            { previousID: parentID, dataType: "markdown", data: "" },
            (insertResp: any) => {
                const newBlockId = insertResp.data[0]?.doOperations[0]?.id;
                if (newBlockId) {
                    resolve(newBlockId);
                } else {
                    showMessage("创建批注失败", 1000, "error");
                    resolve("");
                }
            }
        );
    });
}

/**
 * TODO: Implement multi-block annotation creation.
 */
export function addAnnotationMultiBlock(protyle: IProtyle): Promise<string> {
    console.warn("addAnnotationMultiBlock not implemented");
    return Promise.resolve("");
}


