const path = require('path');
const discord = require('discord.js');
const Command = require('./commands/base');
const CommandGroup = require('./commands/group');
const CommandoMessage = require('./extensions/message');
const ArgumentType = require('./types/base');
const { isConstructor } = require('./util');

class CommandoRegistry {
	constructor(client) {
		Object.defineProperty(this, 'client', { value: client });

		this.commands = new discord.Collection();
		this.groups = new discord.Collection();
		this.types = new discord.Collection();
		this.commandsPath = null;
		this.unknownCommand = null;
	}

	registerGroup(group, name, guarded) {
		if(typeof group === 'string') {
			group = new CommandGroup(this.client, group, name, guarded);
		} else if(isConstructor(group, CommandGroup)) {
			group = new group(this.client);
		} else if(typeof group === 'object' && !(group instanceof CommandGroup)) {
			group = new CommandGroup(this.client, group.id, group.name, group.guarded);
		}

		const existing = this.groups.get(group.id);
		if(existing) {
			existing.name = group.name;
			this.client.emit('debug', `Group ${group.id} is already registered; renamed it to "${group.name}".`);
		} else {
			this.groups.set(group.id, group);
			this.client.emit('groupRegister', group, this);
			this.client.emit('debug', `Registered group ${group.id}.`);
		}

		return this;
	}

	registerGroups(groups) {
		if(!Array.isArray(groups)) throw new TypeError('Groups must be an Array.');
		for(const group of groups) {
			if(Array.isArray(group)) this.registerGroup(...group);
			else this.registerGroup(group);
		}
		return this;
	}

	registerCommand(command) {
		if(isConstructor(command, Command)) command = new command(this.client);
		else if(isConstructor(command.default, Command)) command = new command.default(this.client);
		if(!(command instanceof Command)) throw new Error(`Invalid command object to register: ${command}`);

		if(this.commands.some(cmd => cmd.name === command.name || cmd.aliases.includes(command.name))) {
			throw new Error(`A command with the name/alias "${command.name}" is already registered.`);
		}
		for(const alias of command.aliases) {
			if(this.commands.some(cmd => cmd.name === alias || cmd.aliases.includes(alias))) {
				throw new Error(`A command with the name/alias "${alias}" is already registered.`);
			}
		}
		const group = this.groups.find(grp => grp.id === command.groupID);
		if(!group) throw new Error(`Group "${command.groupID}" is not registered.`);
		if(group.commands.some(cmd => cmd.memberName === command.memberName)) {
			throw new Error(`A command with the member name "${command.memberName}" is already registered in ${group.id}`);
		}
		if(command.unknown && this.unknownCommand) throw new Error('An unknown command is already registered.');

		command.group = group;
		group.commands.set(command.name, command);
		this.commands.set(command.name, command);
		if(command.unknown) this.unknownCommand = command;

		this.client.emit('commandRegister', command, this);
		this.client.emit('debug', `Registered command ${group.id}:${command.memberName}.`);

		return this;
	}

	registerCommands(commands, ignoreInvalid = false) {
		if(!Array.isArray(commands)) throw new TypeError('Commands must be an Array.');
		for(const command of commands) {
			const valid = isConstructor(command, Command) || isConstructor(command.default, Command) ||
				command instanceof Command || command.default instanceof Command;
			if(ignoreInvalid && !valid) {
				this.client.emit('warn', `Attempting to register an invalid command object: ${command}; skipping.`);
				continue;
			}
			this.registerCommand(command);
		}
		return this;
	}

	registerCommandsIn(options) {
		const obj = require('require-all')(options);
		const commands = [];
		for(const group of Object.values(obj)) {
			for(let command of Object.values(group)) {
				if(typeof command.default === 'function') command = command.default;
				commands.push(command);
			}
		}
		if(typeof options === 'string' && !this.commandsPath) this.commandsPath = options;
		else if(typeof options === 'object' && !this.commandsPath) this.commandsPath = options.dirname;
		return this.registerCommands(commands, true);
	}

