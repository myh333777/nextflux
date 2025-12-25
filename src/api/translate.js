/**
 * 翻译 API - 支持逐段翻译，保持排版
 * 支持 AI 翻译和 Google Translate
 */

import { settingsState } from "@/stores/settingsStore";

/**
 * 翻译文本
 * @param {string} text - 要翻译的文本
 * @param {string} targetLang - 目标语言代码 (zh, en, ja, etc.)
 * @returns {Promise<{translatedText: string, error?: string}>}
 */
export async function translateText(text, targetLang = null) {
    const settings = settingsState.get();

    if (!settings.translateEnabled) {
        return { translatedText: "", error: "翻译功能未启用" };
    }

    const lang = targetLang || settings.targetLanguage || "zh";

    if (settings.translateProvider === "google") {
        return translateWithGoogle(text, lang);
    } else {
        return translateWithAI(text, lang);
    }
}

/**
 * 使用 AI 翻译
 */
async function translateWithAI(text, targetLang) {
    const settings = settingsState.get();

    if (!settings.aiApiKey) {
        return { translatedText: "", error: "AI API Key 未配置" };
    }

    const langNames = {
        zh: "中文",
        en: "English",
        ja: "日本語",
        ko: "한국어",
        fr: "Français",
        de: "Deutsch",
        es: "Español"
    };

    const langName = langNames[targetLang] || targetLang;

    try {
        const response = await fetch(settings.aiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: settings.aiModel,
                messages: [
                    {
                        role: "system",
                        content: `You are a professional translator. Translate the following text to ${langName}. 
Rules:
1. Maintain the original formatting (paragraphs, line breaks, HTML tags)
2. Only translate the text content, keep HTML tags unchanged
3. Output ONLY the translated content, nothing else`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                max_tokens: 4000,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const translatedText = data.choices?.[0]?.message?.content?.trim() || "";

        return { translatedText };
    } catch (error) {
        console.error("AI translate error:", error);
        return { translatedText: "", error: error.message };
    }
}

/**
 * 使用 Google Translate (免费 API)
 */
async function translateWithGoogle(text, targetLang) {
    try {
        // 使用免费的 Google Translate API
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // 解析 Google Translate 返回格式
        let translatedText = "";
        if (data && data[0]) {
            translatedText = data[0].map(item => item[0]).join("");
        }

        return { translatedText };
    } catch (error) {
        console.error("Google translate error:", error);
        return { translatedText: "", error: error.message };
    }
}

/**
 * 逐段翻译 HTML 内容，保持原始排版
 * 并发处理避免长文章超时，保留原始 HTML 格式
 */
export async function translateHtmlParagraphs(html, targetLang = null, displayMode = null) {
    const settings = settingsState.get();
    const lang = targetLang || settings.targetLanguage || "zh";
    const mode = displayMode || settings.translateDisplayMode || "bilingual";

    if (!html) {
        return { translatedHtml: html, error: null };
    }

    try {
        // 解析 HTML
        const doc = new DOMParser().parseFromString(html, "text/html");

        // 找到所有段落级元素
        const paragraphs = doc.body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th");

        // 如果没有段落元素，尝试翻译整个内容
        if (paragraphs.length === 0) {
            const bodyHtml = doc.body.innerHTML || "";
            if (!bodyHtml.trim()) {
                return { translatedHtml: html, error: null };
            }

            // 限制长度
            const truncatedHtml = bodyHtml.length > 3000 ? bodyHtml.substring(0, 3000) + "..." : bodyHtml;
            const result = await translateText(truncatedHtml, lang);
            if (result.error) {
                return { translatedHtml: html, error: result.error };
            }

            if (mode === "bilingual") {
                return {
                    translatedHtml: `<div class="original-content">${html}</div><div class="translated-content" style="color: var(--heroui-default-500); margin-top: 1em; padding-top: 1em; border-top: 1px dashed var(--heroui-default-200);">${result.translatedText}</div>`,
                    error: null
                };
            } else {
                return { translatedHtml: `<div class="translated-content">${result.translatedText}</div>`, error: null };
            }
        }

        // 收集需要翻译的元素（使用 innerHTML 保留格式）
        const elementsToTranslate = [];
        paragraphs.forEach((el, index) => {
            const html = el.innerHTML?.trim();
            if (html && html.length > 0) {
                elementsToTranslate.push({ index, html, element: el });
            }
        });

        if (elementsToTranslate.length === 0) {
            return { translatedHtml: html, error: null };
        }

        // 分批并发翻译，每批 40 个段落同时请求
        const BATCH_SIZE = 40;
        const allTranslatedParts = new Array(elementsToTranslate.length).fill(null);

        for (let i = 0; i < elementsToTranslate.length; i += BATCH_SIZE) {
            const batch = elementsToTranslate.slice(i, i + BATCH_SIZE);

            // 并发请求这一批
            const promises = batch.map(async (item, batchIndex) => {
                try {
                    const result = await translateText(item.html, lang);
                    if (!result.error && result.translatedText) {
                        allTranslatedParts[i + batchIndex] = result.translatedText;
                    }
                } catch (e) {
                    console.warn(`Translation failed for paragraph ${i + batchIndex}:`, e);
                }
            });

            // 等待这一批完成
            await Promise.all(promises);
        }

        // 应用翻译
        elementsToTranslate.forEach((item, i) => {
            const translatedHtml = allTranslatedParts[i] || item.html;

            if (mode === "bilingual") {
                // 双语对照：原文 + 译文（保留原始 HTML）
                const translatedEl = document.createElement("div");
                translatedEl.className = "translated-text";
                translatedEl.style.cssText = "color: var(--heroui-default-500); font-size: 0.9em; margin-top: 0.5em; padding-left: 0.5em; border-left: 2px solid var(--heroui-primary-200);";
                translatedEl.innerHTML = translatedHtml;
                item.element.parentNode?.insertBefore(translatedEl, item.element.nextSibling);
            } else {
                // 仅译文：替换原文（保留 HTML 结构）
                item.element.innerHTML = translatedHtml;
            }
        });

        return { translatedHtml: doc.body.innerHTML, error: null };
    } catch (error) {
        console.error("Translate paragraphs error:", error);
        return { translatedHtml: html, error: error.message };
    }
}

/**
 * 简单翻译（兼容旧接口）
 */
export async function translateHtml(html, targetLang = null) {
    return translateHtmlParagraphs(html, targetLang);
}
