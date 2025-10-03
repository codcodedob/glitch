import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// NYC bias (Times Square); type=restaurant increases precision.
const QUERY = 'McDonald\'s in New York City';
const PAGE_SIZE_NOTE = 'Google returns up to ~60 results via pagetoken paging';

async function textSearchAll(q) {
  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&type=restaurant&key=${GOOGLE_API_KEY}`;
  const all = [];
  while (url) {
    const r = await fetch(url);
    const j = await r.json();
    if (j.status !== 'OK' && j.status !== 'ZERO_RESULTS') {
      console.error('Places TextSearch error:', j);
      break;
    }
    all.push(...(j.results || []));
    if (j.next_page_token) {
      // Google needs a short delay before next_page_token becomes valid
      await new Promise(res => setTimeout(res, 2000));
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${j.next_page_token}&key=${GOOGLE_API_KEY}`;
    } else {
      url = null;
    }
  }
  return all;
}

async function run() {
  const results = await textSearchAll(QUERY);
  console.log(`Found ${results.length} candidates. ${PAGE_SIZE_NOTE}`);

  const rows = results.map(p => ({
    name: p.name,
    address: p.formatted_address,
    lat: p.geometry?.location?.lat,
    lng: p.geometry?.location?.lng,
    restroom_available: null,         // unknown until users confirm
    code: null,                        // unknown
    google_place_id: p.place_id,
  })).filter(r => r.lat && r.lng);

  // Upsert by google_place_id to avoid dupes
  const { data, error } = await supabase
    .from('establishments')
    .upsert(rows, { onConflict: 'google_place_id' })
    .select('id, name, address, google_place_id');

  if (error) {
    console.error('Supabase upsert error:', error);
    process.exit(1);
  }
  console.log(`Upserted ${data.length} rows.`);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
