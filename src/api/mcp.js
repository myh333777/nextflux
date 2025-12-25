/**
 * MCP 全文抓取 API
 * 支持 FastMCP Streamable HTTP (SSE) 协议
 * 使用 Vite 代理绕过 CORS
 */

import { settingsState } from "@/stores/settingsStore";

// 存储 session ID
let mcpSessionId = null;

/**
 * 获取代理 endpoint
 * 使用本地代理解决 CORS 问题
 */
function getProxyEndpoint(originalEndpoint) {
    // 默认 MCP 地址使用代理
    if (originalEndpoint?.includes('usa2.190904.xyz:8766')) {
        return '/api/mcp-proxy';
    }
    return originalEndpoint;
}

/**
 * 初始化 MCP 会话
 */
async function initSession(endpoint) {
    const proxyEndpoint = getProxyEndpoint(endpoint);
    try {
        const response = await fetch(proxyEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "init-1",
                method: "initialize",
                params: {
                    protocolVersion: "2024-11-05",
                    capabilities: {},
                    clientInfo: { name: "nextflux", version: "1.0" }
                }
            })
        });

        // 获取 session ID
        mcpSessionId = response.headers.get("mcp-session-id");

        // 解析 SSE 响应
        const text = await response.text();
        const dataMatch = text.match(/data: (.+)/);
        if (dataMatch) {
            const data = JSON.parse(dataMatch[1]);
            return { success: true, sessionId: mcpSessionId, serverInfo: data.result?.serverInfo };
        }

        return { success: true, sessionId: mcpSessionId };
    } catch (error) {
        console.error("MCP init error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * 调用 MCP 工具
 */
async function callTool(endpoint, sessionId, toolName, args) {
    const proxyEndpoint = getProxyEndpoint(endpoint);
    try {
        const response = await fetch(proxyEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                ...(sessionId && { "mcp-session-id": sessionId })
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: Date.now().toString(),
                method: "tools/call",
                params: {
                    name: toolName,
                    arguments: args
                }
            })
        });

        // 更新 session ID
        const newSessionId = response.headers.get("mcp-session-id");
        if (newSessionId) {
            mcpSessionId = newSessionId;
        }

        // 解析 SSE 响应
        const text = await response.text();
        const dataMatch = text.match(/data: (.+)/);
        if (dataMatch) {
            const data = JSON.parse(dataMatch[1]);
            if (data.error) {
                throw new Error(data.error.message);
            }
            return data.result;
        }

        throw new Error("Invalid response format");
    } catch (error) {
        console.error("MCP call error:", error);
        throw error;
    }
}

/**
 * 将纯文本/Markdown 转换为 HTML，保持排版
 */
function formatContentAsHtml(content) {
    if (!content) return "";

    // 如果已经是 HTML (包含标签)，直接返回
    if (/<[^>]+>/.test(content)) {
        return content;
    }

    // 处理 Markdown 格式的内容
    let html = content
        // 处理标题
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // 处理粗体
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // 处理斜体
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // 处理链接
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // 处理换行 - 双换行变成段落，单换行变成 <br>
        .split(/\n\n+/)
        .map(para => para.trim())
        .filter(para => para.length > 0)
        .map(para => {
            // 如果已经是标题，不包装
            if (para.startsWith('<h')) return para;
            // 处理段落内的换行
            return `<p>${para.replace(/\n/g, '<br>')}</p>`;
        })
        .join('\n');

    return html;
}

/**
 * 通过 MCP 服务获取文章全文
 * @param {string} url - 文章 URL
 * @returns {Promise<{content: string, title?: string, method?: string, error?: string}>}
 */
export async function fetchFullContent(url) {
    const settings = settingsState.get();

    if (!settings.mcpEnabled || !settings.mcpEndpoint) {
        return { content: "", error: "MCP 功能未启用或 Endpoint 未配置" };
    }

    try {
        // 如果没有 session，先初始化
        if (!mcpSessionId) {
            const initResult = await initSession(settings.mcpEndpoint);
            if (!initResult.success) {
                return { content: "", error: initResult.error };
            }
        }

        // 调用 get_article 工具
        const result = await callTool(settings.mcpEndpoint, mcpSessionId, "get_article", { url });

        // FastMCP 返回的结果包含 content 数组
        if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find(c => c.type === "text");
            if (textContent) {
                // 尝试解析 JSON
                try {
                    const parsed = JSON.parse(textContent.text);
                    const rawContent = parsed.content || parsed.html || textContent.text;
                    return {
                        content: formatContentAsHtml(rawContent),
                        title: parsed.title || "",
                        method: parsed.method || ""
                    };
                } catch (e) {
                    // 不是 JSON，直接格式化文本
                    return { content: formatContentAsHtml(textContent.text) };
                }
            }
        }

        return { content: "", error: "No content returned" };
    } catch (error) {
        // 如果是 session 错误，重置并重试一次
        if (error.message?.includes("session") || error.message?.includes("Session")) {
            mcpSessionId = null;
            try {
                const initResult = await initSession(settings.mcpEndpoint);
                if (initResult.success) {
                    const result = await callTool(settings.mcpEndpoint, mcpSessionId, "get_article", { url });
                    if (result.content && Array.isArray(result.content)) {
                        const textContent = result.content.find(c => c.type === "text");
                        if (textContent) {
                            try {
                                const parsed = JSON.parse(textContent.text);
                                const rawContent = parsed.content || parsed.html || textContent.text;
                                return {
                                    content: formatContentAsHtml(rawContent),
                                    title: parsed.title || "",
                                    method: parsed.method || ""
                                };
                            } catch (e) {
                                return { content: formatContentAsHtml(textContent.text) };
                            }
                        }
                    }
                }
            } catch (retryError) {
                return { content: "", error: retryError.message };
            }
        }

        return { content: "", error: error.message };
    }
}

/**
 * 测试 MCP 服务连接
 */
export async function testMCPConnection() {
    const settings = settingsState.get();

    if (!settings.mcpEndpoint) {
        return { success: false, error: "MCP Endpoint 未配置" };
    }

    try {
        // 重置 session 并初始化
        mcpSessionId = null;
        const initResult = await initSession(settings.mcpEndpoint);

        if (!initResult.success) {
            return { success: false, error: initResult.error };
        }

        // 获取工具列表
        const proxyEndpoint = getProxyEndpoint(settings.mcpEndpoint);
        const response = await fetch(proxyEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "mcp-session-id": mcpSessionId
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "tools-1",
                method: "tools/list"
            })
        });

        const text = await response.text();
        const dataMatch = text.match(/data: (.+)/);

        if (dataMatch) {
            const data = JSON.parse(dataMatch[1]);
            if (data.error) {
                return { success: false, error: data.error.message };
            }

            const tools = data.result?.tools || [];
            const hasGetArticle = tools.some(t => t.name === "get_article");

            return {
                success: true,
                toolCount: tools.length,
                hasGetArticle,
                serverInfo: initResult.serverInfo
            };
        }

        return { success: false, error: "Invalid response" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
