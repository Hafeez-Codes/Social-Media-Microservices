const logger = require('../utils/logger');
const Post = require('../models/Post');
const { validateCreatePost } = require('../utils/validation');
const { publishEvent } = require('../utils/rabbitmq');

async function invalidatePostCache(req, input) {
	const cachedKey = `posts:${input}`;
	await req.redisClient.del(cachedKey);

	const keys = await req.redisClient.keys('posts:*');
	if (keys.length > 0) {
		await req.redisClient.del(keys);
	}
}

const createPost = async (req, res) => {
	logger.info('Create post endpoint hit...');
	try {
		const { error } = validateCreatePost(req.body);
		if (error) {
			logger.warn('Validation error', error.details[0].message);
			return res.status(400).json({
				success: false,
				message: error.details[0].message,
			});
		}

		const { content, mediaIds } = req.body;
		const newPost = new Post({
			user: req.user.userId,
			content,
			mediaIds: mediaIds || [],
		});

		await newPost.save();

		await publishEvent('post.created', {
			postId: newPost._id.toString(),
			userId: newPost.user.toString(),
			content: newPost.content,
			createdAt: newPost.createdAt,
		});

		await invalidatePostCache(req, newPost._id.toString());

		logger.info('Post created successfully: ', newPost);
		res.status(201).json({
			success: true,
			message: 'Post created successfully',
		});
	} catch (error) {
		logger.error('Error creating post: ', error);
		res.status(500).json({
			success: false,
			message: 'Error creating post',
		});
	}
};

const getAllPosts = async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const startIndex = (page - 1) * limit;

		const cacheKey = `posts:${page}:${limit}`;
		const cachedPosts = await req.redisClient.get(cacheKey);

		if (cachedPosts) {
			return res.json(JSON.parse(cachedPosts));
		}

		const posts = await Post.find({})
			.sort({ createdAt: -1 })
			.skip(startIndex)
			.limit(limit);

		const totalNoOfPosts = await Post.countDocuments();

		const result = {
			posts,
			currentPage: page,
			totalPages: Math.ceil(totalNoOfPosts / limit),
			totalPosts: totalNoOfPosts,
		};

		// Save in Redis cache for 5 minutes
		await req.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 300);

		res.json(result);
	} catch (error) {
		logger.error('Error fetching posts: ', error);
		res.status(500).json({
			success: false,
			message: 'Error fetching posts',
		});
	}
};

const getPost = async (req, res) => {
	try {
		const postId = req.params.id;
		const cacheKey = `post:${postId}`;
		const cachedPost = await req.redisClient.get(cacheKey);

		if (cachedPost) {
			return res.json(JSON.parse(cachedPost));
		}

		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({
				success: false,
				message: 'Post not found',
			});
		}

		await req.redisClient.set(cacheKey, JSON.stringify(post), 'EX', 300);

		res.json(post);
	} catch (error) {
		logger.error('Error fetching post: ', error);
		res.status(500).json({
			success: false,
			message: 'Error creating post by ID',
		});
	}
};

const deletePost = async (req, res) => {
	try {
		const postId = req.params.id;
		const post = await Post.findOneAndDelete({
			_id: postId,
			user: req.user.userId,
		});

		if (!post) {
			return res.status(404).json({
				success: false,
				message: 'Post not found',
			});
		}

		// Publish post deletion event to RabbitMQ
		await publishEvent('post.deleted', {
			postId: post._id.toString(),
			userId: req.user.userId,
			mediaIds: post.mediaIds,
		});

		await invalidatePostCache(req, postId);

		res.json({
			success: true,
			message: 'Post deleted successfully',
		});
	} catch (error) {
		logger.error('Error deleting post: ', error);
		res.status(500).json({
			success: false,
			message: 'Error deleting post',
		});
	}
};

module.exports = {
	createPost,
	getAllPosts,
	getPost,
	deletePost,
};
