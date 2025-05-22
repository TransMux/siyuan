// Plugin for Protyle to implement VSCode-like sticky scroll
import {hasClosestBlock} from "../util/hasClosest";
export const initStickyScroll = (protyle: any) => {
    // Prevent duplicate initialization
    if (protyle.stickyScrollInitialized) {
        return;
    }
    protyle.stickyScrollInitialized = true;

    // Inject styles for sticky scroll UI
    const style = document.createElement('style');
    style.textContent = `
.mux-protyle-sticky-scroll {
  background-color: var(--b3-surface);
  border-bottom: 1px solid var(--b3-border-color);
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 4px 24px;
  box-sizing: border-box;
  z-index: 1;
}
.mux-protyle-sticky-scroll__row {
  width: 100%;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 24px;
  padding: 2px 0;
}
.mux-protyle-sticky-scroll__row:hover {
  background-color: var(--b3-list-hover);
}
.mux-protyle-sticky-scroll * {
  margin: 0 !important;
}
`;
    document.head.appendChild(style);

    // Create the sticky container element
    const stickyContainer = document.createElement('div');
    stickyContainer.className = 'mux-protyle-sticky-scroll protyle-wysiwyg';
    stickyContainer.style.display = 'none';
    // Insert it before the scrollable content
    protyle.element.insertBefore(stickyContainer, protyle.contentElement);

    // 更新函数：查找最顶部的块并获取其面包屑路径
    let lastId: string | null = null;
    const updateSticky = () => {
        // 1. 在视口顶部查找块元素(data-node-id)
        const rect = protyle.contentElement.getBoundingClientRect();
        let target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 5) as HTMLElement | null;
        if (target && target.classList.contains('protyle-wysiwyg')) {
            target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 20) as HTMLElement | null;
        }
        const rawBlock = target ? hasClosestBlock(target) as HTMLElement : null;
        if (!rawBlock) {
            stickyContainer.style.display = 'none';
            return;
        }
        // 如果是列表项内的段落，使用列表项容器
        let blockElement = rawBlock;
        if (blockElement.getAttribute('data-type') === 'NodeParagraph'
            && blockElement.parentElement?.getAttribute('data-type') === 'NodeListItem') {
            blockElement = blockElement.parentElement;
        }
        const id = blockElement.getAttribute('data-node-id');
        if (!id || id === lastId) {
            return;
        }
        lastId = id;
        // 使用双向搜索构建面包屑路径
        let ancestors: HTMLElement[] = [];
        let current: HTMLElement | null = blockElement;
        while (current && current !== protyle.wysiwyg.element) {
            // 方向1：在同级中搜索前面的兄弟元素
            let foundHeading: HTMLElement | null = null;
            let sib = current.previousElementSibling as HTMLElement | null;
            while (sib) {
                if (sib.hasAttribute('data-node-id')) {
                    if (sib.getAttribute('data-type') === 'NodeHeading') {
                        foundHeading = sib;
                    }
                    break;
                }
                sib = sib.previousElementSibling as HTMLElement | null;
            }
            if (foundHeading) {
                ancestors.unshift(foundHeading);
                current = foundHeading;
                continue;
            }
            // 方向2：如果没有标题兄弟元素，则向上移动到父块
            const parentBlock = current.parentElement
                ? hasClosestBlock(current.parentElement) as HTMLElement
                : null;
            if (!parentBlock || parentBlock === current) {
                break;
            }
            if (parentBlock.getAttribute('data-type') === 'NodeListItem') {
                ancestors.unshift(parentBlock);
            }
            current = parentBlock;
        }
        if (ancestors.length > 3) {
            ancestors = ancestors.slice(-3);
        }
        if (!ancestors.length) {
            stickyContainer.style.display = 'none';
            return;
        }
        // 渲染克隆的行，保留实际缩进和内容
        stickyContainer.innerHTML = '';
        ancestors.forEach(orig => {
            const clone = orig.cloneNode(true) as HTMLElement;
            if (orig.getAttribute('data-type') === 'NodeListItem') {
                // For list items, keep only the first block child and its preceding protyle-action div
                const blocks = Array.from(clone.children).filter(child => 
                    (child as HTMLElement).hasAttribute('data-node-id')
                );
                clone.innerHTML = '';
                if (blocks.length > 0) {
                    const firstBlock = blocks[0];
                    const actionDiv = firstBlock.previousElementSibling;
                    if (actionDiv && actionDiv.classList.contains('protyle-action')) {
                        clone.appendChild(actionDiv.cloneNode(true));
                    }
                    clone.appendChild(firstBlock);
                }
            }

            clone.className = 'mux-protyle-sticky-scroll__row ' + (clone.className || '');
            // 根据相对于protyle.element的偏移量计算内边距
            const origRect = orig.getBoundingClientRect();
            const containerRect = protyle.element.getBoundingClientRect();
            const relativeLeft = origRect.left - containerRect.left;
            clone.style.paddingLeft = `${relativeLeft}px`;
            clone.addEventListener('click', (event) => {
                const nodeId = orig.getAttribute('data-node-id');
                if (nodeId) {
                    const target = protyle.contentElement.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
                    if (target) {
                        target.scrollIntoView({ behavior: 'auto', block: 'start' });
                        event.stopPropagation();
                        event.preventDefault();
                    }
                }
            });
            clone.addEventListener('contextmenu', ev => {
                ev.preventDefault();
                const r = orig.getBoundingClientRect();
                orig.dispatchEvent(new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    clientX: r.left,
                    clientY: r.top
                }));
            });
            stickyContainer.appendChild(clone);
        });
        stickyContainer.style.display = '';
    };

    // Attach scroll listener on editor content
    protyle.contentElement.addEventListener('scroll', updateSticky, { passive: true });
};