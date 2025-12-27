import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@nanostores/react";
import { PhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import "./ArticleView.css";
import ActionButtons from "@/components/ArticleView/components/ActionButtons.jsx";
import { generateReadableDate } from "@/lib/format.js";
import {
  activeArticle,
  filteredArticles,
  imageGalleryActive,
} from "@/stores/articlesStore.js";
import { Chip, Divider, ScrollShadow } from "@heroui/react";
import EmptyPlaceholder from "@/components/ArticleList/components/EmptyPlaceholder";
import { cleanTitle, extractFirstImage, getFontSizeClass } from "@/lib/utils";
import ArticleImage from "@/components/ArticleView/components/ArticleImage.jsx";
import parse from "html-react-parser";
import { settingsState } from "@/stores/settingsStore";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import PlayAndPause from "@/components/ArticleView/components/PlayAndPause.jsx";
import { currentThemeMode, themeState } from "@/stores/themeStore.js";
import CodeBlock from "@/components/ArticleView/components/CodeBlock.jsx";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { cn, getHostname } from "@/lib/utils.js";
import FeedIcon from "@/components/ui/FeedIcon.jsx";
import { getArticleById } from "@/db/storage";
import Attachments from "@/components/ArticleView/components/Attachments.jsx";
import ArticleSummary from "@/components/ArticleView/components/ArticleSummary.jsx";
import ArticleToolbar from "@/components/ArticleView/components/ArticleToolbar.jsx";
import ChatBubble from "@/components/ArticleView/components/ChatBubble.jsx";
import MarkdownContent from "@/components/ArticleView/components/MarkdownContent.jsx";
import { convertHtmlToSimplified, traditionalToSimplified } from "@/utils/t2s.js";

// 占位符图片检测
const isPlaceholderImage = (url) => {
  if (!url) return true;
  const lowerUrl = url.toLowerCase();
  const placeholderKeywords = [
    'placeholder', 'grey-placeholder', 'gray-placeholder',
    'lazy', 'blank', 'spacer', 'pixel', '1x1',
    'loading', 'skeleton', 'dummy'
  ];
  return placeholderKeywords.some(keyword => lowerUrl.includes(keyword));
};

// 将所有图片 URL 替换为代理 URL
const proxyAllImages = (html) => {
  if (!html) return html;
  return html.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi, (match, before, src, after) => {
    // 如果已经是代理 URL，不再处理
    if (src.startsWith('/api/image-proxy')) {
      return match;
    }
    // 如果是 data URL 或相对路径，不处理
    if (src.startsWith('data:') || src.startsWith('/')) {
      return match;
    }
    // 如果是占位符图片，直接移除
    if (isPlaceholderImage(src)) {
      return '';
    }
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(src)}`;
    return `<img ${before}src="${proxyUrl}"${after}>`;
  });
};

const ArticleView = () => {
  const { t } = useTranslation();
  const { articleId } = useParams();
  const [error, setError] = useState(null);
  // 翻译后的内容
  const [translatedContent, setTranslatedContent] = useState(null);
  // 翻译状态
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateProvider, setTranslateProvider] = useState(null); // 'google' | 'ai'
  // MCP 获取的全文内容
  const [mcpContent, setMcpContent] = useState(null);
  // MCP 内容是否为 Markdown 格式
  const [isMcpMarkdown, setIsMcpMarkdown] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const $activeArticle = useStore(activeArticle);
  const $filteredArticles = useStore(filteredArticles);

  // 用于追踪当前文章 ID，解决异步竞态问题
  const currentArticleIdRef = useRef(null);
  const autoFetchingRef = useRef(false);
  const autoTranslatingRef = useRef(false);

  const {
    lineHeight,
    fontSize,
    maxWidth,
    alignJustify,
    fontFamily,
    titleFontSize,
    titleAlignType,
    reduceMotion,
    floatingSidebar,
    t2sEnabled,
  } = useStore(settingsState);
  const { lightTheme } = useStore(themeState);
  const $currentThemeMode = useStore(currentThemeMode);
  const scrollAreaRef = useRef(null);
  // 判断当前是否实际使用了stone主题
  const isStoneTheme = () => {
    return lightTheme === "stone" && $currentThemeMode === "light";
  };

  // 监听文章ID变化,滚动到顶部
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current;
      if (viewport) {
        setTimeout(
          () => {
            viewport.scrollTo({
              top: 0,
              behavior: "instant", // 使用 instant 避免与动画冲突
            });
          },
          reduceMotion ? 1 : 300,
        );
      }
    }
  }, [articleId, reduceMotion]);

  useEffect(() => {
    // 使用 React 推荐的 ignore flag 模式防止竞态
    let ignore = false;

    // 1. 首先更新当前文章 ID ref
    currentArticleIdRef.current = articleId;

    // 2. 重置所有 ref 状态
    autoFetchingRef.current = false;
    autoTranslatingRef.current = false;

    // 3. 重置翻译和 MCP 内容
    setTranslatedContent(null);
    setMcpContent(null);
    setIsMcpMarkdown(false);
    setTranslatedTitle(null);
    setIsTranslating(false);
    setTranslateProvider(null);

    // 4. 立即清空 activeArticle，防止显示旧内容
    activeArticle.set(null);

    // 5. 加载文章
    const loadArticleByArticleId = async () => {
      if (!articleId) {
        return;
      }

      setError(null);
      try {
        const loadedArticle = await getArticleById(articleId);

        // 使用 ignore flag 检查是否应该忽略结果
        if (ignore) {
          console.log('[ArticleView] 请求已被取消（cleanup triggered），丢弃加载结果');
          return;
        }

        if (loadedArticle) {
          // 保存原始内容
          loadedArticle.originalContent = loadedArticle.content;
          activeArticle.set(loadedArticle);
        } else {
          setError("请选择要阅读的文章");
        }
      } catch (err) {
        console.error("加载文章失败:", err);
        if (!ignore) {
          setError(err.message);
        }
      }
    };

    loadArticleByArticleId();

    // Cleanup function: 当 articleId 变化或组件卸载时，设置 ignore = true
    return () => {
      ignore = true;
      console.log('[ArticleView] Cleanup: 标记旧请求为忽略');
    };
  }, [articleId]);

  // 获取当前显示的内容（繁简转换 + 图片代理）- 默认开启
  const rawContent = translatedContent || mcpContent || $activeArticle?.content;
  const shouldConvertT2S = t2sEnabled !== false; // 默认为 true
  const contentWithT2S = shouldConvertT2S ? convertHtmlToSimplified(rawContent) : rawContent;
  // 应用全局图片代理
  const displayContent = proxyAllImages(contentWithT2S);

  // 处理 MCP 全文更新
  const handleMcpContentUpdate = async (content, isMarkdown = false) => {
    // 确保 content 是字符串
    if (typeof content !== 'string') {
      console.error('[MCP] content is not a string:', typeof content, content);
      return;
    }

    setMcpContent(content);
    setIsMcpMarkdown(isMarkdown);

    // 自动翻译（如果开启）
    const settings = settingsState.get();
    if (settings.autoTranslateAfterFetch && settings.translateEnabled && content) {
      try {
        const { translateWithGoogleHtml, translateWithAIHtml } = await import("@/api/translate");
        // 如果设置为 AI 但 AI 未配置，回落到 Google
        let translateFn = translateWithGoogleHtml;
        if (settings.translateProvider === "ai" && settings.aiApiKey && settings.aiEndpoint) {
          translateFn = translateWithAIHtml;
        }
        const result = await translateFn(content);
        // 翻译返回 { translatedHtml, error } 对象
        if (result && result.translatedHtml && !result.error) {
          setTranslatedContent(result.translatedHtml);
        }
      } catch (err) {
        console.error("自动翻译失败:", err);
      }
    }
  };

  // 自动获取全文（内容少于200字时）
  useEffect(() => {
    let ignore = false;
    const settings = settingsState.get();

    // 检查条件
    if (!settings.mcpEnabled || !settings.mcpAutoFetch) {
      return;
    }

    if (!$activeArticle?.content || !$activeArticle?.url) {
      return;
    }

    // 如果已经有 MCP 内容或正在获取，跳过
    if (mcpContent || autoFetchingRef.current) {
      return;
    }

    // 计算纯文本长度
    const stripHtml = (html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("script, style, noscript").forEach(el => el.remove());
      return doc.body.textContent || "";
    };

    const plainText = stripHtml($activeArticle.content);
    console.log(`[AutoFetch] 文章长度: ${plainText.length}字`);

    // 如果内容少于200字，自动获取全文
    if (plainText.length < 200) {
      autoFetchingRef.current = true;
      const currentUrl = $activeArticle.url;
      console.log(`[AutoFetch] 开始自动获取全文: ${currentUrl}`);

      const fetchFull = async () => {
        try {
          // 使用 ignore flag 检查
          if (ignore) {
            console.log(`[AutoFetch] 请求已取消`);
            return;
          }

          const { fetchFullContent } = await import("@/api/mcp");
          const result = await fetchFullContent(currentUrl);

          // 再次检查 ignore flag
          if (ignore) {
            console.log(`[AutoFetch] 文章已切换，丢弃结果`);
            return;
          }

          if (result.success && result.content) {
            console.log(`[AutoFetch] MCP 获取成功, isMarkdown: ${result.isMarkdown}`);
            handleMcpContentUpdate(result.content, result.isMarkdown);
          } else {
            console.log(`[AutoFetch] MCP 获取失败:`, result.error);
          }
        } catch (err) {
          console.error("[AutoFetch] 自动获取全文失败:", err);
        } finally {
          autoFetchingRef.current = false;
        }
      };
      fetchFull();
    }

    return () => {
      ignore = true;
    };
  }, [$activeArticle?.id, mcpContent]);

  // 自动翻译英文内容
  useEffect(() => {
    let ignore = false;
    const settings = settingsState.get();

    // 检查是否启用自动翻译英文
    if (!settings.autoTranslateEnglish || !settings.translateEnabled) {
      return;
    }

    // 已经翻译过或正在翻译中
    if (translatedContent || autoTranslatingRef.current || isTranslating) {
      return;
    }

    const contentToCheck = mcpContent || $activeArticle?.content;
    if (!contentToCheck) return;

    // 检测是否为英文内容
    const checkAndTranslate = async () => {
      try {
        const { isEnglishText } = await import("@/utils/langDetect");
        const plainText = contentToCheck.replace(/<[^>]*>/g, '').slice(0, 500);

        if (isEnglishText(plainText)) {
          autoTranslatingRef.current = true;

          // 根据 autoTranslatePriority 设置决定使用哪个翻译服务
          const priority = settings.autoTranslatePriority || "google";
          const canUseAI = settings.aiApiKey && settings.aiEndpoint;
          const useAI = priority === "ai" && canUseAI;

          setTranslateProvider(useAI ? 'ai' : 'google');
          setIsTranslating(true);

          console.log(`[AutoTranslate] 检测到英文内容，使用 ${useAI ? 'AI' : 'Google'} 翻译`);
          const { translateWithGoogleHtml, translateWithAIHtml } = await import("@/api/translate");

          const translateFn = useAI ? translateWithAIHtml : translateWithGoogleHtml;

          const result = await translateFn(contentToCheck);

          // 使用 ignore flag 检查
          if (ignore) {
            console.log(`[AutoTranslate] 文章已切换，丢弃翻译结果`);
            setIsTranslating(false);
            setTranslateProvider(null);
            return;
          }

          if (result && result.translatedHtml && !result.error) {
            setTranslatedContent(result.translatedHtml);

            // 同时翻译标题
            const currentArticle = activeArticle.get();
            const title = currentArticle?.title;
            if (title) {
              try {
                const { translateText } = await import("@/api/translate");
                const titleResult = await translateText(title, settings.targetLanguage || "zh");
                if (!ignore && titleResult.translatedText) {
                  setTranslatedTitle(titleResult.translatedText);
                  console.log('[AutoTranslate] 标题翻译成功:', titleResult.translatedText);
                }
              } catch (titleErr) {
                console.warn('[AutoTranslate] 标题翻译失败:', titleErr);
              }
            }
          }

          setIsTranslating(false);
          setTranslateProvider(null);
        }
      } catch (err) {
        console.error("[AutoTranslate] 自动翻译失败:", err);
        setIsTranslating(false);
        setTranslateProvider(null);
      }
    };

    checkAndTranslate();

    return () => {
      ignore = true;
    };
  }, [$activeArticle?.id, mcpContent]);

  const handleLinkWithImg = (domNode) => {
    const imgNodes = domNode.children.filter(
      (child) => child.type === "tag" && child.name === "img",
    );

    if (imgNodes.length > 0) {
      const hostname = getHostname(domNode.attribs.href);
      return (
        <>
          {imgNodes.map((imgNode, index) => (
            <ArticleImage
              imgNode={imgNode}
              key={imgNode.attribs?.src || index}
            />
          ))}
          <div className="flex justify-center">
            <Chip
              color="primary"
              variant="flat"
              size="sm"
              classNames={{ base: "cursor-pointer my-2" }}
              endContent={<ExternalLink className="size-4 text-primary pr-1" />}
            >
              <a
                href={domNode.attribs.href}
                className="border-none!"
                rel="noopener noreferrer"
                target="_blank"
              >
                {hostname}
              </a>
            </Chip>
          </div>
        </>
      );
    }
    return domNode;
  };

  // 检查是否有音频附件
  const audioEnclosure = $activeArticle?.enclosures?.find((enclosure) =>
    enclosure.mime_type?.startsWith("audio/"),
  );

  const navigate = useNavigate();

  return (
    <>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={articleId ? "content" : "empty"}
            className={cn(
              "flex-1 p-0 h-screen fixed md:static inset-0 z-20 md:pr-2 md:py-2",
              !articleId ? "hidden md:flex md:flex-1" : "",
            )}
            initial={
              articleId ? { opacity: 1, x: 40 } : { opacity: 0, x: 0, scale: 0.8 }
            }
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={
              articleId
                ? { opacity: 0, x: 40, scale: 1 }
                : { opacity: 0, x: 0, scale: 0.8 }
            }
            transition={{
              duration: 0.5,
              type: "spring",
              bounce: 0,
              ease: "easeInOut",
            }}
          >
            {!$activeArticle || error ? (
              <EmptyPlaceholder />
            ) : (
              <ScrollShadow
                ref={scrollAreaRef}
                isEnabled={false}
                className={cn(
                  "article-scroll-area h-full bg-content2 md:bg-transparent",
                  floatingSidebar
                    ? "md:bg-transparent"
                    : "md:bg-background md:shadow-custom md:rounded-2xl",
                )}
              >
                <ActionButtons parentRef={scrollAreaRef} />

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={articleId}
                    initial={reduceMotion ? {} : { y: 50, opacity: 0 }}
                    animate={{
                      y: 0,
                      opacity: 1,
                      transition: {
                        opacity: { delay: 0.05 },
                      },
                    }}
                    exit={reduceMotion ? {} : { y: -50, opacity: 0 }}
                    transition={{ bounce: 0, ease: "easeInOut" }}
                    className="article-view-content px-5 pt-5 pb-20 w-full mx-auto"
                    style={{
                      maxWidth: `${maxWidth}ch`,
                      fontFamily: fontFamily,
                    }}
                  >
                    <header
                      className="article-header"
                      style={{ textAlign: titleAlignType }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/feed/${$activeArticle?.feed?.id}`)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            navigate(`/feed/${$activeArticle?.feed?.id}`);
                        }}
                        className={cn(
                          "text-default-500 text-sm flex items-center gap-1 hover:cursor-pointer focus:outline-none",
                          titleAlignType === "center" ? "justify-center" : "",
                        )}
                      >
                        <FeedIcon feedId={$activeArticle?.feed?.id} />
                        {$activeArticle?.feed?.title}
                      </button>
                      <h1
                        className="article-title font-semibold my-2 hover:cursor-pointer leading-tight"
                        style={{
                          fontSize: `${titleFontSize * fontSize}px`,
                        }}
                      >
                        <a
                          href={$activeArticle?.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {translatedTitle
                            ? (shouldConvertT2S ? traditionalToSimplified(translatedTitle) : translatedTitle)
                            : (shouldConvertT2S ? traditionalToSimplified(cleanTitle($activeArticle?.title)) : cleanTitle($activeArticle?.title))
                          }
                        </a>
                      </h1>
                      <div className="text-default-400 text-sm">
                        <time
                          dateTime={$activeArticle?.published_at}
                          key={t.language}
                        >
                          {generateReadableDate($activeArticle?.published_at)}
                        </time>
                      </div>
                    </header>
                    <Divider className="my-4" />
                    {/* AI 摘要组件 - 使用 MCP 获取的内容（如有）*/}
                    <ArticleSummary
                      content={mcpContent || $activeArticle?.content}
                      title={$activeArticle?.title}
                      articleUrl={$activeArticle?.url}
                    />
                    {/* 工具栏：翻译 + 全文获取 */}
                    <ArticleToolbar
                      articleUrl={$activeArticle?.url}
                      articleContent={mcpContent || $activeArticle?.content}
                      onContentUpdate={handleMcpContentUpdate}
                      onTranslatedContentUpdate={setTranslatedContent}
                    />
                    {/* 翻译状态提示 */}
                    {isTranslating && (
                      <div className="flex items-center gap-2 text-xs text-default-400 mb-2">
                        <span className="animate-pulse">●</span>
                        <span>{translateProvider === 'ai' ? 'AI 翻译中...' : 'Google 翻译中...'}</span>
                      </div>
                    )}
                    {audioEnclosure && (
                      <PlayAndPause
                        source={audioEnclosure}
                        poster={extractFirstImage($activeArticle)}
                      />
                    )}
                    <PhotoProvider
                      bannerVisible={true}
                      onVisibleChange={(visible) =>
                        imageGalleryActive.set(visible)
                      }
                      maskOpacity={0.8}
                      loop={false}
                      speed={() => 300}
                    >
                      <div
                        className={cn(
                          "article-content prose dark:prose-invert max-w-none",
                          "prose-pre:rounded-lg prose-pre:shadow-small",
                          "prose-h1:text-[1.5em] prose-h2:text-[1.25em] prose-h3:text-[1.125em] prose-h4:text-[1em]",
                          getFontSizeClass(fontSize),
                          isStoneTheme() ? "prose-stone" : "",
                        )}
                        style={{
                          lineHeight: lineHeight + "em",
                          textAlign: alignJustify ? "justify" : "left",
                        }}
                      >
                        {/* 根据内容类型选择渲染方式 */}
                        {isMcpMarkdown && mcpContent ? (
                          // MCP Markdown 内容使用 ReactMarkdown 渲染（包括翻译后的内容）
                          <MarkdownContent
                            content={
                              translatedContent
                                ? (shouldConvertT2S ? traditionalToSimplified(translatedContent) : translatedContent)
                                : (shouldConvertT2S ? traditionalToSimplified(mcpContent) : mcpContent)
                            }
                          />
                        ) : (
                          // HTML 内容使用 html-react-parser 渲染
                          parse(displayContent || '', {
                            replace(domNode) {
                              if (
                                domNode.type === "tag" &&
                                domNode.name === "img"
                              ) {
                                return <ArticleImage imgNode={domNode} />;
                              }
                              if (domNode.type === "tag" && domNode.name === "a") {
                                return domNode.children.length > 0
                                  ? handleLinkWithImg(domNode)
                                  : domNode;
                              }
                              if (
                                domNode.type === "tag" &&
                                domNode.name === "iframe"
                              ) {
                                const { src } = domNode.attribs;
                                domNode.attribs = {
                                  ...domNode.attribs,
                                  referrerpolicy: "strict-origin-when-cross-origin",
                                };

                                // 判断是否为 Bilibili iframe
                                const isBilibili = src && src.includes("bilibili");

                                // 如果不是 YouTube iframe,直接返回原始节点
                                if (!isBilibili) {
                                  return domNode;
                                }

                                // 如果是 Bilibili iframe, 组装新的iframe
                                if (isBilibili) {
                                  // 获取bilibili视频 bvid
                                  const bvid = src.match(/bvid=([^&]+)/)?.[1];
                                  if (bvid) {
                                    return (
                                      <iframe
                                        src={`//bilibili.com/blackboard/html5mobileplayer.html?isOutside=true&bvid=${bvid}&p=1&hideCoverInfo=1&danmaku=0`}
                                        allowFullScreen={true}
                                      ></iframe>
                                    );
                                  }
                                  return domNode;
                                }
                              }
                              if (
                                domNode.type === "tag" &&
                                domNode.name === "pre"
                              ) {
                                // 1. 首先检查是否有code子节点
                                const codeNode = domNode.children.find(
                                  (child) =>
                                    child.type === "tag" && child.name === "code",
                                );

                                // 递归获取所有文本内容的辅助函数
                                const getTextContent = (node) => {
                                  if (!node) return "";
                                  if (node.type === "text") return node.data;
                                  if (node.type === "tag") {
                                    if (node.name === "br") return "\n";
                                    // 处理其他标签内的文本
                                    const childText = node.children
                                      .map((child) => getTextContent(child))
                                      .join("");
                                    // 对于块级元素,在前后添加换行
                                    if (
                                      [
                                        "p",
                                        "div",
                                        "h1",
                                        "h2",
                                        "h3",
                                        "h4",
                                        "h5",
                                        "h6",
                                      ].includes(node.name)
                                    ) {
                                      return `${childText}\n`;
                                    }
                                    return childText;
                                  }
                                  return "";
                                };

                                if (codeNode) {
                                  // 2. 处理带有code标签的情况
                                  const className = codeNode.attribs?.class || "";
                                  const language =
                                    className
                                      .split(/\s+/)
                                      .find(
                                        (cls) =>
                                          cls.startsWith("language-") ||
                                          cls.startsWith("lang-"),
                                      )
                                      ?.replace(/^(language-|lang-)/, "") || "text";

                                  const code = getTextContent(codeNode)
                                    .replace(/\n{3,}/g, "\n\n") // 将连续3个及以上换行替换为2个
                                    .trim();

                                  return code ? (
                                    <CodeBlock code={code} language={language} />
                                  ) : (
                                    domNode
                                  );
                                } else {
                                  // 3. 处理直接在pre标签中的文本
                                  const code = getTextContent(domNode)
                                    .replace(/\n{3,}/g, "\n\n")
                                    .trim();

                                  // 如果内容为空则不处理
                                  if (!code) {
                                    return domNode;
                                  }

                                  return <CodeBlock code={code} language="text" />;
                                }
                              }
                            },
                          })
                        )}
                        <Attachments article={$activeArticle} />
                      </div>
                    </PhotoProvider>
                  </motion.div>
                </AnimatePresence>
              </ScrollShadow>
            )}
          </motion.div>
        </AnimatePresence>
      </MotionConfig>
      <ChatBubble
        articleContent={mcpContent || $activeArticle?.content}
        articleTitle={$activeArticle?.title}
      />
    </>
  );
};

export default ArticleView;
