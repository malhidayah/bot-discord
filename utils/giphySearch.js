async function searchGif(query) {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return null; // Belum dikonfigurasi, skip diam-diam

  const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(
    query
  )}&limit=8&rating=pg-13&lang=id`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[GIF SEARCH ERROR] ${response.status}: ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    const items = data.data || [];
    if (!items.length) return null;

    // Pilih random dari hasil biar nggak monoton hasil yang sama terus
    const pick = items[Math.floor(Math.random() * items.length)];
    return pick?.images?.original?.url || pick?.images?.downsized?.url || null;
  } catch (e) {
    console.error("[GIF SEARCH ERROR]", e);
    return null;
  }
}

module.exports = { searchGif };
