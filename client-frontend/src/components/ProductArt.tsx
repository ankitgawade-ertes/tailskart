import type { ArtKind } from "@/lib/types";

// Illustrated placeholder used until real product photos are added.
export default function ProductArt({
  kind,
  tint,
  brand,
  className = "",
}: {
  kind: ArtKind;
  tint: string;
  brand: string;
  className?: string;
}) {
  const ink = "#2438c8";
  const label = brand.length > 12 ? brand.slice(0, 11) + "…" : brand;
  const stroke = { stroke: ink, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

  const brandText = (y: number, size = 13) => (
    <text x="100" y={y} textAnchor="middle" fontFamily="var(--font-jakarta), sans-serif" fontWeight={800} fontSize={size} fill={ink}>
      {label}
    </text>
  );

  let art: React.ReactNode;
  switch (kind) {
    case "bag":
      art = (
        <g>
          <path d="M58 52 L142 52 L150 168 Q150 176 142 176 L58 176 Q50 176 50 168 Z" fill="#fff" {...stroke} />
          <path d="M58 52 L64 38 L136 38 L142 52" fill="#fff" {...stroke} />
          <rect x="62" y="96" width="76" height="40" rx="10" fill={tint} />
          {brandText(121)}
          <circle cx="100" cy="74" r="9" fill="#2438c8" opacity=".85" />
          <path d="M70 152 h60" {...stroke} strokeWidth={2} opacity=".35" />
        </g>
      );
      break;
    case "pouch":
      art = (
        <g>
          <path d="M66 46 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l4 -4 L140 168 Q140 176 132 176 L68 176 Q60 176 60 168 Z" fill="#fff" {...stroke} />
          <rect x="70" y="92" width="60" height="38" rx="10" fill={tint} />
          {brandText(116, 11)}
          <path d="M84 148 q16 12 32 0" {...stroke} fill="none" />
        </g>
      );
      break;
    case "jar":
      art = (
        <g>
          <rect x="70" y="36" width="60" height="22" rx="6" fill="#2438c8" opacity=".9" {...stroke} />
          <path d="M62 64 Q62 58 68 58 L132 58 Q138 58 138 64 L142 166 Q142 176 132 176 L68 176 Q58 176 58 166 Z" fill="#fff" {...stroke} />
          <rect x="66" y="98" width="68" height="40" rx="10" fill={tint} />
          {brandText(123, 12)}
        </g>
      );
      break;
    case "treat":
      art = (
        <g transform="rotate(-24 100 106)">
          <path
            d="M52 90 a16 16 0 1 1 22 -6 L126 84 a16 16 0 1 1 22 6 a16 16 0 1 1 -22 30 L74 120 a16 16 0 1 1 -22 -30 Z"
            fill="#fff"
            {...stroke}
          />
          <rect x="74" y="92" width="52" height="20" rx="8" fill={tint} />
        </g>
      );
      break;
    case "toy":
      art = (
        <g>
          <circle cx="100" cy="108" r="56" fill="#fff" {...stroke} />
          <path d="M48 92 Q100 120 152 92" fill="none" {...stroke} />
          <path d="M50 128 Q100 100 150 128" fill="none" {...stroke} />
          <circle cx="100" cy="108" r="14" fill="#2438c8" opacity=".85" />
        </g>
      );
      break;
    case "collar":
      art = (
        <g>
          <ellipse cx="100" cy="96" rx="58" ry="40" fill="none" {...stroke} strokeWidth={16} stroke={ink} />
          <ellipse cx="100" cy="96" rx="58" ry="40" fill="none" stroke={tint} strokeWidth={9} />
          <rect x="88" y="128" width="24" height="12" rx="3" fill="#fff" {...stroke} />
          <circle cx="100" cy="158" r="14" fill="#2438c8" opacity=".9" {...stroke} />
        </g>
      );
      break;
    case "bed":
      art = (
        <g>
          <ellipse cx="100" cy="128" rx="74" ry="40" fill="#fff" {...stroke} />
          <ellipse cx="100" cy="122" rx="50" ry="22" fill={tint} {...stroke} />
          <path d="M84 116 q16 -10 32 0" fill="none" {...stroke} strokeWidth={2} opacity=".5" />
        </g>
      );
      break;
    case "bottle":
      art = (
        <g>
          <rect x="86" y="30" width="28" height="20" rx="4" fill="#2438c8" opacity=".9" {...stroke} />
          <path d="M80 50 L120 50 L120 62 Q138 70 138 92 L138 166 Q138 176 128 176 L72 176 Q62 176 62 166 L62 92 Q62 70 80 62 Z" fill="#fff" {...stroke} />
          <rect x="70" y="106" width="60" height="38" rx="10" fill={tint} />
          {brandText(130, 11)}
        </g>
      );
      break;
    case "litter":
      art = (
        <g>
          <path d="M56 56 L144 56 L136 176 L64 176 Z" fill="#fff" {...stroke} />
          <rect x="50" y="42" width="100" height="16" rx="5" fill={ink} />
          <path d="M80 42 q20 -22 40 0" fill="none" {...stroke} />
          <rect x="68" y="96" width="64" height="40" rx="10" fill={tint} />
          {brandText(121, 11)}
        </g>
      );
      break;
    case "bowl":
      art = (
        <g>
          <ellipse cx="100" cy="92" rx="62" ry="16" fill={tint} {...stroke} />
          <path d="M38 92 Q46 160 100 160 Q154 160 162 92" fill="#fff" {...stroke} />
          <path d="M60 160 L140 160" {...stroke} strokeWidth={6} />
          <ellipse cx="100" cy="92" rx="62" ry="16" fill={tint} {...stroke} />
        </g>
      );
      break;
    case "tee":
      art = (
        <g>
          <path d="M70 44 L44 60 L30 92 L56 102 L60 92 L60 172 L140 172 L140 92 L144 102 L170 92 L156 60 L130 44 Q100 64 70 44 Z" fill="#fff" {...stroke} />
          <rect x="78" y="100" width="44" height="30" rx="8" fill={tint} />
          <circle cx="100" cy="115" r="7" fill="#2438c8" opacity=".85" />
        </g>
      );
      break;
  }

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={`${brand} product image`}>
      <rect width="200" height="200" fill={tint} opacity=".45" />
      <circle cx="100" cy="110" r="78" fill={tint} />
      {art}
    </svg>
  );
}

/** Shows the product's first uploaded photo, or the illustrated placeholder when it has none. */
export function ProductVisual({
  image,
  kind,
  tint,
  brand,
  alt,
  className = "",
}: {
  image?: string | null;
  kind: ArtKind;
  tint: string;
  brand: string;
  alt?: string;
  className?: string;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={alt || brand} loading="lazy" decoding="async" className={`${className} bg-white object-contain`} />;
  }
  return <ProductArt kind={kind} tint={tint} brand={brand} className={className} />;
}
