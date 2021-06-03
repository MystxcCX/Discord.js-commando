const { stripIndents, oneLine } = require('common-tags');
const Command = require('../base');

module.exports = class PrefixCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'prefix',
			group: 'util',
			memberName: 'prefix',
			description: 'Zeigt oder setzt des Befehls Prefix',
			format: '[prefix/"standart"/"keins"]',
			details: oneLine`
				Wenn kein Prefix festgelgt wurde wird das Standart Prefix verwendet.
				Wenn das Prefix auf "Standart" festgelgt wurde wird das Standart Prefix des Bots verwendet.
				Wenn das Prefix auf "keins", festgelgt wurde, besitz der Bot kein Prefix mehr, dadurch muss der Bot erwähnt werden um Befehle auszuführen.
				Nur Administrator können den Befel verwenden.`,
			examples: ['prefix', 'prefix -', 'prefix !', 'prefix standart', 'prefix keins'],

			args: [
				{
					key: 'prefix',
					prompt: 'Auf was für ein Prefix willst du den Bot setzten?',
					type: 'string',
					max: 15,
					default: ''
				}
			]
		});
	}

	async run(msg, args) {
		if (!args.prefix) {
			const prefix = msg.guild ? msg.guild.commandPrefix : this.client.commandPrefix;
			return msg.reply(stripIndents`
			${prefix ? `Das Befehl\'s Prefix ist \`\`${prefix}\`\`.` : 'Es gibt kein Befehl\'s Prefix'}
			Um einen Befehl auszuführen, benutze ${msg.anyUsage('Befehl')}.
		`);
		}

		if (msg.guild) {
			if (!msg.member.hasPermission('ADMINISTRATOR') && !this.client.isOwner(msg.author)) {
				return msg.reply('Nur Administrator können das Prefix ändern.');
			}
		} else if (!this.client.isOwner(msg.author)) {
			return msg.reply('Nur der Bot besitzer kann das Standart Prefix von diesem Bot ändern');
		}

		const lowercase = args.prefix.toLowerCase();
		const prefix = lowercase === 'keins' ? '' : args.prefix;
		let response;
		if(lowercase === 'standart') {
			if(msg.guild) msg.guild.commandPrefix = null; else this.client.commandPrefix = null;
			const current = this.client.commandPrefix ? `\`\`${this.client.commandPrefix}\`\`` : 'kein prefix';
			response = `Das Befehl\'s Prefix wurde zum Standart zurück gesetzt (zur Zeit ${current}).`;
		} else {
			if(msg.guild) msg.guild.commandPrefix = prefix; else this.client.commandPrefix = prefix;
			response = prefix ? `Das Befehl\'s Prefix wurde auf \`\`${args.prefix}\`\` gesetzt.` : 'Das Befehl\'s Prefix wurde vollständig gelöscht.';
		}

		await msg.reply(`${response} Um einen Befehl auszuführen, benutze ${msg.anyUsage('Befehl')}.`);
		return null;
	}
};
