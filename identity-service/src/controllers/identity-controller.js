const logger = require('../utils/logger');
const { validateRegistration, validateLogin } = require('../utils/validation');
const User = require('../models/User');
const generateTokens = require('../utils/generateToken');
const RefreshToken = require('../models/RefreshToken');

// User Registration
const registerUser = async (req, res) => {
	logger.info('Registration endpoint hit...');
	try {
		const { error } = validateRegistration(req.body);
		if (error) {
			logger.warn('Validation error', error.details[0].message);
			return res.status(400).json({
				success: false,
				message: error.details[0].message,
			});
		}

		const { username, email, password, firstname, lastname } = req.body;

		let user = await User.findOne({ $or: [{ email }, { username }] });
		if (user) {
			logger.warn('User already exists');
			return res.status(400).json({
				success: false,
				message: 'User already exists',
			});
		}

		user = new User({ username, email, password, firstname, lastname });
		await user.save();
		logger.info('User saved successfully', user._id);

		const { accessToken, refreshToken } = await generateTokens(user);

		res.status(201).json({
			success: true,
			message: 'User registered successfully!',
			accessToken,
			refreshToken,
		});
	} catch (error) {
		logger.error('Error during registration', error);
		res.status(500).json({
			success: false,
			message: 'Internal server error',
		});
	}
};

// User Login
const loginUser = async (req, res) => {
	logger.info('Login endpoint hit...');
	try {
		const { error } = validateLogin(req.body);

		if (error) {
			logger.warn('Validation error', error.details[0].message);
			return res.status(400).json({
				success: false,
				message: error.details[0].message,
			});
		}

		const { email, password } = req.body;
		const user = await User.findOne({ email });

		if (!user) {
			logger.warn('Invalid user');
			return res.status(400).json({
				success: false,
				message: 'Invalid user',
			});
		}

		// Validate password
		const isValidPassword = await user.comparePassword(password);
		if (!isValidPassword) {
			logger.warn('Invalid password');
			return res.status(400).json({
				success: false,
				message: 'Invalid password',
			});
		}

		const { accessToken, refreshToken } = await generateTokens(user);

		res.json({
			accessToken,
			refreshToken,
			userId: user._id,
		});
	} catch (error) {
		logger.error('Login error occured', error);
		return res.status(500).json({
			success: false,
			message: 'Internal server error',
		});
	}
};

// Refresh Token Generation
const refreshTokenGenerator = async (req, res) => {
	logger.info('Refresh token endpoint hit...');
	try {
		const { refreshToken } = req.body;
		if (!refreshToken) {
			logger.warn('Refresh token not provided');
			return res.status(400).json({
				success: false,
				message: 'Refresh token not provided',
			});
		}

		const storedToken = await RefreshToken.findOne({ token: refreshToken });

		if (!storedToken || storedToken.expiresAt < new Date()) {
			logger.warn('Invalid or expired refresh token');

			return res.status(401).json({
				success: false,
				message: 'Invalid or expired refresh token',
			});
		}

		const user = await User.findById(storedToken.user);
		if (!user) {
			logger.warn('User not found');

			return res.status(401).json({
				success: false,
				message: 'User not found',
			});
		}

		const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
			await generateTokens(user);

		// Delete the old refresh token
		await RefreshToken.deleteOne({ _id: storedToken._id });

		res.json({
			accessToken: newAccessToken,
			refreshToken: newRefreshToken,
		});
	} catch (error) {
		logger.error('Refresh token error occured', error);
		return res.status(500).json({
			success: false,
			message: 'Internal server error',
		});
	}
};

// Logout
const logoutUser = async (req, res) => {
	logger.info('Logout endpoint hit...');
	try {
		const { refreshToken } = req.body;
		if (!refreshToken) {
			logger.warn('Refresh token not provided');
			return res.status(400).json({
				success: false,
				message: 'Refresh token not provided',
			});
		}

		await RefreshToken.deleteOne({ token: refreshToken });
		logger.info('Refresh token deleted successfully for logout');

		res.json({
			success: true,
			message: 'Logged out successfully',
		});
	} catch (error) {
		logger.error('Error logging out', error);
		return res.status(500).json({
			success: false,
			message: 'Internal server error',
		});
	}
};

module.exports = { registerUser, loginUser, refreshTokenGenerator, logoutUser };
