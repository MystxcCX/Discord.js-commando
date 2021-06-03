const { stripIndents, oneLine } = require('common-tags');
const Command = require('../base');
const { disambiguation } = require('../../util');

module.exports = class HelpCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'help',
			group: 'util',
			memberName: 'help',
			aliases: ['commands'],
			description: 'Zeigt eine Liste der verfügbaren Befehle an und beschreibt diese',
			details: oneLine`
				Der Befehl kann Teil eines Befehlsnamens oder eines ganzen Befehlsnamens sein.
				Wenn es nicht angegeben ist, werden alle verfügbaren Befehle aufgelistet.
			`,
			examples: ['help', 'help prefix'],
			guarded: true,

			args: [
				{
					key: 'command',
					prompt: 'Bei welchem Befehl brauchen sie Hilfe?',
					type: 'string',
					default: ''
				}
			]
		});
	}

	async run(msg, args) {
		const groups = this.client.registry.groups;
		const commands = this.client.registry.findCommands(args.command, false, msg);
		const showAll = args.command && args.command.toLowerCase() === 'all';
		if(args.command && !showAll) {
			if(commands.length === 1) {
				let help = stripIndents`
					${oneLine`
						__Command **${commands[0].name}**:__ ${commands[0].description}
						${commands[0].guildOnly ? ' (Nur auf Servern verwendbar)' : ''}
						${commands[0].nsfw ? ' (NSFW)' : ''}
					`}

					**Format:** ${msg.anyUsage(`${commands[0].name}${commands[0].format ? ` ${commands[0].format}` : ''}`)}
				`;
				if(commands[0].aliases.length > 0) help += `\n**Aliases:** ${commands[0].aliases.join(', ')}`;
				help += `\n${oneLine`
					**Group:** ${commands[0].group.name}
					(\`${commands[0].groupID}:${commands[0].memberName}\`)
				`}`;
				if(commands[0].details) help += `\n**Details:** ${commands[0].details}`;
				if(commands[0].examples) help += `\n**Examples:**\n${commands[0].examples.join('\n')}`;

				const messages = [];
				try {
					messages.push(await msg.direct(help));
					if(msg.channel.type !== 'dm') messages.push(await msg.reply('Ich hab dir eine DM mit Informationen gesendet.'));
				} catch(err) {
					messages.push(await msg.reply('Ich konnte dir keine DM senden. Du hast wahrscheinlich DMs deaktiviert. '));
				}
				return messages;
			} else if(commands.length > 15) {
				return msg.reply('Mehrere Befehle gefunden. Bitte sei spezifischer.');
			} else if(commands.length > 1) {
				return msg.reply(disambiguation(commands, 'Befehle'));
			} else {
				return msg.reply(
					`Befehl kann nicht identifiziert werden. Verwende ${msg.usage(
						null, msg.channel.type === 'dm' ? null : undefined, msg.channel.type === 'dm' ? null : undefined
					)} um die Liste aller Befehle anzuzeigen.`
				);
			}
		} else {
			const messages = [];
			try {
				messages.push(await msg.direct(stripIndents`
					${oneLine`
						Um einen Befel in ${msg.guild ? msg.guild.name : 'jeder Server'},
						verwende ${Command.usage('Befehl', msg.guild ? msg.guild.commandPrefix : null, this.client.user)}.
						Zum Beispiel, ${Command.usage('prefix', msg.guild ? msg.guild.commandPrefix : null, this.client.user)}.
					`}
					Um einen Befel in DM auszuführen verwende einfach ${Command.usage('command', null, null)} mit keinem Prefix.

					Benutze ${this.usage('<command>', null, null)} um detaillierte Informationen zu einem bestimmten Befehl zuerhalten.
					Benutze ${this.usage('all', null, null)} um eine Liste aller Befehle anzuzeigen, nicht nur der verfügbaren.

					__**${showAll ? 'Alle Befehle' : `Verfügbare Befehle in ${msg.guild || 'diesem DM'}`}**__

					${groups.filter(grp => grp.commands.some(cmd => !cmd.hidden && (showAll || cmd.isUsable(msg))))
						.map(grp => stripIndents`
							__${grp.name}__
							${grp.commands.filter(cmd => !cmd.hidden && (showAll || cmd.isUsable(msg)))
								.map(cmd => `**${cmd.name}:** ${cmd.description}${cmd.nsfw ? ' (NSFW)' : ''}`).join('\n')
							}
						`).join('\n\n')
					}
				`, { split: true }));
				if(msg.channel.type !== 'dm') messages.push(await msg.reply('Ich hab dir eine DM mit Informationen geschickt.'));
			} catch(err) {
				messages.push(await msg.reply('Ich konnte dir keine DM senden. Sie haben wahrscheinlich DMs deaktiviert.'));
			}
			return messages;
		}
	}
};
