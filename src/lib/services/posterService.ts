import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const POSTERS_DIR = path.join(process.cwd(), 'public/uploads/posters');
const POSTER_WIDTH = 300;
const WEBP_QUALITY = 80;

class PosterService {
  private initialized = false;

  /**
   * Ensure the posters directory exists
   */
  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(POSTERS_DIR, { recursive: true });
    this.initialized = true;
  }

  /**
   * Download, compress and save a poster
   * @returns Local public path or null on failure
   */
  async downloadAndSave(sourceUrl: string, movieId: string): Promise<string | null> {
    try {
      await this.ensureDir();

      // Download image
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        console.error(`Failed to fetch poster: ${response.status} ${response.statusText}`);
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Compress and convert to WebP
      const outputPath = path.join(POSTERS_DIR, `${movieId}.webp`);
      await sharp(buffer)
        .resize(POSTER_WIDTH, null, { withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outputPath);

      return `/uploads/posters/${movieId}.webp`;
    } catch (error) {
      console.error(`Failed to save poster for ${movieId}:`, error);
      return null;
    }
  }

  /**
   * Check if a local poster exists
   */
  async exists(movieId: string): Promise<boolean> {
    try {
      await fs.access(path.join(POSTERS_DIR, `${movieId}.webp`));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a local poster
   */
  async delete(movieId: string): Promise<void> {
    try {
      await fs.unlink(path.join(POSTERS_DIR, `${movieId}.webp`));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Get the public path for a poster
   */
  getPublicPath(movieId: string): string {
    return `/uploads/posters/${movieId}.webp`;
  }

  /**
   * Get the source URL for a movie's poster
   */
  getSourceUrl(posterPath: string | null, posterUrl: string | null): string | null {
    if (posterPath) {
      return `https://image.tmdb.org/t/p/w500${posterPath}`;
    }
    if (posterUrl) {
      return posterUrl;
    }
    return null;
  }
}

export const posterService = new PosterService();
