module.exports = {
	Client: require('./client'),
	CommandoClient: require('./client'),
	CommandoRegistry: require('./registry'),
	CommandDispatcher: require('./dispatcher'),
	CommandoGuild: require('./extensions/guild'),
	CommandoMessage: require('./extensions/message'),
	Command: require('./commands/base'),
	CommandGroup: require('./commands/group'),
	ArgumentCollector: require('./commands/collector'),
	Argument: require('./commands/argument'),
	ArgumentType: require('./types/base'),
	FriendlyError: require('./errors/friendly'),
	CommandFormatError: require('./errors/command-format'),

	util: require('./util'),
	version: require('../package').version,

	SettingProvider: require('./providers/base'),
	get SQLiteProvider() {
		return require('./providers/sqlite');
	},
	get SyncSQLiteProvider() {
		return require('./providers/sqlite-sync');
	}
};