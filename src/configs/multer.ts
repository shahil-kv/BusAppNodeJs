import multer from 'multer';
import path from 'path';
import type { FileFilterCallback, File as MulterFile } from 'multer';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../temp'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    },
});

const fileFilter = (req: any, file: MulterFile, cb: FileFilterCallback) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF and text files are allowed!'));
    }
};

const upload = multer({ storage, fileFilter });

export default upload; 