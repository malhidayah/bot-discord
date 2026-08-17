const {
  Client,
  GatewayIntentBits,
  Partials,
} = require("discord.js");

const readyHandler = require("./handlers/readyHandler");
const messageHandler = require("./handlers/messageHandler");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences, // WAJIB untuk membaca aktivitas user
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once("ready", () => readyHandler(client));
client.on("messageCreate", (message) => messageHandler(message));

process.on("unhandledRejection", (error) => console.error("[UNHANDLED REJECTION]", error));
process.on("uncaughtException", (error) => console.error("[UNCAUGHT EXCEPTION]", error));

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN belum diisi di .env");
  process.exit(1);
}

client.login(token).catch((err) => {
  console.error("Login gagal:", err);
  process.exit(1);
});
