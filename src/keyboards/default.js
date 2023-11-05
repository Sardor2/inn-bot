const { Markup } = require('telegraf');

// const homeMenu = i18n => Markup.keyboard([
//   [Markup.button.text(i18n.t('home.hotels')), Markup.button.text(i18n.t('home.orders'))],
//   [Markup.button.text(i18n.t('home.help')), Markup.button.text(i18n.t('home.settings'))]
// ]).resize();

const homeMenu = i18n => Markup.keyboard([
  [Markup.button.webApp('s', 'https://5500-firsturdiev-bottemplate-dsz6tvoyu60.ws-eu81.gitpod.io/index.html')]
]);

const phoneNumberMenu = i18n => Markup.keyboard([
  [Markup.button.contactRequest(i18n.t('phoneNumber.send'))]
]).resize();

const hotelsMenu = i18n => Markup.keyboard([
  [Markup.button.text(i18n.t('hotels.region'))],
  [Markup.button.locationRequest(i18n.t('hotels.location'))],
  [Markup.button.text(i18n.t('goBack'))]
]).resize();

const locationMenu = i18n => Markup.keyboard([
  [Markup.button.locationRequest(i18n.t('hotels.location'))],
  [Markup.button.text(i18n.t('goBack'))]
]).resize();

module.exports = {
  homeMenu,
  phoneNumberMenu,
  hotelsMenu,
  locationMenu
};
