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
  aiEndpoint: "https://api.openai.com/v1/chat/completions",
  aiApiKey: "",
  aiModel: "gpt-4o-mini",
  aiSummaryPrompt: `## 📰 情报分析

### 1. 核心逻辑链 (300字以内)
- **[起因]**: 简述引发事件的直接原因或背景矛盾
- **[动态]**: 核心事件是什么，谁做了什么
- **[影响]**: 事件导致的直接后果或潜在趋势

### 2. 关键背景注解
- **[人物/实体名称]**: 一句话解释身份及关键作用
- **[地缘/事件概念]**: 一句话解释定义或历史背景

### 3. 延伸思考 (可选)
- 这对中国/中国读者意味着什么？
- 后续可能的发展走向？`,
  // 翻译设置
  translateEnabled: false,
  translateProvider: "ai", // 'ai' | 'google'
  targetLanguage: "zh",
  translateDisplayMode: "bilingual", // 'bilingual' | 'translated'
  // MCP 全文抓取设置
  mcpEnabled: false,
  mcpEndpoint: "http://usa2.190904.xyz:8766/mcp",
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
    return { ...defaultValue, ...storedValue };
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
