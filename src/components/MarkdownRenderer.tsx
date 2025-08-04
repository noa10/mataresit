import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Simple markdown to HTML converter for basic formatting
  const convertMarkdownToHtml = (markdown: string): string => {
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-4">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-6">$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg my-4 overflow-x-auto"><code class="text-sm">$1</code></pre>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-4">• $1</li>');
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4">• $1</li>');
    html = html.replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>');

    // Wrap consecutive list items
    html = html.replace(/(<li[^>]*>.*<\/li>\s*)+/g, '<ul class="space-y-2 my-4">$&</ul>');

    // Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-primary pl-4 italic my-4">$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^---$/gim, '<hr class="my-8 border-t border-gray-200 dark:border-gray-700" />');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p class="mb-4">');
    html = html.replace(/\n/g, '<br />');

    // Wrap in paragraphs
    html = `<p class="mb-4">${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p class="mb-4"><\/p>/g, '');

    return html;
  };

  const htmlContent = convertMarkdownToHtml(content);

  return (
    <div 
      className={`prose prose-gray dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

export default MarkdownRenderer;
