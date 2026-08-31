# Discord Bot — Ramah, GIF Trending, Jodoh, & Kerang Ajaib

Bot ini **tidak butuh API key AI sama sekali**, dan sejak versi ini juga
**tidak butuh ffmpeg lagi** (fitur musik sudah dihapus total, jadi tidak ada
lagi drama `FFMPEG_NOT_INSTALLED` atau install-script yang diblokir di
hosting gratis).

## Fitur

1. **Ramah & langsung** — kalau dipanggil (mention, reply, atau kata seperti
   `wo`, `bro`, `bang`, `min`, dst.), bot balas singkat tanpa basa-basi.

2. **GIF otomatis berdasarkan kata kunci** — ketik kata seperti `wkwk`,
   `sedih`, `delulu`, `rizz`, `cooked`, `lock in`, dll di chat manapun (bukan
   command khusus), bot otomatis kirim GIF yang cocok. Daftar kata kunci ada
   di `config.js` → `GIF_KEYWORDS`, sudah dicampur ekspresi umum + slang yang
   lagi rame tahun 2026. Edit bebas sesuai selera server kamu.

3. **Tes Jodoh** — `!jodoh @user` (alias: `cocok`, `match`). Bot kasih
   persentase kecocokan acak (0–100%) lengkap dengan foto profil kedua orang
   yang dites.
   - `!jodoh @A @B` → tes A vs B
   - `!jodoh @user` → tes kamu vs user itu
   - `!jodoh` (tanpa mention) → bot ambil 2 orang acak dari yang baru-baru
     ini chat di channel itu

4. **Kerang Ajaib** — `!kerang <pertanyaan>` (alias: `conch`, `tanya`). Bot
   jawab singkat & acak, terinspirasi dari mainan kerang ajaib di kartun
   SpongeBob yang jawabannya suka asal-asalan (sering banget jawab "Tidak").

5. **Join voice & TIDAK PERNAH keluar sendiri** — `!join` (alias: `masuk`,
   `gabung`) bikin bot masuk ke voice channel kamu dan menetap di situ
   selama-lamanya. Bot otomatis reconnect kalau kena gangguan jaringan
   sesaat. **Satu-satunya** cara bikin bot keluar adalah command `!leave`
   (alias: `keluar`, `cabut`) — tidak ada auto-leave karena channel kosong,
   tidak ada timeout idle, tidak ada apa pun selain command itu.
   > Catatan: kalau ada admin server yang manual disconnect/kick bot dari
   > Discord client, itu di luar kendali bot — bot akan coba reconnect ke
   > channel yang sama, tapi kalau memang di-kick dari voice channel oleh
   > permission Discord, ya tetap akan keluar.

## Cara pasang

1. Salin `.env.example` jadi `.env`, isi `DISCORD_TOKEN` dari
   [Discord Developer Portal](https://discord.com/developers/applications).
   - Di tab **Bot**, aktifkan **MESSAGE CONTENT INTENT** (wajib).
2. Install dependency:
   ```bash
   npm install
   ```
3. Jalankan:
   ```bash
   npm start
   ```

## Mengatur GIF berdasarkan kata kunci

Buka `config.js`, bagian `GIF_KEYWORDS`. Dua cara:

- **Tanpa API key** — isi value dengan array link GIF langsung:
  ```js
  "halo|hai": ["https://media.tenor.com/xxxxx/hi.gif"],
  ```
- **Pakai pencarian GIPHY** — isi value dengan string query, lalu isi
  `GIPHY_API_KEY` di `.env` (gratis: https://developers.giphy.com/):
  ```js
  "wkwk|ngakak": "laughing",
  ```

## Command

| Command | Alias | Fungsi |
| --- | --- | --- |
| `!help` | `bantuan` | Lihat daftar command |
| `!join` | `masuk`, `gabung`, `sini` | Bot masuk voice channel & stay permanen |
| `!leave` | `keluar`, `cabut`, `pergi` | Bot keluar dari voice channel |
| `!jodoh @user` | `cocok`, `match` | Tes jodoh random + foto profil |
| `!kerang <pertanyaan>` | `conch`, `tanya` | Tanya ke kerang ajaib |
| `!jari` | `finger` | Ukuran jari random 1–40 cm |
| `!custom add nama \| balasan` | `cc` | Buat/update custom command (Manage Server) |
| `!custom del nama` | — | Hapus custom command (Manage Server) |
| `!custom list` | — | Lihat custom command server |

Prefix `!` bisa diganti lewat env var `PREFIX` di `.env` (mis. `PREFIX=wo`).
Kalau prefix kamu ganti jadi kata yang juga dipakai buat sapaan (seperti
`wo`), tenang — bot sudah pintar bedain `wo` doang (sapaan) vs `wo join`
(command), jadi tidak bakal bentrok.


## Custom Command

Admin/moderator dengan permission **Manage Server** bisa membuat command langsung dari Discord tanpa mengedit source code:

```text
!custom add halo | Halo juga, {user}! 👋
!halo
```

Placeholder yang tersedia:
- `{user}` → username pengirim
- `{mention}` → mention pengirim

Perintah lain:
```text
!custom list
!custom del halo
!custom help
```

Custom command disimpan di `data/customCommands.json` sehingga tetap ada setelah bot restart, selama hosting menggunakan filesystem yang persisten.

## Ukuran Jari Random

Gunakan `!jari` atau `!finger`. Bot akan menghasilkan ukuran random **1–40 cm** setiap kali command dipakai.


## Custom Prefix & Ukuran Tangan

Admin dengan permission **Manage Server** dapat mengubah prefix langsung dari Discord:
- `!prefix ?` → prefix menjadi `?`
- `?prefix reset` → kembali ke prefix default
- `?prefix help` → bantuan

Prefix disimpan per-server di `data/prefixes.json`.

Fitur ukuran tangan:
- `?tangan` atau `?hand` → ukuran tangan random 1–40 cm.
- `?jari` / `?finger` tetap tersedia sebagai alias fitur random yang sama.
