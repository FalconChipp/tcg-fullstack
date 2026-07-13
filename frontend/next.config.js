/** @type {import('next').NextConfig} */

// NEW: central regex for common crawlers we should NOT block
// Uses inline case-insensitive group (?i:...) which Next supports in redirect matchers
const BOT_UA_REGEX = "(?i:Googlebot|bingbot|DuckDuckBot|Applebot|YandexBot|Baiduspider)";

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
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
      // dev
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

  // NEW/CHANGED: Redirect rules that avoid bots and do NOT use UA regex for blocking.
  // We ONLY redirect when:
  //  - QA flag ?forceMobile=1 is present, OR
  //  - Chromium client hint sec-ch-ua-mobile == ?1 (real mobile browser),
  // AND it's NOT a bot UA, AND no bypass cookie is set.
  async redirects() {
    return [
      // 1) QA force via query (?forceMobile=1), unless bypass cookie set OR bot UA (CHANGED)
      {
        // Exclude the block page and any bypass route from being redirected
        source: '/:path((?!mobile-block)(?!allow-desktop).*)',
        has: [{ type: 'query', key: 'forceMobile', value: '1' }],
        missing: [
          { type: 'cookie', key: 'allowMobileWeb', value: '1' },               // keep bypass
          { type: 'header', key: 'user-agent', value: BOT_UA_REGEX },          // NEW: skip bots
        ],
        destination: '/mobile-block',
        permanent: false, // 307
      },

      // 2) Chromium client hint says "mobile" (?1), unless bypass cookie set OR bot UA (CHANGED)
      {
        source: '/:path((?!mobile-block)(?!allow-desktop).*)',
        has: [{ type: 'header', key: 'sec-ch-ua-mobile', value: '\\?1' }],
        missing: [
          { type: 'cookie', key: 'allowMobileWeb', value: '1' },
          { type: 'header', key: 'user-agent', value: BOT_UA_REGEX },          // NEW: skip bots
        ],
        destination: '/mobile-block',
        permanent: false,
      },

      // REMOVED: UA-string regex fallback redirect.
      // (Per your request: "not block bots or UA" — we no longer redirect based on UA matches.)
    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) config.devtool = false;
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    return config;
  },

  poweredByHeader: false,
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
