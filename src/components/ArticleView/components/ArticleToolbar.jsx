import { useState, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { Button, ButtonGroup, Tooltip, Spinner, Chip } from "@heroui/react";
import { Languages, FileText, X, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { settingsState } from "@/stores/settingsStore";
import { translateHtml } from "@/api/translate";
import { fetchFullContent } from "@/api/mcp";

const ArticleToolbar = ({
    articleUrl,
    articleContent,
    onContentUpdate,
    onTranslatedContentUpdate
}) => {
    const { t } = useTranslation();
    const settings = useStore(settingsState);

    // 翻译状态
    const [isTranslating, setIsTranslating] = useState(false);
    const [isTranslated, setIsTranslated] = useState(false);
    const [translateError, setTranslateError] = useState(null);

    // 全文抓取状态
    const [isFetching, setIsFetching] = useState(false);
    const [fetchSuccess, setFetchSuccess] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    // 翻译文章
    const handleTranslate = useCallback(async () => {
        if (!articleContent) return;

        setIsTranslating(true);
        setTranslateError(null);

        try {
            const result = await translateHtml(articleContent);

            if (result.error) {
                setTranslateError(result.error);
            } else {
                onTranslatedContentUpdate?.(result.translatedHtml);
                setIsTranslated(true);
            }
        } catch (err) {
            setTranslateError(err.message);
        } finally {
            setIsTranslating(false);
        }
    }, [articleContent, onTranslatedContentUpdate]);

    // 取消翻译，显示原文
    const handleShowOriginal = useCallback(() => {
        onTranslatedContentUpdate?.(null);
        setIsTranslated(false);
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
                onContentUpdate?.(result.content);
                setFetchSuccess(true);
                // 5秒后重置成功状态
                setTimeout(() => setFetchSuccess(false), 5000);
            }
        } catch (err) {
            setFetchError(err.message);
        } finally {
            setIsFetching(false);
        }
    }, [articleUrl, onContentUpdate]);

    const showTranslate = settings.translateEnabled && settings.aiApiKey;
    const showMCP = settings.mcpEnabled && settings.mcpEndpoint;

    if (!showTranslate && !showMCP) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
            {/* 翻译按钮 */}
            {showTranslate && (
                <ButtonGroup size="sm" variant="flat">
                    {!isTranslated ? (
                        <Tooltip content="翻译文章内容">
                            <Button
                                color="secondary"
                                isLoading={isTranslating}
                                onPress={handleTranslate}
                                startContent={!isTranslating && <Languages className="size-4" />}
                            >
                                {isTranslating ? "翻译中..." : "翻译"}
                            </Button>
                        </Tooltip>
                    ) : (
                        <>
                            <Chip color="success" variant="flat" size="sm" startContent={<Check className="size-3" />}>
                                已翻译
                            </Chip>
                            <Tooltip content="显示原文">
                                <Button
                                    color="default"
                                    isIconOnly
                                    onPress={handleShowOriginal}
                                >
                                    <X className="size-4" />
                                </Button>
                            </Tooltip>
                        </>
                    )}
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
