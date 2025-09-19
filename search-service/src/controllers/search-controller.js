const Search = require('../models/Search');
const logger = require('../utils/logger');

const searchPostController = async (req, res) => {
	logger.info('Search request recieved');
	try {
		const { query } = req.query;

		const results = await Search.find(
			{ $text: { $search: query } },
			{ score: { $meta: 'textScore' } }
		)
			.sort({ score: { $meta: 'textScore' } })
			.limit(10);

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
