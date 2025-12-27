import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { Button, Textarea, Spinner, ScrollShadow } from "@heroui/react";
import { MessageCircle, X, Send, Trash2 } from "lucide-react";
import { settingsState } from "@/stores/settingsStore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const ChatBubble = ({ articleContent, articleTitle }) => {
    const settings = useStore(settingsState);
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // 清理 HTML 标签
    const stripHtml = (html) => {
        if (!html) return "";
        const doc = new DOMParser().parseFromString(html, "text/html");
        doc.querySelectorAll("script, style, noscript").forEach(el => el.remove());
        return doc.body.textContent || "";
    };

    // 滚动到底部
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 聊天框打开时聚焦输入框
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // 文章变化时清空历史
    useEffect(() => {
        setMessages([]);
    }, [articleTitle]);

    // 发送消息
    const handleSend = useCallback(async () => {
        if (!input.trim() || isLoading || !settings.aiApiKey) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const plainText = stripHtml(articleContent);
            const truncatedContent = plainText.length > 6000
                ? plainText.substring(0, 6000) + "..."
                : plainText;

            const systemPrompt = `你是一个智能阅读助手。用户正在阅读一篇文章，请根据文章内容回答用户的问题。

文章标题：${articleTitle || "未知"}

文章内容：
${truncatedContent}

请用中文回复，回答要简洁准确。`;

            const apiMessages = [
                { role: "system", content: systemPrompt },
                ...messages.map(m => ({ role: m.role, content: m.content })),
                { role: "user", content: userMessage }
            ];

            const response = await fetch(settings.aiEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${settings.aiApiKey}`
                },
                body: JSON.stringify({
                    model: settings.aiModel,
                    messages: apiMessages,
                    max_tokens: 2000,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const assistantMessage = data.choices?.[0]?.message?.content?.trim() || "抱歉，无法生成回复";

            setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);
        } catch (error) {
            setMessages(prev => [...prev, {
                role: "assistant",
                content: `错误：${error.message}`
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, settings, articleContent, articleTitle, messages]);

    // 清空历史
    const handleClear = () => {
        setMessages([]);
    };

    // 按 Enter 发送
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // 如果 AI 未启用，不显示
    if (!settings.aiEnabled || !settings.aiApiKey) {
        return null;
    }

    return (
        <>
            {/* 聊天气泡按钮 */}
            <Button
                isIconOnly
                color="primary"
                size="lg"
                radius="full"
                className="fixed bottom-6 right-6 z-50 shadow-lg"
                onPress={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <X className="size-5" /> : <MessageCircle className="size-5" />}
            </Button>

            {/* 聊天框 */}
            {isOpen && (
                <div className="fixed bottom-20 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] bg-background border border-default-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                    {/* 头部 */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-default-200 bg-default-50">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="size-4 text-primary" />
                            <span className="font-medium text-sm">AI 问答助手</span>
                        </div>
                        <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            onPress={handleClear}
                            title="清空对话"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>

                    {/* 消息列表 */}
                    <ScrollShadow className="flex-1 p-4 overflow-y-auto">
                        {messages.length === 0 && (
                            <div className="text-center text-default-400 text-sm py-8">
                                <p>👋 你好！我是 AI 助手</p>
                                <p className="mt-2">可以对当前文章提问</p>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}
                            >
                                <div
                                    className={`inline-block max-w-[85%] px-3 py-2 rounded-xl text-sm ${msg.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-default-100"
                                        }`}
                                >
                                    {msg.role === "assistant" ? (
                                        <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm, remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-default-400 text-sm">
                                <Spinner size="sm" />
                                <span>思考中...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </ScrollShadow>

                    {/* 输入框 */}
                    <div className="p-3 border-t border-default-200 bg-default-50">
                        <div className="flex items-end gap-2">
                            <Textarea
                                ref={inputRef}
                                placeholder="输入问题..."
                                value={input}
                                onValueChange={setInput}
                                onKeyDown={handleKeyDown}
                                minRows={1}
                                maxRows={3}
                                className="flex-1"
                                disabled={isLoading}
                            />
                            <Button
                                isIconOnly
                                color="primary"
                                onPress={handleSend}
                                isLoading={isLoading}
                                isDisabled={!input.trim()}
                            >
                                <Send className="size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatBubble;
