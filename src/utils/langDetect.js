/**
 * 语言检测工具
 */

/**
 * 检测文本是否主要为英文
 * @param {string} text - 要检测的文本
 * @returns {boolean} 是否为英文
 */
export function isEnglishText(text) {
    if (!text || typeof text !== 'string') return false;

    // 1. 移除 Markdown 图片和链接: ![alt](url), [text](url)
    // 2. 移除 HTML 标签
    // 3. 移除 http/https 链接
    const plainText = text
        .replace(/!\[.*?\]\(.*?\)/g, '')   // 移除 Markdown 图片
        .replace(/\[.*?\]\(.*?\)/g, '')    // 移除 Markdown 链接(整个移除，避免统计 url 中的英文)
        .replace(/<[^>]*>/g, '')           // 移除 HTML 标签
        .replace(/https?:\/\/[^\s]+/g, '') // 移除纯文本 URL
        .replace(/```[\s\S]*?```/g, '')    // 移除代码块
        .replace(/`[^`]*`/g, '')           // 移除行内代码
        .trim();

    if (plainText.length < 10) return false;

    // 计算字符类型
    let englishChars = 0;
    let chineseChars = 0;
    let otherChars = 0;

    for (const char of plainText) {
        if (/[a-zA-Z]/.test(char)) {
            englishChars++;
        } else if (/[\u4e00-\u9fff]/.test(char)) {
            chineseChars++;
        } else if (/[\u3040-\u30ff\uac00-\ud7af]/.test(char)) {
            // 日文假名、韩文
            otherChars++;
        }
    }

    const totalLetters = englishChars + chineseChars + otherChars;
    if (totalLetters === 0) return false;

    // 如果英文字符占比超过 70%，认为是英文
    return (englishChars / totalLetters) > 0.7;
}

/**
 * 检测文本语言代码
 * @param {string} text - 要检测的文本
 * @returns {string} 语言代码: 'en', 'zh', 'ja', 'ko', 'unknown'
 */
export function detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'unknown';

    const plainText = text.replace(/<[^>]*>/g, '').trim();
    if (plainText.length < 5) return 'unknown';

    let englishChars = 0;
    let chineseChars = 0;
    let japaneseChars = 0;
    let koreanChars = 0;

    for (const char of plainText) {
        if (/[a-zA-Z]/.test(char)) {
            englishChars++;
        } else if (/[\u4e00-\u9fff]/.test(char)) {
            chineseChars++;
        } else if (/[\u3040-\u30ff]/.test(char)) {
            japaneseChars++;
        } else if (/[\uac00-\ud7af]/.test(char)) {
            koreanChars++;
        }
    }

    const total = englishChars + chineseChars + japaneseChars + koreanChars;
    if (total === 0) return 'unknown';

    if (englishChars / total > 0.6) return 'en';
    if (chineseChars / total > 0.3) return 'zh';
    if (japaneseChars / total > 0.1) return 'ja';
    if (koreanChars / total > 0.3) return 'ko';

    return 'unknown';
}
