const config = require("../data/config.js");
const knex = require("knex")(config.KNEX_CONFIG);

async function createTables() {
  await knex.schema.hasTable("users").then(function (exists) {
    if (!exists) {
      return knex.schema.createTable("users", function (table) {
        table.increments().primary();
        table.bigint("telegram_id").unique();
        table.string("full_name");
        table.string("phone_number");
        table.string("lang");
        table.timestamp("joined_date").defaultTo(knex.fn.now());
      });
    }
  });
}

// Users

function addUser(data) {
  return knex("users").insert(data);
}

function getUser(telegram_id) {
  return knex("users").select("*").where({ telegram_id }).first();
}

function updateUser(telegram_id, data) {
  return knex("users").where({ telegram_id }).update(data);
}

// Hotels

function getHotels(data = {}) {
  return knex("hotels")
    .select("*")
    .where({ ...data, active: true });
}

function getHotelsByLocation(latitude, longitude, data = {}) {
  return knex("hotels")
    .select(
      knex.raw(`
		*,
		SQRT(
			POW(69.1 * (latitude - ${latitude}), 2) 
			+ POW(69.1 * (${longitude} - longitude) * COS(latitude / 57.3), 2)
		) AS distance
	`)
    )
    .where(data)
    .orderBy("distance")
    .limit(20);
}

function getHotel(id) {
  return knex("hotels").select("*").where({ id }).first();
}

// Rooms

function getRooms(data = {}) {
  return knex("rooms").select("*").where(data);
}

function getRoom(id) {
  return knex("rooms").select("*").where({ id }).first();
}

// Regions

function getRegions() {
  return knex("regions").select("*");
}

function getRegion(id) {
  return knex("regions").select("*").where({ id }).first();
}

// Bookings

function addReservation(data) {
  return knex("reservations").insert(data);
}

// Orders

async function getOrders(data = {}) {
  const reservations = await knex("reservations").select("*").where(data);
  const bookings = await knex("bookings").select("*").where(data);
  return [...reservations, ...bookings];
}

function getOrder(data = {}) {
  return knex("reservations").select("*").where(data).first();
}

function removeOrder(id) {
  return knex("reservations").where({ id }).del();
}

function updateOrder(target, data) {
  return knex("reservations").where(target).update(data);
}

function getReservations(data = {}) {
  return knex("reservations").select("*").where(data);
}

// Comfortables

function getComfort(id) {
  return knex("comfortables").select("*").where({ id }).first();
}

// Other

async function getHotelPrices(id) {
  let rooms = await getRooms({ hotel_id: id });
  if (rooms.length < 1) return null;

  rooms = rooms.map((item) => item.price);
  return [
    new Intl.NumberFormat().format(Math.min(...rooms)),
    new Intl.NumberFormat().format(Math.max(...rooms)),
  ];
}

async function countComments(id) {
  const result = await knex
    .count("id")
    .from("comments")
    .where({ hotel_id: id })
    .first();
  return result.count || 0;
}

async function getRoomPrice(type, hotelId) {
  const room = await knex("rooms")
    .select("*")
    .where({ type, hotel_id: hotelId })
    .first();
  return new Intl.NumberFormat().format(room?.price || 0);
}

function addBilling(data) {
  return knex("billing_payments").insert(data);
}

function getReservation(data) {
  return knex("reservations").select("*").where(data).first();
}

function getCorp(data) {
  return knex("corp").select("*").where(data).first();
}

module.exports = {
  knex,
  createTables,
  addUser,
  updateUser,
  getUser,
  getHotels,
  addReservation,
  getOrders,
  getOrder,
  getHotel,
  removeOrder,
  getRoom,
  getReservation,
  getRooms,
  getRegion,
  getCorp,
  getRegions,
  getHotelPrices,
  countComments,
  updateOrder,
  getRoomPrice,
  getReservations,
  getComfort,
  getHotelsByLocation,
  addBilling,
};
