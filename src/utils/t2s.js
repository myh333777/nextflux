/**
 * 繁体转简体转换工具 - 使用 OpenCC
 */

import * as OpenCC from 'opencc-js';

// 创建繁体到简体转换器 (台湾繁体 -> 大陆简体)
const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });

/**
 * 繁体转简体
 * @param {string} text - 繁体文本
 * @returns {string} 简体文本
 */
export function traditionalToSimplified(text) {
    if (!text) return text;
    try {
        return converter(text);
    } catch (e) {
        console.error('OpenCC conversion error:', e);
        return text;
    }
}

/**
 * 转换 HTML 内容中的繁体字
 * @param {string} html - HTML 内容
 * @returns {string} 转换后的 HTML
 */
export function convertHtmlToSimplified(html) {
    if (!html) return html;

    try {
        // OpenCC 可以直接处理带 HTML 标签的文本，会自动保留标签
        return converter(html);
    } catch (e) {
        console.error('OpenCC HTML conversion error:', e);
        return html;
    }
}
