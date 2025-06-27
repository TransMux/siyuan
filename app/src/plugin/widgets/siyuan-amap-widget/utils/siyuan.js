export function resolveAvId() {
    // 获取当前制定的数据库id，支持通过url参数或者html标签属性指定
    const params = new URLSearchParams(window.location.search);
    let id = params.get('av_id');
    if (id)
        return id;
    const roots = [document.documentElement, document.body];
    for (const el of roots) {
        if (el && el.hasAttribute('custom-av-id')) {
            id = el.getAttribute('custom-av-id');
            if (id)
                return id;
        }
    }
    return null;
} 