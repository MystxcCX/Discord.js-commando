const FriendlyError = require('./friendly');

class CommandFormatError extends FriendlyError {
	constructor(msg) {
		super(
			`Ungültige Befehl\'s verwendung. Das akzeptierte Format des \`${msg.command.name}\` Befehl\'s lautet: ${msg.usage(
				msg.command.format,
				msg.guild ? undefined : null,
				msg.guild ? undefined : null
			)}. Benutze ${msg.anyUsage(
				`help ${msg.command.name}`,
				msg.guild ? undefined : null,
				msg.guild ? undefined : null
			)} für mehr Informationen`
		);
		this.name = 'CommandFormatError';
	}
}

module.exports = CommandFormatError;
