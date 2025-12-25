import { useState, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { Button, Spinner, Chip } from "@heroui/react";
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { settingsState } from "@/stores/settingsStore";
import { summarizeArticle } from "@/api/ai";
import ReactMarkdown from "react-markdown";

const ArticleSummary = ({ content, title }) => {
    const { t } = useTranslation();
    const settings = useStore(settingsState);
    const [summary, setSummary] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const [hasGenerated, setHasGenerated] = useState(false);

    const handleGenerateSummary = useCallback(async () => {
        if (!content) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await summarizeArticle(content, title);

            if (result.error) {
                setError(result.error);
            } else {
                setSummary(result.summary);
                setHasGenerated(true);
            }
        } catch (err) {
            setError(err.message || "生成摘要失败");
        } finally {
            setIsLoading(false);
        }
    }, [content, title]);

    // 如果 AI 未启用，不显示组件
    if (!settings.aiEnabled) {
        return null;
    }

    return (
        <div className="mb-4 rounded-xl border border-default-200 bg-default-50 overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-default-100 transition-colors"
                onClick={() => hasGenerated && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-warning" />
                    <span className="font-medium text-sm">AI 摘要</span>
                    {hasGenerated && (
                        <Chip size="sm" variant="flat" color="success" className="text-xs">
                            已生成
                        </Chip>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {!hasGenerated ? (
                        <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            isLoading={isLoading}
                            onPress={handleGenerateSummary}
                            startContent={!isLoading && <Sparkles className="size-3" />}
                        >
                            {isLoading ? "生成中..." : "生成摘要"}
                        </Button>
                    ) : (
                        <>
                            <Button
                                size="sm"
                                variant="light"
                                isIconOnly
                                onPress={handleGenerateSummary}
                                isDisabled={isLoading}
                            >
                                <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
                            </Button>
                            {isExpanded ? (
                                <ChevronUp className="size-4 text-default-400" />
                            ) : (
                                <ChevronDown className="size-4 text-default-400" />
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="px-4 pb-4">
                    {isLoading && !summary && (
                        <div className="flex items-center justify-center py-8 gap-2 text-default-400">
                            <Spinner size="sm" />
                            <span className="text-sm">正在使用 AI 分析文章内容...</span>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-danger-50 text-danger text-sm">
                            <AlertCircle className="size-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {summary && (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{summary}</ReactMarkdown>
                        </div>
                    )}

                    {!isLoading && !summary && !error && (
                        <p className="text-sm text-default-400 py-2">
                            点击"生成摘要"按钮，使用 AI 快速了解文章要点
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default ArticleSummary;
