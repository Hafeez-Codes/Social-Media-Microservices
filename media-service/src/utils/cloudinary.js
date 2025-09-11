const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = (file) => {
	return new Promise((resolve, reject) => {
		const uploadStream = cloudinary.uploader.upload_stream(
			{
				resource_type: 'auto',
			},
			(error, result) => {
				if (error) {
					logger.error('Cloudinary upload error:', error);
					reject(error);
				} else {
					resolve(result);
				}
			}
		);

		uploadStream.end(file.buffer);
	});
};

const deleteFromCloudinary = async (publicId) => {
	try {
		const result = await cloudinary.uploader.destroy(publicId);
		logger.info(`Deleted Cloudinary file: ${publicId}`);
		return result;
	} catch (error) {
		logger.error('Error deleting Cloudinary file:', error);
	}
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };
