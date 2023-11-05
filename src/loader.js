const { Telegraf, Scenes, session } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const config = require('./data/config.js');
const i18n = require('./utils/i18n.js');
const db = require('./utils/db.js');
const registrationScene = require('./scenes/registration.js');

// Bot

const bot = new Telegraf(config.BOT_TOKEN);

// Scenes

const stage = new Scenes.Stage([registrationScene]);

// Middlewares

const localSession = new LocalSession({
  storage: LocalSession.storageFileAsync
});

bot.use(localSession.middleware());
bot.use(i18n.middleware());
bot.use(stage.middleware());
bot.use(async (ctx, next) => {
  if (ctx.chat.type == 'private') {
    const user = await db.getUser(ctx.chat.id);
    if (!user)
      return ctx.scene.enter('REGISTRATION');
    ctx.session.user = user;
    ctx.i18n.locale(ctx.session.user.lang);
  }

  return next();
});

module.exports = {
  bot
};