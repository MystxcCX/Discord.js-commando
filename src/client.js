const discord = require('discord.js');
const CommandoRegistry = require('./registry');
const CommandDispatcher = require('./dispatcher');
const GuildSettingsHelper = require('./providers/helper');

class CommandoClient extends discord.Client {
	constructor(options = {}) {
		if(typeof options.commandPrefix === 'undefined') options.commandPrefix = '!';
		if(options.commandPrefix === null) options.commandPrefix = '';
		if(typeof options.commandEditableDuration === 'undefined') options.commandEditableDuration = 30;
		if(typeof options.nonCommandEditable === 'undefined') options.nonCommandEditable = true;
		super(options);

		this.registry = new CommandoRegistry(this);
		this.dispatcher = new CommandDispatcher(this, this.registry);
		this.provider = null;
		this.settings = new GuildSettingsHelper(this, null);
		this._commandPrefix = null;

		const msgErr = err => { this.emit('error', err); };
		this.on('message', message => { this.dispatcher.handleMessage(message).catch(msgErr); });
		this.on('messageUpdate', (oldMessage, newMessage) => {
			this.dispatcher.handleMessage(newMessage, oldMessage).catch(msgErr);
		});

		if(options.owner) {
			this.once('ready', () => {
				if(options.owner instanceof Array || options.owner instanceof Set) {
					for(const owner of options.owner) {
						this.users.fetch(owner).catch(err => {
							this.emit('warn', `Unable to fetch owner ${owner}.`);
							this.emit('error', err);
						});
					}
				} else {
					this.users.fetch(options.owner).catch(err => {
						this.emit('warn', `Unable to fetch owner ${options.owner}.`);
						this.emit('error', err);
					});
				}
			});
		}
	}

	get commandPrefix() {
		if(typeof this._commandPrefix === 'undefined' || this._commandPrefix === null) return this.options.commandPrefix;
		return this._commandPrefix;
	}

	set commandPrefix(prefix) {
		this._commandPrefix = prefix;
		this.emit('commandPrefixChange', null, this._commandPrefix);
	}

	get owners() {
		if(!this.options.owner) return null;
		if(typeof this.options.owner === 'string') return [this.users.cache.get(this.options.owner)];
		const owners = [];
		for(const owner of this.options.owner) owners.push(this.users.cache.get(owner));
		return owners;
	}

	isOwner(user) {
		if(!this.options.owner) return false;
		user = this.users.resolve(user);
		if(!user) throw new RangeError('Unable to resolve user.');
		if(typeof this.options.owner === 'string') return user.id === this.options.owner;
		if(this.options.owner instanceof Array) return this.options.owner.includes(user.id);
		if(this.options.owner instanceof Set) return this.options.owner.has(user.id);
		throw new RangeError('The client\'s "owner" option is an unknown value.');
	}

	async setProvider(provider) {
		const newProvider = await provider;
		this.provider = newProvider;

		if(this.readyTimestamp) {
			this.emit('debug', `Provider set to ${newProvider.constructor.name} - initialising...`);
			await newProvider.init(this);
			this.emit('debug', 'Provider finished initialisation.');
			return undefined;
		}

		this.emit('debug', `Provider set to ${newProvider.constructor.name} - will initialise once ready.`);
		await new Promise(resolve => {
			this.once('ready', () => {
				this.emit('debug', `Initialising provider...`);
				resolve(newProvider.init(this));
			});
		});

		this.emit('providerReady', provider);
		this.emit('debug', 'Provider finished initialisation.');
		return undefined;
	}

	async destroy() {
		await super.destroy();
		if(this.provider) await this.provider.destroy();
	}
}

module.exports = CommandoClient;
