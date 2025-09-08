const { uploadToCloudinary } = require('../utils/cloudinary');
const logger = require('../utils/logger');

const uploadMedia = async (req, res) => {
	logger.info('Upload media request received');
	try {
		if (!req.file) {
			logger.error('No file uploaded... Please upload a file!');
			return res.status(400).json({
				success: false,
				message: 'No file uploaded... Please upload a file!',
			});
		}

		const { originalName, mimeType, buffer } = req.file;
		const userId = req.user.userId;

		logger.info(`File details: name=${originalName}, type=${mimeType}`);
		logger.info('Uploading file to Cloudinary...');

		const cloudinaryUploadResult = await uploadToCloudinary(req.file);
	} catch (error) {}
};
