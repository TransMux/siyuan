/* 
mux-annotation
id={id}
*/
export const checkInlineMemo = (text: string) => {
    // 检查内容是否符合批注格式
    return text.startsWith("mux-annotation")
};

