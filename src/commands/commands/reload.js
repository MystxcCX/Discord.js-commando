const { oneLine } = require('common-tags');
const Command = require('../base');

module.exports = class ReloadCommandCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'reload',
			aliases: ['reload-command'],
			group: 'befehle',
			memberName: 'reload',
			description: 'Ladet einen Befehl oder einen Gruppe neu.',
			details: oneLine`
				Das Argument muss der Name / die ID (teilweise oder vollständig) eines Befehls oder einer Befehlsgruppe sein.
				Durch das neu laden einer Gruppe werden alle enthalten Befehl in der Gruppe neugeladen.
				Nur Administrator können den Befel verwenden
			`,
			examples: ['reload some-command'],
			ownerOnly: true,
			guarded: true,
			hidden: true,

			args: [
				{
					key: 'cmdOrGrp',
					label: 'command/group',
					prompt: 'Welchen Befehl oder welche Gruppe willst du neu laden.',
					type: 'group|command'
				}
			]
		});
	}

	async run(msg, args) {
		const { cmdOrGrp } = args;
		const isCmd = Boolean(cmdOrGrp.groupID);
		cmdOrGrp.reload();

		if(this.client.shard) {
			try {
				await this.client.shard.broadcastEval(`
					const ids = [${this.client.shard.ids.join(',')}];
					if(!this.shard.ids.some(id => ids.includes(id))) {
						this.registry.${isCmd ? 'commands' : 'groups'}.get('${isCmd ? cmdOrGrp.name : cmdOrGrp.id}').reload();
					}
				`);
			} catch(err) {
				this.client.emit('warn', `Error when broadcasting command reload to other shards`);
				this.client.emit('error', err);
				if(isCmd) {
					await msg.reply(`Der \`${cmdOrGrp.name}\` Befehl wurde neugeladen, aber er konnte nicht auf allen Servern neu geladen wereden.`);
				} else {
					await msg.reply(
						`Alle Befehle in der \`${cmdOrGrp.name}\` Gruppe wurde neu geladen, aber es konnte nicht auf allen Servern neu geladen werden.`
					);
				}
				return null;
			}
		}

		if(isCmd) {
			await msg.reply(`Der \`${cmdOrGrp.name}\` Befehl${this.client.shard ? 'wurde auf allen Servern neu geladen' : ''}.`);
		} else {
			await msg.reply(
				`Alle Befehle in der \`${cmdOrGrp.name}\` Gruppe${this.client.shard ? ' wurden auf allen Servern neu geladen' : ''}.`);
		}
		return null;
	}
};
