// Deno Deploy 静态文件服务器 (SPA + MCP 代理)

const DIST_DIR = "./dist";
const MCP_URL = "http://usa2.190904.xyz:8766/mcp";

Deno.serve(async (req) => {
    const url = new URL(req.url);

    // CORS 预检
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
                "Access-Control-Expose-Headers": "mcp-session-id",
            },
        });
    }

    // 代理 MCP 请求
    if (url.pathname.startsWith("/api/mcp-proxy")) {
        try {
            // 转发请求到 MCP 服务
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            };

            // 转发 mcp-session-id
            const sessionId = req.headers.get("mcp-session-id");
            if (sessionId) {
                headers["mcp-session-id"] = sessionId;
            }

            const body = req.method !== "GET" ? await req.text() : undefined;

            const proxyRes = await fetch(MCP_URL, {
                method: req.method,
                headers,
                body,
            });

            // 获取响应文本
            const responseText = await proxyRes.text();

            // 构建响应 headers
            const responseHeaders = new Headers({
                "Content-Type": proxyRes.headers.get("Content-Type") || "text/event-stream",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "mcp-session-id",
            });

            // 转发 mcp-session-id
            const mcpSessionId = proxyRes.headers.get("mcp-session-id");
            if (mcpSessionId) {
                responseHeaders.set("mcp-session-id", mcpSessionId);
            }

            return new Response(responseText, {
                status: proxyRes.status,
                headers: responseHeaders,
            });
        } catch (e) {
            console.error("MCP proxy error:", e);
            return new Response(JSON.stringify({ error: (e as Error).message }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }
    }

    // 静态文件路径
    let filePath = `${DIST_DIR}${url.pathname}`;

    // 如果是目录，尝试 index.html
    if (filePath.endsWith("/")) {
        filePath += "index.html";
    }

    try {
        const file = await Deno.readFile(filePath);
        const ext = filePath.split(".").pop() || "";
        const contentTypes: Record<string, string> = {
            "html": "text/html; charset=utf-8",
            "js": "application/javascript",
            "css": "text/css",
            "json": "application/json",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "svg": "image/svg+xml",
            "ico": "image/x-icon",
            "woff": "font/woff",
            "woff2": "font/woff2",
            "ttf": "font/ttf",
        };

        return new Response(file, {
            headers: {
                "Content-Type": contentTypes[ext] || "application/octet-stream",
                "Cache-Control": ext === "html" ? "no-cache" : "public, max-age=31536000",
            },
        });
    } catch {
        // SPA 回退：返回 index.html  
        try {
            const indexHtml = await Deno.readFile(`${DIST_DIR}/index.html`);
            return new Response(indexHtml, {
                headers: { "Content-Type": "text/html; charset=utf-8" },
            });
        } catch {
            return new Response("Not Found", { status: 404 });
        }
    }
});
