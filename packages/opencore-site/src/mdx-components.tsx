import type { ReactNode } from 'react';

type MDXComponentProps = {
  children?: ReactNode;
  [key: string]: unknown;
};

export function useMDXComponents(components: Record<string, unknown>) {
  return {
    h1: ({ children }: MDXComponentProps) => <h1 className="mt-10 text-4xl font-semibold tracking-tight text-white">{children}</h1>,
    h2: ({ children }: MDXComponentProps) => <h2 className="mt-8 text-2xl font-semibold tracking-tight text-white">{children}</h2>,
    p: ({ children }: MDXComponentProps) => <p className="mt-4 leading-7 text-slate-300">{children}</p>,
    a: ({ children, ...props }: MDXComponentProps) => (
      <a {...props} className="font-medium text-cyan-300 underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-200">
        {children}
      </a>
    ),
    ul: ({ children }: MDXComponentProps) => <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-300">{children}</ul>,
    li: ({ children }: MDXComponentProps) => <li>{children}</li>,
    blockquote: ({ children }: MDXComponentProps) => (
      <blockquote className="mt-6 border-l-2 border-cyan-400/50 pl-4 text-slate-200">{children}</blockquote>
    ),
    code: ({ children }: MDXComponentProps) => <code className="rounded bg-slate-950/80 px-1.5 py-0.5 text-sm text-cyan-200">{children}</code>,
    pre: ({ children }: MDXComponentProps) => <pre className="mt-4 overflow-x-auto rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4 text-sm text-slate-200 shadow-xl">{children}</pre>,
    ...components
  };
}
