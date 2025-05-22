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
    stickyContainer.className = 'protyle-sticky-scroll protyle-wysiwyg';
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
        // Determine the block element at top of viewport
        const rawBlock = target ? hasClosestBlock(target) : false;
        if (!rawBlock) {
            stickyContainer.style.display = 'none';
            return;
        }
        let blockElement = rawBlock as HTMLElement;
        const blockType = blockElement.getAttribute('data-type');
        // If it's a paragraph inside a list item, use the list item container
        if (blockType === 'NodeParagraph' &&
            blockElement.parentElement?.getAttribute('data-type') === 'NodeListItem') {
            blockElement = blockElement.parentElement;
        }
        const id = blockElement.getAttribute('data-node-id');
        if (!id || id === lastId) {
            return;
        }
        lastId = id;
        // Build path: include headings and, for lists, only the first list item
        const ancestors: HTMLElement[] = [];
        let node: HTMLElement | null = blockElement;
        while (node && node !== protyle.wysiwyg.element) {
            const type = node.getAttribute('data-type');
            if (type === 'NodeHeading') {
                ancestors.unshift(node);
            } else if (type === 'NodeListItem') {
                // Only include the first list item of this list
                const parentList = node.parentElement;
                if (parentList && parentList.getAttribute('data-type') === 'NodeList') {
                    const firstItem = parentList.querySelector(':scope > [data-type="NodeListItem"]') as HTMLElement;
                    if (firstItem) {
                        ancestors.unshift(firstItem);
                    }
                }
            }
            // Move up to closest block parent
            const parentNode = node.parentElement
                ? hasClosestBlock(node.parentElement) as HTMLElement
                : null;
            if (!parentNode || parentNode === node) {
                break;
            }
            node = parentNode;
        }
        if (!ancestors.length) {
            stickyContainer.style.display = 'none';
            return;
        }
        // Render cloned rows preserving real indent and content
        stickyContainer.innerHTML = '';
        ancestors.forEach(orig => {
            const clone = orig.cloneNode(true) as HTMLElement;
            clone.className = 'protyle-sticky-scroll__row ' + (clone.className || '');
            // Preserve real indent via offsetLeft from editor content
            clone.style.paddingLeft = orig.offsetLeft + 'px';
            // Ensure interactive behavior
            clone.addEventListener('click', () => {
                orig.scrollIntoView({ behavior: 'auto', block: 'start' });
                protyle.wysiwyg.element.focus();
            });
            clone.addEventListener('contextmenu', ev => {
                ev.preventDefault();
                const rect = orig.getBoundingClientRect();
                orig.dispatchEvent(new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left,
                    clientY: rect.top
                }));
            });
            stickyContainer.appendChild(clone);
        });
        stickyContainer.style.display = '';
    };

    // Attach scroll listener on editor content
    protyle.contentElement.addEventListener('scroll', updateSticky, { passive: true });
}; 