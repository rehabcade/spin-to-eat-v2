// api/restaurants.js — Foursquare Places (free dev tier, no card)
// Supports ?city=City,State  OR  ?lat=..&lon=..&radius=5000  (meters)

const FSQ_KEY = process.env.FOURSQUARE_API_KEY;
const DEFAULT_RADIUS = 5000; // meters
const CATEGORY_RESTAURANT = "13065"; // Foursquare category for restaurants

// simple JSON fetch helper
async function getJSON(url, headers = {}) {
  const r = await fetch(url, { headers });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  try {
    if (!FSQ_KEY) {
      return res.status(500).json({ error: "Missing FOURSQUARE_API_KEY" });
    }

    const { city, lat, lon, radius } = req.query;
    const headers = {
      Accept: "application/json",
      Authorization: FSQ_KEY,
    };

    let ll = null; // "lat,lon" string
    let rad = Number(radius) || DEFAULT_RADIUS;

    if (lat && lon) {
      ll = `${Number(lat)},${Number(lon)}`;
    } else if (city) {
      // Geocode city name to coordinates using Foursquare
      const geoUrl = new URL("https://api.foursquare.com/v3/places/search");
      geoUrl.searchParams.set("query", city);
      geoUrl.searchParams.set("limit", "1");
      const g = await getJSON(geoUrl.toString(), headers);
      const hit = (g.results || [])[0];
      if (!hit?.geocodes?.main) {
        return res.status(404).json({ error: "City not found" });
      }
      ll = `${hit.geocodes.main.latitude},${hit.geocodes.main.longitude}`;
    } else {
      return res
        .status(400)
        .json({ error: "Provide ?city=... or ?lat=..&lon=.." });
    }

    // Search for open restaurants near ll
    // Note: Foursquare "open_now" is supported in v3 (boolean)
    const url = new URL("https://api.foursquare.com/v3/places/search");
    url.searchParams.set("ll", ll);
    url.searchParams.set("radius", String(rad));
    url.searchParams.set("categories", CATEGORY_RESTAURANT);
    url.searchParams.set("open_now", "true");
    url.searchParams.set("sort", "DISTANCE");
    url.searchParams.set("limit", "50");

    const data = await getJSON(url.toString(), headers);

    // Normalize results
    const items = (data.results || []).map((p) => {
      const name = p.name || "Unknown";
      const addr = [
        p.location?.address,
        p.location?.locality,
        p.location?.region,
        p.location?.postcode,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        id: p.fsq_id,
        name,
        address: addr,
        lat: p.geocodes?.main?.latitude,
        lon: p.geocodes?.main?.longitude,
        rating: p.rating, // may be undefined on free tier
        price: p.price,   // 1-4 if available
        categories: (p.categories || []).map((c) => c.name),
        website: p.website || "",
      };
    }).filter(x => x.lat && x.lon);

    // Shuffle for randomness
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({
      count: items.length,
      items,
      attribution: "Data © Foursquare",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Foursquare lookup failed" });
  }
}
