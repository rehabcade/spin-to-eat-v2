// api/restaurants.js — Foursquare Places search

const FSQ_KEY = process.env.FOURSQUARE_API_KEY;

// Common food & drink categories (restaurant + cafe + fast food + bar + pub)
const DEFAULT_CATEGORIES = ["13065", "13032", "13099", "13003", "13377"];
const DEFAULT_RADIUS = 8000; // meters
const DEFAULT_LIMIT = 50;

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

    const { city, lat, lon } = req.query;
    const radius = Number(req.query.radius) || DEFAULT_RADIUS;
    const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, 50);
    const openNow =
      String(req.query.open ?? "true").toLowerCase().trim() !== "false";
    const categories = (req.query.categories
      ? String(req.query.categories).split(",")
      : DEFAULT_CATEGORIES
    )
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");

    // 1) Get coordinates (prefer lat/lon if provided)
    let ll;
    if (lat && lon) {
      ll = `${Number(lat)},${Number(lon)}`;
    } else if (city) {
      // Geocode city with Nominatim (free + reliable)
      const nomi = new URL("https://nominatim.openstreetmap.org/search");
      nomi.searchParams.set("format", "json");
      nomi.searchParams.set("limit", "1");
      nomi.searchParams.set("q", city);
      const geo = await fetch(nomi.toString(), {
        headers: {
          "User-Agent": "SpinToEat/1.0",
          "Accept-Language": "en",
        },
      }).then((r) => r.json());
      if (!geo?.length) {
        return res.status(404).json({ error: "City not found" });
      }
      ll = `${geo[0].lat},${geo[0].lon}`;
    } else {
      return res
        .status(400)
        .json({ error: "Provide ?city=... or ?lat=..&lon=.." });
    }

    // 2) Foursquare search
    const headers = {
      Accept: "application/json",
      Authorization: FSQ_KEY.trim(),
    };
    const url = new URL("https://api.foursquare.com/v3/places/search");
    url.searchParams.set("ll", ll);
    url.searchParams.set("radius", String(radius));
    url.searchParams.set("categories", categories);
    url.searchParams.set("sort", "DISTANCE");
    url.searchParams.set("limit", String(limit));
    if (openNow) url.searchParams.set("open_now", "true");

    const data = await getJSON(url.toString(), headers);

    const items = (data.results || [])
      .map((p) => {
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
          name: p.name || "Unknown",
          address: addr,
          lat: p.geocodes?.main?.latitude,
          lon: p.geocodes?.main?.longitude,
          categories: (p.categories || []).map((c) => c.name),
          price: p.price || null,
          rating: p.rating || null,
          website: p.website || "",
        };
      })
      .filter((x) => x.lat && x.lon);

    // Shuffle for randomness
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res
      .status(200)
      .json({ count: items.length, items, attribution: "Data © Foursquare" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Foursquare lookup failed" });
  }
}
