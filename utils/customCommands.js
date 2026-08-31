const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "customCommands.json");
const MAX_COMMANDS_PER_GUILD = 50;
const MAX_NAME_LENGTH = 32;
const MAX_RESPONSE_LENGTH = 1800;

function ensureFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}\n", "utf8");
}

function load() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) || {};
  } catch (err) {
    console.error("[CUSTOM COMMANDS] Gagal membaca data:", err);
    return {};
  }
}

function save(data) {
  ensureFile();
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(temp, DATA_FILE);
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function isValidName(name) {
  return /^[a-z0-9_-]{1,32}$/i.test(name);
}

function getGuildCommands(guildId) {
  const data = load();
  return data[guildId] || {};
}

function get(guildId, name) {
  return getGuildCommands(guildId)[normalizeName(name)] || null;
}

function add(guildId, name, response) {
  name = normalizeName(name);
  response = String(response || "").trim();

  if (!isValidName(name)) {
    return { ok: false, error: "Nama command hanya boleh berisi huruf, angka, `_`, atau `-` (maks. 32 karakter)." };
  }
  if (!response) return { ok: false, error: "Isi balasan tidak boleh kosong." };
  if (response.length > MAX_RESPONSE_LENGTH) {
    return { ok: false, error: `Balasan terlalu panjang. Maksimal ${MAX_RESPONSE_LENGTH} karakter.` };
  }

  const data = load();
  const commands = data[guildId] || {};
  const exists = Boolean(commands[name]);

  if (!exists && Object.keys(commands).length >= MAX_COMMANDS_PER_GUILD) {
    return { ok: false, error: `Maksimal ${MAX_COMMANDS_PER_GUILD} custom command per server.` };
  }

  commands[name] = response;
  data[guildId] = commands;
  save(data);
  return { ok: true, updated: exists };
}

function remove(guildId, name) {
  name = normalizeName(name);
  const data = load();
  const commands = data[guildId] || {};
  if (!commands[name]) return false;

  delete commands[name];
  if (Object.keys(commands).length) data[guildId] = commands;
  else delete data[guildId];
  save(data);
  return true;
}

function list(guildId) {
  return Object.keys(getGuildCommands(guildId)).sort();
}

module.exports = {
  add,
  remove,
  get,
  list,
  MAX_COMMANDS_PER_GUILD,
  MAX_NAME_LENGTH,
  MAX_RESPONSE_LENGTH,
};
