import { useNavigate, useParams } from "react-router-dom";
import { Clock, ArrowUpFromLine, Star, Circle, CircleDot } from "lucide-react";
import {
  cleanTitle,
  cn,
  extractFirstImage,
  extractTextFromHtml,
} from "@/lib/utils";
import { formatPublishDate } from "@/lib/format";
import ArticleCardCover from "./ArticleCardCover.jsx";
import {
  handleMarkStatus,
  handleMarkAboveAsRead,
} from "@/handlers/articleHandlers.js";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { settingsState } from "@/stores/settingsStore";
import { feeds } from "@/stores/feedsStore";
import { Ripple, useRipple } from "@heroui/react";
import FeedIcon from "@/components/ui/FeedIcon.jsx";
import { useTranslation } from "react-i18next";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";
import { traditionalToSimplified } from "@/utils/t2s.js";
import { isEnglishText } from "@/utils/langDetect.js";
import { getCachedTranslation, setCachedTranslation, isTranslating, addToQueue, removeFromQueue } from "@/stores/translationCache.js";
import { translationCache } from "@/stores/translationCache.js";

export default function ArticleCard({ article }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { articleId } = useParams();
  const cardRef = useRef(null);
  const $feeds = useStore(feeds);
  const $translationCache = useStore(translationCache);
  const {
    markAsReadOnScroll,
    cardImageSize,
    showFavicon,
    showReadingTime,
    textPreviewLines,
    titleLines,
    t2sEnabled,
    translateListItems,
    translateEnabled,
  } = useStore(settingsState);
  const hasBeenVisible = useRef(false);
  const { ripples, onClear, onPress } = useRipple();
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
  });

  const imageUrl = useMemo(() => extractFirstImage(article), [article]);
  const feedTitle = useMemo(() => {
    const feed = $feeds.find((f) => f.id === article.feedId);
    const title = feed?.title || article.feedId;
    return t2sEnabled !== false ? traditionalToSimplified(title) : title;
  }, [article.feedId, $feeds, t2sEnabled]);

  // 原始标题和摘要
  const rawTitle = useMemo(() => cleanTitle(article.title), [article.title]);
  const rawPreview = useMemo(() => extractTextFromHtml(article.content).slice(0, 300), [article.content]);

  // 检查是否需要翻译（英文内容）
  const needsTranslation = useMemo(() => {
    if (!translateListItems || !translateEnabled) return false;
    return isEnglishText(rawTitle) || isEnglishText(rawPreview);
  }, [translateListItems, translateEnabled, rawTitle, rawPreview]);

  // 获取翻译缓存
  const cached = $translationCache[article.id];

  // 显示内容（优先显示翻译）
  const displayTitle = useMemo(() => {
    const title = cached?.title || rawTitle;
    return t2sEnabled !== false ? traditionalToSimplified(title) : title;
  }, [cached?.title, rawTitle, t2sEnabled]);

  const previewContent = useMemo(() => {
    const text = cached?.preview || rawPreview;
    return t2sEnabled !== false ? traditionalToSimplified(text) : text;
  }, [cached?.preview, rawPreview, t2sEnabled]);

  useEffect(() => {
    // 如果文章已读或未启用滚动标记已读,则不需要观察
    if (article.status === "read" || !markAsReadOnScroll) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const cardRect = entry.boundingClientRect;
          const rootRect = entry.rootBounds;

          // 当文章进入视口时记录状态
          if (entry.isIntersecting) {
            hasBeenVisible.current = true;
          }
          // 只有当卡片完全在视口顶部以上,且之前显示过时才标记已读
          else if (hasBeenVisible.current && cardRect.top < rootRect.top) {
            // console.log(cardRect.bottom, rootRect.top, '标记已读');
            handleMarkStatus(article);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        // 设置根元素为滚动容器
        root: document.querySelector(".v-list"),
        // 设置阈值为0,表示完全离开视口时触发
        threshold: 0.2,
      },
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [article, markAsReadOnScroll]);

  // 滚动时翻译可见的卡片
  useEffect(() => {
    // 检查是否需要翻译
    if (!translateListItems || !translateEnabled) return;

    // 检查是否是英文
    const isEnglish = isEnglishText(rawTitle) || isEnglishText(rawPreview);
    if (!isEnglish) return;

    // 已翻译或正在翻译
    if (getCachedTranslation(article.id)?.title) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // 再次检查防止重复翻译
            if (getCachedTranslation(article.id)?.title || isTranslating(article.id)) {
              observer.unobserve(entry.target);
              return;
            }

            // 添加到翻译队列
            addToQueue(article.id);

            try {
              const { translateText } = await import("@/api/translate");

              // 翻译标题
              if (isEnglishText(rawTitle)) {
                const titleResult = await translateText(rawTitle);
                if (titleResult.translatedText && !titleResult.error) {
                  setCachedTranslation(article.id, { title: titleResult.translatedText });
                }
              }

              // 翻译摘要
              if (isEnglishText(rawPreview)) {
                const previewResult = await translateText(rawPreview.slice(0, 200));
                if (previewResult.translatedText && !previewResult.error) {
                  setCachedTranslation(article.id, { preview: previewResult.translatedText });
                }
              }
            } catch (err) {
              console.warn("翻译列表项失败:", err);
            } finally {
              removeFromQueue(article.id);
            }

            observer.unobserve(entry.target);
          }
        }
      },
      {
        root: document.querySelector(".v-list"),
        // rootMargin 提前 800px 开始翻译，确保滚动前已翻译
        rootMargin: "800px 0px 800px 0px",
        threshold: 0,
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [article.id, translateListItems, translateEnabled, rawTitle, rawPreview]);

  const handleArticleClick = async (article) => {
    const basePath = window.location.pathname.split("/article/")[0];
    const toUrl =
      basePath === "/"
        ? `/article/${article.id}`
        : `${basePath}/article/${article.id}`;
    navigate(toUrl);
    if (article.status !== "read") {
      await handleMarkStatus(article);
    }
  };

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 创建一个模拟的 PressEvent 对象
    const pressEvent = {
      type: "press",
      target: e.currentTarget,
      x,
      y,
    };

    onPress(pressEvent);
    handleArticleClick(article);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
  };

  return (
    <>
      <div
        ref={cardRef}
        className={cn(
          "cursor-pointer select-none overflow-hidden p-2 rounded-xl",
          "relative transform-gpu transition-background duration-200",
          "bg-transparent contain-content",
          "hover:bg-background/70",
          parseInt(articleId) === article.id &&
          "bg-background/70 shadow-custom",
        )}
        data-article-id={article.id}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <Ripple
          ripples={ripples}
          onClear={onClear}
          color="hsl(var(--heroui-content4))"
        />
        <div
          className={cn(
            "card-content flex flex-col gap-1 transition-opacity",
            article.status === "read" && article.starred === 0 && "opacity-50",
          )}
        >
          <div className="card-header flex flex-col gap-1">
            <div className="card-meta flex items-start justify-between gap-1">
              <div className="card-source flex items-center flex-1 gap-1 min-w-0">
                <div className="card-source-content flex gap-1 items-center min-w-0">
                  {showFavicon && <FeedIcon feedId={article.feedId} />}
                  <span className="card-source-title text-default-500 font-bold text-xs line-clamp-1">
                    {feedTitle}
                  </span>
                </div>
              </div>
              <div className="card-time-wrapper flex items-center gap-1 text-xs text-default-400">
                <span className="card-star">
                  <Star
                    className="size-3 fill-current"
                    style={{ opacity: article.starred === 1 ? 1 : 0 }}
                  />
                </span>
                <span className="card-time whitespace-nowrap">
                  {formatPublishDate(article.published_at)}
                </span>
              </div>
            </div>
            <div className="card-content-body flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <h3
                  className={cn(
                    "card-title text-base font-semibold text-wrap break-words",
                    article.status === "read"
                      ? "text-content2-foreground"
                      : "text-foreground",
                  )}
                  style={{
                    wordBreak: "break-word",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: titleLines === 0 ? "none" : titleLines,
                  }}
                >
                  {displayTitle}
                </h3>
                {showReadingTime && (
                  <div className="text-xs text-default-500 flex items-center gap-1">
                    <Clock className="size-3 shrink-0" />
                    <span className="line-clamp-1">
                      {article.reading_time === 0
                        ? t("common.lessThanAMinute")
                        : `${article.reading_time} ${t("common.minute")}`}
                    </span>
                  </div>
                )}
                {textPreviewLines !== 0 && (
                  <span
                    className={cn(
                      "text-sm text-default-500 text-wrap break-words w-full max-w-full overflow-hidden",
                    )}
                    style={{
                      wordBreak: "break-word",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: textPreviewLines,
                    }}
                  >
                    {previewContent}
                  </span>
                )}
                {cardImageSize === "large" && (
                  <ArticleCardCover imageUrl={imageUrl} />
                )}
              </div>
              {cardImageSize === "small" && (
                <ArticleCardCover imageUrl={imageUrl} />
              )}
            </div>
          </div>
        </div>
      </div>

      <ContextMenu
        isOpen={contextMenu.isOpen}
        onClose={closeContextMenu}
        position={contextMenu.position}
      >
        <ContextMenuItem
          onClick={() => {
            handleMarkAboveAsRead(article.id);
            closeContextMenu();
          }}
          startContent={<ArrowUpFromLine className="size-4 text-default-500" />}
        >
          {t("common.markAboveAsRead")}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            handleMarkStatus(article);
            closeContextMenu();
          }}
          startContent={
            article.status === "read" ? (
              <CircleDot className="size-4 text-default-500 p-0.5 fill-current" />
            ) : (
              <Circle className="size-4 text-default-500 p-0.5" />
            )
          }
        >
          {article.status === "read"
            ? t("common.markAsUnread")
            : t("common.markAsRead")}
        </ContextMenuItem>
      </ContextMenu>
    </>
  );
}
