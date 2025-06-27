import { showMessage } from "../../../dialog/message";
import { getSelectedBlock } from "../utils/block";

export function copyBlockLink(event: any) {
    const selectedBlock = getSelectedBlock(event?.detail?.previousRange);
    console.log(selectedBlock);
    let focusBlock = selectedBlock[0];
    
    if (!focusBlock) {
        showMessage("No block selected", 3000);
        return;
    }
    
    // https://x.transmux.top/j/20241031103336-pcmhdn1
    if (focusBlock.parentElement.dataset.type === "NodeListItem") {
        focusBlock = focusBlock.parentElement;
    }
    const link = `https://x.transmux.top/j/${focusBlock.dataset.nodeId}`;
    // copy link to clipboard
    navigator.clipboard.writeText(link);
    showMessage(`复制成功：${link}`, 3000);
}

export function openHomepage() {
    window.open("siyuan://blocks/20250206142847-cbvnc9o", "_blank");
} 