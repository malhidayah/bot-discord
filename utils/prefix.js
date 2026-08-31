const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "prefixes.json");
const DEFAULT_PREFIX = process.env.PREFIX || "!";
const MAX_PREFIX_LENGTH = 3;

function ensureFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}\n", "utf8");
}
function load() {
  ensureFile();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return {}; }
}
function save(data) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
}
function get(guildId) {
  if (!guildId) return DEFAULT_PREFIX;
  const data = load();
  return typeof data[guildId] === "string" ? data[guildId] : DEFAULT_PREFIX;
}
function set(guildId, prefix) {
  if (!guildId) return { ok: false, error: "Prefix hanya bisa diatur di server." };
  prefix = String(prefix || "").trim();
  if (!prefix) return { ok: false, error: "Prefix tidak boleh kosong." };
  if (prefix.length > MAX_PREFIX_LENGTH) return { ok: false, error: `Prefix maksimal ${MAX_PREFIX_LENGTH} karakter.` };
  if (/\s/.test(prefix)) return { ok: false, error: "Prefix tidak boleh mengandung spasi." };
  if (prefix === "/" || prefix === "@") return { ok: false, error: "Prefix itu bentrok dengan fitur Discord. Pilih yang lain." };
  const data = load();
  data[guildId] = prefix;
  save(data);
  return { ok: true, prefix };
}
function reset(guildId) {
  const data = load();
  delete data[guildId];
  save(data);
  return DEFAULT_PREFIX;
}
module.exports = { get, set, reset, DEFAULT_PREFIX, MAX_PREFIX_LENGTH };
