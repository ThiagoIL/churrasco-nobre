const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // A Content-Security-Policy (com nonce por requisição) é definida em src/proxy.ts.
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // comprovantes de compra: até 8 MB por arquivo, com folga para o multipart
    serverActions: { bodySizeLimit: "9mb" },
    proxyClientMaxBodySize: "9mb",
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // o navegador precisa buscar sempre a versão nova do service worker
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
