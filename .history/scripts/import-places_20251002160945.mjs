// scripts/import-places.mjs
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// Grab CLI arguments
// Example: npm run import:places -- "McDonald's" "New York"
const [,, query = "McDonald's", location = "New York"] = process.argv;

console.log(`🔎 Importing places for: ${query} in ${location}`);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ⚠️ must be Service Role key, not anon
);

async function fetchPlacesPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google API error: ${res.statusText}`);
  const data = await res.json();
  return data;
}

async function importPlaces() {
  const baseUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    query + " in " + location
  )}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  let url = baseUrl;
  let totalImported = 0;

  do {
    const data = await fetchPlacesPage(url);

    if (data.results?.length) {
      for (const place of data.results) {
        const { name, formatted_address, geometry } = place;
        const { lat, lng } = geometry.location;

        const { error } = await supabase
          .from("establishments")
          .upsert(
            {
              name,
              address: formatted_address,
              lat,
              lng,
              restroom_available: true,
            },
            { onConflict: "name,address" }
          );

        if (error) {
          console.error("❌ Supabase error:", error.message);
        } else {
          totalImported++;
          console.log(`✅ Upserted: ${name} @ ${formatted_address}`);
        }
      }
    }

    // Pagination: wait for next_page_token if present
    if (data.next_page_token) {
      console.log("⏳ Waiting for next page...");
      await new Promise((r) => setTimeout(r, 2000));
      url = `${baseUrl}&pagetoken=${data.next_page_token}`;
    } else {
      url = null;
    }
  } while (url);

  console.log(`🎉 Done. Imported/updated ${totalImported} ${query} locations in ${location}.`);
}

importPlaces().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
