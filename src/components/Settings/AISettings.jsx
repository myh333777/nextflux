import { useState, useRef, useCallback } from "react";
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
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    Card,
    CardBody,
} from "@heroui/react";
import { Sparkles, Languages, FileText, Check, X, Plus, Trash2, Edit, Download, Upload, List, RefreshCw, Bookmark } from "lucide-react";
import { settingsState, updateSettings } from "@/stores/settingsStore";
import { testAIConnection, fetchModels } from "@/api/ai";
import { testMCPConnection } from "@/api/mcp";
import { testMemosConnection } from "@/api/memos";

const AISettings = () => {
    const settings = useStore(settingsState);
    const [aiTestResult, setAiTestResult] = useState(null);
    const [aiTesting, setAiTesting] = useState(false);
    const [mcpTestResult, setMcpTestResult] = useState(null);
    const [mcpTesting, setMcpTesting] = useState(false);
    const [memosTestResult, setMemosTestResult] = useState(null);
    const [memosTesting, setMemosTesting] = useState(false);

    // 提示词管理
    const { isOpen: isPromptOpen, onOpen: onPromptOpen, onClose: onPromptClose } = useDisclosure();
    const [editingPrompt, setEditingPrompt] = useState(null);
    const [promptName, setPromptName] = useState("");
    const [promptContent, setPromptContent] = useState("");

    // 模型列表
    const [models, setModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsError, setModelsError] = useState(null);

    // 配置导入导出
    const fileInputRef = useRef(null);

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

    // 测试 Memos 连接
    const handleTestMemos = async () => {
        setMemosTesting(true);
        setMemosTestResult(null);
        const result = await testMemosConnection();
        setMemosTestResult(result);
        setMemosTesting(false);
    };

    // 获取模型列表
    const handleFetchModels = async () => {
        setModelsLoading(true);
        setModelsError(null);
        const result = await fetchModels();
        if (result.error) {
            setModelsError(result.error);
            setModels([]);
        } else {
            setModels(result.models);
        }
        setModelsLoading(false);
    };

    // 添加新提示词
    const handleAddPrompt = () => {
        setEditingPrompt(null);
        setPromptName("");
        setPromptContent("");
        onPromptOpen();
    };

    // 编辑提示词
    const handleEditPrompt = (prompt) => {
        setEditingPrompt(prompt);
        setPromptName(prompt.name);
        setPromptContent(prompt.prompt);
        onPromptOpen();
    };

    // 保存提示词
    const handleSavePrompt = () => {
        if (!promptName.trim() || !promptContent.trim()) return;

        const newPrompt = {
            id: editingPrompt?.id || `custom-${Date.now()}`,
            name: promptName.trim(),
            prompt: promptContent.trim(),
        };

        if (editingPrompt) {
            // 更新现有提示词
            const isPreset = (settings.aiPresetPrompts || []).some(p => p.id === editingPrompt.id);
            if (isPreset) {
                const updated = (settings.aiPresetPrompts || []).map(p =>
                    p.id === editingPrompt.id ? { ...p, ...newPrompt } : p
                );
                updateSettings({ aiPresetPrompts: updated });
            } else {
                const updated = (settings.aiCustomPrompts || []).map(p =>
                    p.id === editingPrompt.id ? newPrompt : p
                );
                updateSettings({ aiCustomPrompts: updated });
            }
        } else {
            // 添加新提示词
            updateSettings({
                aiCustomPrompts: [...(settings.aiCustomPrompts || []), newPrompt],
            });
        }

        onPromptClose();
    };

    // 删除自定义提示词
    const handleDeletePrompt = (promptId) => {
        const updated = (settings.aiCustomPrompts || []).filter(p => p.id !== promptId);
        updateSettings({ aiCustomPrompts: updated });
    };

    // 导出配置
    const handleExportConfig = useCallback(() => {
        const config = {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            settings: settings,
        };
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nextflux-config-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [settings]);

    // 导入配置
    const handleImportConfig = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target.result);
                if (config.settings) {
                    updateSettings(config.settings);
                    alert("配置导入成功！");
                } else {
                    alert("无效的配置文件格式");
                }
            } catch (err) {
                alert("配置文件解析失败: " + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    }, []);

    // 获取所有提示词
    const allPrompts = [...(settings.aiPresetPrompts || []), ...(settings.aiCustomPrompts || [])];

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

                        {/* 摘要模型 */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    {models.length > 0 ? (
                                        <Select
                                            label="摘要模型"
                                            selectedKeys={settings.aiModel ? [settings.aiModel] : []}
                                            onSelectionChange={(keys) => {
                                                const value = Array.from(keys)[0];
                                                if (value) updateSettings({ aiModel: value });
                                            }}
                                        >
                                            {models.map((model) => (
                                                <SelectItem key={model.id} value={model.id}>
                                                    {model.name}
                                                </SelectItem>
                                            ))}
                                        </Select>
                                    ) : (
                                        <Input
                                            label="摘要模型"
                                            placeholder="gpt-4o-mini"
                                            value={settings.aiModel}
                                            onValueChange={(value) => updateSettings({ aiModel: value })}
                                        />
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    isIconOnly
                                    isLoading={modelsLoading}
                                    onPress={handleFetchModels}
                                    className="mt-6"
                                    title="获取模型列表"
                                >
                                    <RefreshCw className="size-4" />
                                </Button>
                            </div>
                            {modelsError && (
                                <p className="text-xs text-danger">{modelsError}</p>
                            )}
                            <p className="text-xs text-default-400">
                                点击刷新按钮自动获取模型列表，或手动输入模型名称
                            </p>
                        </div>

                        {/* 翻译模型 */}
                        <div className="space-y-2">
                            {models.length > 0 ? (
                                <Select
                                    label="翻译模型（可选）"
                                    selectedKeys={settings.aiTranslateModel ? [settings.aiTranslateModel] : []}
                                    onSelectionChange={(keys) => {
                                        const value = Array.from(keys)[0];
                                        updateSettings({ aiTranslateModel: value || "" });
                                    }}
                                >
                                    <SelectItem key="" value="">
                                        与摘要模型相同
                                    </SelectItem>
                                    {models.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                            {model.name}
                                        </SelectItem>
                                    ))}
                                </Select>
                            ) : (
                                <Input
                                    label="翻译模型（可选）"
                                    placeholder="留空则使用摘要模型"
                                    value={settings.aiTranslateModel || ""}
                                    onValueChange={(value) => updateSettings({ aiTranslateModel: value })}
                                />
                            )}
                            <p className="text-xs text-default-400">
                                可为翻译指定不同的模型，留空则使用摘要模型
                            </p>
                        </div>

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

            {/* 提示词管理 */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <List className="size-5 text-success" />
                        <h3 className="text-lg font-semibold">提示词管理</h3>
                    </div>
                    <Button
                        size="sm"
                        color="success"
                        variant="flat"
                        startContent={<Plus className="size-4" />}
                        onPress={handleAddPrompt}
                    >
                        新增提示词
                    </Button>
                </div>

                <div className="space-y-2">
                    {allPrompts.map((prompt) => {
                        const isPreset = (settings.aiPresetPrompts || []).some(p => p.id === prompt.id);
                        return (
                            <Card key={prompt.id} className="bg-default-50">
                                <CardBody className="flex flex-row items-center justify-between py-2 px-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{prompt.name}</span>
                                        {isPreset && (
                                            <Chip size="sm" variant="flat" color="default">预设</Chip>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="light"
                                            isIconOnly
                                            onPress={() => handleEditPrompt(prompt)}
                                        >
                                            <Edit className="size-4" />
                                        </Button>
                                        {!isPreset && (
                                            <Button
                                                size="sm"
                                                variant="light"
                                                color="danger"
                                                isIconOnly
                                                onPress={() => handleDeletePrompt(prompt.id)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
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

                        <Input
                            type="number"
                            label="翻译并发数"
                            placeholder="20"
                            value={String(settings.translateConcurrency || 20)}
                            onValueChange={(value) => updateSettings({ translateConcurrency: parseInt(value) || 20 })}
                            description="同时翻译的段落数，增加可加快速度但可能触发限流"
                        />

                        <Switch
                            isSelected={settings.autoTranslateEnglish}
                            onValueChange={(value) => updateSettings({ autoTranslateEnglish: value })}
                            size="sm"
                        >
                            自动翻译英文内容
                        </Switch>

                        {settings.autoTranslateEnglish && (
                            <Select
                                size="sm"
                                label="自动翻译优先级"
                                selectedKeys={[settings.autoTranslatePriority || "google"]}
                                onChange={(e) => updateSettings({ autoTranslatePriority: e.target.value })}
                                description="选择自动翻译时优先使用的翻译服务"
                            >
                                <SelectItem key="google" value="google">Google 翻译（服务器代理）</SelectItem>
                                <SelectItem key="ai" value="ai">AI 翻译</SelectItem>
                            </Select>
                        )}

                        <Switch
                            isSelected={settings.translateListItems}
                            onValueChange={(value) => updateSettings({ translateListItems: value })}
                            size="sm"
                        >
                            翻译列表标题和摘要（滚动时翻译）
                        </Switch>
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
                        <Select
                            label="MCP 服务提供商"
                            selectedKeys={
                                [settings.mcpEndpoint].filter(k =>
                                    k === "http://usa2.190904.xyz:8766/mcp" ||
                                    k === "https://url2md-pro.deno.dev"
                                ).length > 0
                                    ? [settings.mcpEndpoint]
                                    : ["custom"]
                            }
                            onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0];
                                if (value && value !== "custom") {
                                    updateSettings({ mcpEndpoint: value });
                                }
                            }}
                        >
                            <SelectItem key="http://usa2.190904.xyz:8766/mcp" value="http://usa2.190904.xyz:8766/mcp">
                                标准 MCP 服务 (Default)
                            </SelectItem>
                            <SelectItem key="https://url2md-pro.deno.dev" value="https://url2md-pro.deno.dev">
                                URL2MD Pro (Alternative)
                            </SelectItem>
                            <SelectItem key="custom" value="custom">
                                自定义地址
                            </SelectItem>
                        </Select>

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

                        <Switch
                            isSelected={settings.mcpAutoFetch}
                            onValueChange={(value) => updateSettings({ mcpAutoFetch: value })}
                            size="sm"
                        >
                            内容少于200字时自动获取全文
                        </Switch>

                        <Switch
                            isSelected={settings.autoTranslateAfterFetch}
                            onValueChange={(value) => updateSettings({ autoTranslateAfterFetch: value })}
                            size="sm"
                        >
                            获取全文后自动翻译
                        </Switch>
                    </div>
                )}
            </div>

            <Divider />

            {/* Memos 保存设置 */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bookmark className="size-5 text-success" />
                        <h3 className="text-lg font-semibold">Memos 保存</h3>
                    </div>
                    <Switch
                        isSelected={settings.memosEnabled}
                        onValueChange={(value) => updateSettings({ memosEnabled: value })}
                    />
                </div>

                <p className="text-sm text-default-500">
                    将 AI 摘要保存到 Memos 笔记服务
                </p>

                {settings.memosEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-default-200">
                        <Input
                            label="Memos 地址"
                            placeholder="https://memos.example.com"
                            value={settings.memosEndpoint}
                            onValueChange={(value) => updateSettings({ memosEndpoint: value })}
                            description="你的 Memos 服务地址"
                        />

                        <Input
                            label="Access Token"
                            type="password"
                            placeholder="你的 Memos Token"
                            value={settings.memosToken}
                            onValueChange={(value) => updateSettings({ memosToken: value })}
                            description="在 Memos 设置中生成 Access Token"
                        />

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                isLoading={memosTesting}
                                onPress={handleTestMemos}
                            >
                                测试连接
                            </Button>
                            {memosTestResult && (
                                <Chip
                                    color={memosTestResult.success ? "success" : "danger"}
                                    variant="flat"
                                    startContent={
                                        memosTestResult.success ? (
                                            <Check className="size-3" />
                                        ) : (
                                            <X className="size-3" />
                                        )
                                    }
                                >
                                    {memosTestResult.success
                                        ? `连接成功 (${memosTestResult.user})`
                                        : memosTestResult.error}
                                </Chip>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Divider />

            {/* 配置导入导出 */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Download className="size-5 text-warning" />
                    <h3 className="text-lg font-semibold">配置管理</h3>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<Download className="size-4" />}
                        onPress={handleExportConfig}
                    >
                        导出配置
                    </Button>
                    <Button
                        size="sm"
                        color="secondary"
                        variant="flat"
                        startContent={<Upload className="size-4" />}
                        onPress={() => fileInputRef.current?.click()}
                    >
                        导入配置
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleImportConfig}
                    />
                </div>
                <p className="text-xs text-default-400">
                    导出的配置包含所有设置项（包括 API Key），请妥善保管
                </p>
            </div>

            {/* 提示词编辑弹窗 */}
            <Modal isOpen={isPromptOpen} onClose={onPromptClose} size="2xl">
                <ModalContent>
                    <ModalHeader>
                        {editingPrompt ? "编辑提示词" : "新增提示词"}
                    </ModalHeader>
                    <ModalBody>
                        <Input
                            label="提示词名称"
                            placeholder="如：📊 数据分析"
                            value={promptName}
                            onValueChange={setPromptName}
                        />
                        <Textarea
                            label="提示词内容"
                            placeholder="请输入提示词内容..."
                            value={promptContent}
                            onValueChange={setPromptContent}
                            minRows={8}
                            maxRows={15}
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onPromptClose}>
                            取消
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleSavePrompt}
                            isDisabled={!promptName.trim() || !promptContent.trim()}
                        >
                            保存
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
};

export default AISettings;
