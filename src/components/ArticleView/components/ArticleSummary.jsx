import { useState, useCallback, useMemo } from "react";
import { useStore } from "@nanostores/react";
import { Button, Spinner, Chip, Accordion, AccordionItem, Checkbox } from "@heroui/react";
import { Sparkles, RefreshCw, AlertCircle, Copy, Check, Plus, Bookmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { settingsState } from "@/stores/settingsStore";
import { summarizeWithMultiplePrompts } from "@/api/ai";
import { saveToMemos, buildMemoContent } from "@/api/memos";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const ArticleSummary = ({ content, title, articleUrl }) => {
    const { t } = useTranslation();
    const settings = useStore(settingsState);

    // 多摘要结果
    const [summaries, setSummaries] = useState([]); // [{id, name, summary, error}]
    const [isLoading, setIsLoading] = useState(false);
    const [loadingPromptIds, setLoadingPromptIds] = useState([]); // 正在加载的提示词
    const [copiedId, setCopiedId] = useState(null);
    const [memosSaving, setMemosSaving] = useState(false);
    const [memosSaved, setMemosSaved] = useState(false);

    // 选中的提示词 ID
    const [selectedPromptIds, setSelectedPromptIds] = useState(["default"]);

    // 合并预设和自定义提示词
    const allPrompts = useMemo(() => {
        const presets = settings.aiPresetPrompts || [];
        const customs = settings.aiCustomPrompts || [];
        return [...presets, ...customs];
    }, [settings.aiPresetPrompts, settings.aiCustomPrompts]);

    // 获取选中的提示词详情
    const selectedPrompts = useMemo(() => {
        return allPrompts.filter(p => selectedPromptIds.includes(p.id));
    }, [allPrompts, selectedPromptIds]);

    // 获取还未生成的选中提示词
    const pendingPrompts = useMemo(() => {
        const generatedIds = summaries.map(s => s.id);
        return selectedPrompts.filter(p => !generatedIds.includes(p.id));
    }, [selectedPrompts, summaries]);

    const handleTogglePrompt = (promptId) => {
        setSelectedPromptIds(prev => {
            if (prev.includes(promptId)) {
                return prev.filter(id => id !== promptId);
            } else {
                return [...prev, promptId];
            }
        });
    };

    // 生成摘要（只生成还未生成的选中提示词）
    const handleGenerateSummary = useCallback(async () => {
        if (!content || pendingPrompts.length === 0) return;

        setIsLoading(true);
        setLoadingPromptIds(pendingPrompts.map(p => p.id));

        try {
            const results = await summarizeWithMultiplePrompts(content, title, pendingPrompts);
            // 追加到现有结果
            setSummaries(prev => [...prev, ...results]);
        } catch (err) {
            setSummaries(prev => [...prev, { id: "error-" + Date.now(), name: "错误", summary: "", error: err.message }]);
        } finally {
            setIsLoading(false);
            setLoadingPromptIds([]);
        }
    }, [content, title, pendingPrompts]);

    // 重新生成所有
    const handleRegenerateAll = useCallback(async () => {
        if (!content || selectedPrompts.length === 0) return;

        setIsLoading(true);
        setLoadingPromptIds(selectedPrompts.map(p => p.id));
        setSummaries([]);

        try {
            const results = await summarizeWithMultiplePrompts(content, title, selectedPrompts);
            setSummaries(results);
        } catch (err) {
            setSummaries([{ id: "error", name: "错误", summary: "", error: err.message }]);
        } finally {
            setIsLoading(false);
            setLoadingPromptIds([]);
        }
    }, [content, title, selectedPrompts]);

    const handleCopyMarkdown = useCallback(async (summary, id) => {
        if (!summary) return;
        try {
            await navigator.clipboard.writeText(summary);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error("复制失败:", err);
        }
    }, []);

    // 保存到 Memos
    const handleSaveToMemos = useCallback(async () => {
        if (summaries.length === 0) return;

        setMemosSaving(true);
        setMemosSaved(false);

        try {
            // 构建 Memos 内容
            const summaryData = summaries.map(s => ({
                promptName: s.name,
                content: s.summary
            }));
            const memoContent = buildMemoContent(title, articleUrl, summaryData);

            const result = await saveToMemos(memoContent);
            if (result.success) {
                setMemosSaved(true);
                setTimeout(() => setMemosSaved(false), 3000);
            } else {
                console.error("保存失败:", result.error);
            }
        } catch (err) {
            console.error("保存到 Memos 失败:", err);
        } finally {
            setMemosSaving(false);
        }
    }, [summaries, title, articleUrl]);

    // 如果 AI 未启用，不显示组件
    if (!settings.aiEnabled) {
        return null;
    }

    const hasResults = summaries.length > 0;
    const hasPending = pendingPrompts.length > 0;

    return (
        <div className="mb-4 rounded-xl border border-default-200 bg-default-50 overflow-hidden">
            {/* Header with prompt selector */}
            <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-warning" />
                        <span className="font-medium text-sm">AI 摘要</span>
                        {hasResults && (
                            <Chip size="sm" variant="flat" color="success" className="text-xs">
                                {summaries.length} 个结果
                            </Chip>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {hasResults && (
                            <Button
                                size="sm"
                                variant="light"
                                isIconOnly
                                onPress={handleRegenerateAll}
                                isDisabled={isLoading || selectedPrompts.length === 0}
                                title="重新生成全部"
                            >
                                <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
                            </Button>
                        )}
                        {hasResults && settings.memosEnabled && (
                            <Button
                                size="sm"
                                color={memosSaved ? "success" : "default"}
                                variant="flat"
                                isIconOnly
                                isLoading={memosSaving}
                                onPress={handleSaveToMemos}
                                title={memosSaved ? "已保存到 Memos" : "保存到 Memos"}
                            >
                                {memosSaved ? <Check className="size-4" /> : <Bookmark className="size-4" />}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            isLoading={isLoading}
                            isDisabled={!hasPending && !hasResults}
                            onPress={hasPending ? handleGenerateSummary : handleRegenerateAll}
                            startContent={!isLoading && (hasPending ? <Plus className="size-3" /> : <Sparkles className="size-3" />)}
                        >
                            {isLoading ? "生成中..." : hasPending ? `生成 (${pendingPrompts.length})` : "重新生成"}
                        </Button>
                    </div>
                </div>

                {/* 提示词选择器 - 始终显示 */}
                <div className="flex flex-wrap gap-2">
                    {allPrompts.map(prompt => {
                        const isSelected = selectedPromptIds.includes(prompt.id);
                        const isGenerated = summaries.some(s => s.id === prompt.id);
                        const isCurrentlyLoading = loadingPromptIds.includes(prompt.id);

                        return (
                            <Chip
                                key={prompt.id}
                                size="sm"
                                variant={isSelected ? "solid" : "bordered"}
                                color={isGenerated ? "success" : isSelected ? "primary" : "default"}
                                className="cursor-pointer select-none"
                                onClick={() => handleTogglePrompt(prompt.id)}
                                startContent={
                                    isCurrentlyLoading ? (
                                        <Spinner size="sm" className="size-3" />
                                    ) : isGenerated ? (
                                        <Check className="size-3" />
                                    ) : null
                                }
                            >
                                {prompt.name}
                            </Chip>
                        );
                    })}
                </div>
            </div>

            {/* Results */}
            {summaries.length > 0 && (
                <div className="px-4 pb-4 border-t border-default-200">
                    <Accordion
                        selectionMode="multiple"
                        defaultExpandedKeys={summaries.map(s => s.id)}
                        className="px-0 pt-2"
                    >
                        {summaries.map(item => (
                            <AccordionItem
                                key={item.id}
                                aria-label={item.name}
                                title={
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{item.name}</span>
                                        {item.error && (
                                            <Chip size="sm" color="danger" variant="flat">
                                                失败
                                            </Chip>
                                        )}
                                    </div>
                                }
                            >
                                {item.error ? (
                                    <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-danger-50 text-danger text-sm">
                                        <AlertCircle className="size-4 shrink-0" />
                                        <span>{item.error}</span>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm, remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                            >
                                                {item.summary}
                                            </ReactMarkdown>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-default-200">
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                color={copiedId === item.id ? "success" : "default"}
                                                onPress={() => handleCopyMarkdown(item.summary, item.id)}
                                                startContent={copiedId === item.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                                            >
                                                {copiedId === item.id ? "已复制" : "复制 Markdown"}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            )}

            {/* Empty state */}
            {!hasResults && !isLoading && (
                <div className="px-4 pb-4 border-t border-default-200">
                    <p className="text-sm text-default-400 py-2">
                        选择提示词后点击"生成"按钮
                    </p>
                </div>
            )}

            {/* Loading state */}
            {isLoading && summaries.length === 0 && (
                <div className="px-4 pb-4 border-t border-default-200">
                    <div className="flex items-center justify-center py-8 gap-2 text-default-400">
                        <Spinner size="sm" />
                        <span className="text-sm">正在并发生成 {loadingPromptIds.length} 个摘要...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArticleSummary;
