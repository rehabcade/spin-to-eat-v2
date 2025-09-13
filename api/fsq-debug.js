// /pages/api/fsq-debug.js

export default async function handler(req, res) {
  try {
    const key = process.env.FOURSQUARE_API_KEY;

    if (!key) {
      return res.status(500).json({ ok: false, error: "Missing FOURSQUARE_API_KEY" });
    }

    // Try a simple Foursquare request
    const r = await fetch("https://api.foursquare.com/v3/places/search?near=Lafayette,LA&limit=1", {
      headers: {
        Accept: "application/json",
        Authorization: key   // MUST be "Authorization: {API_KEY}"
      }
    });

    const text = await r.text();
    return res.status(r.status).send(text);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Request failed" });
  }
}
