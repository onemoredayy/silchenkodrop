/** @type {import('next').NextConfig} */
const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig = {
  // сборка на сервере идёт в отдельную папку и подменяет рабочую только после успеха (scripts/deploy.sh)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    instrumentationHook: true, // автообновление цен (instrumentation.ts)
    ...(extraOrigins.length ? { serverActions: { allowedOrigins: extraOrigins } } : {}),
  },
};

export default nextConfig;
