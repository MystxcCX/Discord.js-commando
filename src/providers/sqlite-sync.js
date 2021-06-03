const SettingProvider = require('./base');

class SyncSQLiteProvider extends SettingProvider {

	constructor(conn) {
		super();

		this.conn = conn;

		Object.defineProperty(this, 'client', { value: null, writable: true });

		this.settings = new Map();
		this.listeners = new Map();

		this.insertOrReplaceStmt = null;
		this.deleteStmt = null;
	}

	init(client) {
		this.client = client;
		this.conn.prepare('CREATE TABLE IF NOT EXISTS settings (guild INTEGER PRIMARY KEY, settings TEXT)').run();

		const rows = this.conn.prepare('SELECT CAST(guild as TEXT) as guild, settings FROM settings').all();
		for(const row of rows) {
			let settings;
			try {
				settings = JSON.parse(row.settings);
			} catch(err) {
				client.emit('warn', `SyncSQLiteProvider couldn't parse the settings stored for guild ${row.guild}.`);
				continue;
			}

			const guild = row.guild !== '0' ? row.guild : 'global';
			this.settings.set(guild, settings);
			if(guild !== 'global' && !client.guilds.cache.has(row.guild)) continue;
			this.setupGuild(guild, settings);
		}
		this.insertOrReplaceStmt = this.conn.prepare('INSERT OR REPLACE INTO settings VALUES(?, ?)');
		this.deleteStmt = this.conn.prepare('DELETE FROM settings WHERE guild = ?');
		this.listeners
			.set('commandPrefixChange', (guild, prefix) => this.set(guild, 'prefix', prefix))
			.set('commandStatusChange', (guild, command, enabled) => this.set(guild, `cmd-${command.name}`, enabled))
			.set('groupStatusChange', (guild, group, enabled) => this.set(guild, `grp-${group.id}`, enabled))
			.set('guildCreate', guild => {
				const settings = this.settings.get(guild.id);
				if(!settings) return;
				this.setupGuild(guild.id, settings);
			})
			.set('commandRegister', command => {
				for(const [guild, settings] of this.settings) {
					if(guild !== 'global' && !client.guilds.cache.has(guild)) continue;
					this.setupGuildCommand(client.guilds.cache.get(guild), command, settings);
				}
			})
			.set('groupRegister', group => {
				for(const [guild, settings] of this.settings) {
					if(guild !== 'global' && !client.guilds.cache.has(guild)) continue;
					this.setupGuildGroup(client.guilds.cache.get(guild), group, settings);
				}
			});
		for(const [event, listener] of this.listeners) client.on(event, listener);
	}

	destroy() {
		for(const [event, listener] of this.listeners) this.client.removeListener(event, listener);
		this.listeners.clear();
	}

	get(guild, key, defVal) {
		const settings = this.settings.get(this.constructor.getGuildID(guild));
		return settings ? typeof settings[key] !== 'undefined' ? settings[key] : defVal : defVal;
	}

	set(guild, key, val) {
		guild = this.constructor.getGuildID(guild);
		let settings = this.settings.get(guild);
		if(!settings) {
			settings = {};
			this.settings.set(guild, settings);
		}

		settings[key] = val;
		this.insertOrReplaceStmt.run(guild !== 'global' ? guild : 0, JSON.stringify(settings));
		if(guild === 'global') this.updateOtherShards(key, val);
		return val;
	}

	remove(guild, key) {
		guild = this.constructor.getGuildID(guild);
		const settings = this.settings.get(guild);
		if(!settings || typeof settings[key] === 'undefined') return undefined;

		const val = settings[key];
		settings[key] = undefined;
		this.insertOrReplaceStmt.run(guild !== 'global' ? guild : 0, JSON.stringify(settings));
		if(guild === 'global') this.updateOtherShards(key, undefined);
		return val;
	}

	clear(guild) {
		guild = this.constructor.getGuildID(guild);
		if(!this.settings.has(guild)) return;
		this.settings.delete(guild);
		this.deleteStmt.run(guild !== 'global' ? guild : 0);
	}
	setupGuild(guild, settings) {
		if(typeof guild !== 'string') throw new TypeError('The guild must be a guild ID or "global".');
		guild = this.client.guilds.cache.get(guild) || null;

		if(typeof settings.prefix !== 'undefined') {
			if(guild) guild._commandPrefix = settings.prefix;
			else this.client._commandPrefix = settings.prefix;
		}

		for(const command of this.client.registry.commands.values()) this.setupGuildCommand(guild, command, settings);
		for(const group of this.client.registry.groups.values()) this.setupGuildGroup(guild, group, settings);
	}
	setupGuildCommand(guild, command, settings) {
		if(typeof settings[`cmd-${command.name}`] === 'undefined') return;
		if(guild) {
			if(!guild._commandsEnabled) guild._commandsEnabled = {};
			guild._commandsEnabled[command.name] = settings[`cmd-${command.name}`];
		} else {
			command._globalEnabled = settings[`cmd-${command.name}`];
		}
	}
	setupGuildGroup(guild, group, settings) {
		if(typeof settings[`grp-${group.id}`] === 'undefined') return;
		if(guild) {
			if(!guild._groupsEnabled) guild._groupsEnabled = {};
			guild._groupsEnabled[group.id] = settings[`grp-${group.id}`];
		} else {
			group._globalEnabled = settings[`grp-${group.id}`];
		}
	}
	updateOtherShards(key, val) {
		if(!this.client.shard) return;
		key = JSON.stringify(key);
		val = typeof val !== 'undefined' ? JSON.stringify(val) : 'undefined';
		this.client.shard.broadcastEval(`
			const ids = [${this.client.shard.ids.join(',')}];
			if(!this.shard.ids.some(id => ids.includes(id)) && this.provider && this.provider.settings) {
				let global = this.provider.settings.get('global');
				if(!global) {
					global = {};
					this.provider.settings.set('global', global);
				}
				global[${key}] = ${val};
			}
		`);
	}
}

module.exports = SyncSQLiteProvider;
