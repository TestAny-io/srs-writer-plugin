/**
 * Mock for lru-cache module
 * 为lru-cache提供简化的mock实现
 */

export class LRUCache<K, V> {
    private cache = new Map<K, V>();
    private options: any;

    constructor(options: any = {}) {
        this.options = options;
    }

    get(key: K): V | undefined {
        return this.cache.get(key);
    }

    set(key: K, value: V): void {
        // 简化实现：不考虑LRU逻辑和大小限制
        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }
}