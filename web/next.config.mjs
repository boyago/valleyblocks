
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
// CSP do portal. O Next precisa de scripts inline; o dev server também usa eval.
const dev = process.env.NODE_ENV !== "production";
const siteCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.googletagmanager.com https://*.google-analytics.com",
  "font-src 'self' data:",
  "connect-src 'self' wss: ws: https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
// Jogos: só o que não quebra jogos antigos (scripts inline, workers, wasm).
const gamesCsp = "frame-ancestors 'self'; object-src 'none'; base-uri 'self'";

/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() { return [{ source: "/jogos/rota-cristal", destination: "/jogos/robo-e-as-pecas", permanent: true }, { source: "/jogos/arena-labs", destination: "/", permanent: true }]; },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/((?!games/).*)", headers: [{ key: "Content-Security-Policy", value: siteCsp }] },
      { source: "/games/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }, { key: "Content-Security-Policy", value: gamesCsp }] },
    ];
  },
};

export default nextConfig;
