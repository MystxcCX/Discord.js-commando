class FriendlyError extends Error {
	constructor(message) {
		super(message);
		this.name = 'FriendlyError';
	}
}
module.exports = FriendlyError;
