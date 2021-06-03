const discord = require('discord.js');

class CommandGroup {
	constructor(client, id, name, guarded = false) {
		if(!client) throw new Error('A client must be specified.');
		if(typeof id !== 'string') throw new TypeError('Group ID must be a string.');
		if(id !== id.toLowerCase()) throw new Error('Group ID must be lowercase.');

		Object.defineProperty(this, 'client', { value: client });

		this.id = id;
		this.name = name || id;
		this.commands = new discord.Collection();
		this.guarded = guarded;

		this._globalEnabled = true;
	}

	setEnabledIn(guild, enabled) {
		if(typeof guild === 'undefined') throw new TypeError('Guild must not be undefined.');
		if(typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
		if(this.guarded) throw new Error('The group is guarded.');
		if(!guild) {
			this._globalEnabled = enabled;
			this.client.emit('groupStatusChange', null, this, enabled);
			return;
		}
		guild = this.client.guilds.resolve(guild);
		guild.setGroupEnabled(this, enabled);
	}

	isEnabledIn(guild) {
		if(this.guarded) return true;
		if(!guild) return this._globalEnabled;
		guild = this.client.guilds.resolve(guild);
		return guild.isGroupEnabled(this);
	}

	reload() {
		for(const command of this.commands.values()) command.reload();
	}
}

module.exports = CommandGroup;
