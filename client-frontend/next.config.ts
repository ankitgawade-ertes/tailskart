import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\")" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // When the API lives on another domain (e.g. Vercel), proxy it through this one so the
  // session cookie stays first-party. Set API_PROXY_TARGET to the API's URL to turn this on.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
    if (!target) return [];
    return [
      { source: "/v1/:path*", destination: `${target}/v1/:path*` },
      { source: "/uploads/:path*", destination: `${target}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
