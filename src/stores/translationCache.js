/**
 * 翻译缓存 Store
 * 用于存储已翻译的文章标题和摘要
 */

import { atom } from "nanostores";

// 翻译缓存: { [articleId]: { title: string, preview: string, translating: boolean } }
export const translationCache = atom({});

// 正在翻译的队列
export const translatingQueue = atom(new Set());

/**
 * 获取缓存的翻译
 */
export function getCachedTranslation(articleId) {
    return translationCache.get()[articleId];
}

/**
 * 设置翻译缓存
 */
export function setCachedTranslation(articleId, data) {
    const cache = { ...translationCache.get() };
    cache[articleId] = { ...cache[articleId], ...data };
    translationCache.set(cache);
}

/**
 * 检查是否正在翻译
 */
export function isTranslating(articleId) {
    return translatingQueue.get().has(articleId);
}

/**
 * 添加到翻译队列
 */
export function addToQueue(articleId) {
    const queue = new Set(translatingQueue.get());
    queue.add(articleId);
    translatingQueue.set(queue);
}

/**
 * 从翻译队列移除
 */
export function removeFromQueue(articleId) {
    const queue = new Set(translatingQueue.get());
    queue.delete(articleId);
    translatingQueue.set(queue);
}

/**
 * 清空翻译缓存
 */
export function clearTranslationCache() {
    translationCache.set({});
    translatingQueue.set(new Set());
}
