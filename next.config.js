/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['mongodb', 'ioredis', 'bullmq', 'pino'],
  },
};

module.exports = nextConfig;
