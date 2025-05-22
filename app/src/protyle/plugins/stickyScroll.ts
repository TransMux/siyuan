// Plugin for Protyle to implement VSCode-like sticky scroll
import {fetchPost} from "../../util/fetch";
import {getIconByType} from "../../editor/getIcon";
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
.protyle-sticky-scroll {
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
.protyle-sticky-scroll__row {
  width: 100%;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 24px;
  padding: 2px 0;
}
.protyle-sticky-scroll__row:hover {
  background-color: var(--b3-list-hover);
}
`;
    document.head.appendChild(style);

    // Create the sticky container element
    const stickyContainer = document.createElement('div');
    stickyContainer.className = 'protyle-sticky-scroll';
    stickyContainer.style.display = 'none';
    // Insert it before the scrollable content
    protyle.element.insertBefore(stickyContainer, protyle.contentElement);

    // Update function: find topmost block and fetch its breadcrumb path
    let lastId: string | null = null;
    const updateSticky = () => {
        const rect = protyle.contentElement.getBoundingClientRect();
        let target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 5) as HTMLElement | null;
        if (target && target.classList.contains('protyle-wysiwyg')) {
            target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 20) as HTMLElement | null;
        }
        const rawBlock = target ? hasClosestBlock(target) : false;
        if (!rawBlock) {
            stickyContainer.style.display = 'none';
            return;
        }
        const blockElement = rawBlock as HTMLElement;
        const id = blockElement.getAttribute('data-node-id');
        if (!id || id === lastId) {
            return;
        }
        lastId = id;
        // Fetch breadcrumb path for the current block
        fetchPost('/api/block/getBlockBreadcrumb', { id, excludeTypes: [] }, (response: IWebSocketData | string) => {
            // Handle text or error
            if (typeof response === 'string') {
                stickyContainer.style.display = 'none';
                return;
            }
            const data = response.data as any[];
            if (!data.length) {
                stickyContainer.style.display = 'none';
                return;
            }
            // Build breadcrumb into sticky container
            stickyContainer.innerHTML = '';
            data.forEach(item => {
                // Find corresponding DOM block for indent
                const el = protyle.wysiwyg.element.querySelector(`[data-node-id="${item.id}"]`) as HTMLElement | null;
                const indent = el ? el.offsetLeft : 0;
                // Row container
                const row = document.createElement('div');
                row.className = 'protyle-sticky-scroll__row';
                row.style.paddingLeft = indent + 'px';
                row.textContent = item.name || '';
                // Click to jump
                row.addEventListener('click', () => {
                    if (el) {
                        el.scrollIntoView({ behavior: 'auto', block: 'start' });
                        protyle.wysiwyg.element.focus();
                    }
                });
                // Right-click to show context menu
                row.addEventListener('contextmenu', ev => {
                    ev.preventDefault();
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        el.dispatchEvent(new MouseEvent('contextmenu', {
                            bubbles: true,
                            cancelable: true,
                            clientX: rect.left,
                            clientY: rect.top
                        }));
                    }
                });
                stickyContainer.appendChild(row);
            });
            stickyContainer.style.display = '';
        });
    };

    // Attach scroll listener on editor content
    protyle.contentElement.addEventListener('scroll', updateSticky, { passive: true });
}; 