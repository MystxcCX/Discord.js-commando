const fs = require('fs');
const { oneLine } = require('common-tags');
const Command = require('../base');

module.exports = class LoadCommandCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'load',
			aliases: ['load-command'],
			group: 'befehle',
			memberName: 'load',
			description: 'Loads a new command.',
			details: oneLine`
				Das Argument muss der vollständige Befehl im Format \`Gruppe:Befehl Name\` sein.
				Only the bot owner(s) may use this command.`,
			examples: ['load misc:add'],
			ownerOnly: true,
			guarded: true,
			hidden: true,
			args: [
				{
					key: 'command',
					prompt: 'Welchen Befehl willst du laden?',
					validate: val => new Promise(resolve => {
						if (!val) return resolve(false);
						const split = val.split(':');
						if (split.length !== 2) return resolve(false);
						if (this.client.registry.findCommands(val).length > 0) {
							return resolve('Dieser Befehl ist bereits geladen.');
						}
						const cmdPath = this.client.registry.resolveCommandPath(split[0], split[1]);
						fs.access(cmdPath, fs.constants.R_OK, err => err ? resolve(false) : resolve(true));
						return null;
					}),
					parse: val => {
						const split = val.split(':');
						const cmdPath = this.client.registry.resolveCommandPath(split[0], split[1]);
						delete require.cache[cmdPath];
						return require(cmdPath);
					}
				}
			]
		});
	}

	async run(msg, args) {
		this.client.registry.registerCommand(args.command);
		const command = this.client.registry.commands.last();

		if (this.client.shard) {
			try {
				await this.client.shard.broadcastEval(`
					const ids = [${this.client.shard.ids.join(',')}];
					if(!this.shard.ids.some(id => ids.includes(id))) {
						const cmdPath = this.registry.resolveCommandPath('${command.groupID}', '${command.name}');
						delete require.cache[cmdPath];
						this.registry.registerCommand(require(cmdPath));
					}
				`);
			} catch (err) {
				this.client.emit('warn', `Error when broadcasting command load to other shards`);
				this.client.emit('error', err);
				await msg.reply(`Der \`${command.name}\` Befehl, wurde geladen, aber er konnte nicht auf allen Servern geladen werden`);
				return null;
			}
		}

		await msg.reply(`Der \`${command.name}\` Befehl${this.client.shard ? ' wurde auf allen Servern geladen' : ''}.`);
		return null;
	}
};