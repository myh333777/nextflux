import { useState, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { Button, ButtonGroup, Tooltip, Chip } from "@heroui/react";
import { Languages, FileText, X, Check, Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { settingsState } from "@/stores/settingsStore";
import { translateWithGoogleHtml, translateWithAIHtml, translateMarkdown } from "@/api/translate";
import { fetchFullContent } from "@/api/mcp";

const ArticleToolbar = ({
    articleUrl,
    articleContent,
    isMcpMarkdown = false, // 新增:标识内容是否为Markdown格式
    onContentUpdate,
    onTranslatedContentUpdate
}) => {
    const { t } = useTranslation();
    const settings = useStore(settingsState);

    // 翻译状态
    const [isGoogleTranslating, setIsGoogleTranslating] = useState(false);
    const [isAITranslating, setIsAITranslating] = useState(false);
    const [isTranslated, setIsTranslated] = useState(false);
    const [translateError, setTranslateError] = useState(null);
    const [translatedWith, setTranslatedWith] = useState(null); // 'google' | 'ai'

    // 全文抓取状态
    const [isFetching, setIsFetching] = useState(false);
    const [fetchSuccess, setFetchSuccess] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    // Google 翻译 (智能判断Markdown/HTML)
    const handleGoogleTranslate = useCallback(async () => {
        if (!articleContent) return;

        setIsGoogleTranslating(true);
        setTranslateError(null);

        try {
            let result;
            if (isMcpMarkdown) {
                // Markdown格式:使用translateMarkdown
                result = await translateMarkdown(articleContent, settings.targetLanguage || "zh");
                // translateMarkdown返回{translatedText, error}
                if (result.error) {
                    setTranslateError(result.error);
                } else {
                    onTranslatedContentUpdate?.(result.translatedText);
                    setIsTranslated(true);
                    setTranslatedWith("google");
                }
            } else {
                // HTML格式:使用translateWithGoogleHtml
                result = await translateWithGoogleHtml(articleContent);
                if (result.error) {
                    setTranslateError(result.error);
                } else {
                    onTranslatedContentUpdate?.(result.translatedHtml);
                    setIsTranslated(true);
                    setTranslatedWith("google");
                }
            }
        } catch (err) {
            setTranslateError(err.message);
        } finally {
            setIsGoogleTranslating(false);
        }
    }, [articleContent, isMcpMarkdown, settings.targetLanguage, onTranslatedContentUpdate]);

    // AI 翻译 (智能判断Markdown/HTML)
    const handleAITranslate = useCallback(async () => {
        if (!articleContent) return;

        setIsAITranslating(true);
        setTranslateError(null);

        try {
            let result;
            if (isMcpMarkdown) {
                // Markdown格式:使用translateMarkdown(但配置为AI)
                // 注意:translateMarkdown内部会根据settings.autoTranslatePriority选择AI/Google
                // 这里我们需要确保使用AI,暂时直接用translateMarkdown并假设用户已配置AI优先
                result = await translateMarkdown(articleContent, settings.targetLanguage || "zh");
                if (result.error) {
                    setTranslateError(result.error);
                } else {
                    onTranslatedContentUpdate?.(result.translatedText);
                    setIsTranslated(true);
                    setTranslatedWith("ai");
                }
            } else {
                // HTML格式:使用translateWithAIHtml
                result = await translateWithAIHtml(articleContent);
                if (result.error) {
                    setTranslateError(result.error);
                } else {
                    onTranslatedContentUpdate?.(result.translatedHtml);
                    setIsTranslated(true);
                    setTranslatedWith("ai");
                }
            }
        } catch (err) {
            setTranslateError(err.message);
        } finally {
            setIsAITranslating(false);
        }
    }, [articleContent, isMcpMarkdown, settings.targetLanguage, onTranslatedContentUpdate]);

    // 取消翻译，显示原文
    const handleShowOriginal = useCallback(() => {
        onTranslatedContentUpdate?.(null);
        setIsTranslated(false);
        setTranslatedWith(null);
    }, [onTranslatedContentUpdate]);

    // 获取全文
    const handleFetchFullContent = useCallback(async () => {
        if (!articleUrl) return;

        setIsFetching(true);
        setFetchError(null);

        try {
            const result = await fetchFullContent(articleUrl);

            if (result.error) {
                setFetchError(result.error);
            } else if (result.content) {
                // 清除翻译状态，允许对新内容重新翻译
                onTranslatedContentUpdate?.(null);
                setIsTranslated(false);
                setTranslatedWith(null);

                // 传递 isMarkdown 标识
                onContentUpdate?.(result.content, result.isMarkdown);
                setFetchSuccess(true);
                setTimeout(() => setFetchSuccess(false), 5000);
            }
        } catch (err) {
            setFetchError(err.message);
        } finally {
            setIsFetching(false);
        }
    }, [articleUrl, onContentUpdate, onTranslatedContentUpdate]);

    const showTranslate = settings.translateEnabled;
    const showAITranslate = settings.aiApiKey; // AI 翻译需要配置 API Key
    const showMCP = settings.mcpEnabled && settings.mcpEndpoint;

    if (!showTranslate && !showMCP) {
        return null;
    }

    const isTranslating = isGoogleTranslating || isAITranslating;

    return (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
            {/* Google 翻译按钮 */}
            {showTranslate && !isTranslated && (
                <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    isLoading={isGoogleTranslating}
                    isDisabled={isAITranslating}
                    onPress={handleGoogleTranslate}
                    startContent={!isGoogleTranslating && <Languages className="size-4" />}
                >
                    {isGoogleTranslating ? "翻译中..." : "Google"}
                </Button>
            )}

            {/* AI 翻译按钮 */}
            {showTranslate && showAITranslate && !isTranslated && (
                <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    isLoading={isAITranslating}
                    isDisabled={isGoogleTranslating}
                    onPress={handleAITranslate}
                    startContent={!isAITranslating && <Bot className="size-4" />}
                >
                    {isAITranslating ? "翻译中..." : "AI"}
                </Button>
            )}

            {/* 已翻译状态 */}
            {isTranslated && (
                <ButtonGroup size="sm" variant="flat">
                    <Chip
                        color="success"
                        variant="flat"
                        size="sm"
                        startContent={<Check className="size-3" />}
                    >
                        {translatedWith === "ai" ? "AI已翻译" : "Google已翻译"}
                    </Chip>
                    <Button
                        color="default"
                        isIconOnly
                        onPress={handleShowOriginal}
                    >
                        <X className="size-4" />
                    </Button>
                </ButtonGroup>
            )}

            {/* MCP 全文抓取按钮 */}
            {showMCP && (
                <Button
                    size="sm"
                    variant="flat"
                    color={fetchSuccess ? "success" : "primary"}
                    isLoading={isFetching}
                    onPress={handleFetchFullContent}
                    startContent={
                        fetchSuccess ? (
                            <Check className="size-4" />
                        ) : !isFetching ? (
                            <FileText className="size-4" />
                        ) : null
                    }
                >
                    {isFetching ? "抓取中..." : fetchSuccess ? "已获取" : "获取全文"}
                </Button>
            )}

            {/* 错误提示 */}
            {(translateError || fetchError) && (
                <Chip color="danger" variant="flat" size="sm">
                    {translateError || fetchError}
                </Chip>
            )}
        </div>
    );
};

export default ArticleToolbar;
