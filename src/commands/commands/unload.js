const { oneLine } = require('common-tags');
const Command = require('../base');

module.exports = class UnloadCommandCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'unload',
			aliases: ['unload-command', 'unload-cmd'],
			group: 'befehle',
			memberName: 'unload',
			description: 'Entladet einen Befehl',
			details: oneLine`
				Das Argument muss der Name / die ID (teilweise oder vollständig) eines Befehls oder einer Befehlsgruppe sein.
				Nur der Bot besitzer kann diesen Befehl ausführen.
			`,
			examples: ['unload some-command'],
			ownerOnly: true,
			guarded: true,
			hidden: true,

			args: [
				{
					key: 'command',
					prompt: 'Welchen Befehl willst du entladen?',
					type: 'command'
				}
			]
		});
	}

	async run(msg, args) {
		args.command.unload();

		if(this.client.shard) {
			try {
				await this.client.shard.broadcastEval(`
					const ids = [${this.client.shard.ids.join(',')}];
					if(!this.shard.ids.some(id => ids.includes(id))) {
						this.registry.commands.get('${args.command.name}').unload();
					}
				`);
			} catch(err) {
				this.client.emit('warn', `Error when broadcasting command unload to other shards`);
				this.client.emit('error', err);
				await msg.reply(`Unloaded \`${args.command.name}\` command, but failed to unload on other shards.`);
				return null;
			}
		}

		await msg.reply(`Der \`${args.command.name}\` Befehl${this.client.shard ? ' wurde auf allen Servern entladen' : ''}.`);
		return null;
	}
};
