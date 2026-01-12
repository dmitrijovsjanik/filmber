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
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: getGitCommitHash(),
  },
};

export default withNextIntl(nextConfig);
