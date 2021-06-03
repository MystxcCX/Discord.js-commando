const { Guild } = require('discord.js');

class SettingProvider {
	constructor() {
		if(this.constructor.name === 'SettingProvider') throw new Error('The base SettingProvider cannot be instantiated.');
	}

	init(client) { throw new Error(`${this.constructor.name} doesn't have an init method.`); }

	destroy() { throw new Error(`${this.constructor.name} doesn't have a destroy method.`); }

	get(guild, key, defVal) { throw new Error(`${this.constructor.name} doesn't have a get method.`); }

	set(guild, key, val) { throw new Error(`${this.constructor.name} doesn't have a set method.`); }

	remove(guild, key) { throw new Error(`${this.constructor.name} doesn't have a remove method.`); }

	clear(guild) { throw new Error(`${this.constructor.name} doesn't have a clear method.`); }

	static getGuildID(guild) {
		if(guild instanceof Guild) return guild.id;
		if(guild === 'global' || guild === null) return 'global';
		if(typeof guild === 'string' && !isNaN(guild)) return guild;
		throw new TypeError('Invalid guild specified. Must be a Guild instance, guild ID, "global", or null.');
	}
}

module.exports = SettingProvider;
