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

    // 使用 autoTranslatePriority 设置决定翻译服务
    const priority = settings.autoTranslatePriority || "google";
    const canUseAI = settings.aiApiKey && settings.aiEndpoint;

    // 如果优先使用 AI 且 AI 可用，则使用 AI
    if (priority === "ai" && canUseAI) {
        return translateWithAI(text, lang);
    } else {
        // 否则使用 Google（通过服务器代理）
        return translateWithGoogle(text, lang);
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
                model: settings.aiTranslateModel || settings.aiModel,
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
 * 使用 Google Translate (通过服务器代理)
 */
async function translateWithGoogle(text, targetLang) {
    try {
        // 使用服务器端代理解决国内访问问题
        const response = await fetch("/api/translate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text,
                targetLang,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return { translatedText: data.translatedText || "" };
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

        // 分批并发翻译，使用配置的并发数
        const BATCH_SIZE = settings.translateConcurrency || 20;
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

/**
 * 使用 Google 翻译 HTML（强制使用 Google）
 */
export async function translateWithGoogleHtml(html, targetLang = null) {
    const settings = settingsState.get();
    const lang = targetLang || settings.targetLanguage || "zh";
    const mode = settings.translateDisplayMode || "bilingual";

    return translateHtmlWithProvider(html, lang, mode, "google");
}

/**
 * 使用 AI 翻译 HTML（强制使用 AI）
 */
export async function translateWithAIHtml(html, targetLang = null) {
    const settings = settingsState.get();
    const lang = targetLang || settings.targetLanguage || "zh";
    const mode = settings.translateDisplayMode || "bilingual";

    return translateHtmlWithProvider(html, lang, mode, "ai");
}

/**
 * 使用指定提供商翻译 HTML
 */
async function translateHtmlWithProvider(html, lang, mode, provider) {
    const settings = settingsState.get();

    // 确保 html 是字符串
    if (!html || typeof html !== 'string') {
        return html;
    }

    // 选择翻译函数
    const translateFn = provider === "google" ? translateWithGoogle : translateWithAI;

    try {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // 扩展选择器，包含更多可能包含文本的元素
        const paragraphs = doc.body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, figcaption, dt, dd, summary, caption");

        // 如果没有找到标准段落元素，尝试查找包含文本的 div
        let elementsToProcess = Array.from(paragraphs);

        if (elementsToProcess.length === 0) {
            // 尝试获取直接包含文本的 div
            const divs = doc.body.querySelectorAll("div");
            divs.forEach(div => {
                // 检查是否有直接的文本子节点
                const hasDirectText = Array.from(div.childNodes).some(
                    node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim().length > 20
                );
                if (hasDirectText) {
                    elementsToProcess.push(div);
                }
            });
        }

        if (elementsToProcess.length === 0) {
            const bodyHtml = doc.body.innerHTML || "";
            if (!bodyHtml.trim()) {
                return { translatedHtml: html, error: null };
            }

            // 如果没有标准段落元素，尝试按换行分段翻译
            // 将 <br> 和 \n 分割的内容视为独立段落
            const textContent = doc.body.textContent || "";
            const lines = textContent.split(/\n+/).filter(line => line.trim().length > 10);

            if (lines.length > 1) {
                // 有多行内容，逐行翻译
                console.log(`[Translate] 无标准段落，按换行分段翻译 ${lines.length} 行`);
                const BATCH_SIZE = settings.translateConcurrency || 20;
                const translatedLines = new Array(lines.length).fill(null);

                for (let i = 0; i < lines.length; i += BATCH_SIZE) {
                    const batch = lines.slice(i, i + BATCH_SIZE);
                    const promises = batch.map(async (line, batchIndex) => {
                        try {
                            const result = await translateFn(line.trim(), lang);
                            if (!result.error && result.translatedText) {
                                translatedLines[i + batchIndex] = result.translatedText;
                            }
                        } catch (e) {
                            console.warn(`Translation failed for line ${i + batchIndex}:`, e);
                        }
                    });
                    await Promise.all(promises);
                }

                // 构建双语或纯翻译结果
                let resultHtml = "";
                lines.forEach((line, i) => {
                    const translated = translatedLines[i] || "";
                    if (mode === "bilingual" && translated) {
                        resultHtml += `<p>${line}</p><p class="translated-text" style="color: var(--heroui-default-500); font-size: 0.9em; margin-top: 0.3em; padding-left: 0.5em; border-left: 2px solid var(--heroui-primary-200);">${translated}</p>`;
                    } else if (translated) {
                        resultHtml += `<p>${translated}</p>`;
                    } else {
                        resultHtml += `<p>${line}</p>`;
                    }
                });

                return { translatedHtml: resultHtml, error: null };
            }

            // 单段内容，如果太长则分块翻译
            if (textContent.length > 3000) {
                console.log(`[Translate] 长单段内容 ${textContent.length} 字，分块翻译`);
                const chunks = [];
                for (let i = 0; i < textContent.length; i += 2500) {
                    chunks.push(textContent.substring(i, i + 2500));
                }

                const translatedChunks = [];
                for (const chunk of chunks) {
                    const result = await translateFn(chunk, lang);
                    translatedChunks.push(result.translatedText || chunk);
                }

                const translated = translatedChunks.join('');
                if (mode === "bilingual") {
                    return {
                        translatedHtml: `<div class="original-content">${html}</div><div class="translated-content" style="color: var(--heroui-default-500); margin-top: 1em; padding-top: 1em; border-top: 1px dashed var(--heroui-default-200);">${translated}</div>`,
                        error: null
                    };
                }
                return { translatedHtml: `<div class="translated-content">${translated}</div>`, error: null };
            }

            const result = await translateFn(textContent, lang);
            if (result.error) {
                return { translatedHtml: html, error: result.error };
            }
            if (mode === "bilingual") {
                return {
                    translatedHtml: `<div class="original-content">${html}</div><div class="translated-content" style="color: var(--heroui-default-500); margin-top: 1em; padding-top: 1em; border-top: 1px dashed var(--heroui-default-200);">${result.translatedText}</div>`,
                    error: null
                };
            }
            return { translatedHtml: `<div class="translated-content">${result.translatedText}</div>`, error: null };
        }

        const elementsToTranslate = [];
        elementsToProcess.forEach((el, index) => {
            const elemHtml = el.innerHTML?.trim();
            // 跳过已翻译的元素和空元素
            if (elemHtml && elemHtml.length > 0 && !el.classList.contains('translated-text')) {
                elementsToTranslate.push({ index, html: elemHtml, element: el });
            }
        });

        if (elementsToTranslate.length === 0) {
            return { translatedHtml: html, error: null };
        }

        const BATCH_SIZE = settings.translateConcurrency || 20;
        const MAX_CHUNK_SIZE = 2500; // Google Translate 安全限制
        const allTranslatedParts = new Array(elementsToTranslate.length).fill(null);

        for (let i = 0; i < elementsToTranslate.length; i += BATCH_SIZE) {
            const batch = elementsToTranslate.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (item, batchIndex) => {
                try {
                    const htmlContent = item.html;

                    // 如果段落太长，需要分块翻译
                    if (htmlContent.length > MAX_CHUNK_SIZE) {
                        console.log(`[Translate] 段落 ${i + batchIndex} 太长 (${htmlContent.length} 字符)，分块翻译`);

                        // 尝试按 <br> 分割（同时支持正常标签和 HTML 实体编码）
                        // 匹配: <br>, <br/>, <br />, &lt;br&gt;, &lt;br/&gt;, &lt;br /&gt;
                        let parts = htmlContent.split(/(?:<br\s*\/?>|&lt;br\s*\/?&gt;)+/gi).filter(p => p.trim().length > 0);

                        // 如果分割后只有一个部分或仍然太长，按句号分割
                        if (parts.length <= 1 || parts.some(p => p.length > MAX_CHUNK_SIZE)) {
                            // 提取纯文本（也去除 HTML 实体编码的标签）
                            const plainText = htmlContent
                                .replace(/&lt;[^&]*&gt;/g, '') // 去除 &lt;...&gt; 实体标签
                                .replace(/<[^>]*>/g, '');     // 去除正常 HTML 标签
                            parts = plainText.split(/(?<=[。！？.!?])\s*/g).filter(p => p.trim().length > 0);
                        }

                        // 合并小块以减少请求数
                        const chunks = [];
                        let currentChunk = '';
                        for (const part of parts) {
                            if (currentChunk.length + part.length > MAX_CHUNK_SIZE) {
                                if (currentChunk) chunks.push(currentChunk);
                                currentChunk = part;
                            } else {
                                currentChunk += (currentChunk ? ' ' : '') + part;
                            }
                        }
                        if (currentChunk) chunks.push(currentChunk);

                        // 翻译所有块
                        const translatedChunks = [];
                        for (const chunk of chunks) {
                            const result = await translateFn(chunk, lang);
                            translatedChunks.push(result.translatedText || chunk);
                        }

                        allTranslatedParts[i + batchIndex] = translatedChunks.join(' ');
                    } else {
                        // 正常翻译
                        const result = await translateFn(htmlContent, lang);
                        if (!result.error && result.translatedText) {
                            allTranslatedParts[i + batchIndex] = result.translatedText;
                        }
                    }
                } catch (e) {
                    console.warn(`Translation failed for paragraph ${i + batchIndex}:`, e);
                }
            });
            await Promise.all(promises);
        }

        // 倒序处理，避免插入新元素时影响后续元素的位置
        for (let i = elementsToTranslate.length - 1; i >= 0; i--) {
            const item = elementsToTranslate[i];
            const translatedHtml = allTranslatedParts[i] || item.html;
            if (mode === "bilingual") {
                const translatedEl = document.createElement("div");
                translatedEl.className = "translated-text";
                translatedEl.style.cssText = "color: var(--heroui-default-500); font-size: 0.9em; margin-top: 0.5em; padding-left: 0.5em; border-left: 2px solid var(--heroui-primary-200);";
                translatedEl.innerHTML = translatedHtml;
                item.element.parentNode?.insertBefore(translatedEl, item.element.nextSibling);
            } else {
                item.element.innerHTML = translatedHtml;
            }
        }

        return { translatedHtml: doc.body.innerHTML, error: null };
    } catch (error) {
        console.error("Translate with provider error:", error);
        return { translatedHtml: html, error: error.message };
    }
}
