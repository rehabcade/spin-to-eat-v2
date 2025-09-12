// api/fsq-debug.js — quick debug for Foursquare key + API call

const FSQ_KEY = (process.env.FOURSQUARE_API_KEY || "").trim();

export default async function handler(req, res) {
  try {
    if (!FSQ_KEY) {
      return res.status(500).json({ ok: false, msg: "Missing FOURSQUARE_API_KEY" });
    }

    // Hit the categories endpoint (always available, no params needed)
    const r = await fetch("https://api.foursquare.com/v3/places/categories", {
      headers: {
        Accept: "application/json",
        Authorization: FSQ_KEY   // no "Bearer", just the raw key
      }
    });

    const text = await r.text();

    res.status(r.status).json({
      ok: r.ok,
      status: r.status,
      payload: text.slice(0, 500) // first 500 chars to keep response small
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message || String(e) });
  }
}
