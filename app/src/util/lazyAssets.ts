export const refreshAssetAfterLoad = (assetPath: string) => {
    // 刷新页面中指定路径的资源 - 简化逻辑，不使用占位符机制
    const elements = document.querySelectorAll(`img[src="${assetPath}"], video[src="${assetPath}"]`);
    
    elements.forEach(element => {
        if (element.tagName === 'IMG') {
            const img = element as HTMLImageElement;
            // 重新加载图片，添加时间戳避免缓存
            img.src = assetPath + '?t=' + Date.now();
        } else if (element.tagName === 'VIDEO') {
            const video = element as HTMLVideoElement;
            // 重新加载视频，添加时间戳避免缓存
            video.src = assetPath + '?t=' + Date.now();
            video.load(); // 重新加载视频
        }
    });
};