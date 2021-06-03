const ArgumentType = require('./base');

class StringArgumentType extends ArgumentType {
	constructor(client) {
		super(client, 'string');
	}

	validate(val, msg, arg) {
		if(arg.oneOf && !arg.oneOf.includes(val.toLowerCase())) {
			return `Bitte geben Sie eine der folgenden Optionen ein: ${arg.oneOf.map(opt => `\`${opt}\``).join(', ')}`;
		}
		if(arg.min !== null && typeof arg.min !== 'undefined' && val.length < arg.min) {
			return `Bitte gib nur zeichen über ${arg.label} ein oder verwende die exakten Zeichen ${arg.min}.`;
		}
		if(arg.max !== null && typeof arg.max !== 'undefined' && val.length > arg.max) {
			return `Bitte gib nur zeichen unter ${arg.label} ein oder verwende die exakten Zeichen ${arg.max}.`;
		}
		return true;
	}

	parse(val) {
		return val;
	}
}

module.exports = StringArgumentType;
