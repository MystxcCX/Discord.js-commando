const ArgumentType = require('./base');
const emojiRegex = require('emoji-regex/RGI_Emoji.js');

class DefaultEmojiArgumentType extends ArgumentType {
	constructor(client) {
		super(client, 'default-emoji');
	}

	validate(value, msg, arg) {
		if(!new RegExp(`^(?:${emojiRegex().source})$`).test(value)) return false;
		if(arg.oneOf && !arg.oneOf.includes(value)) {
			return `Bitte gib eine der folgenden Optionen ein: ${arg.oneOf.join(' | ')}`;
		}
		return true;
	}

	parse(value) {
		return value;
	}
}

module.exports = DefaultEmojiArgumentType;
