// scripts/lookup-address.mjs
// at top of each script
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
const envFile = fs.existsSync(path.join(process.cwd(), ".env.local")) ? ".env.local" : ".env";
dotenv.config({ path: envFile });

// load .env.local if present; fallback to .env
const envFile = fs.existsSync(path.join(process.cwd(), ".env.local"))
  ? ".env.local"
  : ".env";
dotenv.config({ path: envFile });

const KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!KEY) {
  console.error("Missing GOOGLE_MAPS_API_KEY in .env.local or .env");
  process.exit(1);
}

const input = process.argv.slice(2).join(" ").trim();
if (!input) {
  console.error('Usage: npm run lookup-address -- "McDonald\'s 429 7th Ave NYC"');
  process.exit(1);
}

const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
url.searchParams.set("input", input);
url.searchParams.set("inputtype", "textquery");
url.searchParams.set("fields", "place_id,name,formatted_address,geometry");

try {
  const resp = await fetch(`${url}&key=${KEY}`);
  const data = await resp.json();

  if (data.status !== "OK" || !data.candidates?.length) {
    console.error("No candidates. Raw response:");
    console.error(JSON.stringify(data, null, 2));
    process.exit(2);
  }

  const c = data.candidates[0];
  console.log("Name:        ", c.name);
  console.log("Address:     ", c.formatted_address);
  console.log("Place ID:    ", c.place_id);
  if (c.geometry?.location) {
    console.log("Lat, Lng:    ", c.geometry.location.lat, c.geometry.location.lng);
  }
} catch (e) {
  console.error("Lookup failed:", e?.message || e);
  process.exit(3);
}
