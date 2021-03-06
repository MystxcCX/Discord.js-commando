class ArgumentType {
	constructor(client, id) {
		if(!client) throw new Error('A client must be specified.');
		if(typeof id !== 'string') throw new Error('Argument type ID must be a string.');
		if(id !== id.toLowerCase()) throw new Error('Argument type ID must be lowercase.');

		Object.defineProperty(this, 'client', { value: client });

		this.id = id;
	}

	validate(val, originalMsg, arg, currentMsg = originalMsg) {
		throw new Error(`${this.constructor.name} doesn't have a validate() method.`);
	}

	parse(val, originalMsg, arg, currentMsg = originalMsg) {
		throw new Error(`${this.constructor.name} doesn't have a parse() method.`);
	}

	isEmpty(val, originalMsg, arg, currentMsg = originalMsg) {
		if(Array.isArray(val)) return val.length === 0;
		return !val;
	}
}

module.exports = ArgumentType;
