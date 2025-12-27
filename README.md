# NextFlux RSS Reader

> 一个现代化的RSS阅读器，集成AI摘要、自动翻译、全文抓取等功能，部署在Deno Deploy。

## 📋 项目概述

NextFlux是一个功能强大的RSS阅读器前端应用，专为提升阅读体验和信息获取效率而设计。主要特色：

- **智能AI摘要**: 多种可定制的AI摘要模板（情报分析、学术选题、数据总结等）
- **自动翻译**: 支持Google翻译和AI翻译，自动识别英文内容
- **全文抓取**: 通过MCP服务获取完整文章内容（支持Markdown和HTML）
- **图片代理**: 智能处理各类图片源（防盗链、相对路径、HTML实体等）
- **繁简转换**: 支持繁体中文自动转简体
- **Memos集成**: 一键保存摘要到Memos

## 🏗️ 技术架构

### 前端技术栈
- **框架**: React 18 + Vite
- **状态管理**: Nanostores
- **UI组件**: HeroUI (NextUI fork)
- **Markdown渲染**: react-markdown + remark-gfm + rehype-katex
- **代码高亮**: react-syntax-highlighter
- **图片查看**: react-photo-view
- **HTTP客户端**: Axios

### 后端服务 (Deno)
- **运行时**: Deno Deploy
- **主要功能**:
  - 图片代理 (`/api/image-proxy`)
  - Google翻译代理 (`/api/translate`)
  - MCP服务代理 (`/api/mcp`)
  - 静态文件服务

### 关键依赖
- Miniflux API (RSS源)
- Google Translate API
- MCP服务 (全文抓取)
- Memos API (笔记保存)

## 🚀 部署方式

### 1. 环境要求
- Node.js 18+
- Deno CLI
- Git

### 2. 本地开发

```bash
# 克隆项目
git clone https://github.com/myh333777/nextflux.git
cd nextflux

# 安装依赖
npm install

# 启动开发服务器 (前端)
npm run dev
# 访问: http://localhost:5173

# 启动后端服务 (可选，用于测试API)
deno run --allow-net --allow-read --allow-env main.ts
```

### 3. 生产部署到Deno Deploy

```bash
# 构建前端
npm run build

# 部署到Deno Deploy
/Users/myh/.deno/bin/deployctl deploy \
  --project=nextflux-rss \
  --prod \
  main.ts \
  --exclude=node_modules

# 或使用简化命令
npm run build && deployctl deploy --project=nextflux-rss --prod main.ts --exclude=node_modules
```

**部署地址**: https://nextflux-rss.deno.dev

### 4. 配置说明

关键配置文件：
- `deno.json`: Deno项目配置
- `vite.config.js`: Vite构建配置
- `src/stores/settingsStore.js`: 应用设置（含AI prompt配置）

## 🔧 开发工作流

### 典型修改流程

1. **修改代码** (如添加新功能、修改prompt等)
2. **本地测试** (`npm run dev`)
3. **构建** (`npm run build`)
4. **部署** (`deployctl deploy ...`)
5. **Git同步**
   ```bash
   git add -A
   git commit -m "feat: 描述修改内容"
   git push
   ```

### 关键文件说明

#### 前端核心文件
```
src/
├── components/
│   └── ArticleView/
│       ├── ArticleView.jsx          # 文章主视图
│       └── components/
│           ├── ArticleSummary.jsx   # AI摘要组件
│           ├── ArticleToolbar.jsx   # 翻译/全文按钮
│           └── MarkdownContent.jsx  # Markdown渲染
├── stores/
│   └── settingsStore.js             # 设置存储 (重要!)
├── api/
│   ├── ai.js                        # AI摘要API
│   ├── translate.js                 # 翻译API
│   └── mcp.js                       # MCP全文抓取
└── utils/
    ├── langDetect.js                # 语言检测
    └── t2s.js                       # 繁简转换
```

