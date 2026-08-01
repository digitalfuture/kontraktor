import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';

const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Memory storage to process images in-memory
const storage = multer.memoryStorage();

// File filter: only images
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // max 10 files per request
  },
});

/**
 * Processes an uploaded image from memory buffer, resizes, and saves as modern WebP.
 */
export async function processAndSaveImage(
  file: Express.Multer.File,
  options: { isAvatar?: boolean; quality?: number } = {}
): Promise<{ filename: string; size: number }> {
  let ext: string;
  let destinationPath: string;
  let uniqueName: string;

  if (options.isAvatar) {
    ext = '.webp';
    uniqueName = crypto.randomBytes(16).toString('hex') + ext;
    destinationPath = path.join(UPLOADS_DIR, uniqueName);

    let pipeline = sharp(file.buffer);
    // Premium square cover crop to avoid layout shifts (CLS) on the web
    pipeline = pipeline.resize(300, 300, {
      fit: 'cover',
      position: 'center',
    });

    // Compress and convert to high-fidelity WebP
    const quality = options.quality || 90;
    const processedBuffer = await pipeline.webp({ quality }).toBuffer();
    await fs.promises.writeFile(destinationPath, processedBuffer);

    return {
      filename: uniqueName,
      size: processedBuffer.length,
    };
  }

  // Portfolio — resize to a reasonable display size then convert to WebP
  ext = '.webp';
  uniqueName = crypto.randomBytes(16).toString('hex') + ext;
  destinationPath = path.join(UPLOADS_DIR, uniqueName);

  let pipeline = sharp(file.buffer);
  pipeline = pipeline.resize(1920, 1920, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  const quality = options.quality || 90;
  const processedBuffer = await pipeline.webp({ quality }).toBuffer();
  await fs.promises.writeFile(destinationPath, processedBuffer);

  return {
    filename: uniqueName,
    size: processedBuffer.length,
  };
}

export function deleteFile(filename: string): void {
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export const UPLOADS_URL = '/uploads';
