import { useState } from "react";
import { useStore } from "@nanostores/react";
import {
    Input,
    Switch,
    Select,
    SelectItem,
    Button,
    Chip,
    Divider,
    Textarea,
} from "@heroui/react";
import { Sparkles, Languages, FileText, Check, X } from "lucide-react";
import { settingsState, updateSettings } from "@/stores/settingsStore";
import { testAIConnection } from "@/api/ai";
import { testMCPConnection } from "@/api/mcp";

const AISettings = () => {
    const settings = useStore(settingsState);
    const [aiTestResult, setAiTestResult] = useState(null);
    const [aiTesting, setAiTesting] = useState(false);
    const [mcpTestResult, setMcpTestResult] = useState(null);
    const [mcpTesting, setMcpTesting] = useState(false);

    // 目标语言选项
    const languages = [
        { label: "中文", value: "zh" },
        { label: "English", value: "en" },
        { label: "日本語", value: "ja" },
        { label: "한국어", value: "ko" },
        { label: "Français", value: "fr" },
        { label: "Deutsch", value: "de" },
    ];

    // 测试 AI 连接
    const handleTestAI = async () => {
        setAiTesting(true);
        setAiTestResult(null);
        const result = await testAIConnection();
        setAiTestResult(result);
        setAiTesting(false);
    };

    // 测试 MCP 连接
    const handleTestMCP = async () => {
        setMcpTesting(true);
        setMcpTestResult(null);
        const result = await testMCPConnection();
        setMcpTestResult(result);
        setMcpTesting(false);
    };

    return (
        <div className="space-y-6">
            {/* AI 总结设置 */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="size-5 text-warning" />
                    <h3 className="text-lg font-semibold">AI 总结</h3>
                </div>

                <Switch
                    isSelected={settings.aiEnabled}
                    onValueChange={(value) => updateSettings({ aiEnabled: value })}
                >
                    启用 AI 总结
                </Switch>

                {settings.aiEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-default-200">
                        <Input
                            label="API Endpoint"
                            placeholder="https://api.openai.com/v1/chat/completions"
                            value={settings.aiEndpoint}
                            onValueChange={(value) => updateSettings({ aiEndpoint: value })}
                            description="OpenAI 兼容 API 地址"
                        />

                        <Input
                            type="password"
                            label="API Key"
                            placeholder="sk-..."
                            value={settings.aiApiKey}
                            onValueChange={(value) => updateSettings({ aiApiKey: value })}
                        />

                        <Input
                            label="模型"
                            placeholder="gpt-4o-mini"
                            value={settings.aiModel}
                            onValueChange={(value) => updateSettings({ aiModel: value })}
                            description="填写模型名称，如 gpt-4o-mini, deepseek-chat, claude-3-5-sonnet-20241022"
                        />

                        <Textarea
                            label="摘要提示词"
                            placeholder="请用中文简洁地总结以下文章内容..."
                            value={settings.aiSummaryPrompt}
                            onValueChange={(value) => updateSettings({ aiSummaryPrompt: value })}
                            minRows={2}
                        />

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                isLoading={aiTesting}
                                onPress={handleTestAI}
                            >
                                测试连接
                            </Button>
                            {aiTestResult && (
                                <Chip
                                    color={aiTestResult.success ? "success" : "danger"}
                                    variant="flat"
                                    startContent={
                                        aiTestResult.success ? (
                                            <Check className="size-3" />
                                        ) : (
                                            <X className="size-3" />
                                        )
                                    }
                                >
                                    {aiTestResult.success ? "连接成功" : aiTestResult.error}
                                </Chip>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Divider />

            {/* 翻译设置 */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Languages className="size-5 text-secondary" />
                    <h3 className="text-lg font-semibold">自动翻译</h3>
                </div>

                <Switch
                    isSelected={settings.translateEnabled}
                    onValueChange={(value) => updateSettings({ translateEnabled: value })}
                >
                    启用翻译功能
                </Switch>

                {settings.translateEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-default-200">
                        <Select
                            label="翻译服务"
                            selectedKeys={[settings.translateProvider]}
                            onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0];
                                if (value) updateSettings({ translateProvider: value });
                            }}
                            description={
                                settings.translateProvider === "ai"
                                    ? "使用上方配置的 AI API 进行翻译"
                                    : "使用 Google 翻译（无需配置）"
                            }
                        >
                            <SelectItem key="ai" value="ai">
                                AI 翻译
                            </SelectItem>
                            <SelectItem key="google" value="google">
                                Google 翻译
                            </SelectItem>
                        </Select>

                        <Select
                            label="目标语言"
                            selectedKeys={[settings.targetLanguage]}
                            onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0];
                                if (value) updateSettings({ targetLanguage: value });
                            }}
                        >
                            {languages.map((lang) => (
                                <SelectItem key={lang.value} value={lang.value}>
                                    {lang.label}
                                </SelectItem>
                            ))}
                        </Select>

                        <Select
                            label="显示模式"
                            selectedKeys={[settings.translateDisplayMode || 'bilingual']}
                            onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0];
                                if (value) updateSettings({ translateDisplayMode: value });
                            }}
                            description="双语对照会保留原文，在每段下方显示译文"
                        >
                            <SelectItem key="bilingual" value="bilingual">
                                双语对照
                            </SelectItem>
                            <SelectItem key="translated" value="translated">
                                仅显示译文
                            </SelectItem>
                        </Select>
                    </div>
                )}
            </div>

            <Divider />

            {/* MCP 全文抓取设置 */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">全文获取 (MCP)</h3>
                </div>

                <Switch
                    isSelected={settings.mcpEnabled}
                    onValueChange={(value) => updateSettings({ mcpEnabled: value })}
                >
                    启用 MCP 全文获取
                </Switch>

                {settings.mcpEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-default-200">
                        <Input
                            label="MCP Endpoint"
                            placeholder="http://192.168.1.x:8765/mcp"
                            value={settings.mcpEndpoint}
                            onValueChange={(value) => updateSettings({ mcpEndpoint: value })}
                            description="MCP 付费墙绕过服务地址"
                        />

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                isLoading={mcpTesting}
                                onPress={handleTestMCP}
                            >
                                测试连接
                            </Button>
                            {mcpTestResult && (
                                <Chip
                                    color={mcpTestResult.success ? "success" : "danger"}
                                    variant="flat"
                                    startContent={
                                        mcpTestResult.success ? (
                                            <Check className="size-3" />
                                        ) : (
                                            <X className="size-3" />
                                        )
                                    }
                                >
                                    {mcpTestResult.success
                                        ? `连接成功 (${mcpTestResult.toolCount} 工具)`
                                        : mcpTestResult.error}
                                </Chip>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AISettings;
