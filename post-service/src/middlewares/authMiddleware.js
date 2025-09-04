const logger = require('../utils/logger');

const authenticateRequest = (req, res, next) => {
	const userId = req.headers['x-user-id'];

	if (!userId) {
		logger.warn('Authentication failed: No user ID provided');
		return res.status({
			success: false,
			message: 'Authentication required! Please login to continue.',
		});
	}

	req.user = { userId };
	next();
};

module.exports = { authenticateRequest };
