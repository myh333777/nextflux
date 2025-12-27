// Deno Deploy 静态文件服务器 (SPA + MCP 代理 + Google 翻译代理)

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

    // Google 翻译代理
    if (url.pathname === "/api/translate") {
        try {
            const body = await req.json();
            const { text, targetLang = "zh" } = body;

            if (!text) {
                return new Response(JSON.stringify({ error: "Missing text" }), {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                });
            }

            // 使用 Google Translate API (免费版)
            const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

            const translateRes = await fetch(translateUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            });

            if (!translateRes.ok) {
                throw new Error(`Google Translate API error: ${translateRes.status}`);
            }

            const result = await translateRes.json();

            // 解析 Google 翻译响应格式
            let translatedText = "";
            if (result && result[0]) {
                for (const item of result[0]) {
                    if (item[0]) {
                        translatedText += item[0];
                    }
                }
            }

            return new Response(JSON.stringify({ translatedText }), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        } catch (e) {
            console.error("Translate proxy error:", e);
            return new Response(JSON.stringify({ error: (e as Error).message }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }
    }

    // 图片代理 - 解决国内无法访问外网图片问题
    if (url.pathname === "/api/image-proxy") {
        const imageUrl = url.searchParams.get("url");

        if (!imageUrl) {
            return new Response("Missing url parameter", {
                status: 400,
                headers: { "Access-Control-Allow-Origin": "*" }
            });
        }

        try {
            const imageRes = await fetch(imageUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "image/*,*/*;q=0.8",
                    "Referer": new URL(imageUrl).origin,
                },
            });

            if (!imageRes.ok) {
                throw new Error(`Image fetch failed: ${imageRes.status}`);
            }

            const contentType = imageRes.headers.get("Content-Type") || "image/jpeg";
            const imageData = await imageRes.arrayBuffer();

            return new Response(imageData, {
                headers: {
                    "Content-Type": contentType,
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=86400", // 缓存24小时
                },
            });
        } catch (e) {
            console.error("Image proxy error:", e);
            return new Response("Image proxy error", {
                status: 500,
                headers: { "Access-Control-Allow-Origin": "*" },
            });
        }
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
