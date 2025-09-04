require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const {
	RateLimiterRedis,
	RateLimiterMemory,
} = require('rate-limiter-flexible');
const Redis = require('ioredis');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const routes = require('./routes/identity-service');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Database Connection
mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => logger.info('Connected to MongoDB'))
	.catch((err) => logger.error('Mongo connection error: ', err));

const redisClient = new Redis(process.env.REDIS_URL);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
	logger.info(`Received ${req.method} request to ${req.url}`);
	logger.info(`Request body, ${req.body}`);
	next();
});

// DDoS Protection and Rate Limiting
const getClientIp = (req) =>
	req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

const globalLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'global',
	points: 20, // 20 requests
	duration: 1, // per second
	blockDuration: 60, // block for 1 minute
	insuranceLimiter: new RateLimiterMemory({ points: 10, duration: 1 }),
});

app.use(async (req, res, next) => {
	try {
		await globalLimiter.consume(getClientIp(req));
		next();
	} catch {
		logger.warn(`Global rate limit exceeded for IP: ${getClientIp(req)}`);
		res.status(429).json({
			success: false,
			message: 'Too many requests. Please slow down.',
		});
	}
});

/*
const rateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'middleware',
	points: 10,
	duration: 1,
});

app.use((req, res, next) => {
	rateLimiter
		.consume(req.ip)
		.then(() => next())
		.catch(() => {
			logger.warn(`Rate Limit exceeded for IP: ${req.ip}`);
			res.status(429).json({
				success: false,
				message: 'Too many requests...',
			});
		});
});
*/

// IP based rate limiting for sensitive endpoints
const sensitiveEndPointsLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 50, // 50 attempts per window per IP
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res) => {
		logger.warn(
			`Sensitive endpoint rate limit exceeded for IP: ${getClientIp(req)}`
		);
		res.status(429).json({
			success: false,
			message: 'Too many attempts. Please try again later.',
		});
	},
	store: new RedisStore({
		sendCommand: (...args) => redisClient.call(...args),
	}),
});

/*
const sensitiveEndPointsLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 50,
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res) => {
		logger.warn(
			`Rate Limit exceeded for sensitive endpoint for IP: ${req.ip}`
		);
		res.status(429).json({
			success: false,
			message: 'Too many requests...',
		});
	},
	store: new RedisStore({
		sendCommand: (...args) => redisClient.call(...args),
	}),
});
*/

app.use('/api/auth/register', sensitiveEndPointsLimiter);

// Routes
app.use('/api/auth', routes);

// Error Handling Middleware
app.use(errorHandler);

app.listen(PORT, () => {
	logger.info(`Identity Service running on port ${PORT}`);
});

// Unhandled Regection Handling
process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled Rejection at: ', promise, 'reason: ', reason);
});
