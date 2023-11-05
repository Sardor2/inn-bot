const { Markup } = require('telegraf');
const db = require('../utils/db.js');

function getChunks(arr, len) {
  let chunks = [],
    i = 0,
    n = arr.length;

  while (i < n) {
    chunks.push(arr.slice(i, i += len));
  }

  return chunks;
}

const languageMenu = Markup.inlineKeyboard([
  [Markup.button.callback('🇺🇿 O\'zbekcha', 'language:uz')],
  [Markup.button.callback('🇷🇺 Русский', 'language:ru')],
  [Markup.button.callback('🇬🇧 English', 'language:en')]
]);

const agreeMenu = i18n => Markup.inlineKeyboard([
  [Markup.button.callback(i18n.t('agree.agree'), 'agree')]
]);

const regionsMenu = i18n => Markup.inlineKeyboard([
  [Markup.button.callback(i18n.t('regions.13'), 'regions:13')],
  [Markup.button.callback(i18n.t('regions.14'), 'regions:14')],
  [Markup.button.callback(i18n.t('regions.1'), 'regions:1'), Markup.button.callback(i18n.t('regions.2'), 'regions:2')],
  [Markup.button.callback(i18n.t('regions.3'), 'regions:3'), Markup.button.callback(i18n.t('regions.4'), 'regions:4')],
  [Markup.button.callback(i18n.t('regions.5'), 'regions:5'), Markup.button.callback(i18n.t('regions.6'), 'regions:6')],
  [Markup.button.callback(i18n.t('regions.7'), 'regions:7'), Markup.button.callback(i18n.t('regions.8'), 'regions:8')],
  [Markup.button.callback(i18n.t('regions.9'), 'regions:9'), Markup.button.callback(i18n.t('regions.10'), 'regions:10')],
  [Markup.button.callback(i18n.t('regions.11'), 'regions:11'), Markup.button.callback(i18n.t('regions.12'), 'regions:12')],
  [Markup.button.callback(i18n.t('goBack'), 'regions:back')],
]);

const ratingMenu = (i18n, two, three, four, five) => Markup.inlineKeyboard([
  [Markup.button.callback(`⭐⭐⭐⭐⭐ (${five})`, 'rating:5')],
  [Markup.button.callback(`⭐⭐⭐⭐ (${four})`, 'rating:4')],
  [Markup.button.callback(`⭐⭐⭐ (${three})`, 'rating:3')],
  [Markup.button.callback(`⭐⭐ (${two})`, 'rating:2')],
  [Markup.button.callback(i18n.t('goBack'), 'rating:back')]
]);

const hotelMenu = (i18n, id, photosUrl, commentsUrl, commentsCount) => {
  if (commentsCount > 0) {
    return Markup.inlineKeyboard([
      [Markup.button.callback(i18n.t('hotels.order'), `order:${id}`)],
      [Markup.button.url(i18n.t('hotels.viewPhotos'), photosUrl)],
      [Markup.button.url(i18n.t('hotels.viewComments', { count: commentsCount }), commentsUrl)],
      [Markup.button.callback(i18n.t('goBack'), 'hotel:back')]
    ]);
  } else {
    return Markup.inlineKeyboard([
      [Markup.button.callback(i18n.t('hotels.order'), `order:${id}`)],
      [Markup.button.url(i18n.t('hotels.viewPhotos'), photosUrl)],
      [Markup.button.callback(i18n.t('goBack'), 'hotel:back')]
    ]);
  }
}

const chooseStartDate = (i18n, year, month) => {
  const monthTitle = `${i18n.t(`calendar.months.${month}.title`)} (${year})`;
  const daysLen = Number(i18n.t(`calendar.months.${month}.days`));
  const buttons = [[Markup.button.callback(monthTitle, 'empty')]];
  let days = [];
  for (let i = 1; i <= daysLen; i++) {
    const day = `${year}-${month}-${i}`;
    days.push(Markup.button.callback(i, `startDate:${day}`));
  }
  days = getChunks(days, 6);
  buttons.push(...days);
  buttons.push([Markup.button.callback('◀️', 'startDate:prev'), Markup.button.callback('▶️', 'startDate:next')]);
  buttons.push([Markup.button.callback(i18n.t('goBack'), 'startDate:back')]);
  return Markup.inlineKeyboard(buttons);
}

const chooseEndDate = (i18n, year, month, startDate) => {
  const monthTitle = `${i18n.t(`calendar.months.${month}.title`)} (${year})`;
  const daysLen = Number(i18n.t(`calendar.months.${month}.days`));
  const buttons = [[Markup.button.callback(monthTitle, 'empty')]];
  let days = [];
  for (let i = 1; i <= daysLen; i++) {
    const day = `${year}-${month}-${i}`;
    days.push(Markup.button.callback(startDate == day ? `✅ ${i}` : i, `endDate:${day}`));
  }
  days = getChunks(days, 6);
  buttons.push(...days);
  buttons.push([Markup.button.callback('◀️', 'endDate:prev'), Markup.button.callback('▶️', 'endDate:next')]);
  buttons.push([Markup.button.callback(i18n.t('goBack'), 'endDate:back')]);
  return Markup.inlineKeyboard(buttons);
};

const hotelsSelectMenu = (i18n, hotels, cursor, all) => Markup.inlineKeyboard([
  ...hotels.map(hotel => [Markup.button.callback(hotel.title_ru, `hotels:${hotel.id}`)]),
  [Markup.button.callback('⏮️', 'hotels:prev'), Markup.button.callback(`${cursor}/${all}`, 'empty'), Markup.button.callback('⏭️', 'hotels:next')],
  [Markup.button.callback(i18n.t('goBack'), 'hotels2:back')]
]);

