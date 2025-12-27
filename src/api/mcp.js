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
 * 检查是否为占位符图片（不需要代理）
 */
function isPlaceholderImage(url) {
    if (!url) return true;
    const lowerUrl = url.toLowerCase();
    // 常见占位符关键词
    const placeholderKeywords = [
        'placeholder', 'grey-placeholder', 'gray-placeholder',
        'lazy', 'blank', 'spacer', 'pixel', '1x1',
        'loading', 'skeleton', 'dummy'
    ];
    return placeholderKeywords.some(keyword => lowerUrl.includes(keyword));
}

/**
 * 将 HTML 中的图片 URL 替换为代理 URL
 * 解决国内无法访问外网图片的问题
 */
function proxyImageUrls(html) {
    if (!html) return html;

    // 匹配 <img src="..."> 中的 src 属性
    return html.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi, (match, before, src, after) => {
        // 如果已经是代理 URL，不再处理
        if (src.startsWith('/api/image-proxy')) {
            return match;
        }
        // 如果是 data URL 或相对路径，不处理
        if (src.startsWith('data:') || src.startsWith('/')) {
            return match;
        }
        // 如果是占位符图片，直接移除该 img 标签
        if (isPlaceholderImage(src)) {
            return '';
        }
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(src)}`;
        return `<img ${before}src="${proxyUrl}"${after}>`;
    });
}

/**
 * 将纯文本/Markdown 转换为 HTML，保持排版
 */
function formatContentAsHtml(content) {
    if (!content) return "";

    // 如果已经是 HTML (包含标签)，处理其中的图片后返回
    if (/<[^>]+>/.test(content)) {
        return proxyImageUrls(content);
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
        // 处理图片 (必须在链接之前处理，因为语法相似)
        // 使用图片代理解决国内访问问题
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
            // 跳过占位符图片
            if (isPlaceholderImage(url)) {
                return '';
            }
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
            return `<img src="${proxyUrl}" alt="${alt}" loading="lazy">`;
        })
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
 * 使用简单 fetch 阅读模式获取文章内容
 * 通过 CORS 代理获取页面内容
 * @param {string} url - 文章 URL
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
export async function fetchWithReadability(url) {
    try {
        // 使用 allorigins 代理绕过 CORS
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

        const response = await fetch(proxyUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml',
            }
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        const html = await response.text();

        // 简单的内容提取：查找 article 或 main 标签
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // 移除不需要的元素
        const removeSelectors = ['script', 'style', 'nav', 'header', 'footer', 'aside', '.sidebar', '.comments', '.ad', '.advertisement', '[class*="ad-"]'];
        removeSelectors.forEach(sel => {
            doc.querySelectorAll(sel).forEach(el => el.remove());
        });

        // 尝试获取文章内容
        let content = doc.querySelector('article')?.innerHTML
            || doc.querySelector('[role="main"]')?.innerHTML
            || doc.querySelector('main')?.innerHTML
            || doc.querySelector('.post-content')?.innerHTML
            || doc.querySelector('.article-content')?.innerHTML
            || doc.querySelector('.entry-content')?.innerHTML
            || doc.querySelector('.content')?.innerHTML;

        if (content && content.length > 500) {
            return { success: true, content: content };
        }

        return { success: false, error: "无法提取文章内容" };
    } catch (error) {
        return { success: false, error: error.message };
    }
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

        // 新格式：优先使用 structuredContent
        if (result.structuredContent?.result) {
            const structured = result.structuredContent.result;
            if (structured.success && structured.content) {
                return {
                    success: true,
                    content: formatContentAsHtml(structured.content),
                    title: structured.title || "",
                    method: structured.method || ""
                };
            }
        }

        // 旧格式：FastMCP 返回的结果包含 content 数组
        if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find(c => c.type === "text");
            if (textContent) {
                // 尝试解析 JSON（双层嵌套）
                try {
                    const parsed = JSON.parse(textContent.text);
                    const rawContent = parsed.content || parsed.html || textContent.text;
                    return {
                        success: true,
                        content: formatContentAsHtml(rawContent),
                        title: parsed.title || "",
                        method: parsed.method || ""
                    };
                } catch (e) {
                    // 不是 JSON，直接格式化文本
                    return { success: true, content: formatContentAsHtml(textContent.text) };
                }
            }
        }

        return { success: false, content: "", error: "No content returned" };
    } catch (error) {
        // 如果是 session 错误，重置并重试一次
        if (error.message?.includes("session") || error.message?.includes("Session")) {
            mcpSessionId = null;
            try {
                const initResult = await initSession(settings.mcpEndpoint);
                if (initResult.success) {
                    const result = await callTool(settings.mcpEndpoint, mcpSessionId, "get_article", { url });

                    // 新格式：优先使用 structuredContent
                    if (result.structuredContent?.result) {
                        const structured = result.structuredContent.result;
                        if (structured.success && structured.content) {
                            return {
                                success: true,
                                content: formatContentAsHtml(structured.content),
                                title: structured.title || "",
                                method: structured.method || ""
                            };
                        }
                    }

                    // 旧格式
                    if (result.content && Array.isArray(result.content)) {
                        const textContent = result.content.find(c => c.type === "text");
                        if (textContent) {
                            try {
                                const parsed = JSON.parse(textContent.text);
                                const rawContent = parsed.content || parsed.html || textContent.text;
                                return {
                                    success: true,
                                    content: formatContentAsHtml(rawContent),
                                    title: parsed.title || "",
                                    method: parsed.method || ""
                                };
                            } catch (e) {
                                return { success: true, content: formatContentAsHtml(textContent.text) };
                            }
                        }
                    }
                }
            } catch (retryError) {
                return { success: false, content: "", error: retryError.message };
            }
        }

        return { success: false, content: "", error: error.message };
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
