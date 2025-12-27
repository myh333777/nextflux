/**
 * Markdown 内容渲染组件
 * 用于渲染 MCP fetch 返回的 Markdown 格式内容
 */
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import CodeBlock from "./CodeBlock.jsx";
import ArticleImage from "./ArticleImage.jsx";

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

// 图片 URL 代理
const proxyImageUrl = (url) => {
    if (!url) return url;
    // 如果已经是代理 URL，不再处理
    if (url.startsWith('/api/image-proxy')) return url;
    // 如果是 data URL 或相对路径，不处理
    if (url.startsWith('data:') || url.startsWith('/')) return url;
    // 如果是占位符图片，返回空
    if (isPlaceholderImage(url)) return null;
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
};

const MarkdownContent = ({ content, className = "" }) => {
    // 自定义渲染组件
    const components = useMemo(() => ({
        // 代码块渲染 - 使用现有 CodeBlock 组件
        code({ node, inline, className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const language = match ? match[1] : 'text';
            const code = String(children).replace(/\n$/, '');

            if (!inline && code) {
                return <CodeBlock code={code} language={language} />;
            }
            // 行内代码
            return (
                <code className={codeClassName} {...props}>
                    {children}
                </code>
            );
        },
        // 图片渲染 - 使用代理并复用 ArticleImage
        img({ src, alt, ...props }) {
            const proxiedSrc = proxyImageUrl(src);
            if (!proxiedSrc) return null; // 跳过占位符图片

            // 构造类似 domNode 的结构给 ArticleImage
            const imgNode = {
                attribs: {
                    src: proxiedSrc,
                    alt: alt || '',
                    loading: 'lazy'
                }
            };
            return <ArticleImage imgNode={imgNode} />;
        },
        // 链接渲染 - 添加安全属性
        a({ href, children, ...props }) {
            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                >
                    {children}
                </a>
            );
        },
        // 表格容器 - 添加滚动支持
        table({ children, ...props }) {
            return (
                <div className="overflow-x-auto">
                    <table {...props}>{children}</table>
                </div>
            );
        }
    }), []);

    if (!content) return null;

    return (
        <ReactMarkdown
            className={className}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={components}
        >
            {content}
        </ReactMarkdown>
    );
};

export default MarkdownContent;
