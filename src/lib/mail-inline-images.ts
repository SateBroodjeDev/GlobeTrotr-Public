export type InlineMailImage = { contentId: string; url: string };

/** Replaces only image src="cid:..." references with short-lived links for scanned attachments. */
export function resolveInlineMailImages(html: string, images: InlineMailImage[]) {
  const byId = new Map(images.map((image) => [image.contentId.replace(/^<|>$/g, "").toLowerCase(), image.url]));
  return html.replace(/<img\b[^>]*>/gi, (tag) => tag.replace(/\bsrc\s*=\s*(["'])(cid:[^"']+)\1/i, (attribute, quote: string, source: string) => {
    const id = source.slice(4).replace(/^<|>$/g, "").toLowerCase();
    const url = byId.get(id);
    return url ? `src=${quote}${url.replaceAll("&", "&amp;").replaceAll(quote, quote === '"' ? "&quot;" : "&#39;")}${quote}` : attribute;
  }));
}
