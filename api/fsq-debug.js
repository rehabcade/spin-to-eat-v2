export default async function handler(req, res) {
  try {
    const key = process.env.FOURSQUARE_API_KEY || "";
    if (!key) return res.status(500).json({ ok:false, msg:"Missing FOURSQUARE_API_KEY" });

    const near = req.query.near || "Lafayette,LA";
    const url = new URL("https://api.foursquare.com/v3/places/search");
    url.searchParams.set("near", near);
    url.searchParams.set("categories", "13065"); // restaurants
    url.searchParams.set("limit", "3");

    const r = await fetch(url.toString(), {
      headers: { Accept: "application/json", Authorization: key }
    });

    const text = await r.text(); // show raw payload to catch errors
    return res.status(r.status).json({ ok:r.ok, status:r.status, payload: text.slice(0, 2000) });
  } catch (e) {
    return res.status(500).json({ ok:false, msg:e.message || String(e) });
  }
}
