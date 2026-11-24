import { boldParts, type Block } from "@/lib/cms";

const Inline = ({ text }: { text: string }) => (
  <>
    {boldParts(text).map((s, i) => (s.b ? <strong key={i}>{s.t}</strong> : <span key={i}>{s.t}</span>))}
  </>
);

/** Renders text written in Admin → Info pages with the store's prose styles. */
export function CmsBody({ blocks, className = "prose-tk" }: { blocks: Block[]; className?: string }) {
  return (
    <div className={className}>
      {blocks.map((b, i) =>
        b.h ? (
          <h2 key={i}>{b.h}</h2>
        ) : b.h3 ? (
          <h3 key={i}>{b.h3}</h3>
        ) : b.list ? (
          <ul key={i}>
            {b.list.map((l, k) => (
              <li key={k}><Inline text={l} /></li>
            ))}
          </ul>
        ) : (
          <p key={i}><Inline text={b.p ?? ""} /></p>
        ),
      )}
    </div>
  );
}
