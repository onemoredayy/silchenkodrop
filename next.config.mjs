/** @type {import('next').NextConfig} */
const codespaceHost = process.env.CODESPACE_NAME
  ? `${process.env.CODESPACE_NAME}-3000.app.github.dev`
  : "localhost:3000";

const nextConfig = {
  experimental: {
    serverActions: {
      // Разрешаем действия с адреса Codespaces и с localhost
      allowedOrigins: ["localhost:3000", codespaceHost, "*.app.github.dev"],
    },
  },
};

export default nextConfig;
