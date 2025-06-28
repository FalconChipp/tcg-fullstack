import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Directory to store avatars
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Allowed extensions
const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Name as username-UUID.ext
    const username = req.user.username;
    const unique = Date.now().toString(36);
    cb(null, `${username}-${unique}${ext}`);
  }
});

export const avatarUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) return cb(new Error('Only image files allowed'));
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});
