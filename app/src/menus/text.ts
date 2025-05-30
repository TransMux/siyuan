import {Menu} from "../plugin/Menu";
import {showMessage} from "../dialog/message";

export const textMenu = (target: Element) => {
    const menu = new Menu();
    if (menu.isOpen) {
        return;
    }
    menu.addItem({
        id: "copy",
        label: window.siyuan.languages.copy,
        icon: "iconCopy",
        click() {
            if (getSelection().rangeCount === 0) {
                return;
            }
            const range = getSelection().getRangeAt(0);
            if (!range.toString()) {
                getSelection().getRangeAt(0).selectNode(target);
            }
            document.execCommand("copy");
            showMessage(window.siyuan.languages.copy);
        }
    });
    menu.addItem({
        id: "selectAll",
        label: window.siyuan.languages.selectAll,
        icon: "iconSelect",
        click() {
            if (getSelection().rangeCount === 0) {
                return;
            }
            getSelection().getRangeAt(0).selectNode(target);
        }
    });
    return menu;
};
