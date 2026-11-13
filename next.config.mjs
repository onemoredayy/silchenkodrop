/** @type {import('next').NextConfig} */
const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: extraOrigins.length
    ? { serverActions: { allowedOrigins: extraOrigins } }
    : {},
};

export default nextConfig;
