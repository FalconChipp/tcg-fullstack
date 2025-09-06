/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  images: {
    // Smaller files on the wire
    formats: ['image/avif', 'image/webp'],

    // Match your card grid breakpoints (1–4 columns)
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [96, 128, 192, 256, 384],

    // Keep optimized variants cached
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days

    // Allow optimized fetch from your hosts
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.tcgdex.net' },
      { protocol: 'https', hostname: 'cdn.tcgdex.net' },
      { protocol: 'https', hostname: 'images.tcgdex.net' },
      { protocol: 'https', hostname: 'images.pokemontcg.io' },
      { protocol: 'https', hostname: 'cdn.pidgi.net' },
      { protocol: 'https', hostname: 'backendtcg.sixbyfive.com' },
      { protocol: 'https', hostname: 'tcg.sixbyfive.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      // dev
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
    // you can remove `domains` when using remotePatterns
  },

  // (optional) add preconnect to image hosts via HTTP headers
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

  webpack: (config, { isServer }) => {
    if (isServer) config.devtool = false;
    return config;
  },

  poweredByHeader: false,
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
