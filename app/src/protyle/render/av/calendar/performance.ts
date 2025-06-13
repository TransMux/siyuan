// Performance optimization utilities for calendar view

// Cache for rendered calendar data
const calendarCache = new Map<string, any>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Debounce utility for search and filter operations
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

// Throttle utility for scroll events
export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// Cache management
export const CalendarCache = {
    set(key: string, data: any): void {
        calendarCache.set(key, {
            data,
            timestamp: Date.now(),
        });
    },

    get(key: string): any | null {
        const cached = calendarCache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > CACHE_DURATION) {
            calendarCache.delete(key);
            return null;
        }

        return cached.data;
    },

    clear(): void {
        calendarCache.clear();
    },

    generateKey(avID: string, viewID: string, params: any): string {
        return `${avID}-${viewID}-${JSON.stringify(params)}`;
    }
};

// Virtual scrolling for large event lists
export class VirtualScroller {
    private container: HTMLElement;
    private itemHeight: number;
    private visibleItems: number;
    private totalItems: number;
    private scrollTop: number = 0;
    private renderItem: (index: number, data: any) => HTMLElement;
    private data: any[];

    constructor(options: {
        container: HTMLElement;
        itemHeight: number;
        renderItem: (index: number, data: any) => HTMLElement;
    }) {
        this.container = options.container;
        this.itemHeight = options.itemHeight;
        this.renderItem = options.renderItem;
        this.visibleItems = Math.ceil(this.container.clientHeight / this.itemHeight) + 2; // Buffer
        this.data = [];
        this.totalItems = 0;

        this.bindEvents();
    }

    setData(data: any[]): void {
        this.data = data;
        this.totalItems = data.length;
        this.render();
    }

    private bindEvents(): void {
        this.container.addEventListener('scroll', throttle(() => {
            this.scrollTop = this.container.scrollTop;
            this.render();
        }, 16)); // ~60fps
    }

    private render(): void {
        const startIndex = Math.floor(this.scrollTop / this.itemHeight);
        const endIndex = Math.min(startIndex + this.visibleItems, this.totalItems);

        // Clear container
        this.container.innerHTML = '';

        // Create spacer for items above visible area
        if (startIndex > 0) {
            const topSpacer = document.createElement('div');
            topSpacer.style.height = `${startIndex * this.itemHeight}px`;
            this.container.appendChild(topSpacer);
        }

        // Render visible items
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.renderItem(i, this.data[i]);
            this.container.appendChild(item);
        }

        // Create spacer for items below visible area
        if (endIndex < this.totalItems) {
            const bottomSpacer = document.createElement('div');
            bottomSpacer.style.height = `${(this.totalItems - endIndex) * this.itemHeight}px`;
            this.container.appendChild(bottomSpacer);
        }

        // Set total height
        this.container.style.height = `${this.totalItems * this.itemHeight}px`;
    }
}

// Event batching for multiple operations
export class EventBatcher {
    private operations: (() => void)[] = [];
    private timeoutId: NodeJS.Timeout | null = null;

    add(operation: () => void): void {
        this.operations.push(operation);
        this.scheduleExecution();
    }

    private scheduleExecution(): void {
        if (this.timeoutId) return;

        this.timeoutId = setTimeout(() => {
            this.executeOperations();
            this.timeoutId = null;
        }, 0);
    }

    private executeOperations(): void {
        const ops = [...this.operations];
        this.operations = [];
        
        // Execute all operations in a single frame
        requestAnimationFrame(() => {
            ops.forEach(op => op());
        });
    }
}

// Memory-efficient event handling
export const addEventListenerOnce = (
    element: HTMLElement,
    event: string,
    handler: (e: Event) => void
): void => {
    const wrapper = (e: Event) => {
        handler(e);
        element.removeEventListener(event, wrapper);
    };
    element.addEventListener(event, wrapper);
};

// Intersection Observer for lazy loading
export const createIntersectionObserver = (
    callback: (entry: IntersectionObserverEntry) => void,
    options: IntersectionObserverInit = {}
): IntersectionObserver => {
    return new IntersectionObserver((entries) => {
        entries.forEach(callback);
    }, {
        root: null,
        rootMargin: '50px',
        threshold: 0.1,
        ...options
    });
};

