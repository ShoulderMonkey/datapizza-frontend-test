'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Check, Copy } from 'lucide-react';
import { stripIncompleteTrailingTag } from './streamingMarkdown';

const SAFE_LINK = /^(https?:|mailto:)/i;

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose-content text-slate-800 dark:text-slate-100 leading-relaxed text-[15px] space-y-3.5 break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // Order matters: sanitize must run AFTER raw so parsed inline HTML is filtered.
        rehypePlugins={[rehypeRaw, [rehypeSanitize, defaultSchema]]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mt-4 mb-2 tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-3 mb-1.5 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mt-2.5 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 mb-2.5 marker:text-slate-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 mb-2.5 marker:text-slate-500 dark:marker:text-slate-400 font-medium">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-0.5 leading-normal">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500/80 bg-indigo-50/50 dark:bg-indigo-950/40 pl-3.5 py-1.5 my-2.5 rounded-r text-slate-700 dark:text-slate-300 italic text-[14px]">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="w-full overflow-x-auto my-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-50 dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors">{children}</tr>,
          th: ({ children }) => <th className="px-3.5 py-2.5 font-medium text-slate-700 dark:text-slate-300">{children}</th>,
          td: ({ children }) => <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{children}</td>,
          code: ({ className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const isInline = !codeClassName && typeof children === 'string' && !children.includes('\n');

            if (isInline) {
              return (
                <code
                  className="bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-200 dark:border-slate-700"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock language={match ? match[1] : ''}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          },
          a: ({ href, children }) => {
            const isSafe = typeof href === 'string' && SAFE_LINK.test(href.trim());
            return (
              <a
                href={isSafe ? href : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 underline font-medium"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {stripIncompleteTrailingTag(content)}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 text-slate-100 text-[13px] font-mono">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-800/80 border-b border-slate-700/80 text-xs text-slate-400">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer py-0.5 px-1.5 rounded bg-slate-700/50 hover:bg-slate-700"
          title="Copia codice"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copiato' : 'Copia'}</span>
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto">
        <pre className="m-0 leading-relaxed font-mono">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  );
}
