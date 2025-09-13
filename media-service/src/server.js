require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const mediaRoutes = require('./routes/media-routes');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./utils/logger');
const { connectToRabbitMQ, consumeEvent } = require('./utils/rabbitmq');
const { handlePostDeleted } = require('./eventHandlers/media-event-handlers');

const app = express();
const PORT = process.env.PORT || 3003;

// Database connection
mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => logger.info('Connected to MongoDB'))
	.catch((err) => {
		logger.error('Failed to connect to MongoDB', err);
	});

// Redis Connection
const redisClient = new Redis(process.env.REDIS_URL);

// Middlewares
app.use(cors());
app.use(helmet());
app.use(express.json());

app.use((req, res, next) => {
	logger.info(`Received ${req.method} request to ${req.url}`);
	logger.info(`Request body, ${req.body}`);
	next();
});

// IP Based Rate limiting for sensitive endpoints
const getClientId = (req) =>
	req.user?.id ||
	req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
	req.ip;

const sensitiveEndPointsLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 50, // 50 attempts per window per IP
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res) => {
		logger.warn(
			`Sensitive endpoint rate limit exceeded for Client: ${getClientId(
				req
			)}`
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

app.use('/api/media/upload', sensitiveEndPointsLimiter);

// Routes
app.use('/api/media', mediaRoutes);

// Error Handling Middleware
app.use(errorHandler);

async function startServer() {
	try {
		await connectToRabbitMQ();

		// Consume events
		await consumeEvent('post.deleted', handlePostDeleted);

		app.listen(PORT, () => {
			logger.info(`Media service running on port ${PORT}`);
		});
	} catch (error) {
		logger.error('Failed to start server', { error });
		process.exit(1);
	}
}

startServer();

// Unhandled Regection Handling
process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled Rejection at: ', promise, 'reason: ', reason);
});
