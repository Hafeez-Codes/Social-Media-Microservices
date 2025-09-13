const { deleteFromCloudinary } = require('../utils/cloudinary');
const logger = require('../utils/logger');
const Media = require('../models/Media');

const handlePostDeleted = async (event) => {
	console.log(event, 'eventeventevent');

	const { postId, mediaIds } = event;
	try {
		const mediaToDelete = await Media.find({ _id: { $in: mediaIds } });

		for (const media of mediaToDelete) {
			await deleteFromCloudinary(media.publicId);
			await Media.findByIdAndDelete(media._id);

			logger.info(
				`Deleted media ${media._id} from Cloudinary and database`
			);
		}

		logger.info(`Processed post.deleted event for Post ID: ${postId}`);
	} catch (error) {
		logger.error('Error handling post.deleted event:', error);
	}
};

module.exports = { handlePostDeleted };
