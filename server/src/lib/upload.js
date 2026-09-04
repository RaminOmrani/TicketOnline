import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import mime from 'mime-types';
import { config } from '../config.js';
import { getSetting } from './settings.js';

const tmpDir = path.join(config.dataDir, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'svg', 'avif']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', '3gp']);
const AUDIO_EXT = new Set(['mp3', 'm4a', 'ogg', 'oga', 'wav', 'aac', 'opus', 'weba', 'webm']);

export function extOf(name, mimeType) {
  let ext = path.extname(name || '').slice(1).toLowerCase();
  if (!ext && mimeType) ext = (mime.extension(mimeType) || '').toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  return ext;
}

export function kindOf(ext, mimeType, isVoice = false) {
  if (isVoice) return 'voice';
  const m = (mimeType || '').toLowerCase();
  if (m.startsWith('image/') || IMAGE_EXT.has(ext)) return 'image';
  if (m.startsWith('video/') || VIDEO_EXT.has(ext)) return 'video';
  if (m.startsWith('audio/') || AUDIO_EXT.has(ext)) return 'audio';
  return 'file';
}

export function makeUploader() {
  const maxMb = Number(getSetting('max_upload_mb')) || 100;
  const maxCount = Number(getSetting('max_attachments')) || 10;
  const storage = multer.diskStorage({
    destination: tmpDir,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  });
  return multer({
    storage,
    limits: { fileSize: maxMb * 1024 * 1024, files: maxCount + 1 },
    fileFilter: (_req, file, cb) => {
      // Multer decodes filenames as latin1; fix to utf8 for Persian names
      try {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch {}
      const isVoice = file.fieldname === 'voice';
      const ext = extOf(file.originalname, file.mimetype);
      if (isVoice) return cb(null, true);
      const allowed = new Set(String(getSetting('allowed_extensions')).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
      if (!ext || !allowed.has(ext)) {
        const err = new Error(`فرمت فایل «${ext || file.originalname}» مجاز نیست.`);
        err.status = 400;
        return cb(err);
      }
      cb(null, true);
    },
  });
}

export function uploadErrorHandler(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    const maxMb = Number(getSetting('max_upload_mb')) || 100;
    const map = {
      LIMIT_FILE_SIZE: `حجم هر فایل حداکثر ${maxMb} مگابایت مجاز است.`,
      LIMIT_FILE_COUNT: `تعداد فایل‌ها بیش از حد مجاز است.`,
      LIMIT_UNEXPECTED_FILE: 'فیلد فایل نامعتبر است.',
    };
    return res.status(400).json({ error: map[err.code] || 'خطا در بارگذاری فایل.' });
  }
  if (err && err.status === 400) return res.status(400).json({ error: err.message });
  next(err);
}

/**
 * Move uploaded temp files into permanent storage, generate thumbnails, and
 * return attachment descriptors ready to insert into DB.
 */
export async function processUploads(files, meta = {}) {
  const out = [];
  const d = new Date();
  const rel = path.join(String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, '0'));
  const dir = path.join(config.uploadDir, rel);
  fs.mkdirSync(dir, { recursive: true });

  for (const f of files) {
    const isVoice = f.fieldname === 'voice';
    let ext = extOf(f.originalname, f.mimetype);
    if (isVoice && !ext) ext = 'webm';
    const kind = kindOf(ext, f.mimetype, isVoice);
    const id = crypto.randomUUID();
    const storedName = ext ? `${id}.${ext}` : id;
    const finalPath = path.join(dir, storedName);
    fs.renameSync(f.path, finalPath);

    const item = {
      kind,
      original_name: isVoice ? `voice-${Date.now()}.${ext}` : f.originalname,
      stored_path: path.join(rel, storedName).replace(/\\/g, '/'),
      thumb_path: null,
      mime: f.mimetype || mime.lookup(ext) || 'application/octet-stream',
      size: f.size,
      width: null,
      height: null,
      duration: null,
    };
    const m = meta[f.originalname] || {};
    if (typeof m.duration === 'number' && isFinite(m.duration)) item.duration = Math.round(m.duration * 10) / 10;

    if (kind === 'image' && ext !== 'svg') {
      try {
        const img = sharp(finalPath, { failOn: 'none' }).rotate();
        const info = await img.metadata();
        item.width = info.width || null;
        item.height = info.height || null;
        const thumbName = `${id}_thumb.webp`;
        await sharp(finalPath, { failOn: 'none' }).rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(dir, thumbName));
        item.thumb_path = path.join(rel, thumbName).replace(/\\/g, '/');
      } catch (e) {
        console.warn('thumbnail failed', e.message);
      }
    }
    out.push(item);
  }
  return out;
}

export function cleanupTemp(files = []) {
  for (const f of files) {
    try {
      if (f?.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
    } catch {}
  }
}

export function absPath(rel) {
  const p = path.resolve(config.uploadDir, rel);
  if (!p.startsWith(config.uploadDir)) throw new Error('bad path');
  return p;
}

export function deleteStored(att) {
  for (const rel of [att.stored_path, att.thumb_path]) {
    if (!rel) continue;
    try {
      fs.unlinkSync(absPath(rel));
    } catch {}
  }
}
