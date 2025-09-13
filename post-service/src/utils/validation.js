const joi = require('joi');

const validateCreatePost = (data) => {
	const schema = joi.object({
		content: joi.string().min(3).max(5000).required(),
		mediaIds: joi.array().items(joi.string().hex().length(24)),
	});

	return schema.validate(data);
};

module.exports = { validateCreatePost };
