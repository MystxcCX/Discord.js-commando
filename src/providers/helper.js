class GuildSettingsHelper {
	constructor(client, guild) {
		Object.defineProperty(this, 'client', { value: client });

		this.guild = guild;
	}

	get(key, defVal) {
		if(!this.client.provider) throw new Error('No settings provider is available.');
		return this.client.provider.get(this.guild, key, defVal);
	}

	set(key, val) {
		if(!this.client.provider) throw new Error('No settings provider is available.');
		return this.client.provider.set(this.guild, key, val);
	}

	remove(key) {
		if(!this.client.provider) throw new Error('No settings provider is available.');
		return this.client.provider.remove(this.guild, key);
	}

	clear() {
		if(!this.client.provider) throw new Error('No settings provider is available.');
		return this.client.provider.clear(this.guild);
	}
}

module.exports = GuildSettingsHelper;
