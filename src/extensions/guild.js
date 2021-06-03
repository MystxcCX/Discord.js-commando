const { Structures } = require('discord.js');
const Command = require('../commands/base');
const GuildSettingsHelper = require('../providers/helper');

module.exports = Structures.extend('Guild', Guild => {

	class CommandoGuild extends Guild {
		constructor(...args) {
			super(...args);


			this.settings = new GuildSettingsHelper(this.client, this);


			this._commandPrefix = null;
		}

		get commandPrefix() {
			if(this._commandPrefix === null) return this.client.commandPrefix;
			return this._commandPrefix;
		}

		set commandPrefix(prefix) {
			this._commandPrefix = prefix;

			this.client.emit('commandPrefixChange', this, this._commandPrefix);
		}


		setCommandEnabled(command, enabled) {
			command = this.client.registry.resolveCommand(command);
			if(command.guarded) throw new Error('The command is guarded.');
			if(typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
			enabled = Boolean(enabled);
			if(!this._commandsEnabled) {

				this._commandsEnabled = {};
			}
			this._commandsEnabled[command.name] = enabled;

			this.client.emit('commandStatusChange', this, command, enabled);
		}


		isCommandEnabled(command) {
			command = this.client.registry.resolveCommand(command);
			if(command.guarded) return true;
			if(!this._commandsEnabled || typeof this._commandsEnabled[command.name] === 'undefined') {
				return command._globalEnabled;
			}
			return this._commandsEnabled[command.name];
		}


		setGroupEnabled(group, enabled) {
			group = this.client.registry.resolveGroup(group);
			if(group.guarded) throw new Error('The group is guarded.');
			if(typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
			enabled = Boolean(enabled);
			if(!this._groupsEnabled) {

				this._groupsEnabled = {};
			}
			this._groupsEnabled[group.id] = enabled;

			this.client.emit('groupStatusChange', this, group, enabled);
		}

		isGroupEnabled(group) {
			group = this.client.registry.resolveGroup(group);
			if(group.guarded) return true;
			if(!this._groupsEnabled || typeof this._groupsEnabled[group.id] === 'undefined') return group._globalEnabled;
			return this._groupsEnabled[group.id];
		}

		commandUsage(command, user = this.client.user) {
			return Command.usage(command, this.commandPrefix, user);
		}
	}

	return CommandoGuild;
});
