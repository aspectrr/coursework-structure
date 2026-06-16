/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow reading markdown/PDF files from mounted course volume
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
};

export default nextConfig;