// Optimized DOM manipulation
export const updateElementBatch = (
    elements: HTMLElement[],
    updates: ((element: HTMLElement) => void)[]
): void => {
    // Use DocumentFragment for batch DOM operations
    const fragment = document.createDocumentFragment();
    
    elements.forEach((element, index) => {
        const clone = element.cloneNode(true) as HTMLElement;
        updates[index]?.(clone);
        fragment.appendChild(clone);
    });

    // Replace all elements at once
    if (elements.length > 0 && elements[0].parentNode) {
        elements[0].parentNode.insertBefore(fragment, elements[0]);
        elements.forEach(el => el.remove());
    }
};

// Date calculation optimizations
export const DateUtils = {
    // Cache for frequently used date calculations
    dateCache: new Map<string, Date>(),

    getStartOfWeek(date: Date, firstDayOfWeek: number = 1): Date {
        const key = `week-${date.getTime()}-${firstDayOfWeek}`;
        if (this.dateCache.has(key)) {
            return this.dateCache.get(key)!;
        }

        const result = new Date(date);
        const day = result.getDay();
        const diff = result.getDate() - day + (day === 0 ? -6 : 1);
        result.setDate(diff);
        result.setHours(0, 0, 0, 0);

        this.dateCache.set(key, result);
        return result;
    },

    getStartOfMonth(date: Date): Date {
        const key = `month-${date.getFullYear()}-${date.getMonth()}`;
        if (this.dateCache.has(key)) {
            return this.dateCache.get(key)!;
        }

        const result = new Date(date.getFullYear(), date.getMonth(), 1);
        this.dateCache.set(key, result);
        return result;
    },

    clearCache(): void {
        this.dateCache.clear();
    }
};

// Resource cleanup
export const ResourceManager = {
    observers: new Set<IntersectionObserver>(),
    timeouts: new Set<NodeJS.Timeout>(),
    intervals: new Set<NodeJS.Timeout>(),

    addObserver(observer: IntersectionObserver): void {
        this.observers.add(observer);
    },

    addTimeout(timeout: NodeJS.Timeout): void {
        this.timeouts.add(timeout);
    },

    addInterval(interval: NodeJS.Timeout): void {
        this.intervals.add(interval);
    },

    cleanup(): void {
        this.observers.forEach((observer: IntersectionObserver) => observer.disconnect());
        this.timeouts.forEach((timeout: NodeJS.Timeout) => clearTimeout(timeout));
        this.intervals.forEach((interval: NodeJS.Timeout) => clearInterval(interval));

        this.observers.clear();
        this.timeouts.clear();
        this.intervals.clear();

        CalendarCache.clear();
        DateUtils.clearCache();
    }
};

// Performance monitoring
export const PerformanceMonitor = {
    measurements: new Map<string, number[]>(),

    start(label: string): void {
        performance.mark(`${label}-start`);
    },

    end(label: string): number {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
        
        const measure = performance.getEntriesByName(label, 'measure')[0];
        const duration = measure.duration;

        if (!this.measurements.has(label)) {
            this.measurements.set(label, []);
        }
        this.measurements.get(label)!.push(duration);

        // Keep only last 100 measurements
        const measures = this.measurements.get(label)!;
        if (measures.length > 100) {
            measures.shift();
        }

        return duration;
    },

    getAverageTime(label: string): number {
        const measures = this.measurements.get(label) || [];
        if (measures.length === 0) return 0;
        
        return measures.reduce((sum: number, time: number) => sum + time, 0) / measures.length;
    },

    report(): void {
        console.group('Calendar Performance Report');
        this.measurements.forEach((times: number[], label: string) => {
            const avg = this.getAverageTime(label);
            const max = Math.max(...times);
            const min = Math.min(...times);
            console.log(`${label}: avg=${avg.toFixed(2)}ms, max=${max.toFixed(2)}ms, min=${min.toFixed(2)}ms`);
        });
        console.groupEnd();
    }
}; 