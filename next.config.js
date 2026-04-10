const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Alias missing peer dependencies of @txnlab/use-wallet to an empty module
    // This prevents webpack from failing during the resolution phase
    config.resolve.alias = {
      ...config.resolve.alias,
      "@web3auth/modal": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "@web3auth/base": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "@web3auth/base-provider": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "@web3auth/single-factor-auth": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "@walletconnect/modal": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "@walletconnect/sign-client": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "magic-sdk": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "@magic-ext/algorand": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "lute-connect": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "@perawallet/connect-beta": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "@algorandfoundation/liquid-auth-use-wallet-client": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
      "daffi-connect": path.resolve(__dirname, 'src/lib/dummy-module.ts'),
    };
    
    return config;
  },
}

module.exports = nextConfig
