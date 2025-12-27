import { persistentAtom } from "@nanostores/persistent";

const defaultValue = {
  lineHeight: 1.8,
  fontSize: 16,
  maxWidth: 65, // 单位为ch
  alignJustify: false,
  fontFamily: "system-ui",
  titleFontSize: 1.6, // 标题相对于正文大小的倍数
  titleAlignType: "left",
  feedIconShape: "square", // circle, square
  useGrayIcon: false,
  sortDirection: "desc", // asc, desc
  sortField: "published_at", // published_at, created_at
  showHiddenFeeds: false,
  markAsReadOnScroll: false,
  cardImageSize: "large", // none, small, large
  showFavicon: true,
  titleLines: 2,
  textPreviewLines: 2,
  showReadingTime: true,
  autoHideToolbar: false,
  syncInterval: "15", // 添加同步间隔设置，默认15分钟
  showLineNumbers: false,
  forceDarkCodeTheme: false,
  defaultExpandCategory: false, // 默认展开分类
  showUnreadByDefault: false,
  reduceMotion: false,
  interfaceFontSize: "16",
  showIndicator: true,
  floatingSidebar: false,
  // AI 总结设置
  aiEnabled: false,
  aiEndpoint: "https://v.198990.xyz/gemini/v1beta/openai/chat/completions",
  aiApiKey: "",
  aiModel: "gpt-4o-mini",
  aiTranslateModel: "", // 翻译专用模型，为空时使用 aiModel
  // 启用的摘要提示词 ID 列表
  aiEnabledPrompts: ["default"],
  // 预设提示词（不可删除，可禁用）
  aiPresetPrompts: [
    {
      id: "default",
      name: "📰 情报分析",
      enabled: true,
      prompt: `## 📰 情报分析

### 1. 核心逻辑链 (300字以内)
- **[起因]**: 简述引发事件的直接原因或背景矛盾
- **[动态]**: 核心事件是什么，谁做了什么
- **[影响]**: 事件导致的直接后果或潜在趋势

### 2. 关键背景注解
- **[人物/实体名称]**: 一句话解释身份及关键作用
- **[地缘/事件概念]**: 一句话解释定义或历史背景

### 3. 延伸思考 (可选)
- 这对中国/中国读者意味着什么？
- 后续可能的发展走向？`
    },
    {
      id: "academic",
      name: "🎓 学术选题",
      enabled: false,
      prompt: `你是一位顶级应用经济学与金融学期刊的资深学术编辑。请将这篇文章转化为结构严谨的实证研究框架。

## 核心选题概述
**【题目构思】**：[一个符合期刊风格的暂定标题]
**【逻辑链条】**：
*   **核心变量 (X)**：[新闻中的核心冲击/事件]
*   **结果变量 (Y)**：[受影响的经济/金融指标]
*   **作用机制 (M)**：[X 是如何导致 Y 的？]
*   **排除假设**：[看似合理但被排除的解释]

## 详细研究逻辑
### 1. 经济学直觉与故事线
[详细描述背后的经济学原理]

### 2. 竞争性假设的排除策略
[为什么传统观点不足以解释当前现象]

### 3. 期刊适配性
[该选题为何符合顶刊风格]`
    },
    {
      id: "vocabulary",
      name: "📚 难词解析",
      enabled: false,
      prompt: `请分析这篇文章中的专业术语、难词和关键概念，用中文进行详细解释。

## 📖 核心概念解析
对文章中最重要的3-5个概念进行维基百科式的详解：
- **[术语1]**: 定义、背景、在本文中的含义
- **[术语2]**: 定义、背景、在本文中的含义
...

## 🔤 专业词汇表
| 英文 | 中文 | 解释 |
|------|------|------|
| term | 译名 | 简短解释 |

## 💡 延伸阅读建议
- 相关概念或背景知识推荐`
    },
    {
      id: "english",
      name: "🇬🇧 英语学习",
      enabled: false,
      prompt: `请从英语学习的角度分析这篇文章，帮助读者提升英语水平。

## 📝 高级词汇与表达
提取文章中值得学习的高级词汇和地道表达：
| 词汇/短语 | 词性 | 中文释义 | 例句语境 |
|-----------|------|----------|----------|

## 📖 句型分析
分析2-3个复杂或优美的句子结构：
- **原句**: ...
- **结构拆解**: ...
- **仿写建议**: ...

## 🗣️ 实用表达
可用于口语或写作的地道表达：
- [表达1]: 使用场景
- [表达2]: 使用场景

## 📚 主题词汇拓展
与本文主题相关的词汇网络`
    },
    {
      id: "fun",
      name: "🎭 有趣理解",
      enabled: false,
      prompt: `你是一个善于用幽默有趣的方式讲解复杂知识的高手。请用轻松诙谐的语言重新解读这篇文章，让枯燥的新闻变得生动有趣、令人印象深刻。

## 🎬 一句话神总结
用一句话概括这篇文章，要有趣、犀利、让人忍不住想分享。

## 🎪 故事化讲解
把文章的核心内容用讲故事的方式说出来：
- 可以用比喻、类比、调侃
- 可以联系生活中的场景
- 让读者"啊哈！原来是这样"

## 💡 关键知识点（记住这三条就够了）
1. **[要点1]**: 用大白话讲明白
2. **[要点2]**: 用大白话讲明白
3. **[要点3]**: 用大白话讲明白

## 🤔 灵魂拷问
提出1-2个引发思考的问题，让读者对这个话题产生更深的兴趣

## 📢 朋友圈文案（可直接复制）
写一段适合发朋友圈的文案，分享这篇文章的有趣观点`
    }
  ],
  // 用户自定义提示词
  aiCustomPrompts: [],
  // 旧版兼容
  aiSummaryPrompt: ``,
  // Memos 设置
  memosEnabled: false,
  memosEndpoint: "https://memos.190904.xyz",
  memosToken: "",
  // 翻译设置
  translateEnabled: false,
  translateProvider: "ai", // 'ai' | 'google'
  targetLanguage: "zh",
  translateDisplayMode: "bilingual", // 'bilingual' | 'translated'
  translateConcurrency: 20, // 翻译并发数
  autoTranslateEnglish: false, // 自动翻译英文内容
  autoTranslatePriority: "google", // 自动翻译优先级: 'google' | 'ai'
  translateListItems: false, // 翻译列表标题和摘要
  // MCP 全文抓取设置
  mcpEnabled: false,
  mcpEndpoint: "http://usa2.190904.xyz:8766/mcp",
  mcpAutoFetch: false, // 内容少于200字时自动获取全文
  autoTranslateAfterFetch: false, // 获取全文后自动翻译
  // 繁简转换设置（默认开启）
  t2sEnabled: true,
};

