const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

cloudinary.config({
	cloud_name: process.env.cloud_name,
	api_key: process.env.api_key,
	api_secret: process.env.api_secret,
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
					resolve(error);
				} else {
					resolve(result);
				}
			}
		);

		uploadStream.end(file.buffer);
	});
};

module.exports = { uploadToCloudinary };
