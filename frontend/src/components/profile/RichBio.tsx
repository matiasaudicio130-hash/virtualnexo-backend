import { type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Link2 } from "lucide-react";
import { parseRichText } from "@/lib/richText";
import type { ProfileLink } from "@/types";

interface Props {
  bio?: string | null;
  links?: ProfileLink[] | null;
}

const linkStyle: CSSProperties = { color: "var(--gold-bright)", cursor: "pointer", textDecoration: "none" };
const chipStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--paper)",
  padding: "5px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)",
  background: "rgba(201,162,39,0.04)", textDecoration: "none", cursor: "pointer",
  transition: "border-color 0.15s",
};

function normalize(url: string): string {
  if (!url) return "";
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}
function cleanHost(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

/** Bio enriquecida: @menciones, #hashtags, URLs auto-linkeadas + chips de links múltiples. */
export function RichBio({ bio, links }: Props) {
  const navigate = useNavigate();
  const tokens = bio ? parseRichText(bio) : [];
  const validLinks = (links || []).filter(l => l && l.url).slice(0, 5);

  if (tokens.length === 0 && validLinks.length === 0) return null;

  return (
    <div style={{ padding: "0 24px 8px" }}>
      {tokens.length > 0 && (
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--silver)", lineHeight: 1.65, textAlign: "center", marginBottom: validLinks.length ? 12 : 0, whiteSpace: "pre-wrap" }}>
          {tokens.map((t, i) => {
            if (t.kind === "mention")
              return <a key={i} onClick={() => navigate(`/explore?q=${encodeURIComponent(t.value)}`)} style={linkStyle}>@{t.value}</a>;
            if (t.kind === "hashtag")
              return <a key={i} onClick={() => navigate(`/explore?tab=interes&tag=${encodeURIComponent(t.value)}`)} style={linkStyle}>#{t.value}</a>;
            if (t.kind === "url")
              return <a key={i} href={t.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{t.value.replace(/^https?:\/\//, "")}</a>;
            return <span key={i}>{t.value}</span>;
          })}
        </p>
      )}

      {validLinks.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {validLinks.map((l, i) => (
            <a
              key={i}
              href={normalize(l.url)}
              target="_blank"
              rel="noopener noreferrer"
              style={chipStyle}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--gold-deep)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <Link2 size={12} style={{ color: "var(--gold)" }} />
              {l.label || cleanHost(l.url)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
