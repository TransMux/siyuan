// Plugin for Protyle to implement VSCode-like sticky scroll
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

    // Update function to render the current heading
    const updateSticky = () => {
        const headings = Array.from(
            protyle.wysiwyg.element.querySelectorAll('[data-type="NodeHeading"]')
        ) as HTMLElement[];
        const scrollTop = protyle.contentElement.scrollTop;
        let current: HTMLElement | null = null;
        for (const h of headings) {
            if (h.offsetTop <= scrollTop) {
                current = h;
            } else {
                break;
            }
        }
        if (current) {
            // Only render the active heading
            stickyContainer.innerHTML = '';
            const item = document.createElement('div');
            item.className = 'protyle-sticky-scroll__item';
            item.textContent = current.textContent || '';
            item.title = current.textContent || '';
            // Click to jump to the heading
            item.addEventListener('click', () => {
                current.scrollIntoView({ behavior: 'auto', block: 'start' });
                protyle.wysiwyg.element.focus();
            });
            // Right-click to show context menu
            item.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                const rect = current.getBoundingClientRect();
                current.dispatchEvent(new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left,
                    clientY: rect.top
                }));
            });
            stickyContainer.appendChild(item);
            stickyContainer.style.display = '';
        } else {
            stickyContainer.style.display = 'none';
            stickyContainer.innerHTML = '';
        }
    };

    // Attach scroll listener on editor content
    protyle.contentElement.addEventListener('scroll', updateSticky, { passive: true });
}; 