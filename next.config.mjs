/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
  trailingSlash: true,
  webpack: (config) => {
    // face-api.js ships a UMD fallback that webpack cannot statically analyse;
    // this is harmless at runtime (we never hit the CommonJS path in the
    // browser) but it logs a noisy warning on every build. Suppress it.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /@vladmandic\/face-api/,
        message: /Critical dependency: require function is used/,
      },
    ];
    return config;
  },
};

export default nextConfig;
