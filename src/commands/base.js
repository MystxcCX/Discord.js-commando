const path = require('path');
const { escapeMarkdown } = require('discord.js');
const { oneLine, stripIndents } = require('common-tags');
const ArgumentCollector = require('./collector');
const { permissions } = require('../util');

class Command {
	constructor(client, info) {
		this.constructor.validateInfo(client, info);

		Object.defineProperty(this, 'client', { value: client });
		this.name = info.name;
		this.aliases = info.aliases || [];
		if(typeof info.autoAliases === 'undefined' || info.autoAliases) {
			if(this.name.includes('-')) this.aliases.push(this.name.replace(/-/g, ''));
			for(const alias of this.aliases) {
				if(alias.includes('-')) this.aliases.push(alias.replace(/-/g, ''));
			}
		}

		this.groupID = info.group;
		this.group = null;
		this.memberName = info.memberName;
		this.description = info.description;
		this.format = info.format || null;
		this.details = info.details || null;
		this.examples = info.examples || null;
		this.guildOnly = Boolean(info.guildOnly);
		this.ownerOnly = Boolean(info.ownerOnly);
		this.clientPermissions = info.clientPermissions || null;
		this.userPermissions = info.userPermissions || null;
		this.nsfw = Boolean(info.nsfw);
		this.defaultHandling = 'defaultHandling' in info ? info.defaultHandling : true;
		this.throttling = info.throttling || null;
		this.argsCollector = info.args && info.args.length ?
			new ArgumentCollector(client, info.args, info.argsPromptLimit) :
			null;
		if(this.argsCollector && typeof info.format === 'undefined') {
			this.format = this.argsCollector.args.reduce((prev, arg) => {
				const wrapL = arg.default !== null ? '[' : '<';
				const wrapR = arg.default !== null ? ']' : '>';
				return `${prev}${prev ? ' ' : ''}${wrapL}${arg.label}${arg.infinite ? '...' : ''}${wrapR}`;
			}, '');
		}

		this.argsType = info.argsType || 'single';
		this.argsCount = info.argsCount || 0;
		this.argsSingleQuotes = 'argsSingleQuotes' in info ? info.argsSingleQuotes : true;
		this.patterns = info.patterns || null;
		this.guarded = Boolean(info.guarded);
		this.hidden = Boolean(info.hidden);
		this.unknown = Boolean(info.unknown);
		this._globalEnabled = true;
		this._throttles = new Map();
	}
	hasPermission(message, ownerOverride = true) {
		if(!this.ownerOnly && !this.userPermissions) return true;
		if(ownerOverride && this.client.isOwner(message.author)) return true;

		if(this.ownerOnly && (ownerOverride || !this.client.isOwner(message.author))) {
			return `Der \`${this.name}\` Befehl kann nur vom Owner verwendet werden`;
		}

		if(message.channel.type === 'text' && this.userPermissions) {
			const missing = message.channel.permissionsFor(message.author).missing(this.userPermissions);
			if(missing.length > 0) {
				if(missing.length === 1) {
					return `Der \`${this.name}\` Befehl verlangt das du die "${permissions[missing[0]]}" Berechtigung besitztst.`;
				}
				return oneLine`
					Der \`${this.name}\` Befehl verlangt das du folgende Berechtigungen bestiztst:
					${missing.map(perm => permissions[perm]).join(', ')}
				`;
			}
		}

		return true;
	}

	async run(message, args, fromPattern, result) {
		throw new Error(`${this.constructor.name} doesn't have a run() method.`);
	}

	onBlock(message, reason, data) {
		switch(reason) {
			case 'guildOnly':
				return message.reply(`Der \`${this.name}\` Befehl muss in einem Server Channel verwendet wereden.`);
			case 'nsfw':
				return message.reply(`Der \`${this.name}\` Befehl kann nur in einem nsfw Channel verwendet werden.`);
			case 'permission': {
				if(data.response) return message.reply(data.response);
				return message.reply(`Du hast keine Berechtigungen den \`${this.name}\` Befehl zu verwenden.`);
			}
			case 'clientPermissions': {
				if(data.missing.length === 1) {
					return message.reply(
						`Ich brauche die "${permissions[data.missing[0]]}" Berechtigung das der \`${this.name}\` Befehl funktioniert.`
					);
				}
				return message.reply(oneLine`
					Ich brauche die folgenden Berechtigungen das der \`${this.name}\` Befehl funktioniert:
					${data.missing.map(perm => permissions[perm]).join(', ')}
				`);
			}
			case 'throttling': {
				return message.reply(
					`Du kannst den \`${this.name}\`Befehl für weiter ${data.remaining.toFixed(1)} Sekunden nicht verwenden.`
				);
			}
			default:
				return null;
		}
	}

