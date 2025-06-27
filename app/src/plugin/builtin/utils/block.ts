import {hasClosestBlock} from "../../../protyle/util/hasClosest";

export function getSelectedBlock(previousRange?: Range): HTMLElement[] {
    let range: Range;
    
    if (previousRange) {
        range = previousRange;
    } else if (getSelection().rangeCount > 0) {
        range = getSelection().getRangeAt(0);
    } else {
        return [];
    }
    
    const startContainer = range.startContainer;
    const selectedBlock = hasClosestBlock(startContainer);
    
    if (selectedBlock) {
        return [selectedBlock as HTMLElement];
    }
    
    return [];
} 