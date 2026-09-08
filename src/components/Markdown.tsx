import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCallout from "@/lib/remark-callout";

export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkCallout]}
      components={{
        a: ({ href, children, ...rest }) => {
          const external = !!href && /^https?:\/\//i.test(href);
          return (
            <a
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              {...rest}
            >
              {children}
            </a>
          );
        },
        table: ({ children, ...rest }) => (
          <div className="prose-scroll">
            <table {...rest}>{children}</table>
          </div>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