#### 后端核心文件
```
main.ts                               # Deno服务器主文件
├── /api/image-proxy                 # 图片代理逻辑
├── /api/translate                   # 翻译代理逻辑
└── /api/mcp                         # MCP代理逻辑
```

## ⚠️ 重要注意事项

### 1. AI Prompt配置 (`settingsStore.js`)

**位置**: `src/stores/settingsStore.js` 第40-180行

**修改Prompt时必须注意**:
- ✅ 每个prompt必须包含 `**输出规范**: 直接输出结果，不需要前缀说明或总述性文字。`
- ✅ `enabled: true` 的prompt会被默认选中
- ✅ `id` 必须唯一且不能修改（用于localStorage持久化）
- ✅ 格式严格遵循现有结构

**当前Prompt顺序**:
1. 📰 情报分析 (默认)
2. 📋 简报
3. 📊 数据总结
4. 🎓 学术选题
5. 📚 难词解析
6. 🇬🇧 英语学习
7. 🎭 有趣理解

### 2. 图片代理配置 (`main.ts`)

**位置**: `main.ts` 第116-150行

**智能Referer策略**:
```typescript
// 需要Referer的域名 (如防盗链站点)
const needRefererDomains = ['ofweek.com', 'mp.ofweek.com', 'armscontrolwonk.com'];

// 需要移除Referer的域名 (如今日头条)
const noRefererDomains = ['toutiao.com', 'toutiaoimg.com'];
```

**修改规则**:
- 遇到新的403图片错误 → 测试是否需要Referer → 添加到对应数组
- 模板变量修复 (如 `${formatId}`) 在第116行

### 3. 翻译功能 (`translate.js`)

**Markdown翻译保护项** (`translateMarkdown`函数):
- ✅ 代码块 (` ```...``` `)
- ✅ 图片/链接语法 (保护URL，翻译alt/text)
- ✅ LaTeX公式 (`$...$` 和 `$$...$$`)
- ✅ HTML实体自动解码

**注意**: 修改翻译逻辑时要保证这些保护机制不被破坏！

### 4. 语言检测 (`langDetect.js`)

**关键**: `isEnglishText`函数会先清理Markdown语法再检测，避免误判。

**不要修改**清理逻辑，否则包含大量链接的中文文章会被误认为英文！

### 5. 部署注意

**每次修改后必须**:
1. `npm run build` (构建前端到`dist/`)
2. `deployctl deploy` (上传到Deno Deploy)
3. 验证线上功能是否正常

**常见错误**:
- ❌ 忘记构建直接部署 → 线上看不到更新
- ❌ 只修改前端忘记重启dev server → 热更新失败
- ❌ Deno类型错误是正常的 → 部署时会自动解决

## 📝 Git提交规范

```bash
# 功能性修改
git commit -m "feat: 添加XXX功能"

# Bug修复
git commit -m "fix: 修复XXX问题"

# 文档更新
git commit -m "docs: 更新README"

# 样式调整
git commit -m "style: 优化XXX样式"

# 重构
git commit -m "refactor: 重构XXX模块"
```

## 🐛 常见问题排查

### 图片不显示
1. 检查浏览器console的`/api/image-proxy?url=...`请求
2. 500错误 → 可能需要添加域名到Referer白名单
3. CORS错误 → 后端已配置`Access-Control-Allow-Origin: *`

### AI摘要不工作
1. 检查`aiEnabled: true`和`aiApiKey`是否配置
2. 检查prompt格式是否正确
3. 查看Network面板的API请求状态

### 翻译失败
1. 400错误 → 内容包含无法翻译的块（图片/链接/公式）
2. 500错误 → Google API问题，检查代理配置

## 📚 相关资源

- **GitHub**: https://github.com/myh333777/nextflux
- **部署**: https://nextflux-rss.deno.dev
- **Deno Deploy Dashboard**: https://dash.deno.com/projects/nextflux-rss

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📄 License

MIT License

---

**维护者**: myh333777  
**最后更新**: 2025-12-27
