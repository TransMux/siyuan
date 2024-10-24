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
        return `$$\n${p1.trim()}\n$$`;
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
    // 检查是否需要替换文本内容中的换行符
    if (replaced) {
        // 使用正则表达式替换所有的换行符为 <br/>
        textHTML = textContent.replace(/\n/g, "<br/>");
    }

    // 去除 textHTML 中的小图片
    if (textHTML) {
        textHTML = removeSmallImages(textHTML);
    }

    return [textContent, textHTML, siyuanHTML];
}
