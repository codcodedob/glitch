// scripts/import-bulk.mjs
import { spawn } from "child_process";

// List of franchises to import
const franchises = [
  "McDonald's",
  "Starbucks",
  "Duck Donuts"
  // add more chains here
];

// 50 US states
const states = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia",
  "Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland",
  "Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey",
  "New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
  "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"
];

function runImport(franchise, state) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "import:places", "--", franchise, state], {
      stdio: "inherit",
      shell: true
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed for ${franchise} in ${state}`));
    });
  });
}

async function runAll() {
  for (const franchise of franchises) {
    for (const state of states) {
      console.log(`🚀 Importing ${franchise} in ${state}...`);
      try {
        await runImport(franchise, state);
      } catch (err) {
        console.error(err.message);
      }
    }
  }
  console.log("🎉 Bulk import finished!");
}

runAll();