	registerType(type) {
		if(isConstructor(type, ArgumentType)) type = new type(this.client);
		else if(isConstructor(type.default, ArgumentType)) type = new type.default(this.client);

		if(!(type instanceof ArgumentType)) throw new Error(`Invalid type object to register: ${type}`);

		if(this.types.has(type.id)) throw new Error(`An argument type with the ID "${type.id}" is already registered.`);

		this.types.set(type.id, type);

		this.client.emit('typeRegister', type, this);
		this.client.emit('debug', `Registered argument type ${type.id}.`);

		return this;
	}

	registerTypes(types, ignoreInvalid = false) {
		if(!Array.isArray(types)) throw new TypeError('Types must be an Array.');
		for(const type of types) {
			const valid = isConstructor(type, ArgumentType) || isConstructor(type.default, ArgumentType) ||
				type instanceof ArgumentType || type.default instanceof ArgumentType;
			if(ignoreInvalid && !valid) {
				this.client.emit('warn', `Attempting to register an invalid argument type object: ${type}; skipping.`);
				continue;
			}
			this.registerType(type);
		}
		return this;
	}

	registerTypesIn(options) {
		const obj = require('require-all')(options);
		const types = [];
		for(const type of Object.values(obj)) types.push(type);
		return this.registerTypes(types, true);
	}

	registerDefaults() {
		this.registerDefaultTypes();
		this.registerDefaultGroups();
		this.registerDefaultCommands();
		return this;
	}

	registerDefaultGroups() {
		return this.registerGroups([
			['commands', 'Commands', true],
			['befehle', 'Befehle', true],
			['util', 'Nützliche Befehle']
		]);
	}

	registerDefaultCommands(commands = {}) {
		commands = {
			help: true, prefix: true, ping: true, eval: true,
			unknownCommand: true, commandState: true, ...commands
		};
		if(commands.help) this.registerCommand(require('./commands/util/help'));
		if(commands.prefix) this.registerCommand(require('./commands/util/prefix'));
		if(commands.ping) this.registerCommand(require('./commands/util/ping'));
		if(commands.eval) this.registerCommand(require('./commands/util/eval'));
		if(commands.unknownCommand) this.registerCommand(require('./commands/util/unknown-command'));
		if(commands.commandState) {
			this.registerCommands([
				require('./commands/commands/groups'),
				require('./commands/commands/enable'),
				require('./commands/commands/disable'),
				require('./commands/commands/reload'),
				require('./commands/commands/load'),
				require('./commands/commands/unload'),
			]);
		}
		return this;
	}

	registerDefaultTypes(types = {}) {
		types = {
			string: true, integer: true, float: true, boolean: true,
			user: true, member: true, role: true, channel: true, textChannel: true,
			voiceChannel: true, categoryChannel: true, message: true, customEmoji: true,
			defaultEmoji: true, command: true, group: true, ...types
		};
		if(types.string) this.registerType(require('./types/string'));
		if(types.integer) this.registerType(require('./types/integer'));
		if(types.float) this.registerType(require('./types/float'));
		if(types.boolean) this.registerType(require('./types/boolean'));
		if(types.user) this.registerType(require('./types/user'));
		if(types.member) this.registerType(require('./types/member'));
		if(types.role) this.registerType(require('./types/role'));
		if(types.channel) this.registerType(require('./types/channel'));
		if(types.textChannel) this.registerType(require('./types/text-channel'));
		if(types.voiceChannel) this.registerType(require('./types/voice-channel'));
		if(types.categoryChannel) this.registerType(require('./types/category-channel'));
		if(types.message) this.registerType(require('./types/message'));
		if(types.customEmoji) this.registerType(require('./types/custom-emoji'));
		if(types.defaultEmoji) this.registerType(require('./types/default-emoji'));
		if(types.command) this.registerType(require('./types/command'));
		if(types.group) this.registerType(require('./types/group'));
		return this;
	}

