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
            // 尝试标准化 URL (处理中文等字符)
            let targetUrl = imageUrl;
            // 特殊处理 Miniflux 的 localhost 代理链接
            // 格式: http://localhost/proxy/<hash>/<base64_url>
            if (targetUrl.includes("/proxy/") && (targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1"))) {
                try {
                    const parts = targetUrl.split("/proxy/");
                    if (parts.length > 1) {
                        const pathParts = parts[1].split("/");
                        // 通常是 <hash>/<base64>，取最后一个部分
                        const base64Part = pathParts[pathParts.length - 1];
                        // 尝试 base64 解码 (需处理 URL safe base64)
                        const decodedUrl = atob(base64Part.replace(/-/g, '+').replace(/_/g, '/'));
                        if (decodedUrl.startsWith("http")) {
                            console.log(`Unwrapped Miniflux proxy URL: ${targetUrl} -> ${decodedUrl}`);
                            targetUrl = decodedUrl;
                        }
                    }
                } catch (e) {
                    console.warn("Failed to unwrap localhost proxy URL:", e);
                    // 失败则继续尝试原链接（虽然基本会失败）
                }
            }

            // 修复常见的模板变量 (如 DW的 ${formatId})
            targetUrl = targetUrl.replace(/\$\{formatId\}/g, '303'); // DW默认格式

            try {
                targetUrl = new URL(targetUrl).toString();
            } catch {
                // 如果 new URL 失败，可能是相对路径或格式错误，尝试 encodeURI
                targetUrl = encodeURI(targetUrl);
            }

            // 智能设置 Referer 策略
            const targetHostname = new URL(targetUrl).hostname;
            const headers: Record<string, string> = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "image/*,*/*;q=0.8",
            };

            // 需要 Referer 的域名列表 (如 OFweek, armscontrolwonk)
            const needRefererDomains = ['ofweek.com', 'mp.ofweek.com', 'armscontrolwonk.com'];
            // 需要移除 Referer 的域名列表 (如 Toutiao)
            const noRefererDomains = ['toutiao.com', 'toutiaoimg.com'];

            let referrerPolicy: ReferrerPolicy = "strict-origin-when-cross-origin"; // 默认

            if (noRefererDomains.some(domain => targetHostname.includes(domain))) {
                // Toutiao 等: 不发送 Referer
                referrerPolicy = "no-referrer";
            } else if (needRefererDomains.some(domain => targetHostname.includes(domain))) {
                // OFweek 等: 发送 origin 作为 Referer
                headers["Referer"] = new URL(targetUrl).origin;
            }

            const imageRes = await fetch(targetUrl, {
                headers,
                referrerPolicy
            });

            if (!imageRes.ok) {
                // 转发上游状态码，而不是抛出 500
                // 有些 404/403 可能也返回图片（如占位图），但通常我们只关心成功
                // 这里选择返回上游状态码和文本
                return new Response(`Upstream error: ${imageRes.status}`, {
                    status: imageRes.status,
                    headers: { "Access-Control-Allow-Origin": "*" }
                });
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
            return new Response("Image proxy error: " + (e as Error).message, {
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
