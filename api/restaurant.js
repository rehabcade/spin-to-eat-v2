// Free + unlimited: OpenStreetMap (Nominatim + Overpass)
// Works on Vercel as a serverless function.
// Usage examples:
//   /api/restaurants?city=Lafayette,LA
//   /api/restaurants?lat=30.2241&lon=-92.0198&radius=5000   (meters)
// Optional: &types=restaurant,cafe,fast_food,bar,pub

const DEFAULT_TYPES = ["restaurant", "cafe", "fast_food", "bar", "pub"];
const DEFAULT_RADIUS = 5000; // meters if using lat/lon

export default async function handler(req, res) {
  try {
    const { city, lat, lon, radius, types } = req.query;

    // 1) Resolve location
    let bbox = null; // [south, west, north, east]
    let center = null; // { lat, lon } (for reference)
    if (lat && lon) {
      // If lat/lon given, build a bbox around it using radius (approx)
      const R = Number(radius) || DEFAULT_RADIUS;
      // ~111,000 m per degree (roughly), scale lon by cos(lat)
      const latDeg = R / 111000;
      const lonDeg = R / (111000 * Math.cos((Number(lat) * Math.PI) / 180));
      bbox = [
        Number(lat) - latDeg,
        Number(lon) - lonDeg,
        Number(lat) + latDeg,
        Number(lon) + lonDeg,
      ];
      center = { lat: Number(lat), lon: Number(lon) };
    } else if (city) {
      // Use Nominatim to geocode city to a bounding box
      const nomiURL = new URL("https://nominatim.openstreetmap.org/search");
      nomiURL.searchParams.set("format", "json");
      nomiURL.searchParams.set("limit", "1");
      nomiURL.searchParams.set("q", city);

      const nomiResp = await fetch(nomiURL.toString(), {
        headers: {
          // Nominatim asks for a descriptive UA; you can change this later.
          "User-Agent": "SpinToEat/1.0 (+https://vercel.app)",
          "Accept-Language": "en",
        },
      });
      if (!nomiResp.ok) throw new Error("Nominatim failed");
      const nomi = await nomiResp.json();
      if (!nomi?.length) {
        return res.status(404).json({ error: "City not found" });
      }
      const hit = nomi[0];
      // boundingbox is [south, north, west, east] as strings
      const [south, north, west, east] = hit.boundingbox.map(Number);
      bbox = [south, west, north, east];
      center = { lat: Number(hit.lat), lon: Number(hit.lon) };
    } else {
      return res
        .status(400)
        .json({ error: "Provide ?city=City,State or ?lat=..&lon=.." });
    }

    // 2) Build Overpass query
    const amenityTypes = (types ? String(types).split(",") : DEFAULT_TYPES)
      .map((t) => t.trim())
      .filter(Boolean);

    // Overpass bbox order: (south,west,north,east)
    const bboxStr = bbox.join(",");

    // Query nodes/ways/relations with amenity tag in our types
    // Using a union to catch all and returning center for ways/relations.
    const orFilter = amenityTypes.map((t) => `["amenity"="${t}"]`).join("");
    const query = `
[out:json][timeout:25];
(
  node${orFilter}(${bboxStr});
  way${orFilter}(${bboxStr});
  relation${orFilter}(${bboxStr});
);
out center tags;
`;

    // 3) Call Overpass
    const overpassResp = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "SpinToEat/1.0 (+https://vercel.app)"
      },
      body: new URLSearchParams({ data: query }).toString(),
    });

    if (!overpassResp.ok) {
      const text = await overpassResp.text();
      throw new Error(`Overpass error: ${overpassResp.status} ${text.slice(0, 200)}`);
    }

    const data = await overpassResp.json();
    const elements = Array.isArray(data.elements) ? data.elements : [];

    // 4) Normalize + shuffle
    const items = elements
      .map((el) => {
        const isWayOrRel = el.type === "way" || el.type === "relation";
        const lat = isWayOrRel ? el.center?.lat : el.lat;
        const lon = isWayOrRel ? el.center?.lon : el.lon;
        const tags = el.tags || {};
        const address = [
          tags["addr:housenumber"],
          tags["addr:street"],
          tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
          tags["addr:state"],
        ]
          .filter(Boolean)
          .join(", ");

        return {
          id: `${el.type}/${el.id}`,
          name: tags.name || "Unnamed place",
          lat,
          lon,
          categories: [tags.cuisine].filter(Boolean),
          address,
          phone: tags.phone || tags["contact:phone"] || "",
          website: tags.website || tags["contact:website"] || "",
          opening_hours: tags.opening_hours || "",
          amenity: tags.amenity || "",
        };
      })
      .filter((x) => x.lat && x.lon);

    // Fisher–Yates shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600"); // 5 min edge cache
    return res.status(200).json({
      count: items.length,
      center,
      items,
      attribution: "Data © OpenStreetMap contributors (via Overpass & Nominatim)",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lookup failed" });
  }
}
