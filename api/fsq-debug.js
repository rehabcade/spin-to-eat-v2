// api/fsq-debug.js — Quick debug for Foursquare API

// Hard-coded Foursquare Service API Key (with fsq3 prefix)
const FSQ_KEY = "fsq3HAIP4COD0GM3H2Y4NVL450FJPXOXGW2RC0I4OY1JZ2D4JIUN";

export default async function handler(req, res) {
  try {
    if (!FSQ_KEY) {
      return res.status(500).json({ error: "Missing FOURSQUARE_API_KEY" });
    }

    // Test: hit Foursquare with a fixed query
    const url = new URL("https://api.foursquare.com/v3/places/search");
    url.searchParams.set("ll", "30.2241,-92.0198"); // Lafayette, LA
    url.searchParams.set("query", "restaurant");
    url.searchParams.set("limit", "5");

    const r = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: FSQ_KEY
      }
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ ok: false, status: r.status, payload: text });
    }

    const data = await r.json();
    return res.status(200).json({
      ok: true,
      key: {
        hasKey: true,
        length: FSQ_KEY.length,
        startsWith: FSQ_KEY.slice(0, 5)
      },
      results: data.results || []
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Debug request failed" });
  }
}
