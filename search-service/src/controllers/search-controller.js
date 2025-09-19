const Search = require('../models/Search');
const logger = require('../utils/logger');

const searchPostController = async (req, res) => {
	logger.info('Search request recieved');
	try {
		const { query } = req.query;

		// Implement caching with Redis
		const cachedKey = `search:${query}`;
		const cachedResults = await req.redisClient.get(cachedKey);

		if (cachedResults) {
			return res.json(JSON.parse(cachedResults));
		}

		const results = await Search.find(
			{ $text: { $search: query } },
			{ score: { $meta: 'textScore' } }
		)
			.sort({ score: { $meta: 'textScore' } })
			.limit(10);

		// Save in Redis cache for 5 minutes
		await req.redisClient.set(
			cachedKey,
			JSON.stringify(results),
			'EX',
			600
		);

		res.json(results);
	} catch (error) {
		logger.error('Error while searching posts', { error });
		res.status(500).json({
			success: false,
			message: 'Internal Server Error',
		});
	}
};

module.exports = { searchPostController };
