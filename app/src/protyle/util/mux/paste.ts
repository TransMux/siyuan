import { fetchSyncPost } from "../../../util/fetch";

function extractBilibiliWatchLaterInfo(textContent: string) {
    // 定义特征值
    const featureValue = "-赤羽Eirc-稍后再看-哔哩哔哩视频";

    // 用正则表达式匹配所有包含特征值的部分
    const regex = /🔗\s*(.+)[^-]*-赤羽Eirc-稍后再看-哔哩哔哩视频\s*(https:\/\/www\.bilibili\.com\/list\/watchlater\?oid=[^&]+&bvid=([a-zA-Z0-9]+))/g;
    let match;
    const results = [];

    while ((match = regex.exec(textContent)) !== null) {
        // 提取并移除特征值
        const quote = match[1].replace(featureValue, '').trim();
        const bvid = match[3];
        const url = `https://www.bilibili.com/video/${bvid}`;

        // 生成结果字符串并加入数组
        results.push(`🔗 ${quote}\r\n${url}`);
    }

    return results.length ? results.join('\n\n') : textContent;
}

function removeSmallImages(htmlString: string) {
    // 将 HTML 字符串转换为 DOM 对象
    let parser = new DOMParser();
    let doc = parser.parseFromString(htmlString, 'text/html');

    // 找到所有的 <img> 元素
    let images = doc.querySelectorAll('img');

    // 遍历所有 <img> 元素，删除小于 20px 高度的图片
    images.forEach(img => {
        let height = parseInt(img.style.height);
        if (height && height < 20) {
            img.remove(); // 删除图片
        }
    });

    // 将修改后的 DOM 对象转换回 HTML 字符串
    return doc.body.innerHTML;
}

export function modifyPasteContent(textContent: string, textHTML: string, siyuanHTML: string) {
    // Remove 🔤 characters
    textContent = textContent.replace(/🔤/g, "");
    // remove \\r\\n
    // textContent = textContent.replace("\r\n", "\n");
    textContent = extractBilibiliWatchLaterInfo(textContent)

    // Process \( x \) style formulas
    textContent = textContent.replace(/\\\((.*?)\\\)/g, function (match, p1) {
        return `$${p1.trim()}$`;
    });
    
    // 处理 \[ ... \] 样式的公式
    // 由于 'gs' 标志在 'es2018' 或更高版本中才可用，因此我们将其拆分为两个步骤
    textContent = textContent.replace(/\\\[(\s*.*?\s*)\\\]/g, function (match, p1) {
        return `$$ ${p1.trim()} $$`;
    });

    // 处理特定的引用格式，如果存在 zotero:// 链接
    if (textContent.includes("zotero://select/library")) {
        siyuanHTML = textContent.replace(
            /“(.*?)” \(\[.*? \(\[pdf\]\((.*?)\)\) (.*)/g,
            function (match, p1, p2, p3, p4) {
                return `- <span data-type="a inline-memo" data-href="${p2}" data-inline-memo-content="${p1}">${p3}</span>`;
            }
        );
    }

    if (textContent.startsWith("[image] ") && textContent.includes("[pdf](zotero://open-pdf/librar")) {
        const regex =
            /\[image\] \(\[pdf\]\((zotero:\/\/open-pdf\/library\/items\/[^)]+)\)\).*?\n.*?\[(.*)\]\(zotero:\/\/select\/library\/items\/[^)]+\)\) (.*)/;

        // 替换逻辑
        siyuanHTML = textContent.replace(
            regex,
            function (match, pdfLink, citation, description) {
                // 构建新的图像标记格式
                let imageFileName = pdfLink.split("annotation=")[1] + ".png"; // 从PDF链接中提取文件名
                return `![${pdfLink}](file://C:\\Users\\InEas\\Zotero\\cache\\library\\${imageFileName} "${description}")`;
            }
        );

    }

    let replaced = false;
    textContent = textContent.replace(/🔗 (.*?)\s*(https?:\/\/[^\s]+)/g, function (match, p1, p2) {
        replaced = true;
        return `[${p1}](${p2})`;
    });
    if (replaced) {
        textHTML = "";
    }

    // 去除 textHTML 中的小图片
    if (textHTML) {
        textHTML = removeSmallImages(textHTML);
    }

    return [textContent, textHTML, siyuanHTML];
}

// 优先级 1：解析思源内部链接，如果是内部链接的话，抓取其锚文本，转换为 block-ref
export async function parseSiyuanInternalLink(content: string) {
    const urlPattern = /https:\/\/x\.transmux\.top\/j\/(\d{14}-[a-zA-Z0-9]{7})/g;

    // 替换逻辑：检查是否在 markdown 的括号中，否则提取 ID
    let result = content;
    const matches = [...content.matchAll(urlPattern)]; // 使用展开运算符确保可重复遍历

    // 使用 Promise.all 并行处理
    const replacements = await Promise.all(
        matches.map(async (match) => {
            const [fullMatch, id] = match;

            // 检查是否在 markdown 括号中
            if (content.includes(`(${fullMatch})`)) {
                // 如果已经在括号中，跳过处理
                return null;
            }

            // 异步获取 plainText
            const plainText = await fetchSyncPost("/api/block/getRefText", { id });

            // 返回替换结果
            return { fullMatch, replacement: `[${plainText.data}](https://x.transmux.top/j/${id})` };
        })
    );

    // 应用替换到结果
    for (const replacement of replacements) {
        if (replacement) {
            const { fullMatch, replacement: newText } = replacement;
            result = result.replace(fullMatch, newText);
        }
    }

    // 返回处理结果
    return {
        matched: result !== content,
        content: result,
    };
}