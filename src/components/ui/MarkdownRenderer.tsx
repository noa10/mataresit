/**
 * Reusable Markdown Renderer Component
 * 
 * Provides consistent markdown rendering across the application with
 * customizable styling for different contexts (chat, documentation, etc.)
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  variant?: 'chat' | 'documentation' | 'compact';
  className?: string;
}

export function MarkdownRenderer({ 
  content, 
  variant = 'chat', 
  className = '' 
}: MarkdownRendererProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'chat':
        return {
          container: 'prose prose-sm dark:prose-invert max-w-none',
          h1: 'text-lg font-bold mt-4 mb-2 first:mt-0',
          h2: 'text-base font-semibold mt-3 mb-2 first:mt-0',
          h3: 'text-sm font-medium mt-2 mb-1 first:mt-0',
          p: 'mb-2 last:mb-0 leading-relaxed',
          ul: 'mb-2 pl-4 space-y-1',
          ol: 'mb-2 pl-4 space-y-1',
          li: 'text-sm',
          code: 'bg-muted px-1 py-0.5 rounded text-xs font-mono',
          codeBlock: 'block bg-muted p-2 rounded text-xs font-mono overflow-x-auto',
          table: 'min-w-full border-collapse border border-border text-xs',
          th: 'border border-border px-2 py-1 text-left font-medium',
          td: 'border border-border px-2 py-1'
        };
      
      case 'documentation':
        return {
          container: 'prose prose-lg dark:prose-invert max-w-none',
          h1: 'text-3xl font-bold mt-8 mb-4 first:mt-0',
          h2: 'text-2xl font-semibold mt-6 mb-3 first:mt-0',
          h3: 'text-xl font-medium mt-4 mb-2 first:mt-0',
          p: 'mb-4 leading-relaxed',
          ul: 'mb-4 pl-6 space-y-2',
          ol: 'mb-4 pl-6 space-y-2',
          li: 'text-base',
          code: 'bg-muted px-2 py-1 rounded text-sm font-mono',
          codeBlock: 'block bg-muted p-4 rounded text-sm font-mono overflow-x-auto',
          table: 'min-w-full border-collapse border border-border',
          th: 'border border-border px-4 py-2 text-left font-semibold',
          td: 'border border-border px-4 py-2'
        };
      
      case 'compact':
        return {
          container: 'prose prose-xs dark:prose-invert max-w-none',
          h1: 'text-sm font-bold mt-2 mb-1 first:mt-0',
          h2: 'text-sm font-semibold mt-2 mb-1 first:mt-0',
          h3: 'text-xs font-medium mt-1 mb-1 first:mt-0',
          p: 'mb-1 last:mb-0 text-xs',
          ul: 'mb-1 pl-3 space-y-0.5',
          ol: 'mb-1 pl-3 space-y-0.5',
          li: 'text-xs',
          code: 'bg-muted px-1 py-0.5 rounded text-xs font-mono',
          codeBlock: 'block bg-muted p-2 rounded text-xs font-mono overflow-x-auto',
          table: 'min-w-full border-collapse border border-border text-xs',
          th: 'border border-border px-1 py-0.5 text-left font-medium',
          td: 'border border-border px-1 py-0.5'
        };
      
      default:
        return getVariantStyles(); // fallback to chat
    }
  };

  const styles = getVariantStyles();

  return (
    <div className={`${styles.container} ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className={styles.h1}>{children}</h1>,
          h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
          h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
          p: ({ children }) => <p className={styles.p}>{children}</p>,
          ul: ({ children }) => <ul className={styles.ul}>{children}</ul>,
          ol: ({ children }) => <ol className={styles.ol}>{children}</ol>,
          li: ({ children }) => <li className={styles.li}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/20 pl-3 italic text-muted-foreground mb-2">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className={styles.code}>{children}</code>
            ) : (
              <code className={styles.codeBlock}>{children}</code>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className={styles.table}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          th: ({ children }) => (
            <th className={styles.th}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={styles.td}>
              {children}
            </td>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          // Handle links with proper styling
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-primary hover:text-primary/80 underline break-words"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Handle horizontal rules
          hr: () => <hr className="my-4 border-border" />,
          // Handle images (if any)
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt}
              className="max-w-full h-auto rounded border border-border"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Specialized markdown renderer for chat messages with streaming support
 */
interface ChatMarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function ChatMarkdownRenderer({ 
  content, 
  isStreaming = false, 
  className = '' 
}: ChatMarkdownRendererProps) {
  if (isStreaming) {
    return (
      <p className={`text-sm mb-2 ${className}`}>
        {content}
        <span className="animate-pulse">|</span>
      </p>
    );
  }

  return (
    <MarkdownRenderer 
      content={content} 
      variant="chat" 
      className={className} 
    />
  );
}
