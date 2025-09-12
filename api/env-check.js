export default function handler(req, res) {
  const k = process.env.FOURSQUARE_API_KEY || "";
  res.status(200).json({
    hasKey: Boolean(k),
    keyLength: k.length,
    startsWith: k ? k.slice(0, 6) : ""
  });
}
