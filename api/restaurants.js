// /pages/api/restaurants.js

const FSQ_KEY = process.env.FOURSQUARE_API_KEY;

export default async function handler(req, res) {
  try {
    if (!FSQ_KEY) return res.status(500).json({ error: "Missing FOURSQUARE_API_KEY" });

    const { city = "Lafayette,LA", limit = 10 } = req.query;

    const url = new URL("https://api.foursquare.com/v3/places/search");
    url.searchParams.set("near", city);
    url.searchParams.set("limit", limit);

    const r = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: FSQ_KEY   // IMPORTANT: no "Bearer", just the raw key
      }
    });

    const data = await r.json();
    res.status(r.status).json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Foursquare request failed" });
  }
}
