import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Raw HTML in posts is NOT rendered (no rehype-raw) and react-markdown strips
// unsafe link protocols, so post content can never inject scripts.
const components: Components = {
  h1: ({ children }) => <h2 className="mt-8 text-2xl font-bold tracking-tight text-slate-900">{children}</h2>,
  h2: ({ children }) => <h2 className="mt-8 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 text-lg font-bold text-slate-900">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-5 text-base font-bold text-slate-900">{children}</h4>,
  p: ({ children }) => <p className="mt-4 text-[16px] leading-7 text-slate-700">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-1.5 pl-6 text-[16px] leading-7 text-slate-700">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-1.5 pl-6 text-[16px] leading-7 text-slate-700">{children}</ol>,
  a: ({ href, children }) => {
    const external = !!href && /^https?:\/\//i.test(href);
    return (
      <a href={href} className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800" {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => <blockquote className="mt-4 border-l-4 border-blue-200 bg-blue-50/50 py-1 pl-4 text-slate-700">{children}</blockquote>,
  // eslint-disable-next-line @next/next/no-img-element -- images in post content come from any URL
  img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" decoding="async" className="mt-5 w-full rounded-xl border border-slate-200" />,
  code: ({ children }) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[14px] text-slate-800">{children}</code>,
  pre: ({ children }) => <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-slate-100">{children}</pre>,
  hr: () => <hr className="my-8 border-slate-200" />,
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm text-slate-700">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-slate-200 px-3 py-2">{children}</td>,
};

export function BlogContent({ content }: { content: string }) {
  return (
    <div className="[&>*:first-child]:mt-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
