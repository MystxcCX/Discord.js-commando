const Argument = require('./argument');

class ArgumentCollector {
	constructor(client, args, promptLimit = Infinity) {
		if(!client) throw new TypeError('Collector client must be specified.');
		if(!args || !Array.isArray(args)) throw new TypeError('Collector args must be an Array.');
		if(promptLimit === null) promptLimit = Infinity;

		Object.defineProperty(this, 'client', { value: client });

		this.args = new Array(args.length);

		let hasInfinite = false;
		let hasOptional = false;
		for(let i = 0; i < args.length; i++) {
			if(hasInfinite) throw new Error('No other argument may come after an infinite argument.');
			if(args[i].default !== null) hasOptional = true;
			else if(hasOptional) throw new Error('Required arguments may not come after optional arguments.');
			this.args[i] = new Argument(this.client, args[i]);
			if(this.args[i].infinite) hasInfinite = true;
		}

		this.promptLimit = promptLimit;
	}

	async obtain(msg, provided = [], promptLimit = this.promptLimit) {
		this.client.dispatcher._awaiting.add(msg.author.id + msg.channel.id);
		const values = {};
		const results = [];

		try {
			for(let i = 0; i < this.args.length; i++) {
				const arg = this.args[i];
				const result = await arg.obtain(msg, arg.infinite ? provided.slice(i) : provided[i], promptLimit);
				results.push(result);

				if(result.cancelled) {
					this.client.dispatcher._awaiting.delete(msg.author.id + msg.channel.id);
					return {
						values: null,
						cancelled: result.cancelled,
						prompts: [].concat(...results.map(res => res.prompts)),
						answers: [].concat(...results.map(res => res.answers))
					};
				}

				values[arg.key] = result.value;
			}
		} catch(err) {
			this.client.dispatcher._awaiting.delete(msg.author.id + msg.channel.id);
			throw err;
		}

		this.client.dispatcher._awaiting.delete(msg.author.id + msg.channel.id);
		return {
			values,
			cancelled: null,
			prompts: [].concat(...results.map(res => res.prompts)),
			answers: [].concat(...results.map(res => res.answers))
		};
	}
}

module.exports = ArgumentCollector;