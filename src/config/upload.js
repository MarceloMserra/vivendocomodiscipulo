const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure directories exist helper (could be moved to utils)
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// 1. PDF Upload Config
const uploadPDF = multer({
    dest: path.join(__dirname, "../../uploads_temp"), // adjust path relative to src/config
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") cb(null, true);
        else cb(new Error("Apenas arquivo PDF."));
    },
});

// 2. Profile Image Storage Config
const storageProfile = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, "../../public/uploads/profiles");
        ensureDir(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "_" + file.originalname.replace(/\s+/g, '_'));
    }
});

const uploadImage = multer({
    storage: storageProfile,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Apenas imagens."));
    }
});

module.exports = { uploadPDF, uploadImage };
