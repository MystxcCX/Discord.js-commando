const { Structures, escapeMarkdown, splitMessage, resolveString } = require('discord.js');
const { oneLine } = require('common-tags');
const Command = require('../commands/base');
const FriendlyError = require('../errors/friendly');
const CommandFormatError = require('../errors/command-format');

module.exports = Structures.extend('Message', Message => {

	class CommandoMessage extends Message {
		constructor(...args) {
			super(...args);

			this.isCommand = false;

			this.command = null;

			this.argString = null;

			this.patternMatches = null;

			this.responses = null;

			this.responsePositions = null;
		}

		initCommand(command, argString, patternMatches) {
			this.isCommand = true;
			this.command = command;
			this.argString = argString;
			this.patternMatches = patternMatches;
			return this;
		}

		usage(argString, prefix, user = this.client.user) {
			if(typeof prefix === 'undefined') {
				if(this.guild) prefix = this.guild.commandPrefix;
				else prefix = this.client.commandPrefix;
			}
			return this.command.usage(argString, prefix, user);
		}

		anyUsage(command, prefix, user = this.client.user) {
			if(typeof prefix === 'undefined') {
				if(this.guild) prefix = this.guild.commandPrefix;
				else prefix = this.client.commandPrefix;
			}
			return Command.usage(command, prefix, user);
		}

		parseArgs() {
			switch(this.command.argsType) {
				case 'single':
					return this.argString.trim().replace(
						this.command.argsSingleQuotes ? /^("|')([^]*)\1$/g : /^(")([^]*)"$/g, '$2'
					);
				case 'multiple':
					return this.constructor.parseArgs(this.argString, this.command.argsCount, this.command.argsSingleQuotes);
				default:
					throw new RangeError(`Unknown argsType "${this.argsType}".`);
			}
		}

		async run() {
			if(this.channel.type === 'text' && !this.guild.members.cache.has(this.author.id) && !this.webhookID) {
				this.member = await this.guild.members.fetch(this.author);
			}

			if(this.channel.type === 'text' && !this.guild.members.cache.has(this.client.user.id)) {
				await this.guild.members.fetch(this.client.user.id);
			}

			if(this.command.guildOnly && !this.guild) {

				this.client.emit('commandBlock', this, 'guildOnly');
				return this.command.onBlock(this, 'guildOnly');
			}

			if(this.command.nsfw && !this.channel.nsfw) {
				this.client.emit('commandBlock', this, 'nsfw');
				return this.command.onBlock(this, 'nsfw');
			}

			const hasPermission = this.command.hasPermission(this);
			if(!hasPermission || typeof hasPermission === 'string') {
				const data = { response: typeof hasPermission === 'string' ? hasPermission : undefined };
				this.client.emit('commandBlock', this, 'permission', data);
				return this.command.onBlock(this, 'permission', data);
			}

			if(this.channel.type === 'text' && this.command.clientPermissions) {
				const missing = this.channel.permissionsFor(this.client.user).missing(this.command.clientPermissions);
				if(missing.length > 0) {
					const data = { missing };
					this.client.emit('commandBlock', this, 'clientPermissions', data);
					return this.command.onBlock(this, 'clientPermissions', data);
				}
			}

			const throttle = this.command.throttle(this.author.id);
			if(throttle && throttle.usages + 1 > this.command.throttling.usages) {
				const remaining = (throttle.start + (this.command.throttling.duration * 1000) - Date.now()) / 1000;
				const data = { throttle, remaining };
				this.client.emit('commandBlock', this, 'throttling', data);
				return this.command.onBlock(this, 'throttling', data);
			}

			let args = this.patternMatches;
			let collResult = null;
			if(!args && this.command.argsCollector) {
				const collArgs = this.command.argsCollector.args;
				const count = collArgs[collArgs.length - 1].infinite ? Infinity : collArgs.length;
				const provided = this.constructor.parseArgs(this.argString.trim(), count, this.command.argsSingleQuotes);

				collResult = await this.command.argsCollector.obtain(this, provided);
				if(collResult.cancelled) {
					if(collResult.prompts.length === 0 || collResult.cancelled === 'promptLimit') {
						const err = new CommandFormatError(this);
						return this.reply(err.message);
					}

					this.client.emit('commandCancel', this.command, collResult.cancelled, this, collResult);
					return this.reply('Befehl abgebrochen.');
				}
				args = collResult.values;
			}
			if(!args) args = this.parseArgs();
			const fromPattern = Boolean(this.patternMatches);

			if(throttle) throttle.usages++;
			const typingCount = this.channel.typingCount;
			try {
				this.client.emit('debug', `Running command ${this.command.groupID}:${this.command.memberName}.`);
				const promise = this.command.run(this, args, fromPattern, collResult);

				this.client.emit('commandRun', this.command, promise, this, args, fromPattern, collResult);
				const retVal = await promise;
				if(!(retVal instanceof Message || retVal instanceof Array || retVal === null || retVal === undefined)) {
					throw new TypeError(oneLine`
						Command ${this.command.name}'s run() resolved with an unknown type
						(${retVal !== null ? retVal && retVal.constructor ? retVal.constructor.name : typeof retVal : null}).
						Command run methods must return a Promise that resolve with a Message, Array of Messages, or null/undefined.
					`);
				}
				return retVal;
			} catch(err) {

				this.client.emit('commandError', this.command, err, this, args, fromPattern, collResult);
				if(this.channel.typingCount > typingCount) this.channel.stopTyping();
				if(err instanceof FriendlyError) {
					return this.reply(err.message);
				} else {
					return this.command.onError(err, this, args, fromPattern, collResult);
				}
			}
		}


		respond({ type = 'reply', content, options, lang, fromEdit = false }) {
			const shouldEdit = this.responses && !fromEdit;
			if(shouldEdit) {
				if(options && options.split && typeof options.split !== 'object') options.split = {};
			}

			if(type === 'reply' && this.channel.type === 'dm') type = 'plain';
			if(type !== 'direct') {
				if(this.guild && !this.channel.permissionsFor(this.client.user).has('SEND_MESSAGES')) {
					type = 'direct';
				}
			}

			content = resolveString(content);

			switch(type) {
				case 'plain':
					if(!shouldEdit) return this.channel.send(content, options);
					return this.editCurrentResponse(channelIDOrDM(this.channel), { type, content, options });
				case 'reply':
					if(!shouldEdit) return super.reply(content, options);
					if(options && options.split && !options.split.prepend) options.split.prepend = `${this.author}, `;
					return this.editCurrentResponse(channelIDOrDM(this.channel), { type, content, options });
				case 'direct':
					if(!shouldEdit) return this.author.send(content, options);
					return this.editCurrentResponse('dm', { type, content, options });
				case 'code':
					if(!shouldEdit) return this.channel.send(content, options);
					if(options && options.split) {
						if(!options.split.prepend) options.split.prepend = `\`\`\`${lang || ''}\n`;
						if(!options.split.append) options.split.append = '\n```';
					}
					content = `\`\`\`${lang || ''}\n${escapeMarkdown(content, true)}\n\`\`\``;
					return this.editCurrentResponse(channelIDOrDM(this.channel), { type, content, options });
				default:
					throw new RangeError(`Unknown response type "${type}".`);
			}
		}

		editResponse(response, { type, content, options }) {
			if(!response) return this.respond({ type, content, options, fromEdit: true });
			if(options && options.split) content = splitMessage(content, options.split);

			let prepend = '';
			if(type === 'reply') prepend = `${this.author}, `;

			if(content instanceof Array) {
				const promises = [];
				if(response instanceof Array) {
					for(let i = 0; i < content.length; i++) {
						if(response.length > i) promises.push(response[i].edit(`${prepend}${content[i]}`, options));
						else promises.push(response[0].channel.send(`${prepend}${content[i]}`));
					}
				} else {
					promises.push(response.edit(`${prepend}${content[0]}`, options));
					for(let i = 1; i < content.length; i++) {
						promises.push(response.channel.send(`${prepend}${content[i]}`));
					}
				}
				return Promise.all(promises);
			} else {
				if(response instanceof Array) {
					for(let i = response.length - 1; i > 0; i--) response[i].delete();
					return response[0].edit(`${prepend}${content}`, options);
				} else {
					return response.edit(`${prepend}${content}`, options);
				}
			}
		}

		editCurrentResponse(id, options) {
			if(typeof this.responses[id] === 'undefined') this.responses[id] = [];
			if(typeof this.responsePositions[id] === 'undefined') this.responsePositions[id] = -1;
			this.responsePositions[id]++;
			return this.editResponse(this.responses[id][this.responsePositions[id]], options);
		}

		say(content, options) {
			if(!options && typeof content === 'object' && !(content instanceof Array)) {
				options = content;
				content = '';
			}
			return this.respond({ type: 'plain', content, options });
		}

		reply(content, options) {
			if(!options && typeof content === 'object' && !(content instanceof Array)) {
				options = content;
				content = '';
			}
			return this.respond({ type: 'reply', content, options });
		}

		direct(content, options) {
			if(!options && typeof content === 'object' && !(content instanceof Array)) {
				options = content;
				content = '';
			}
			return this.respond({ type: 'direct', content, options });
		}

		code(lang, content, options) {
			if(!options && typeof content === 'object' && !(content instanceof Array)) {
				options = content;
				content = '';
			}
			if(typeof options !== 'object') options = {};
			options.code = lang;
			return this.respond({ type: 'code', content, options });
		}

		embed(embed, content = '', options) {
			if(typeof options !== 'object') options = {};
			options.embed = embed;
			return this.respond({ type: 'plain', content, options });
		}

		replyEmbed(embed, content = '', options) {
			if(typeof options !== 'object') options = {};
			options.embed = embed;
			return this.respond({ type: 'reply', content, options });
		}

		finalize(responses) {
			if(this.responses) this.deleteRemainingResponses();
			this.responses = {};
			this.responsePositions = {};

			if(responses instanceof Array) {
				for(const response of responses) {
					const channel = (response instanceof Array ? response[0] : response).channel;
					const id = channelIDOrDM(channel);
					if(!this.responses[id]) {
						this.responses[id] = [];
						this.responsePositions[id] = -1;
					}
					this.responses[id].push(response);
				}
			} else if(responses) {
				const id = channelIDOrDM(responses.channel);
				this.responses[id] = [responses];
				this.responsePositions[id] = -1;
			}
		}

		deleteRemainingResponses() {
			for(const id of Object.keys(this.responses)) {
				const responses = this.responses[id];
				for(let i = this.responsePositions[id] + 1; i < responses.length; i++) {
					const response = responses[i];
					if(response instanceof Array) {
						for(const resp of response) resp.delete();
					} else {
						response.delete();
					}
				}
			}
		}


		static parseArgs(argString, argCount, allowSingleQuote = true) {
			const argStringModified = removeSmartQuotes(argString, allowSingleQuote);
			const re = allowSingleQuote ? /\s*(?:("|')([^]*?)\1|(\S+))\s*/g : /\s*(?:(")([^]*?)"|(\S+))\s*/g;
			const result = [];
			let match = [];
			argCount = argCount || argStringModified.length;

			while(--argCount && (match = re.exec(argStringModified))) result.push(match[2] || match[3]);
			if(match && re.lastIndex < argStringModified.length) {
				const re2 = allowSingleQuote ? /^("|')([^]*)\1$/g : /^(")([^]*)"$/g;
				result.push(argStringModified.substr(re.lastIndex).replace(re2, '$2'));
			}
			return result;
		}
	}

	return CommandoMessage;
});

function removeSmartQuotes(argString, allowSingleQuote = true) {
	let replacementArgString = argString;
	const singleSmartQuote = /[‘’]/g;
	const doubleSmartQuote = /[“”]/g;
	if(allowSingleQuote) replacementArgString = argString.replace(singleSmartQuote, '\'');
	return replacementArgString
	.replace(doubleSmartQuote, '"');
}

function channelIDOrDM(channel) {
	if(channel.type !== 'dm') return channel.id;
	return 'dm';
}
