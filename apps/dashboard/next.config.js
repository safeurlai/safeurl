/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use Bun runtime
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Enable React strict mode
  reactStrictMode: true,
  // Environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  },
};

module.exports = nextConfig;
