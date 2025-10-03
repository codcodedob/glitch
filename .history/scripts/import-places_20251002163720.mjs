// // scripts/import-places.mjs
// import fetch from "node-fetch";
// import { createClient } from "@supabase/supabase-js";

// // Grab CLI arguments
// // Example: npm run import:places -- "McDonald's" "New York"
// const [,, query = "McDonald's", location = "New York"] = process.argv;

// console.log(`🔎 Importing places for: ${query} in ${location}`);

// const supabase = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_SERVICE_ROLE_KEY // ⚠️ must be Service Role key, not anon
// );

// async function fetchPlacesPage(url) {
//   const res = await fetch(url);
//   if (!res.ok) throw new Error(`Google API error: ${res.statusText}`);
//   const data = await res.json();
//   return data;
// }

// async function importPlaces() {
//   const baseUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
//     query + " in " + location
//   )}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

//   let url = baseUrl;
//   let totalImported = 0;

//   do {
//     const data = await fetchPlacesPage(url);

//     if (data.results?.length) {
//       for (const place of data.results) {
//         const { name, formatted_address, geometry } = place;
//         const { lat, lng } = geometry.location;

//         const { error } = await supabase
//           .from("establishments")
//           .upsert(
//             {
//               name,
//               address: formatted_address,
//               lat,
//               lng,
//               restroom_available: true,
//             },
//             { onConflict: "name,address" }
//           );

//         if (error) {
//           console.error("❌ Supabase error:", error.message);
//         } else {
//           totalImported++;
//           console.log(`✅ Upserted: ${name} @ ${formatted_address}`);
//         }
//       }
//     }

//     // Pagination: wait for next_page_token if present
//     if (data.next_page_token) {
//       console.log("⏳ Waiting for next page...");
//       await new Promise((r) => setTimeout(r, 2000));
//       url = `${baseUrl}&pagetoken=${data.next_page_token}`;
//     } else {
//       url = null;
//     }
//   } while (url);

//   console.log(`🎉 Done. Imported/updated ${totalImported} ${query} locations in ${location}.`);
// }

// importPlaces().catch((err) => {
//   console.error("Fatal error:", err);
//   process.exit(1);
// });


// scripts/import-places.mjs
// Usage:
//   npm run import:places -- "McDonald's" "New York State"
//   npm run import:places -- "Starbucks" "New York City"

// Node 18+ has global fetch, no import needed

import { createClient } from "@supabase/supabase-js";

const [,, brandArg = "McDonald's", locationArg = "New York State"] = process.argv;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.GOOGLE_MAPS_API_KEY) {
  console.error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role for inserts
);

const baseQuery = `${brandArg} in ${locationArg}`;
console.log(`🔎 Importing: "${baseQuery}"`);

async function fetchTextSearchPage(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Google TextSearch HTTP ${r.status}`);
  const j = await r.json();
  if (j.status && j.status !== "OK" && j.status !== "ZERO_RESULTS") {
    throw new Error(`Google TextSearch status: ${j.status} (${j.error_message || "no message"})`);
  }
  return j;
}

async function run() {
  const baseUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(baseQuery)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  let url = baseUrl;
  let page = 0, total = 0;

  do {
    page += 1;
    const data = await fetchTextSearchPage(url);

    const rows = (data.results || [])
      .map(p => ({
        name: p.name,
        brand: brandArg,                           // stamp brand explicitly
        address: p.formatted_address || null,
        lat: p.geometry?.location?.lat,
        lng: p.geometry?.location?.lng,
        restroom_available: null,                  // unknown until crowd verifies
        code: null,
        google_place_id: p.place_id || null,
      }))
      .filter(r => r.lat && r.lng);

    if (rows.length) {
      const { error, data: up } = await supabase
        .from("establishments")
        .upsert(rows, { onConflict: "google_place_id" }) // dedupe by place id
        .select("id");

      if (error) {
        console.error("❌ Supabase upsert error:", error.message);
        process.exit(1);
      }
      total += up.length;
      console.log(`✅ Page ${page}: upserted ${up.length} rows (cumulative ${total})`);
    } else {
      console.log(`ℹ️ Page ${page}: 0 rows`);
    }

    if (data.next_page_token) {
      // next_page_token becomes valid after a short delay
      await new Promise(res => setTimeout(res, 2000));
      url = `${baseUrl}&pagetoken=${data.next_page_token}`;
    } else {
      url = null;
    }
  } while (url);

  console.log(`🎉 Done. Imported/updated ${total} locations for "${brandArg}" in "${locationArg}".`);
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
