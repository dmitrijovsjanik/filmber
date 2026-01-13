import { NextRequest, NextResponse } from 'next/server';
import { ProxyAgent, fetch as proxyFetch } from 'undici';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_PROXY_URL = process.env.TMDB_PROXY_URL;

// Valid TMDB image sizes
const VALID_POSTER_SIZES = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'];
const VALID_BACKDROP_SIZES = ['w300', 'w780', 'w1280', 'original'];
const VALID_SIZES = new Set([...VALID_POSTER_SIZES, ...VALID_BACKDROP_SIZES]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const size = searchParams.get('size') || 'w500';

  // Validate path
  if (!path || !path.startsWith('/')) {
    return new NextResponse('Invalid path', { status: 400 });
  }

  // Validate size
  if (!VALID_SIZES.has(size)) {
    return new NextResponse('Invalid size', { status: 400 });
  }

  // Validate path format (should be like /abc123.jpg)
  if (!/^\/[a-zA-Z0-9]+\.(jpg|png|webp)$/.test(path)) {
    return new NextResponse('Invalid image path format', { status: 400 });
  }

  const imageUrl = `${TMDB_IMAGE_BASE}/${size}${path}`;

  try {
    let response: Response;

    if (TMDB_PROXY_URL) {
      const dispatcher = new ProxyAgent(TMDB_PROXY_URL);
      const proxyResponse = await proxyFetch(imageUrl, {
        dispatcher,
      });
      response = proxyResponse as unknown as Response;
    } else {
      response = await fetch(imageUrl);
    }

    if (!response.ok) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Failed to fetch image', { status: 500 });
  }
}
