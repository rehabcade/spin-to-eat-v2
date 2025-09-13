export default function handler(req, res) {
  const key = process.env.FOURSQUARE_API_KEY || null;

  res.status(200).json({
    hasKey: Boolean(key),
    length: key ? key.length : 0,
    startsWith: key ? key.substring(0, 5) : null,
  });
}
