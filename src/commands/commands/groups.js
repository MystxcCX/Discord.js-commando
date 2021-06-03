const { stripIndents } = require('common-tags');
const Command = require('../base');

module.exports = class ListGroupsCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'gruppen',
			aliases: ['list-groups', 'show-groups'],
			group: 'befehle',
			memberName: 'groups',
			description: 'Zeigt alle Gruppen an.',
			details: 'Nur Administrator können den Befel verwenden',
			guarded: true
		});
	}

	hasPermission(msg) {
		if(!msg.guild) return this.client.isOwner(msg.author);
		return msg.member.hasPermission('ADMINISTRATOR') || this.client.isOwner(msg.author);
	}

	run(msg) {
		return msg.reply(stripIndents`
			__**Gruppen**__
			${this.client.registry.groups.map(grp =>
				`**${grp.name}:** ${grp.isEnabledIn(msg.guild) ? 'Aktiviert' : 'Deaktiviert'}`
			).join('\n')}
		`);
	}
};
