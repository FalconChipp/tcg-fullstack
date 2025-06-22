/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [
      'placehold.co',
      'assets.tcgdex.net',
      'images.tcgdex.net', // if you use this domain elsewhere
      'images.pokemontcg.io', // if you use this domain elsewhere
      'cdn.pidgi.net',
      'tcg.sixbyfive.com'
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.devtool = false;
    }
    return config;
  },
};

module.exports = nextConfig;
