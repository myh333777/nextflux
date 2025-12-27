/**
 * AI 总结 API
 * 支持 OpenAI 兼容 API (OpenAI, Azure, Groq, DeepSeek, etc.)
 */

import { settingsState } from "@/stores/settingsStore";

/**
 * 调用 AI 生成文章摘要
 * @param {string} content - 文章内容 (HTML 或纯文本)
 * @param {string} title - 文章标题
 * @param {string} customPrompt - 自定义提示词（可选）
 * @returns {Promise<{summary: string, error?: string}>}
 */
export async function summarizeArticle(content, title = "", customPrompt = null) {
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

    // 使用传入的自定义提示词，或默认提示词
    const prompt = customPrompt || settings.aiSummaryPrompt || "请用中文简洁地总结以下文章内容，突出关键信息。";

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
                max_tokens: 2000,
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
 * 并发执行多个提示词生成摘要
 * @param {string} content - 文章内容
 * @param {string} title - 文章标题
 * @param {Array<{id: string, name: string, prompt: string}>} prompts - 提示词列表
 * @returns {Promise<Array<{id: string, name: string, summary: string, error?: string}>>}
 */
export async function summarizeWithMultiplePrompts(content, title, prompts) {
    const results = await Promise.all(
        prompts.map(async (p) => {
            const result = await summarizeArticle(content, title, p.prompt);
            return {
                id: p.id,
                name: p.name,
                summary: result.summary,
                error: result.error
            };
        })
    );
    return results;
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

/**
 * 获取可用模型列表
 * @returns {Promise<{models: Array<{id: string, name: string}>, error?: string}>}
 */
export async function fetchModels() {
    const settings = settingsState.get();

    if (!settings.aiApiKey || !settings.aiEndpoint) {
        return { models: [], error: "API Key 或 Endpoint 未配置" };
    }

    try {
        // 从 chat/completions endpoint 推导 models endpoint
        let modelsEndpoint = settings.aiEndpoint;
        if (modelsEndpoint.includes("/chat/completions")) {
            modelsEndpoint = modelsEndpoint.replace("/chat/completions", "/models");
        } else if (modelsEndpoint.endsWith("/v1")) {
            modelsEndpoint = modelsEndpoint + "/models";
        } else {
            // 尝试直接添加 /models
            modelsEndpoint = modelsEndpoint.replace(/\/+$/, "") + "/models";
        }

        const response = await fetch(modelsEndpoint, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${settings.aiApiKey}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();

        // 解析模型列表 (OpenAI 格式)
        let models = [];
        if (data.data && Array.isArray(data.data)) {
            models = data.data.map(m => ({
                id: m.id,
                name: m.id
            })).sort((a, b) => a.id.localeCompare(b.id));
        } else if (Array.isArray(data)) {
            models = data.map(m => ({
                id: m.id || m.name || m,
                name: m.id || m.name || m
            }));
        }

        return { models };
    } catch (error) {
        return { models: [], error: error.message };
    }
}
