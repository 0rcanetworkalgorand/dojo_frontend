const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Alias missing peer dependencies of @txnlab/use-wallet to an empty module
    // This prevents webpack from failing during the resolution phase
    config.resolve.alias = {
      ...config.resolve.alias,
      "lute-connect": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "@perawallet/connect-beta": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "@algorandfoundation/liquid-auth-use-wallet-client": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "daffi-connect": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
    };
    
    return config;
  },
}

module.exports = nextConfig
