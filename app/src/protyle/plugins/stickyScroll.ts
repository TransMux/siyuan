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
  padding: 4px 24px;
  box-sizing: border-box;
  z-index: 1;
}
.protyle-sticky-scroll__item {
  cursor: pointer;
  margin-right: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 4px 8px;
  border-radius: var(--b3-border-radius);
  font-size: var(--b3-font-size-editor);
}
.protyle-sticky-scroll__item:hover {
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
            data.forEach((item, idx) => {
                // icon
                const icon = document.createElement('svg');
                icon.className = 'popover__block';
                icon.setAttribute('data-id', item.id);
                const use = document.createElement('use');
                use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${getIconByType(item.type, item.subType)}`);
                icon.appendChild(use);
                stickyContainer.appendChild(icon);
                // text
                if (item.name) {
                    const span = document.createElement('span');
                    span.className = 'protyle-sticky-scroll__item';
                    span.textContent = item.name;
                    span.title = item.name;
                    span.addEventListener('click', () => {
                        // jump to this block
                        const el = protyle.wysiwyg.element.querySelector(`[data-node-id="${item.id}"]`);
                        el?.scrollIntoView({ behavior: 'auto', block: 'start' });
                        protyle.wysiwyg.element.focus();
                    });
                    stickyContainer.appendChild(span);
                }
                // arrow
                if (idx < data.length - 1) {
                    const arrow = document.createElement('svg');
                    arrow.className = 'protyle-sticky-scroll__arrow';
                    const useArrow = document.createElement('use');
                    useArrow.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#iconRight');
                    arrow.appendChild(useArrow);
                    stickyContainer.appendChild(arrow);
                }
            });
            stickyContainer.style.display = '';
        });
    };

    // Attach scroll listener on editor content
    protyle.contentElement.addEventListener('scroll', updateSticky, { passive: true });
}; 