const { match } = require('telegraf-i18n');
const { bot } = require('../loader.js');
const { Markup } = require('telegraf');
const db = require('../utils/db.js');
const defaultKeyboards = require('../keyboards/default.js');
const inlineKeyboards = require('../keyboards/inline.js');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const HTMLParser = require('node-html-parser');
const moment = require('moment');
const crypto = require('crypto');
const fs = require('fs');
const config = require('../data/config.js');
const base64 = require('base-64');
const { default: axios } = require('axios');

const sleep = s => new Promise(r => setTimeout(r, s * 1000));
const HOTELS_PER_PAGE = 10;

function registerHandlers() {

  // Starter

  bot.start(async (ctx) => {
    ctx.session.flag = null;
    return ctx.replyWithHTML(ctx.i18n.t('welcome'), inlineKeyboards.homeMenu(ctx.i18n));
  });

  bot.command('lang', (ctx) => {
    return ctx.replyWithHTML(ctx.i18n.t('language.title'), inlineKeyboards.languageMenu);
  })

  bot.action(/^language:(.+)$/, async (ctx) => {
    const lang = ctx.match[1];
    ctx.i18n.locale(lang);
    await db.updateUser(ctx.from.id, { lang });
    await ctx.answerCbQuery(ctx.i18n.t('language.success'));
    await ctx.deleteMessage();
    return ctx.replyWithHTML(ctx.i18n.t('welcome'), inlineKeyboards.homeMenu(ctx.i18n));
  })

  // Corporate

  bot.action('home:corporate', async (ctx) => {
    ctx.session.flag = 'corporate';
    return ctx.editMessageText(ctx.i18n.t('hotels.typeCode'), inlineKeyboards.emptyMenu);
  })

  bot.on('text', async (ctx, next) => {
    if (ctx.session.flag == 'corporate') {
      const corp = await db.getCorp({ code: ctx.message.text });
      if (corp) {
        ctx.session.corp = corp;
        const date = new Date();
        ctx.session.year = date.getFullYear();
        ctx.session.month = date.getMonth() + 1;
        return ctx.editMessageText(ctx.i18n.t('hotels.chooseStartDate'), inlineKeyboards.chooseStartDate(ctx.i18n, ctx.session.year, ctx.session.month));
      } else {
        return ctx.replyWithHTML(ctx.i18n.t('hotels.errorCorp'));
      }
    }

    return next();
  })

  // My reservation

  bot.action('home:orders', async (ctx) => {
    return ctx.editMessageText(ctx.i18n.t('selectOrder'), await inlineKeyboards.ordersMenu(ctx.i18n, ctx.session.user.id));
  })

  bot.action(/orders:(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    const order = await db.getReservation({ id });
    const hotel = await db.getHotel(order.hotel_id);
    const room = await db.getRoom(order.rooms.split(';')[0]);
    // const billing = await db.getBilling({ reservation_id: order.id });
    const dict = {
      reservationId: order.order,
      hotelTitle: hotel.title_ru,
      startDate: moment(order.start_date).format('DD.MM.YYYY'),
      endDate: moment(order.end_date).format('DD.MM.YYYY'),
      roomsCount: order.rooms.split(';').length,
      roomType: ctx.i18n.t(`hotels.${order.room_type}`),
      adultsCount: order.adults,
      childrenCount: order.children,
      pay: ctx.i18n.t(`hotels.${order.pay_type}`),
      roomPrice: room.price,
      daysCount: moment(order.end_date).diff(moment(order.start_date), 'days'),
      amount: order.amount,
      status: order.status
    };
    return ctx.editMessageText(ctx.i18n.t('invoiceView', dict), { reply_markup: inlineKeyboards.orderMenu(ctx.i18n, order.id, order.status, order.pay_type).reply_markup, parse_mode: 'HTML', disable_web_page_preview: true });
  })

  bot.action('orders:back', async (ctx) => {
    return ctx.editMessageText(ctx.i18n.t('welcome'), inlineKeyboards.homeMenu(ctx.i18n));
  })

  bot.action('order:back', async (ctx) => {
    return ctx.editMessageText(ctx.i18n.t('selectOrder'), await inlineKeyboards.ordersMenu(ctx.i18n, ctx.session.user.id));
  })

  bot.action(/order:remove:(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    await db.updateOrder({ id }, { status: 'REJECTED' });
    await ctx.answerCbQuery(ctx.i18n.t('removeOrderAnswer'), { show_alert: true });
    return ctx.editMessageText(ctx.i18n.t('selectOrder'), await inlineKeyboards.ordersMenu(ctx.i18n, ctx.session.user.id));
  })

  // Back

  bot.action(/(\w+):back$/, async (ctx) => {
    switch (ctx.match[1]) {
      case 'startDate':
        return ctx.editMessageText(ctx.i18n.t('goHome'), inlineKeyboards.homeMenu(ctx.i18n));

      case 'endDate':
        return ctx.editMessageText(ctx.i18n.t('hotels.chooseStartDate'), inlineKeyboards.chooseStartDate(ctx.i18n, ctx.session.year, ctx.session.month));

      case 'hotels':
        return ctx.editMessageText(ctx.i18n.t('hotels.chooseEndDate'), inlineKeyboards.chooseEndDate(ctx.i18n, ctx.session.year, ctx.session.month, ctx.session.startDate));

      case 'regions':
        return ctx.editMessageText(ctx.i18n.t('hotels.title'), inlineKeyboards.hotelsMenu(ctx.i18n));

      // case 'place':
      //   return ctx.editMessageText(ctx.i18n.t('hotels.title'), inlineKeyboards.hotelsMenu(ctx.i18n));

      case 'rating':
        return ctx.editMessageText(ctx.i18n.t('hotels.title'), inlineKeyboards.hotelsMenu(ctx.i18n));

      case 'count':
        return ctx.editMessageText(ctx.i18n.t('hotels.chooseRating'), inlineKeyboards.ratingMenu(ctx.i18n, ctx.session.two, ctx.session.three, ctx.session.four, ctx.session.five));

      case 'type':
        const hotel = ctx.session.hotel;
        const title = hotel[`title_ru`];
        let comfort = [];
        const lang = ctx.i18n.locale();
        const comforts = hotel.comfortables.split(';');
        for (const com of comforts) {
          const data = await db.getComfort(com)
          console.log(data);
          comfort.push(data[`title_${lang}`] || data[`title_ru`])
        }
        const prices = await db.getHotelPrices(hotel.id);
        const commentsCount = await db.countComments(hotel.id);
        return ctx.editMessageCaption(ctx.i18n.t('hotels.markup', { title, price: prices?.join(' - ') || 0, comfortables: comfort.join(', ') || '', address: hotel.address, address_url: `https://www.google.com/maps/place/${hotel.latitude},${hotel.longitude}` }), { parse_mode: 'HTML', reply_markup: inlineKeyboards.hotelMenu(ctx.i18n, hotel.id, hotel.photos_url, hotel.comments_url, commentsCount).reply_markup });

      case 'hotels2':
        await ctx.deleteMessage();
        return ctx.replyWithHTML(ctx.i18n.t('hotels.selectCount'), inlineKeyboards.chooseCountMenu(ctx.i18n, ctx.session.roomsCount, ctx.session.adultsCount, ctx.session.childrenCount));

      case 'hotel':
        await ctx.deleteMessage();
        return ctx.replyWithHTML(ctx.i18n.t('hotels.select'), inlineKeyboards.hotelsSelectMenu(ctx.i18n, ctx.session.currentHotels, ctx.session.cursor + 1, ctx.session.all));

      case 'payment':
        const singlePrice = await db.getRoomPrice('single', ctx.session.hotel.id);
        const doublePrice = await db.getRoomPrice('double', ctx.session.hotel.id);
        const triplePrice = await db.getRoomPrice('triple', ctx.session.hotel.id);
        const familyPrice = await db.getRoomPrice('family', ctx.session.hotel.id);
        const deluxePrice = await db.getRoomPrice('deluxe', ctx.session.hotel.id);
        return ctx.editMessageCaption(ctx.i18n.t('hotels.selectType', { singlePrice, doublePrice, triplePrice, familyPrice, deluxePrice }), { reply_markup: inlineKeyboards.chooseTypeMenu(ctx.i18n).reply_markup, parse_mode: 'HTML' });
    }
  })

  bot.hears(match('goBack'), async (ctx) => {
    switch (ctx.session.flag) {
      case 'region':
        ctx.session.flag = null;
        await ctx.replyWithHTML('🔙', Markup.removeKeyboard());
        return ctx.replyWithHTML(ctx.i18n.t('hotels.title'), inlineKeyboards.hotelsMenu(ctx.i18n));
    }
  })

  // Other

  bot.action('empty', async (ctx) => {
    return ctx.answerCbQuery();
  })

  // Hotels

  bot.action('home:hotels', async (ctx) => {
    const date = new Date();
    ctx.session.year = date.getFullYear();
    ctx.session.month = date.getMonth() + 1;
    return ctx.editMessageText(ctx.i18n.t('hotels.chooseStartDate'), inlineKeyboards.chooseStartDate(ctx.i18n, ctx.session.year, ctx.session.month));
  })

  // Start and end dates

  bot.action('startDate:prev', async (ctx) => {
    if (ctx.session.month <= 1) {
      ctx.session.year--;
      ctx.session.month = 12;
    } else {
      ctx.session.month--;
    }
    return ctx.editMessageText(ctx.i18n.t('hotels.chooseStartDate'), inlineKeyboards.chooseStartDate(ctx.i18n, ctx.session.year, ctx.session.month));
  })

  bot.action('startDate:next', async (ctx) => {
    if (ctx.session.month >= 12) {
      ctx.session.year++;
      ctx.session.month = 1;
    } else {
      ctx.session.month++;
    }
    return ctx.editMessageText(ctx.i18n.t('hotels.chooseStartDate'), inlineKeyboards.chooseStartDate(ctx.i18n, ctx.session.year, ctx.session.month));
  })

  bot.action(/startDate:(\S+)$/, async (ctx) => {
    ctx.session.startDate = ctx.match[1];
    if (moment().isSameOrBefore(ctx.session.startDate, 'day'))
      return ctx.editMessageText(ctx.i18n.t('hotels.chooseEndDate'), inlineKeyboards.chooseEndDate(ctx.i18n, ctx.session.year, ctx.session.month, ctx.session.startDate));
    return ctx.answerCbQuery(ctx.i18n.t('hotels.invalidDate'), { show_alert: true });
  })

  bot.action('endDate:prev', async (ctx) => {
    if (ctx.session.month <= 1) {
      ctx.session.year--;
      ctx.session.month = 12;
    } else {
      ctx.session.month--;
    }
    return ctx.editMessageText(ctx.i18n.t('hotels.chooseEndDate'), inlineKeyboards.chooseEndDate(ctx.i18n, ctx.session.year, ctx.session.month, ctx.session.startDate));
  })

  bot.action('endDate:next', async (ctx) => {
    if (ctx.session.month >= 12) {
      ctx.session.year++;
      ctx.session.month = 1;
    } else {
      ctx.session.month++;
    }
    return ctx.editMessageText(ctx.i18n.t('hotels.choosEendDate'), inlineKeyboards.chooseEndDate(ctx.i18n, ctx.session.year, ctx.session.month, ctx.session.startDate));
  })

  bot.action(/endDate:(\S+)$/, async (ctx) => {
    ctx.session.endDate = ctx.match[1];
    ctx.session.daysCount = moment(ctx.session.endDate).diff(moment(ctx.session.startDate), 'days');
    if (moment(ctx.session.endDate).isAfter(ctx.session.startDate, 'day')) {
      await ctx.deleteMessage();
      await ctx.replyWithHTML(ctx.i18n.t('hotels.chosenDate', { startDate: moment(ctx.session.startDate).format('DD.MM.YYYY'), endDate: moment(ctx.session.endDate).format('DD.MM.YYYY'), days: ctx.session.daysCount }));
      await sleep(0.5);
      return ctx.replyWithHTML(ctx.i18n.t('hotels.title'), inlineKeyboards.hotelsMenu(ctx.i18n));
    }
    return ctx.answerCbQuery(ctx.i18n.t('hotels.invalidDate'), { show_alert: true });
  })

  // Region / Location

  bot.action('hotels:region', async (ctx) => {
    return ctx.editMessageText(ctx.i18n.t('hotels.chooseRegion'), inlineKeyboards.regionsMenu(ctx.i18n));
  })

  bot.action(/regions:(\d+)$/, async (ctx) => {
    ctx.session.region = parseInt(ctx.match[1]);
    ctx.session.searchType = 'region';
    const hotels = await db.getHotels({ region_id: ctx.session.region });
    ctx.session.two = hotels.filter(item => item.rating == 2).length;
    ctx.session.three = hotels.filter(item => item.rating == 3).length;
    ctx.session.four = hotels.filter(item => item.rating == 4).length;
    ctx.session.five = hotels.filter(item => item.rating == 5).length;
    return ctx.editMessageText(ctx.i18n.t('hotels.chooseRating'), inlineKeyboards.ratingMenu(ctx.i18n, ctx.session.two, ctx.session.three, ctx.session.four, ctx.session.five));
  })

  bot.action('hotels:location', async (ctx) => {
    ctx.session.flag = 'region';
    await ctx.deleteMessage();
    return ctx.replyWithHTML(ctx.i18n.t('hotels.locationButton'), defaultKeyboards.locationMenu(ctx.i18n));
  })

  // Location

  bot.on('location', async (ctx) => {
    if (ctx.session.flag == 'region') {
      ctx.session.flag = null;
      ctx.session.searchType = 'location';
      ctx.session.longitude = ctx.message.location.longitude;
      ctx.session.latitude = ctx.message.location.latitude;
      const hotels = await db.getHotelsByLocation(ctx.session.latitude, ctx.session.longitude);
      ctx.session.two = hotels.filter(item => item.rating == 2).length;
      ctx.session.three = hotels.filter(item => item.rating == 3).length;
      ctx.session.four = hotels.filter(item => item.rating == 4).length;
      ctx.session.five = hotels.filter(item => item.rating == 5).length;
      await ctx.replyWithHTML('🔙', Markup.removeKeyboard());
      return ctx.replyWithHTML(ctx.i18n.t('hotels.chooseRating'), inlineKeyboards.ratingMenu(ctx.i18n, ctx.session.two, ctx.session.three, ctx.session.four, ctx.session.five));
    }
  })

  // Place type 

  // bot.action(/place:(\w+)$/, async (ctx) => {
  //   ctx.session.placeType = ctx.match[1];
  //   if (ctx.session.placeType != 'hotel')
  //     return ctx.answerCbQuery(ctx.i18n.t('hotels.noItems'), { show_alert: true });
  //   return ctx.editMessageText(ctx.i18n.t('hotels.chooseRating'), inlineKeyboards.ratingMenu(ctx.i18n));
  // })

  // Rating

  bot.action(/rating:(\d+)$/, async (ctx) => {
    ctx.session.rating = parseInt(ctx.match[1]);
    ctx.session.roomsCount = 1;
    ctx.session.adultsCount = 1;
    ctx.session.childrenCount = 0;
    return ctx.editMessageText(ctx.i18n.t('hotels.selectCount'), inlineKeyboards.chooseCountMenu(ctx.i18n, ctx.session.roomsCount, ctx.session.adultsCount, ctx.session.childrenCount));
  })

  // Counts

  bot.action(/minus:(\w+)$/, async (ctx) => {
    switch (ctx.match[1]) {
      case 'rooms':
        ctx.session.roomsCount = ctx.session.roomsCount > 1 ? ctx.session.roomsCount - 1 : ctx.session.roomsCount;
        return ctx.editMessageReplyMarkup(inlineKeyboards.chooseCountMenu(ctx.i18n, ctx.session.roomsCount, ctx.session.adultsCount, ctx.session.childrenCount).reply_markup);

      case 'adults':
        ctx.session.adultsCount = ctx.session.adultsCount > 1 ? ctx.session.adultsCount - 1 : ctx.session.adultsCount;
        return ctx.editMessageReplyMarkup(inlineKeyboards.chooseCountMenu(ctx.i18n, ctx.session.roomsCount, ctx.session.adultsCount, ctx.session.childrenCount).reply_markup);

      case 'children':
        ctx.session.childrenCount = ctx.session.childrenCount > 0 ? ctx.session.childrenCount - 1 : ctx.session.childrenCount;
        return ctx.editMessageReplyMarkup(inlineKeyboards.chooseCountMenu(ctx.i18n, ctx.session.roomsCount, ctx.session.adultsCount, ctx.session.childrenCount).reply_markup);
    }
  })

  bot.action(/plus:(\w+)$/, async (ctx) => {
    switch (ctx.match[1]) {
      case 'rooms':
        ctx.session.roomsCount++;
        return ctx.editMessageReplyMarkup(inlineKeyboards.chooseCountMenu(ctx.i18n, ctx.session.roomsCount, ctx.session.adultsCount, ctx.session.childrenCount).reply_markup);

      case 'adults':
        ctx.session.adultsCount++;
        return ctx.editMessageReplyMarkup(inlineKeyboards.chooseCountMenu(ctx.i18n, ctx.session.roomsCount, ctx.session.adultsCount, ctx.session.childrenCount).reply_markup);

      case 'children':
        ctx.session.childrenCount++;
        return ctx.editMessageReplyMarkup(inlineKeyboards.chooseCountMenu(ctx.i18n, ctx.session.roomsCount, ctx.session.adultsCount, ctx.session.childrenCount).reply_markup);
    }
  })

  // Show hotels

  bot.action('count:next', async (ctx) => {
    ctx.session.hotels = ctx.session.searchType == 'region' ? await db.getHotels({ rating: ctx.session.rating, region_id: ctx.session.region }) : await db.getHotelsByLocation(ctx.session.latitude, ctx.session.longitude);
    ctx.session.cursor = 0;
    ctx.session.all = Math.ceil(ctx.session.hotels.length / HOTELS_PER_PAGE);
    ctx.session.currentHotels = ctx.session.hotels.slice(ctx.session.cursor * HOTELS_PER_PAGE, ctx.session.cursor * HOTELS_PER_PAGE + HOTELS_PER_PAGE);
    if (ctx.session.hotels.length < 1) {
      await ctx.deleteMessage();
      await ctx.replyWithHTML(ctx.i18n.t('hotels.noHotels'));
      await sleep(0.7);
      return ctx.replyWithHTML(ctx.i18n.t('welcome'), inlineKeyboards.homeMenu(ctx.i18n));
    }
    await ctx.deleteMessage();
    return ctx.replyWithHTML(ctx.i18n.t('hotels.select'), inlineKeyboards.hotelsSelectMenu(ctx.i18n, ctx.session.currentHotels, ctx.session.cursor + 1, ctx.session.all));
  })

  bot.action(/hotels:(prev|next)$/, async (ctx) => {
    switch (ctx.match[1]) {
      case 'prev':
        if (ctx.session.cursor > 0) {
          ctx.session.cursor--;
          ctx.session.currentHotels = ctx.session.hotels.slice(ctx.session.cursor * HOTELS_PER_PAGE, ctx.session.cursor * HOTELS_PER_PAGE + HOTELS_PER_PAGE);
          return ctx.editMessageReplyMarkup(inlineKeyboards.hotelsSelectMenu(ctx.i18n, ctx.session.currentHotels, ctx.session.cursor + 1, ctx.session.all).reply_markup);
        }

      case 'next':
        if (ctx.session.cursor < ctx.session.all - 1) {
          ctx.session.cursor++;
          ctx.session.currentHotels = ctx.session.hotels.slice(ctx.session.cursor * HOTELS_PER_PAGE, ctx.session.cursor * HOTELS_PER_PAGE + HOTELS_PER_PAGE);
          return ctx.editMessageReplyMarkup(inlineKeyboards.hotelsSelectMenu(ctx.i18n, ctx.session.currentHotels, ctx.session.cursor + 1, ctx.session.all).reply_markup);
        }
    }
  })

  bot.action(/hotels:(\d+)$/, async (ctx) => {
    const hotelId = ctx.match[1];
    const hotel = await db.getHotel(hotelId);
    const title = hotel[`title_ru`];
    let comfort = [];
    const lang = ctx.i18n.locale();
    const comforts = hotel.comfortables.split(';');
    for (const com of comforts) {
      const data = await db.getComfort(com)
      console.log(data);
      comfort.push(data[`title_${lang}`] || data[`title_ru`])
    }
    const prices = await db.getHotelPrices(hotel.id);
    const commentsCount = await db.countComments(hotel.id);
    await ctx.deleteMessage();
    return ctx.replyWithPhoto(hotel.main_photo, { caption: ctx.i18n.t('hotels.markup', { title, price: prices?.join(' - ') || 0, comfortables: comfort.join(', ') || '', address: hotel.address, address_url: `https://www.google.com/maps/place/${hotel.latitude},${hotel.longitude}` }), parse_mode: 'HTML', reply_markup: inlineKeyboards.hotelMenu(ctx.i18n, hotel.id, hotel.photos_url, hotel.comments_url, commentsCount).reply_markup });
  })

  // Room type

  bot.action(/order:(\d+)$/, async (ctx) => {
    const id = ctx.match[1];
    ctx.session.hotel = await db.getHotel(id);
    const singlePrice = await db.getRoomPrice('single', ctx.session.hotel.id);
    const doublePrice = await db.getRoomPrice('double', ctx.session.hotel.id);
    const triplePrice = await db.getRoomPrice('triple', ctx.session.hotel.id);
    const familyPrice = await db.getRoomPrice('family', ctx.session.hotel.id);
    const deluxePrice = await db.getRoomPrice('deluxe', ctx.session.hotel.id);
    return ctx.editMessageCaption(ctx.i18n.t('hotels.selectType', { singlePrice, doublePrice, triplePrice, familyPrice, deluxePrice }), { reply_markup: inlineKeyboards.chooseTypeMenu(ctx.i18n).reply_markup, parse_mode: 'HTML' });
  })

  // Payment

  bot.action(/type:(\w+)$/, async (ctx) => {
    ctx.session.roomType = ctx.match[1];
    const orders = await db.getOrders({ hotel_id: ctx.session.hotel.id, room_type: ctx.session.roomType });
    const excludeIds = [];
    const startDate = new Date(ctx.session.startDate);
    const endDate = new Date(ctx.session.endDate);
    orders.forEach(item => {
      if ((endDate < item.start_date) || (startDate > item.end_date)) {
        return;
      } else {
        excludeIds.push(...item.rooms.split(';').map(item => parseInt(item)));
      }
    });
    const sizes = ctx.session.childrenCount + ctx.session.adultsCount;
    let emptyRooms = await db.getRooms({ hotel_id: ctx.session.hotel.id, type: ctx.session.roomType });
    emptyRooms = emptyRooms.filter(item => !excludeIds.includes(item.id));
    if (emptyRooms.length >= ctx.session.roomsCount) {
      ctx.session.rooms = emptyRooms.slice(0, ctx.session.roomsCount);
      if (ctx.session.rooms.reduce((base, item) => base + item.size, 0) < sizes) {
        return ctx.answerCbQuery(ctx.i18n.t('hotels.noSizes'), { show_alert: true });
      }
      return ctx.editMessageCaption(ctx.i18n.t('hotels.choosePayment'), inlineKeyboards.choosePayment(ctx.i18n));
    } else {
      return ctx.answerCbQuery(ctx.i18n.t('hotels.noRooms'), { show_alert: true });
    }
  })

  // Reservation

  bot.action(/pay:(\w+)$/, async (ctx) => {
    ctx.session.payType = ctx.match[1];
    const roomPrice = ctx.session.rooms[0].price;
    const roomsCount = ctx.session.roomsCount;
    const daysCount = ctx.session.daysCount;
    const amount = (roomPrice * roomsCount) * daysCount;
    const uniqueId = crypto.randomInt(10000, 99999);

    const [reservationId] = (await db.addReservation({
      user_id: ctx.session.user.id,
      hotel_id: ctx.session.hotel.id,
      start_date: new Date(ctx.session.startDate),
      end_date: new Date(ctx.session.endDate),
      pay_type: ctx.session.payType,
      adults: ctx.session.adultsCount,
      children: ctx.session.childrenCount,
      rooms: ctx.session.rooms.map(item => item.id).join(';'),
      room_type: ctx.session.roomType,
      amount,
      order: uniqueId,
      corp_id: ctx.session?.corp?.id
    }));
    ctx.session.corp = null;

    if (ctx.session.payType == 'payme') {
      const [billingId] = (await db.addBilling({
        phone: ctx.session.user.phone_number,
        invoice_id: reservationId,
        summ: amount
      }));

      const axiosConfig = {
        method: 'GET',
        url: `https://checkout.paycom.uz/${base64.encode(`m=${config.PAYME_MERCHANT};ac.order_id=${billingId};ac.phone=${ctx.session.user.phone_number};a=${amount}00`)}`,
        headers: {
          'Authorization': `Basic ${base64.encode(`Paycom:${config.PAYME_TOKEN}`)}`,
          'Content-Type': 'application/json',
        },
      };
      const { data } = await axios(axiosConfig)
      const root = HTMLParser.parse(data, {
        blockTextElements: {
          script: true,
          noscript: true,
          style: true,
          pre: true
        }
      });
      ctx.session.payUrl = root.querySelector('meta[property="og:url"]').getAttribute('content');
    }

    const lang = ctx.i18n.locale();
    const title = ctx.session.hotel[`title_ru`];
    const addressUrl = `https://www.google.com/maps/place/${ctx.session.hotel.latitude},${ctx.session.hotel.longitude}`

    await ctx.deleteMessage();
    await ctx.sendChatAction('typing');
    await sleep(0.5);
    const keyboard = ctx.session.payType == 'payme' ? inlineKeyboards.payMenu(ctx.i18n, ctx.session.payUrl) : null;
    const message = await ctx.replyWithHTML(ctx.i18n.t('invoice', {
      reservationId: uniqueId,
      hotelTitle: title,
      startDate: moment(ctx.session.startDate).format('DD.MM.YYYY'),
      endDate: moment(ctx.session.endDate).format('DD.MM.YYYY'),
      roomsCount,
      roomType: ctx.i18n.t(`hotels.${ctx.session.roomType}`),
      adultsCount: ctx.session.adultsCount,
      childrenCount: ctx.session.childrenCount,
      pay: ctx.i18n.t(`hotels.${ctx.session.payType}`),
      roomPrice,
      daysCount,
      amount
    }), keyboard);
    await sleep(0.5);
    await ctx.replyWithLocation(ctx.session.hotel.latitude, ctx.session.hotel.longitude, { reply_to_message_id: message.message_id, reply_markup: inlineKeyboards.locationMenu(ctx.i18n, addressUrl).reply_markup });

    // try {
    // Create a browser instance
    const browser = await puppeteer.launch({
      args: ['--no-sandbox'],
      timeout: 10000
    });

    // Create a new page
    const page = await browser.newPage();

    const req = await fs.promises.readFile(process.cwd() + `/src/web/${lang}.html`, { encoding: 'utf-8' });
    const res = req;
    const html = HTMLParser.parse(res, {
      blockTextElements: {
        script: true,
        noscript: true,
        style: true,
        pre: true
      }
    });

    // DOM

    html.querySelectorAll('.bot__photo').forEach(elem => elem.setAttribute('src', ctx.session.hotel.main_photo));
    html.querySelectorAll('.bot__title').forEach(elem => elem.textContent = title);
    html.querySelectorAll('.bot__phone-number').forEach(elem => elem.textContent = ctx.session.user.phone_number);
    html.querySelectorAll('.bot__address').forEach(elem => elem.textContent = ctx.session.hotel.address);
    html.querySelectorAll('.bot__start-date').forEach(elem => elem.textContent = moment(ctx.session.startDate).format('DD.MM.YYYY'));
    html.querySelectorAll('.bot__end-date').forEach(elem => elem.textContent = moment(ctx.session.endDate).format('DD.MM.YYYY'));
    html.querySelectorAll('.bot__full-name').forEach(elem => elem.textContent = ctx.session.user.full_name);
    html.querySelectorAll('.bot__booking-id').forEach(elem => elem.textContent = uniqueId);
    html.querySelectorAll('.bot__days').forEach(elem => elem.textContent = daysCount);
    html.querySelectorAll('.bot__rooms').forEach(elem => elem.textContent = roomsCount);
    html.querySelectorAll('.bot__room-price').forEach(elem => elem.textContent = roomPrice);
    html.querySelectorAll('.bot__order-price').forEach(elem => elem.textContent = amount);
    html.querySelectorAll('.bot__people-count').forEach(elem => elem.textContent = ctx.session.childrenCount + ctx.session.adultsCount);

    const text = html.toString();

    await ctx.replyWithChatAction('upload_document');

    // Open URL in current page
    await page.setContent(text, {
      waitUntil: 'load'
    });

    //To reflect CSS used for screens instead of print
    await page.emulateMediaType('screen');

    // Download the PDF
    const pdf = await page.pdf({
      printBackground: true,
      displayHeaderFooter: true,
      landscape: true,
      pageRanges: '1-1'
    });

    await ctx.replyWithDocument({ source: pdf, filename: `Your-invoice-${uniqueId}.pdf` }, { caption: ctx.i18n.t('invoicePDF'), parse_mode: 'HTML' });

    // Close the browser instance
    await browser.close();
    // } catch (err) {
    //   console.log(err);
    //   await ctx.replyWithDocument('https://dl.uploadgram.me/63318ecc41055h?dl', { caption: ctx.i18n.t('invoicePDF'), parse_mode: 'HTML' });
    // }

    return ctx.replyWithHTML(ctx.i18n.t('welcome'), inlineKeyboards.homeMenu(ctx.i18n));
  })

}

module.exports = registerHandlers;
