const amqp = require('amqplib');
const logger = require('./logger');

let connection = null;
let channel = null;

const EXCHANGE_NAME = 'facebook_events';

async function connectToRabbitMQ(retries = 5, delay = 3000) {
	for (let i = 0; i < retries; i++) {
		try {
			connection = await amqp.connect(process.env.RABBITMQ_URL);
			channel = await connection.createChannel();
			await channel.assertExchange(EXCHANGE_NAME, 'topic', {
				durable: false,
			});
			logger.info('Connected to RabbitMQ');
			return channel;
		} catch (error) {
			logger.error(`Failed to connect to RabbitMQ (attempt ${i + 1})`, {
				error,
			});
			await new Promise((r) => setTimeout(r, delay));
		}
	}
	throw new Error('Could not connect to RabbitMQ after multiple attempts');
}

async function consumeEvent(routingKey, callback) {
	if (!channel) {
		await connectToRabbitMQ(); // will throw if all retries fail
	}

	const q = await channel.assertQueue('', { exclusive: true });
	await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);

	channel.consume(q.queue, (msg) => {
		if (msg !== null) {
			try {
				const content = JSON.parse(msg.content.toString());
				callback(content);
			} catch (e) {
				logger.error('Error parsing RabbitMQ message', e);
			}
			channel.ack(msg);
		}
	});

	logger.info(`Consuming events from RabbitMQ: ${routingKey}`);
}

module.exports = { connectToRabbitMQ, consumeEvent };
