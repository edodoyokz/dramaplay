import { useEffect } from "react";

// ponytail: client-side head updates, no SSR needed — Google renders JS
// and most crawlers can execute JavaScript.
export function SeoHead({
  title,
  description,
  canonical,
  ogImage,
  noindex,
}: {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}) {
  useEffect(() => {
    const t = `${title} — Dramaplay`;
    document.title = t;
    setMeta("og:title", t);
    setMeta("twitter:title", t);
    if (description != null) {
      setMeta("description", description);
      setMeta("og:description", description);
      setMeta("twitter:description", description);
    }
    if (ogImage != null) {
      setMeta("og:image", ogImage);
      setMeta("twitter:image", ogImage);
      setMeta("twitter:card", "summary_large_image");
    }
    if (canonical != null) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
      setMeta("og:url", canonical);
    }
    if (noindex) {
      setMeta("robots", "noindex, nofollow");
    }
  }, [title, description, canonical, ogImage, noindex]);
  return null;
}

function setMeta(name: string, content: string) {
  const existing = document.querySelector<HTMLMetaElement>(
    `meta[name="${name}"], meta[property="${name}"]`
  );
  if (existing) {
    existing.content = content;
  } else {
    const el = document.createElement("meta");
    el.setAttribute(name.startsWith("og:") ? "property" : "name", name);
    el.content = content;
    document.head.appendChild(el);
  }
}
