const { Scenes, Markup } = require('telegraf');
const inlineKeyboards = require('../keyboards/inline.js');
const defaultKeyboards = require('../keyboards/default.js');
const db = require('../utils/db.js');

const sleep = s => new Promise(r => setTimeout(r, s * 1000));
const phoneNumberRegex = /\+998\d{9}/;

const registrationScene = new Scenes.WizardScene(
  'REGISTRATION',
  async (ctx) => {
    ctx.wizard.state.data = { telegram_id: ctx.from.id, full_name: `${ctx.from.first_name} ${ctx.from.last_name || ''}` }
    await ctx.replyWithHTML(ctx.i18n.t('language.title'), inlineKeyboards.languageMenu);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.callbackQuery.data.match(/^language:(.+)$/)) {
      const lang = ctx.callbackQuery.data.split(':')[1];
      ctx.wizard.state.data.lang = lang;
      ctx.i18n.locale(lang);
      await ctx.answerCbQuery(ctx.i18n.t('language.success'));
      await ctx.deleteMessage();
      await ctx.replyWithHTML(ctx.i18n.t('registration.title'));
      await ctx.replyWithHTML(ctx.i18n.t('agree.title'), inlineKeyboards.agreeMenu(ctx.i18n));
      return ctx.wizard.next();
    } 
  },
  async (ctx) => {
    if (ctx.callbackQuery.data == 'agree') {
      await ctx.deleteMessage();
      await ctx.replyWithHTML(ctx.i18n.t('phoneNumber.title'), defaultKeyboards.phoneNumberMenu(ctx.i18n));
      return ctx.wizard.next();
    }
  },
  async (ctx) => {
    let phoneNumber = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
    phoneNumber = phoneNumber.includes('+') ? phoneNumber : `+${phoneNumber}`;
    if (phoneNumber.match(phoneNumberRegex)) {
      ctx.wizard.state.data.phone_number = phoneNumber;
      await db.addUser(ctx.wizard.state.data);
      await ctx.replyWithHTML(ctx.i18n.t('registration.success'), Markup.removeKeyboard());
      await sleep(0.5);
      await ctx.replyWithHTML(ctx.i18n.t('welcome'), inlineKeyboards.homeMenu(ctx.i18n));
      return ctx.scene.leave();
    } else {
      return ctx.replyWithHTML(ctx.i18n.t('phoneNumber.invalid'), defaultKeyboards.phoneNumberMenu(ctx.i18n));
    }
  }
);

module.exports = registrationScene;