	reregisterCommand(command, oldCommand) {
		if(isConstructor(command, Command)) command = new command(this.client);
		else if(isConstructor(command.default, Command)) command = new command.default(this.client);

		if(command.name !== oldCommand.name) throw new Error('Command name cannot change.');
		if(command.groupID !== oldCommand.groupID) throw new Error('Command group cannot change.');
		if(command.memberName !== oldCommand.memberName) throw new Error('Command memberName cannot change.');
		if(command.unknown && this.unknownCommand !== oldCommand) {
			throw new Error('An unknown command is already registered.');
		}

		command.group = this.resolveGroup(command.groupID);
		command.group.commands.set(command.name, command);
		this.commands.set(command.name, command);
		if(this.unknownCommand === oldCommand) this.unknownCommand = null;
		if(command.unknown) this.unknownCommand = command;
		this.client.emit('commandReregister', command, oldCommand);
		this.client.emit('debug', `Reregistered command ${command.groupID}:${command.memberName}.`);
	}
	unregisterCommand(command) {
		this.commands.delete(command.name);
		command.group.commands.delete(command.name);
		if(this.unknownCommand === command) this.unknownCommand = null;
		this.client.emit('commandUnregister', command);
		this.client.emit('debug', `Unregistered command ${command.groupID}:${command.memberName}.`);
	}
	findGroups(searchString = null, exact = false) {
		if(!searchString) return this.groups;

		const lcSearch = searchString.toLowerCase();
		const matchedGroups = Array.from(this.groups.filter(
			exact ? groupFilterExact(lcSearch) : groupFilterInexact(lcSearch)
		).values());
		if(exact) return matchedGroups;

		for(const group of matchedGroups) {
			if(group.name.toLowerCase() === lcSearch || group.id === lcSearch) return [group];
		}
		return matchedGroups;
	}

	resolveGroup(group) {
		if(group instanceof CommandGroup) return group;
		if(typeof group === 'string') {
			const groups = this.findGroups(group, true);
			if(groups.length === 1) return groups[0];
		}
		throw new Error('Unable to resolve group.');
	}

	findCommands(searchString = null, exact = false, message = null) {
		if(!searchString) {
			return message ?
				Array.from(this.commands.filter(cmd => cmd.isUsable(message)).values()) :
				Array.from(this.commands);
		}

		const lcSearch = searchString.toLowerCase();
		const matchedCommands = Array.from(this.commands.filter(
			exact ? commandFilterExact(lcSearch) : commandFilterInexact(lcSearch)
		).values());
		if(exact) return matchedCommands;

		for(const command of matchedCommands) {
			if(command.name === lcSearch || (command.aliases && command.aliases.some(ali => ali === lcSearch))) {
				return [command];
			}
		}

		return matchedCommands;
	}

	resolveCommand(command) {
		if(command instanceof Command) return command;
		if(command instanceof CommandoMessage && command.command) return command.command;
		if(typeof command === 'string') {
			const commands = this.findCommands(command, true);
			if(commands.length === 1) return commands[0];
		}
		throw new Error('Unable to resolve command.');
	}

	resolveCommandPath(group, memberName) {
		return path.join(this.commandsPath, group, `${memberName}.js`);
	}
}

function groupFilterExact(search) {
	return grp => grp.id === search || grp.name.toLowerCase() === search;
}

function groupFilterInexact(search) {
	return grp => grp.id.includes(search) || grp.name.toLowerCase().includes(search);
}

function commandFilterExact(search) {
	return cmd => cmd.name === search ||
		(cmd.aliases && cmd.aliases.some(ali => ali === search)) ||
		`${cmd.groupID}:${cmd.memberName}` === search;
}

function commandFilterInexact(search) {
	return cmd => cmd.name.includes(search) ||
		`${cmd.groupID}:${cmd.memberName}` === search ||
		(cmd.aliases && cmd.aliases.some(ali => ali.includes(search)));
}

module.exports = CommandoRegistry;
