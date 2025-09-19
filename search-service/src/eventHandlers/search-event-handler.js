const Search = require('../models/Search');
const logger = require('../utils/logger');

// Cache Invalidation
async function invalidateSearchCache(req, input) {
	const cachedKey = `search:${input}`;
	await req.redisClient.del(cachedKey);

	const keys = await req.redisClient.keys('search:*');
	if (keys.length > 0) {
		await req.redisClient.del(keys);
	}
}

async function handlePostCreated(event) {
	try {
		const newSearchPost = new Search({
			postId: event.postId,
			userId: event.userId,
			content: event.content,
			createdAt: event.createdAt,
		});

		await newSearchPost.save();

		await invalidateSearchCache(req, event.postId);
		logger.info(
			`Search post created:  ${
				event.postId
			}, ${newSearchPost._id.toString()}`
		);
	} catch (error) {
		logger.error('Error handling post.created event: ', error);
	}
}

async function handlePostDeleted(event) {
	try {
		await Search.findOneAndDelete({ postId: event.postId });

		await invalidateSearchCache(req, event.postId);

		logger.info(`Search post deleted: ${event.postId}`);
	} catch (error) {
		logger.error('Error handling post.deleted event: ', error);
	}
}

module.exports = { handlePostCreated, handlePostDeleted };
