import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { defaultSchema, type Schema } from 'hast-util-sanitize'

const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'u', 's', 'sub', 'sup', 'span'],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./]],
  },
}

interface MarkdownContentProps {
  content: string
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 space-y-2 break-words text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          table: ({ children }) => (
            <div className="my-1 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-xs [&_td]:whitespace-normal">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-slate-200 px-3 py-1.5 text-left font-semibold whitespace-nowrap text-slate-700">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-slate-100 px-3 py-1.5 align-top">{children}</td>,
          tr: ({ children }) => <tr className="even:bg-slate-50">{children}</tr>,
          p: ({ children }) => <p className="break-words">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed marker:text-slate-400">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-semibold text-slate-900">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold text-slate-900">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-900">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold text-slate-900">{children}</h4>,
          h5: ({ children }) => <h5 className="text-sm font-semibold text-slate-900">{children}</h5>,
          h6: ({ children }) => <h6 className="text-sm font-semibold text-slate-900">{children}</h6>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-600">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-slate-200" />,
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100 [&_code]:bg-transparent [&_code]:px-0 [&_code]:py-0 [&_code]:text-inherit">
              {children}
            </pre>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">
                {children}
              </code>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
