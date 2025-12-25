/**
 * AI 总结 API
 * 支持 OpenAI 兼容 API (OpenAI, Azure, Groq, DeepSeek, etc.)
 */

import { settingsState } from "@/stores/settingsStore";

/**
 * 调用 AI 生成文章摘要
 * @param {string} content - 文章内容 (HTML 或纯文本)
 * @param {string} title - 文章标题
 * @returns {Promise<{summary: string, error?: string}>}
 */
export async function summarizeArticle(content, title = "") {
    const settings = settingsState.get();

    if (!settings.aiEnabled || !settings.aiApiKey) {
        return { summary: "", error: "AI 功能未启用或 API Key 未配置" };
    }

    // 清理 HTML 标签，提取纯文本
    const plainText = stripHtml(content);

    // 限制内容长度，避免超出 token 限制
    const maxLength = 8000;
    const truncatedContent = plainText.length > maxLength
        ? plainText.substring(0, maxLength) + "..."
        : plainText;

    const prompt = settings.aiSummaryPrompt || "请用中文简洁地总结以下文章内容，突出关键信息。";

    const messages = [
        {
            role: "system",
            content: prompt
        },
        {
            role: "user",
            content: title ? `标题: ${title}\n\n内容:\n${truncatedContent}` : truncatedContent
        }
    ];

    try {
        const response = await fetch(settings.aiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: settings.aiModel,
                messages: messages,
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content?.trim() || "";

        return { summary };
    } catch (error) {
        console.error("AI summarize error:", error);
        return { summary: "", error: error.message };
    }
}

/**
 * 清理 HTML 标签
 */
function stripHtml(html) {
    if (!html) return "";

    // 创建临时元素解析 HTML
    const doc = new DOMParser().parseFromString(html, "text/html");

    // 移除 script 和 style
    doc.querySelectorAll("script, style, noscript").forEach(el => el.remove());

    // 获取纯文本
    return doc.body.textContent || "";
}

/**
 * 测试 AI 连接
 */
export async function testAIConnection() {
    const settings = settingsState.get();

    if (!settings.aiApiKey || !settings.aiEndpoint) {
        return { success: false, error: "API Key 或 Endpoint 未配置" };
    }

    try {
        const response = await fetch(settings.aiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: settings.aiModel,
                messages: [{ role: "user", content: "Hi" }],
                max_tokens: 5
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
