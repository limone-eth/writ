import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCallout from "@/lib/remark-callout";
import remarkHeadingIds from "@/lib/remark-heading-ids";

export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkCallout, remarkHeadingIds]}
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
        // A picture on a line of its own is a figure, not a paragraph. Its
        // Markdown alt text becomes the visible caption, which is why the
        // image itself is left with an empty alt: a screen reader would
        // otherwise read the same words twice.
        p: ({ children, node, ...rest }) => {
          const only = node?.children.length === 1 ? node.children[0] : null;
          if (only?.type === "element" && only.tagName === "img") {
            const src = String(only.properties?.src ?? "");
            const caption = String(only.properties?.alt ?? "").trim();
            return (
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" decoding="async" />
                {caption && <figcaption>{caption}</figcaption>}
              </figure>
            );
          }
          return <p {...rest}>{children}</p>;
        },
        // An image inside a sentence stays inline.
        img: ({ src, alt, node: _node, ...rest }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={typeof src === "string" ? src : undefined}
            alt={alt ?? ""}
            loading="lazy"
            decoding="async"
            {...rest}
          />
        ),
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
