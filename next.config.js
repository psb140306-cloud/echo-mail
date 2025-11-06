const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // 이미지 최적화 설정
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
  },

  // 실험적 기능
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },

  // 빌드 최적화
  output: 'standalone',

  // 환경변수 설정
  env: {
    APP_VERSION: process.env.npm_package_version || '1.0.0',
  },

  // 리다이렉트 설정
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/dashboard',
        permanent: true,
      },
    ]
  },

  // 헤더 설정
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
          },
        ],
      },
    ]
  },

  // Webpack 설정
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })

    // Ensure @ alias resolves correctly
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }

    return config
  },
}

module.exports = nextConfig
