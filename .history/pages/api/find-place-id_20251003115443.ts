import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing GOOGLE_MAPS_API_KEY" });

  const input = (req.query.input as string) ||
    "McDonald's 429 7th Ave, New York, NY 10001";
  const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
  url.searchParams.set("input", input);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set("fields", "place_id,name,formatted_address,geometry");

  const r = await fetch(`${url}&key=${key}`);
  const j = await r.json();
  res.status(200).json(j);
}
