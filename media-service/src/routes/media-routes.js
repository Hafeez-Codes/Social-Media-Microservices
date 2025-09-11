const express = require('express');
const multer = require('multer');

const { uploadMedia } = require('../controllers/media-controller');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }, // ? 5MB limit
}).single('file');

router.post(
	'/upload',
	authenticateRequest,
	(req, res, next) => {
		upload(req, res, function (err) {
			if (err instanceof multer.MulterError) {
				logger.error('Multer error during file upload:', err);
				return res.status(400).json({
					message: 'Multer error during file upload',
					error: err.message,
				});
			} else if (err) {
				logger.error('Unknown error during file upload:', err);
				return res.status(500).json({
					message: 'Unknown error during file upload',
					error: err.message,
				});
			}

			if (!req.file) {
				return res.status(400).json({
					message: 'No file uploaded... Please upload a file!',
				});
			}

			next();
		});
	},
	uploadMedia
);

module.exports = router;
