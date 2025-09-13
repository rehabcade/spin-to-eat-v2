// api/fsq-debug.js — check if FSQ key works

export default async function handler(req, res) {
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) {
    return res.status(500).json({ ok: false, error: "No FOURSQUARE_API_KEY set" });
  }

  try {
    const r = await fetch("https://api.foursquare.com/v3/places/search?ll=40.7,-74&limit=1", {
      headers: {
        Accept: "application/json",
        Authorization: key.trim(),
      },
    });

    const text = await r.text();
    res.status(r.status).json({
      ok: r.ok,
      status: r.status,
      payload: text.slice(0, 300),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
