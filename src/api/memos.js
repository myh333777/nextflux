/**
 * Memos API - 保存内容到 Memos
 */

import { settingsState } from "@/stores/settingsStore";

/**
 * 保存内容到 Memos
 * @param {string} content - Markdown 内容
 * @param {string} visibility - 可见性: PRIVATE, PROTECTED, PUBLIC
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveToMemos(content, visibility = "PRIVATE") {
    const settings = settingsState.get();

    if (!settings.memosEnabled || !settings.memosEndpoint || !settings.memosToken) {
        return { success: false, error: "Memos 未配置" };
    }

    try {
        const endpoint = settings.memosEndpoint.replace(/\/+$/, "");

        const response = await fetch(`${endpoint}/api/v1/memos`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.memosToken}`
            },
            body: JSON.stringify({
                content: content,
                visibility: visibility
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        return { success: true };
    } catch (error) {
        console.error("Save to Memos error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * 构建文章摘要的 Memos 内容
 * @param {string} title - 文章标题
 * @param {string} url - 文章链接
 * @param {Array} summaries - AI 摘要数组 [{promptName, content}]
 * @returns {string} Markdown 格式的 Memos 内容
 */
export function buildMemoContent(title, url, summaries) {
    let content = `# ${title}\n\n`;
    content += `🔗 [原文链接](${url})\n\n`;
    content += `---\n\n`;

    if (summaries && summaries.length > 0) {
        summaries.forEach(summary => {
            if (summary.content) {
                content += `## ${summary.promptName}\n\n`;
                content += `${summary.content}\n\n`;
            }
        });
    }

    // 添加时间戳
    const now = new Date();
    content += `\n---\n📅 ${now.toLocaleDateString('zh-CN')} ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;

    return content;
}

/**
 * 测试 Memos 连接
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testMemosConnection() {
    const settings = settingsState.get();

    if (!settings.memosEndpoint || !settings.memosToken) {
        return { success: false, error: "Memos Endpoint 或 Token 未配置" };
    }

    try {
        const endpoint = settings.memosEndpoint.replace(/\/+$/, "");

        // 尝试新版 API (/api/v1/auth/status)
        let response = await fetch(`${endpoint}/api/v1/auth/status`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.memosToken}`
            }
        });

        // 如果 404，尝试旧版 API
        if (response.status === 404) {
            response = await fetch(`${endpoint}/api/v1/user/me`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${settings.memosToken}`
                }
            });
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return { success: true, user: data.name || data.nickname || data.username || "已连接" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
