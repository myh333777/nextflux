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

        // 使用 /api/v1/memos 接口测试连接 (获取最新一条 memo)
        // 这是一个更通用的接口，通常都可用
        const response = await fetch(`${endpoint}/api/v1/memos?limit=1`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.memosToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        // 如果能获取到数据，说明连接成功
        // 尝试从返回的数据中获取用户信息 (如果存在 memos)
        let username = "已连接";
        if (data.memos && data.memos.length > 0) {
            // creator 格式通常为 "users/1"
            const creator = data.memos[0].creator;
            if (creator) {
                // 尝试获取该用户信息
                try {
                    const userRes = await fetch(`${endpoint}/api/v1/${creator}`, {
                        headers: { "Authorization": `Bearer ${settings.memosToken}` }
                    });
                    if (userRes.ok) {
                        const userData = await userRes.json();
                        username = userData.nickname || userData.username || username;
                    }
                } catch (e) {
                    console.warn("Failed to fetch user info", e);
                }
            }
        }

        return { success: true, user: username };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
