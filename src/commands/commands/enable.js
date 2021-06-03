const { oneLine } = require('common-tags');
const Command = require('../base');

module.exports = class EnableCommandCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'aktiviere',
			aliases: ['befehl-aktivieren', 'cmd-an', 'befehl-an'],
			group: 'befehle',
			memberName: 'enable',
			description: 'Aktiviert einen Befehl oder eine Befehlsgruppe.',
			details: oneLine`
				Das Argument muss der Name / die ID (teilweise oder vollständig) eines Befehls oder einer Gruppe sein.
				Nur Administrator können den Befel verwenden
			`,
			examples: ['enable util', 'enable Utility', 'enable prefix'],
			guarded: true,

			args: [
				{
					key: 'cmdOrGrp',
					label: 'command/group',
					prompt: 'Welchen Befehl oder welche Gruppe möchtest du aktivieren?',
					type: 'group|command'
				}
			]
		});
	}

	hasPermission(msg) {
		if(!msg.guild) return this.client.isOwner(msg.author);
		return msg.member.hasPermission('ADMINISTRATOR') || this.client.isOwner(msg.author);
	}

	run(msg, args) {
		const group = args.cmdOrGrp.group;
		if(args.cmdOrGrp.isEnabledIn(msg.guild, true)) {
			if(`${args.cmdOrGrp.group ? 'Befehl' : ''}`) {
				return msg.reply(`Der ${args.cmdOrGrp.group ? 'Befehl' : ''} \`${args.cmdOrGrp.name}\` ist bereits aktivieret ${group && !group.isEnabledIn(msg.guild) ? `, aber der \`${group.name}\` Befehl ist deaktiviert so kann der Befehl weiter hin nicht verwendet werden` : ''}.`)
			} else if(`${args.cmdOrGrp.group ? '' : 'Gruppe'}`) {
				return msg.reply(`Der ${args.cmdOrGrp.group ? '' : 'Gruppe'} \`${args.cmdOrGrp.name}\` ist bereits aktivieret ${group && !group.isEnabledIn(msg.guild) ? `, aber die \`${group.name}\` Gruppe ist deaktiviert so kann der Befehl weiter hin nicht verwendet werden` : ''}.`)
			}
		}
		args.cmdOrGrp.setEnabledIn(msg.guild, true);
		if(`${args.cmdOrGrp.group ? 'Befehl' : ''}`) {
			return msg.reply(`Die ${group ? 'Befehl' : ''} \`${args.cmdOrGrp.name}\` wurde aktiviert`)

		} else if(`${args.cmdOrGrp.group ? '' : 'Gruppe'}`) {
			return msg.reply(`Die ${group ? '' : 'Gruppe'} \`${args.cmdOrGrp.name}\` wurde aktiviert`)
		}
	}
};
