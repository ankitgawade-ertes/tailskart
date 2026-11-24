// Info pages edited in Admin → Info pages. When a page isn't published there,
// the store keeps showing the built-in text from data/content.ts.
import { serverGetSafe } from "./api";

export interface CmsPage {
  slug: string;
  title: string;
  body: string;
  updatedAt: string;
}

export type Block = { h?: string; h3?: string; p?: string; list?: string[] };

export const getCmsPage = (slug: string) => serverGetSafe<CmsPage | null>(`/pages/${encodeURIComponent(slug)}`, null, 60);

/** Admin text format: "## Heading", "### Sub-heading", "- bullet" lines, blank line between paragraphs. */
export function parseBlocks(body: string): Block[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .flatMap<Block>((b) => {
      const lines = b.split("\n");
      if (lines.every((l) => /^[-*] /.test(l))) return [{ list: lines.map((l) => l.slice(2).trim()) }];
      const out: Block[] = [];
      let para: string[] = [];
      const flush = () => {
        if (para.length) out.push({ p: para.join(" ") });
        para = [];
      };
      for (const l of lines) {
        if (l.startsWith("### ")) {
          flush();
          out.push({ h3: l.slice(4).trim() });
        } else if (/^#{1,2} /.test(l)) {
          flush();
          out.push({ h: l.replace(/^#{1,2} /, "").trim() });
        } else para.push(l.trim());
      }
      flush();
      return out;
    });
}

/** Splits **bold** runs for rendering. */
export const boldParts = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).map((s) => (s.startsWith("**") && s.endsWith("**") ? { b: true, t: s.slice(2, -2) } : { b: false, t: s }));

export const updatedLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