export const settingsState = persistentAtom("settings", defaultValue, {
  encode: (value) => {
    const filteredValue = Object.keys(value).reduce((acc, key) => {
      if (key in defaultValue) {
        acc[key] = value[key];
      }
      return acc;
    }, {});
    return JSON.stringify(filteredValue);
  },
  decode: (str) => {
    const storedValue = JSON.parse(str);
    const merged = { ...defaultValue, ...storedValue };

    // 确保新的预设提示词被添加到用户设置中
    if (defaultValue.aiPresetPrompts && merged.aiPresetPrompts) {
      const storedIds = merged.aiPresetPrompts.map(p => p.id);
      defaultValue.aiPresetPrompts.forEach(defaultPrompt => {
        if (!storedIds.includes(defaultPrompt.id)) {
          // 新的预设提示词，添加到用户设置中
          merged.aiPresetPrompts.push(defaultPrompt);
        }
      });
    }

    return merged;
  },
});

export const updateSettings = (settingsChanges) =>
  settingsState.set({ ...settingsState.get(), ...settingsChanges });

export const resetSettings = () => {
  // 定义阅读相关的设置项
  const readingSettings = [
    "lineHeight",
    "fontSize",
    "maxWidth",
    "alignJustify",
    "fontFamily",
    "titleFontSize",
    "titleAlignType",
    "autoHideToolbar",
    "showLineNumbers",
    "forceDarkCodeTheme",
  ];
  const currentSettings = settingsState.get();
  const newSettings = { ...currentSettings };

  // 只重置阅读相关的设置
  readingSettings.forEach((key) => {
    newSettings[key] = defaultValue[key];
  });

  settingsState.set(newSettings);
};
