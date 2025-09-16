/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: { appDir: true },

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [96, 128, 192, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.tcgdex.net' },
      { protocol: 'https', hostname: 'cdn.tcgdex.net' },
      { protocol: 'https', hostname: 'images.tcgdex.net' },
      { protocol: 'https', hostname: 'images.pokemontcg.io' },
      { protocol: 'https', hostname: 'cdn.pidgi.net' },
      { protocol: 'https', hostname: 'backendtcg.sixbyfive.com' },
      { protocol: 'https', hostname: 'tcg.sixbyfive.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },

  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        {
          key: 'Link',
          value:
            '<https://assets.tcgdex.net>; rel=preconnect, ' +
            '<https://images.pokemontcg.io>; rel=preconnect' +
            '<https://cdn.pidgi.net>; rel=preconnect' +
            '<https://placehold.co>; rel=preconnect',
        },
      ],
    },
  ],

  // NEW: Redirect rules that don't rely on middleware
  async redirects() {
    return [
      // 1) QA: force via query (?forceMobile=1), unless bypass cookie set
      {
        // Exclude the block page and bypass route themselves
        source: '/:path((?!mobile-block)(?!allow-desktop).*)',
        has: [{ type: 'query', key: 'forceMobile', value: '1' }],
        missing: [{ type: 'cookie', key: 'allowMobileWeb', value: '1' }],
        destination: '/mobile-block',
        permanent: false, // 307 in dev/prod
      },
      // 2) Chromium client hint says "mobile"
      {
        source: '/:path((?!mobile-block)(?!allow-desktop).*)',
        has: [{ type: 'header', key: 'sec-ch-ua-mobile', value: '\\?1' }],
        missing: [{ type: 'cookie', key: 'allowMobileWeb', value: '1' }],
        destination: '/mobile-block',
        permanent: false,
      },

    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) config.devtool = false;
    return config;
  },

  poweredByHeader: false,
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
