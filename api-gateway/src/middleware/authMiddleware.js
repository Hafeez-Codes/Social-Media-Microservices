const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

const validateToken = (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (!token) {
		logger.warn('Access denied: No token provided');
		return res.status(401).json({
			message: 'Authentication required! Please login to continue',
			success: false,
		});
	}

	jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
		if (err) {
			logger.warn('Invalid token!');
			return res.status(429).json({
				message: 'Invalid token! Please login again',
				success: false,
			});
		}

		req.user = user;
		next();
	});
};

module.exports = { validateToken };
