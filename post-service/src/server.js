require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const {
	RateLimiterRedis,
	RateLimiterMemory,
} = require('rate-limiter-flexible');
const cors = require('cors');
const helmet = require('helmet');
const postRoutes = require('./routes/post-route');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3002;

// Database Connection
mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => logger.info('Connected to MongoDB'))
	.catch((err) => logger.error('Mongo connection error: ', err));

// Redis Connection
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

// Rate Limiting
const getClientId = (req) =>
	req.user?.id ||
	req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
	req.ip;

// --- Global limiter (all requests to this service) ---
const globalLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'post_global',
	points: 30, // 30 requests
	duration: 1,
	blockDuration: 60,
	insuranceLimiter: new RateLimiterMemory({ points: 15, duration: 1 }),
});

app.use(async (req, res, next) => {
	try {
		await globalLimiter.consume(getClientId(req));
		next();
	} catch {
		logger.warn(
			`Global rate limit exceeded for client: ${getClientId(req)}`
		);
		res.status(429).json({
			success: false,
			message: 'Too many requests. Please slow down...',
		});
	}
});

// Per-endpoint Limiter (Create Post)

const createPostLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'create_post',
	points: 5, // 5 posts
	duration: 60, // per minute
	blockDuration: 120, // block for 2 minutes
	insuranceLimiter: new RateLimiterMemory({ points: 2, duration: 60 }),
});

app.post('/api/posts/create-post', async (req, res, next) => {
	try {
		await createPostLimiter.consume(getClientId(req));
		next();
	} catch {
		logger.warn(
			`Create post rate limit exceeded for client: ${getClientId(req)}`
		);
		res.status(429).json({
			success: false,
			message: 'You are posting too quickly. Please wait...',
		});
	}
});

app.use(
	'/api/posts',
	(req, res, next) => {
		req.redisClient = redisClient;
		next();
	},
	postRoutes
);

// Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
	logger.info(`Post service running on port ${PORT}`);
});

// Unhandled Regection Handling
process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled Rejection at: ', promise, 'reason: ', reason);
});
