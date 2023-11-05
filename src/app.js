const config = require('./data/config.js');
const { bot } = require('./loader.js');
const { setBotCommands, logStartup } = require('./utils/misc.js');
const registerHandlers = require('./handlers/handlers.js');
const { createTables } = require('./utils/db.js');

// Startup

async function init() {
  await createTables();
  registerHandlers();
  Array.prototype.move = function (from, to) {
    this.splice(to, 0, this.splice(from, 1)[0]);
  };

  await setBotCommands();
  bot.catch(err => console.log(err));
  logStartup();
  return bot.launch(config.BOT_CONFIG);
}

// Error handling

process.on('unhandledRejection', err => console.log(err));
process.on('uncaughtException', err => console.log(err));
process.on('rejectionHandled', err => console.log(err));

// Init

init();