import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // MCP 代理 - 解决 CORS 问题
      '/api/mcp-proxy': {
        target: 'http://usa2.190904.xyz:8766',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mcp-proxy/, '/mcp'),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // 确保正确的 Accept 头
            proxyReq.setHeader('Accept', 'application/json, text/event-stream');
          });
        }
      }
    }
  }
});