const choosePayment = i18n => Markup.inlineKeyboard([
  [Markup.button.callback(i18n.t('hotels.cash'), 'pay:cash')],
  [Markup.button.callback(i18n.t('hotels.payme'), 'pay:payme')],
  [Markup.button.callback(i18n.t('goBack'), 'payment:back')]
]);

const chooseCountMenu = (i18n, roomsCount, adultsCount, childrenCount) => Markup.inlineKeyboard([
  [Markup.button.callback(i18n.t('roomsCount'), 'empty')],
  [Markup.button.callback('➖', 'minus:rooms'), Markup.button.callback(roomsCount.toString(), 'empty'), Markup.button.callback('➕', 'plus:rooms')],
  [Markup.button.callback(i18n.t('adultsCount'), 'empty')],
  [Markup.button.callback('➖', 'minus:adults'), Markup.button.callback(adultsCount.toString(), 'empty'), Markup.button.callback('➕', 'plus:adults')],
  [Markup.button.callback(i18n.t('childrenCount'), 'empty')],
  [Markup.button.callback('➖', 'minus:children'), Markup.button.callback(childrenCount.toString(), 'empty'), Markup.button.callback('➕', 'plus:children')],
  [Markup.button.callback(i18n.t('hotels.next'), 'count:next')],
  [Markup.button.callback(i18n.t('goBack'), 'count:back')]
]);

const homeMenu = i18n => Markup.inlineKeyboard([
  [Markup.button.webApp(i18n.t('home.hotels'), 'https://guileless-brioche-59495c.netlify.app')],
  [Markup.button.callback(i18n.t('home.hotels'), 'home:hotels')],
  [Markup.button.callback(i18n.t('home.hostels'), 'home:hostels')],
  [Markup.button.callback(i18n.t('home.sanatoriums'), 'home:sanatoriums')],
  [Markup.button.callback(i18n.t('home.dachas'), 'home:dachas')],
  [Markup.button.callback(i18n.t('home.orders'), 'home:orders')],
  [Markup.button.callback(i18n.t('home.help'), 'home:help')],
  [Markup.button.callback(i18n.t('home.corporate'), 'home:corporate')]
]).resize();

const hotelsMenu = i18n => Markup.inlineKeyboard([
  [Markup.button.callback(i18n.t('hotels.region'), 'hotels:region')],
  [Markup.button.callback(i18n.t('hotels.location'), 'hotels:location')],
  [Markup.button.callback(i18n.t('goBack'), 'hotels:back')]
]);

const ordersMenu = async (i18n, id) => {
  const orders = await db.getReservations({ user_id: id });
  const buttons = orders.map((item, index) => [Markup.button.callback(`${item.status == 'UNPAID' ? '🕒' : (item.status == 'PAID' ? '✅' : '❌')} #${index + 1}`, `orders:${item.id}`)]);
  buttons.push([Markup.button.callback(i18n.t('goBack'), 'orders:back')]);
  return Markup.inlineKeyboard(buttons);
}

const goBackMenu = (i18n, data) => Markup.inlineKeyboard([
  [Markup.button.callback(i18n.t('goBack'), data)]
]);

const choosePlaceType = i18n => Markup.inlineKeyboard([
  [Markup.button.callback(i18n.t('hotels.hotel'), 'place:hotel')],
  [Markup.button.callback(i18n.t('hotels.hostel'), 'place:hostel')],
  [Markup.button.callback(i18n.t('hotels.sanatorium'), 'place:sanatorium')],
  [Markup.button.callback(i18n.t('hotels.dacha'), 'place:dacha')],
  [Markup.button.callback(i18n.t('goBack'), 'place:back')]
]);

const chooseTypeMenu = i18n => Markup.inlineKeyboard([
  [Markup.button.callback(i18n.t('hotels.single'), 'type:single')],
  [Markup.button.callback(i18n.t('hotels.double'), 'type:double')],
  [Markup.button.callback(i18n.t('hotels.triple'), 'type:triple')],
  [Markup.button.callback(i18n.t('hotels.family'), 'type:family')],
  [Markup.button.callback(i18n.t('hotels.deluxe'), 'type:deluxe')],
  [Markup.button.callback(i18n.t('goBack'), 'type:back')]
]);

const orderMenu = (i18n, orderId, status, payType) => {
  switch (status) {
    case 'UNPAID':
      return Markup.inlineKeyboard([
        [Markup.button.callback(i18n.t('removeOrder'), `order:remove:${orderId}`)],
        [Markup.button.callback(i18n.t('goBack'), 'order:back')]
      ]);

    default:
      return Markup.inlineKeyboard([
        [Markup.button.callback(i18n.t('goBack'), 'order:back')]
      ]);
  }
}

const showNextMenu = i18n => Markup.inlineKeyboard([
  [Markup.button.callback(i18n.t('hotels.showNextButton'), 'hotels:next')]
]);

const locationMenu = (i18n, addressUrl) => Markup.inlineKeyboard([
  [Markup.button.url(i18n.t('viewOnWeb'), addressUrl)]
]);

const payMenu = (i18n, url) => Markup.inlineKeyboard([
  [Markup.button.webApp(i18n.t('pay'), url)]
]);

const emptyMenu = Markup.inlineKeyboard([[]]);

module.exports = {
  languageMenu,
  agreeMenu,
  regionsMenu,
  ratingMenu,
  hotelMenu,
  locationMenu,
  chooseStartDate,
  chooseEndDate,
  choosePayment,
  chooseCountMenu,
  homeMenu,
  hotelsMenu,
  choosePlaceType,
  chooseTypeMenu,
  ordersMenu,
  goBackMenu,
  orderMenu,
  emptyMenu,
  showNextMenu,
  payMenu,
  hotelsSelectMenu
};