	onError(err, message, args, fromPattern, result) {
		const owners = this.client.owners;
		const ownerList = owners ? owners.map((usr, i) => {
			const or = i === owners.length - 1 && owners.length > 1 ? 'or ' : '';
			return `${or}${escapeMarkdown(usr.username)}#${usr.discriminator}`;
		}).join(owners.length > 2 ? ', ' : ' ') : '';

		const invite = this.client.options.invite;
		return message.reply(stripIndents`
			Beim Ausführen des Befehls ist ein Fehler aufgetreten: \`${err.name}: ${err.message}\`
			Bitte Kontaktiere ${ownerList || 'den Bot Owner das dieses Problem gelösst werden kann.'}
		`);
	}

	throttle(userID) {
		if(!this.throttling || this.client.isOwner(userID)) return null;

		let throttle = this._throttles.get(userID);
		if(!throttle) {
			throttle = {
				start: Date.now(),
				usages: 0,
				timeout: this.client.setTimeout(() => {
					this._throttles.delete(userID);
				}, this.throttling.duration * 1000)
			};
			this._throttles.set(userID, throttle);
		}

		return throttle;
	}

	setEnabledIn(guild, enabled) {
		if(typeof guild === 'undefined') throw new TypeError('Guild must not be undefined.');
		if(typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
		if(this.guarded) throw new Error('The command is guarded.');
		if(!guild) {
			this._globalEnabled = enabled;
			this.client.emit('commandStatusChange', null, this, enabled);
			return;
		}
		guild = this.client.guilds.resolve(guild);
		guild.setCommandEnabled(this, enabled);
	}

	isEnabledIn(guild, bypassGroup) {
		if(this.guarded) return true;
		if(!guild) return this.group._globalEnabled && this._globalEnabled;
		guild = this.client.guilds.resolve(guild);
		return (bypassGroup || guild.isGroupEnabled(this.group)) && guild.isCommandEnabled(this);
	}

	isUsable(message = null) {
		if(!message) return this._globalEnabled;
		if(this.guildOnly && message && !message.guild) return false;
		const hasPermission = this.hasPermission(message);
		return this.isEnabledIn(message.guild) && hasPermission && typeof hasPermission !== 'string';
	}

	usage(argString, prefix = this.client.commandPrefix, user = this.client.user) {
		return this.constructor.usage(`${this.name}${argString ? ` ${argString}` : ''}`, prefix, user);
	}

	reload() {
		let cmdPath, cached, newCmd;
		try {
			cmdPath = this.client.registry.resolveCommandPath(this.groupID, this.memberName);
			cached = require.cache[cmdPath];
			delete require.cache[cmdPath];
			newCmd = require(cmdPath);
		} catch(err) {
			if(cached) require.cache[cmdPath] = cached;
			try {
				cmdPath = path.join(__dirname, this.groupID, `${this.memberName}.js`);
				cached = require.cache[cmdPath];
				delete require.cache[cmdPath];
				newCmd = require(cmdPath);
			} catch(err2) {
				if(cached) require.cache[cmdPath] = cached;
				if(err2.message.includes('Cannot find module')) throw err; else throw err2;
			}
		}

		this.client.registry.reregisterCommand(newCmd, this);
	}

	unload() {
		const cmdPath = this.client.registry.resolveCommandPath(this.groupID, this.memberName);
		if(!require.cache[cmdPath]) throw new Error('Command cannot be unloaded.');
		delete require.cache[cmdPath];
		this.client.registry.unregisterCommand(this);
	}

	static usage(command, prefix = null, user = null) {
		const nbcmd = command.replace(/ /g, '\xa0');
		if(!prefix && !user) return `\`\`${nbcmd}\`\``;

		let prefixPart;
		if(prefix) {
			if(prefix.length > 1 && !prefix.endsWith(' ')) prefix += ' ';
			prefix = prefix.replace(/ /g, '\xa0');
			prefixPart = `\`\`${prefix}${nbcmd}\`\``;
		}

		let mentionPart;
		if(user) mentionPart = `\`\`@${user.username.replace(/ /g, '\xa0')}#${user.discriminator}\xa0${nbcmd}\`\``;

		return `${prefixPart || ''}${prefix && user ? ' oder ' : ''}${mentionPart || ''}`;
	}

	static validateInfo(client, info) {
		if(!client) throw new Error('A client must be specified.');
		if(typeof info !== 'object') throw new TypeError('Command info must be an Object.');
		if(typeof info.name !== 'string') throw new TypeError('Command name must be a string.');
		if(info.name !== info.name.toLowerCase()) throw new Error('Command name must be lowercase.');
		if(info.aliases && (!Array.isArray(info.aliases) || info.aliases.some(ali => typeof ali !== 'string'))) {
			throw new TypeError('Command aliases must be an Array of strings.');
		}
		if(info.aliases && info.aliases.some(ali => ali !== ali.toLowerCase())) {
			throw new RangeError('Command aliases must be lowercase.');
		}
		if(typeof info.group !== 'string') throw new TypeError('Command group must be a string.');
		if(info.group !== info.group.toLowerCase()) throw new RangeError('Command group must be lowercase.');
		if(typeof info.memberName !== 'string') throw new TypeError('Command memberName must be a string.');
		if(info.memberName !== info.memberName.toLowerCase()) throw new Error('Command memberName must be lowercase.');
		if(typeof info.description !== 'string') throw new TypeError('Command description must be a string.');
		if('format' in info && typeof info.format !== 'string') throw new TypeError('Command format must be a string.');
		if('details' in info && typeof info.details !== 'string') throw new TypeError('Command details must be a string.');
		if(info.examples && (!Array.isArray(info.examples) || info.examples.some(ex => typeof ex !== 'string'))) {
			throw new TypeError('Command examples must be an Array of strings.');
		}
		if(info.clientPermissions) {
			if(!Array.isArray(info.clientPermissions)) {
				throw new TypeError('Command clientPermissions must be an Array of permission key strings.');
			}
			for(const perm of info.clientPermissions) {
				if(!permissions[perm]) throw new RangeError(`Invalid command clientPermission: ${perm}`);
			}
		}
		if(info.userPermissions) {
			if(!Array.isArray(info.userPermissions)) {
				throw new TypeError('Command userPermissions must be an Array of permission key strings.');
			}
			for(const perm of info.userPermissions) {
				if(!permissions[perm]) throw new RangeError(`Invalid command userPermission: ${perm}`);
			}
		}
		if(info.throttling) {
			if(typeof info.throttling !== 'object') throw new TypeError('Command throttling must be an Object.');
			if(typeof info.throttling.usages !== 'number' || isNaN(info.throttling.usages)) {
				throw new TypeError('Command throttling usages must be a number.');
			}
			if(info.throttling.usages < 1) throw new RangeError('Command throttling usages must be at least 1.');
			if(typeof info.throttling.duration !== 'number' || isNaN(info.throttling.duration)) {
				throw new TypeError('Command throttling duration must be a number.');
			}
			if(info.throttling.duration < 1) throw new RangeError('Command throttling duration must be at least 1.');
		}
		if(info.args && !Array.isArray(info.args)) throw new TypeError('Command args must be an Array.');
		if('argsPromptLimit' in info && typeof info.argsPromptLimit !== 'number') {
			throw new TypeError('Command argsPromptLimit must be a number.');
		}
		if('argsPromptLimit' in info && info.argsPromptLimit < 0) {
			throw new RangeError('Command argsPromptLimit must be at least 0.');
		}
		if(info.argsType && !['single', 'multiple'].includes(info.argsType)) {
			throw new RangeError('Command argsType must be one of "single" or "multiple".');
		}
		if(info.argsType === 'multiple' && info.argsCount && info.argsCount < 2) {
			throw new RangeError('Command argsCount must be at least 2.');
		}
		if(info.patterns && (!Array.isArray(info.patterns) || info.patterns.some(pat => !(pat instanceof RegExp)))) {
			throw new TypeError('Command patterns must be an Array of regular expressions.');
		}
	}
}

module.exports = Command;
