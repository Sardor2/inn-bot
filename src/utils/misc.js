const { bot } = require('../loader.js');

async function setBotCommands() {
  await bot.telegram.setMyCommands([
    { command: 'start', description: '🔄 Botni qayta ishga tushirish | 🔄 Перезапустите бота | 🔄 Restart the bot' },
    { command: 'lang', description: '🇺🇿 Tilni o\'zgartirish | 🇷🇺 Изменить язык | 🇬🇧 Change the language '}
  ])
}

function logStartup() {
  bot.telegram.getMe().then(bot => {
    console.log(`\x1b[33mBot is running on @${bot.username}\x1b[0m`);
  });
}

function getChunks(arr, len) {
  let chunks = [],
    i = 0,
    n = arr.length;

  while (i < n) {
    chunks.push(arr.slice(i, i += len));
  }

  return chunks;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
  setBotCommands,
  logStartup,
  getChunks,
  sleep
}