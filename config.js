require("dotenv").config();

module.exports = {
  // Prefix untuk command teks, contoh: wo join, wo jodoh, dst.
  prefix: process.env.PREFIX || "!",

  // Jeda minimum (ms) sebelum user yang sama bisa memicu balasan sapaan lagi.
  userCooldown: Number(process.env.USER_COOLDOWN || 1200),

  // Kata-kata yang dianggap "memanggil" bot (di luar mention/reply),
  // dipakai untuk balasan sapaan singkat & ramah.
  CALL_WORD_REGEX: /(?:^|\s)(?:wo+|wok|wo~+|woy+|oi+|bot|wowo|wowo~|bro|bang|min)(?=\s|$|[!?.,~])/iu,

  // === GIF OTOMATIS BERDASARKAN KATA KUNCI ===
  // Setiap ada pesan (bukan command) yang mengandung salah satu kata kunci
  // di bawah, bot otomatis kirim GIF yang cocok.
  //
  // Format key   : kata/frasa pemicu, boleh lebih dari satu dipisah "|"
  // Format value : STRING -> query pencarian ke GIPHY (butuh GIPHY_API_KEY)
  //                ARRAY  -> daftar URL GIF langsung, dipilih random,
  //                          TIDAK butuh API key sama sekali.
  //
  // Sudah dicampur ekspresi umum + istilah/slang yang lagi rame dipakai
  // anak Indonesia tahun 2026. Silakan edit/tambah sesuai selera server kamu.
  GIF_KEYWORDS: {
    // --- ekspresi umum sehari-hari ---
    "wkwk|ngakak|kocak|lucu banget|awokwok": "laughing",
    "sedih|nangis|hiks|mewek": "crying",
    "mantap|keren|gg|goks|gaskeun": "thumbs up",
    "marah|kesel|bete|emosi": "angry",
    "kaget|anjay|anjir kaget": "shocked",
    "malu|salting": "embarrassed",
    "capek|lelah|cape banget": "tired",
    "ngantuk": "sleepy",
    "laper|lapar": "hungry",
    "gabut|bosen|boseng": "bored",
    "selamat pagi|pagii|met pagi": "good morning",
    "selamat malam|malem semua|met bobo": "good night",
    "makasih|terima kasih|thanks|thx": "thank you",
    "baper": "blushing",
    "nolep|julid": "side eye",

    // --- slang/tren 2026 ---
    "delulu": "delulu",
    "rizz|jago rizz": "rizz",
    "cooked|udah cooked|abis cooked": "cooked meme",
    "aura|aura farming": "aura farming",
    "brainrot|brain rot": "brainrot",
    "lock in|lockin|fokus banget": "lock in focus",
    "bet|sip lah": "bet meme",
    "gyat": "gyat meme",
    "skibidi": "skibidi",
    "main character": "main character energy",

    // --- aksi sayang / interaksi manis ke sesama user ---
    "peluk|hug dong": "anime hug",
    "cium|kiss|cup|cupp": "anime kiss",
    "cuddle|cudle|meluk manja|bobo bareng": "anime cuddle",
    "gemes|gemas|cubit pipi|cubit gemes": "cheek pinch cute",
    "elus|usap kepala|pat pat|puk puk": "pat head anime",
    "gandeng|gandengan tangan": "holding hands anime",
    "dadah|bye bye|dadah dadah": "wave goodbye anime",
    "hai|halo|lambai": "wave hello anime",
    "kedip|wink": "anime wink",
    "high five|hifive|tos": "high five anime",
    "sabar": "sabar",

    // --- aksi kocak / "berantem" ala meme (bercanda, bukan beneran) ---
    "tampar|geplak|slap": "anime slap",
    "tonjok|pukul|bogem mentah": "anime punch",
    "jitak|jitakin": "head bonk anime",
    "tendang|tendangin": "anime kick",
    "dorong|dorongin": "anime push",
    "kejar|kejar kejaran": "anime chase",

    // --- gaul & interaksi lainnya ---
    "bini gua|bini guweh|bini gw|calon bini": "my bini",
    "suami gua|suami guweh|suami gw": "my suami",
    "apakah ini my|my kisah|kisah": "my kisah",
    "gebetan|crush|pdkt": "anime shy blush",
    "kena mental|mental breakdown": "anime mental breakdown",
    "healing|healing dulu": "relax spa anime",
    "santuy|santai aja": "chill relax anime",
    "kepo|penasaran banget": "curious peek anime",
    "pusing|migrain": "headache anime",
    "nyerah|give up|udah gak kuat|nggak sanggup": "give up anime",
    "semangat|fighting|ganbatte": "cheer up anime",
    "pamer|flexing": "show off anime",
    "wowo|prabowo|wo": "prabowo",
    "takut|takut banget|serem": "takut banget",
    "jomok|gay": "jomok",
    "mole|login": ["https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHBsYTgwYmU5Y2FjMTI5ZDM3Nm5pdmVrejdyMmQ1YjAzNWF1Yml1YSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1mhPcNgITnbEnCIaR0/giphy.gif"],

    // Contoh pakai URL langsung tanpa API key (hapus komentar & isi linknya):
    // "halo|hai": ["https://media.tenor.com/xxxxxxxxxx/hi.gif"],
  },

  // Jeda minimum (ms) antar-pengiriman GIF otomatis per channel, biar tidak spam.
  gifCooldown: Number(process.env.GIF_COOLDOWN || 4000),

  // === TES JODOH ===
  // Tingkatan hasil berdasarkan persentase (dicek dari atas ke bawah,
  // dipakai yang pertama cocok). Urutan "min" HARUS menurun.
  MATCH_TIERS: [
    { min: 90, text: "Langsung VC aja 💍✨", color: 0xff4d6d },
    { min: 70, text: "COCOK Sih, 😍", color: 0xff8fa3 },
    { min: 50, text: "Lumayan, coba dm dulu 👀", color: 0xffc2d1 },
    { min: 30, text: "Haha, Jas plennnn. 🤣", color: 0xffe5ec },
    { min: 0, text: "Kayaknya mending gausah kenal 😅", color: 0xdee2ff },
  ],

  // === KERANG AJAIB ===
  // Jawaban singkat & acak ala kerang ajaib. Sengaja lebih sering "Tidak"
  // biar sesuai spirit aslinya yang jawabannya suka nyebelin/ngasal.
  KERANG_ANSWERS: [
    "Tidak.",
    "Tidak.",
    "Tidak.",
    "TIDAK.",
    "Mungkin suatu hari nanti.",
    "Sepertinya tidak.",
    "Coba tanya lagi.",
    "Bisa jadi.",
    "Kemungkinan besar iya.",
    "Aku rasa begitu.",
    "Jangan harap.",
    "Tanyakan lagi lain kali.",
  ],
};
