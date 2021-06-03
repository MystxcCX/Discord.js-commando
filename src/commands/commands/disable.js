const { oneLine } = require('common-tags');
const Command = require('../base');

module.exports = class DisableCommandCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'deaktiviere',
			aliases: ['deaktiviere-befehl', 'cmd-aus', 'befehl-aus'],
			group: 'befehle',
			memberName: 'disable',
			description: 'Deaktiviert einen Befehl oder eine Gruppe',
			details: oneLine`
				Das Argument muss der Name / die ID (teilweise oder vollständig) eines Befehls oder einer Befehlsgruppe sein.
				Nur Administrator können den Befel verwenden
			`,
			examples: ['disable util', 'disable Utility', 'disable prefix'],
			guarded: true,

			args: [
				{
					key: 'cmdOrGrp',
					label: 'Befehl',
					prompt: 'Welchen Befehl oder welche Gruppe möchten Sie deaktivieren?',
					type: 'group|command'
				}
			]
		});
	}

	hasPermission(msg) {
		if(!msg.guild) return this.client.isOwner(msg.author);
		return msg.member.permissions.has('ADMINISTRATOR') || this.client.isOwner(msg.author);
	}

	run(msg, args) {
		if(!args.cmdOrGrp.isEnabledIn(msg.guild, true)) {
			if(`${args.cmdOrGrp.group ? 'Befehl' : ''}`) {
				return msg.reply(`Der ${args.cmdOrGrp.group ? 'Befehl' : ''} \`${args.cmdOrGrp.name}\` ist bereits deaktiviert.`)
			} else if(`${args.cmdOrGrp.group ? '' : 'Gruppe'}`) {
				return msg.reply(`Die ${args.cmdOrGrp.group ? '' : 'Gruppe'} \`${args.cmdOrGrp.name}\` ist bereits deaktiviert.`)
			}
		}
		if(args.cmdOrGrp.guarded) {
			if(`${args.cmdOrGrp.group ? 'Befehl' : ''}`) {
				return msg.reply(`Du kannst den ${args.cmdOrGrp.group ? 'Befehl' : ''} \`${args.cmdOrGrp.name}\` nicht deaktivieren.`)
			} else if(`${args.cmdOrGrp.group ? '' : 'Gruppe'}`) {
				return msg.reply(`Du kannst den ${args.cmdOrGrp.group ? '' : 'Gruppe'} \`${args.cmdOrGrp.name}\` nicht deaktivieren.`)
			}
		}
		args.cmdOrGrp.setEnabledIn(msg.guild, false);

		if(`${args.cmdOrGrp.group ? 'Befehl' : ''}`) {
			return msg.reply(`Der ${args.cmdOrGrp.group ? 'Befehl' : ''} \`${args.cmdOrGrp.name}\` wurde deaktiviert.`)
		} else if(`${args.cmdOrGrp.group ? '' : 'Gruppe'}`) {
			return msg.reply(`Die ${args.cmdOrGrp.group ? '' : 'Gruppe'} \`${args.cmdOrGrp.name}\` wurde deaktiviert.`)
		}
	}
};
