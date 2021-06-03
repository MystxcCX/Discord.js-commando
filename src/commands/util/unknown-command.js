const Command = require('../base');

module.exports = class UnknownCommandCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'unbekannter-befehl',
			group: 'util',
			memberName: 'unbekannter-befehl',
			description: 'Zeigt Hilfeinformationen an, wenn ein unbekannter Befehl verwendet wird.',
			examples: ['unbekannter-befehl kickeverybodyever'],
			unknown: true,
			hidden: true
		});
	}

	run(msg) {
		return msg.reply(
			`Unbekannter Befehl. Benutz ${msg.anyUsage(
				'help',
				msg.guild ? undefined : null,
				msg.guild ? undefined : null
			)} umd die Liste der Befele anzuzeigen.`
		);
	}
};
