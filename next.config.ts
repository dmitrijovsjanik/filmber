import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { execSync } from 'child_process';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Get git commit hash for version display
function getGitCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
    localPatterns: [
      {
        pathname: '/api/tmdb-image/**',
      },
      {
        pathname: '/uploads/**',
      },
    ],
    // Responsive breakpoints matching TMDB poster sizes
    deviceSizes: [320, 420, 768, 1024, 1200],
    imageSizes: [92, 154, 185, 342, 500, 780],
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: getGitCommitHash(),
  },
};

export default withNextIntl(nextConfig);
