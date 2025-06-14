import { fetchPost, fetchSyncPost } from "../util/fetch";

const bindAttrInput = (inputElement: HTMLInputElement, id: string) => {
    inputElement.addEventListener("change", () => {
        fetchPost("/api/attr/setBlockAttrs", {
            id,
            attrs: { [inputElement.dataset.name]: inputElement.value }
        });
    });
};

export async function renderCustomAttr(customAttrElement: Element, block_id: string, focusName = "bookmark") {
    // javascript
    // export const openFileAttr = (attrs: IObject, focusName = "bookmark", protyle?: IProtyle) => {
    const response = await fetchSyncPost("/api/attr/getBlockAttrs", { id: block_id })
    const attrs = response.data;

    customAttrElement.innerHTML = `<div class="fn__flex-column">
    <div class="fn__flex-1 custom-attr" style="display: flex; align-items: center; gap: 10px;">
        <span style="flex-shrink: 0;">${window.siyuan.languages.name}：</span>
        <input spellcheck="${window.siyuan.config.editor.spellcheck}" class="b3-text-field fn__block" placeholder="${window.siyuan.languages.attrNameTip}" data-name="name">
        <span style="flex-shrink: 0;">${window.siyuan.languages.alias}：</span>
        <input spellcheck="${window.siyuan.config.editor.spellcheck}" class="b3-text-field fn__block" placeholder="${window.siyuan.languages.attrAliasTip}" data-name="alias">
    </div>
</div>`;

    (customAttrElement.querySelector('.b3-text-field[data-name="name"]') as HTMLInputElement).value = attrs.name || "";
    (customAttrElement.querySelector('.b3-text-field[data-name="alias"]') as HTMLInputElement).value = attrs.alias || "";

    customAttrElement.querySelectorAll(".b3-text-field").forEach((item: HTMLInputElement) => {
        if (focusName !== "av" && focusName === item.getAttribute("data-name")) {
            item.focus();
        }
        bindAttrInput(item, attrs.id);
    });
}