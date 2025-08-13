const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

const generateTokens = async (user) => {
	const accessToken = jwt.sign(
		{
			userId: user._id,
			username: user.username,
		},
		process.env.JWT_SECRET,
		{ expiresIn: '60m' }
	);

	const refreshToken = crypto.randomBytes(64).toString('hex');
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

	await RefreshToken.create({
		token: refreshToken,
		user: user._id,
		expiresAt,
	});

	return { accessToken, refreshToken };
};

module.exports = generateTokens;
