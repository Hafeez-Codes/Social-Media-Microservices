const Media = require('../models/Media');
const {
	uploadToCloudinary,
	deleteFromCloudinary,
} = require('../utils/cloudinary');
const logger = require('../utils/logger');

const uploadMedia = async (req, res) => {
	logger.info('Upload media request received');
	try {
		console.log(req.file);

		if (!req.file) {
			logger.error('No file uploaded... Please upload a file!');
			return res.status(400).json({
				success: false,
				message: 'No file uploaded... Please upload a file!',
			});
		}

		const { originalname, mimetype, buffer } = req.file;
		const userId = req.user.userId;

		logger.info(`File details: name=${originalname}, type=${mimetype}`);
		logger.info('Uploading file to Cloudinary...');

		const cloudinaryUploadResult = await uploadToCloudinary(req.file);
		logger.info(
			`Cloudinary upload result: Public ID: - ${cloudinaryUploadResult.public_id}`
		);

		const newMedia = new Media({
			publicId: cloudinaryUploadResult.public_id,
			originalName: originalname,
			mimeType: mimetype,
			url: cloudinaryUploadResult.secure_url,
			userId,
		});

		await newMedia.save();

		res.status(201).json({
			success: true,
			mediaId: newMedia._id,
			url: newMedia.url,
			message: 'Media uploaded successfully',
		});
	} catch (error) {
		logger.error('Error uploading media:', error);

		// if Cloudinary upload happened but Mongo failed
		if (error.name === 'ValidationError' && req.file) {
			await deleteFromCloudinary(error.publicId || req.file.filename);
		}

		res.status(500).json({
			success: false,
			message: 'Server error while uploading media',
		});
	}
};

const getAllMedia = async (req, res) => {
	try {
		const mediaList = await Media.find().sort({
			createdAt: -1,
		});
		res.json({ success: true, media: mediaList });
	} catch (error) {
		logger.error('Error fetching media:', error);
		res.status(201).json({
			success: true,
			mediaId: newMedia._id,
			url: newMedia.url,
			message: 'Error fetching media',
		});
	}
};

module.exports = { uploadMedia, getAllMedia };
