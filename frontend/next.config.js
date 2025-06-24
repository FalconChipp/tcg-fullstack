/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [
      'placehold.co',
      'assets.tcgdex.net',
      'cdn.tcgdex.net',
      'images.tcgdex.net', 
      'images.pokemontcg.io', 
      'cdn.pidgi.net',
      'tcg.sixbyfive.com',
      'localhost'
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
