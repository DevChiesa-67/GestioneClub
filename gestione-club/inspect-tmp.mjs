import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

const tables = ["tipi_profili", "permessi_tipo_profilo", "permessi_pagine_tipo_profilo"];
for (const t of tables) {
  const { data, error } = await supabase.from(t).select("*").limit(5);
  console.log(`\n=== ${t} ===`);
  if (error) console.log("ERROR:", error.message);
  else console.log(JSON.stringify(data, null, 2));
}

const { data: profiliSample, error: profiliErr } = await supabase
  .from("profili")
  .select("tipo_profilo")
  .limit(1000);
if (profiliErr) console.log("profili ERROR:", profiliErr.message);
else {
  const distinct = [...new Set(profiliSample.map(p => p.tipo_profilo))];
  console.log("\n=== distinct tipo_profilo values in profili ===");
  console.log(distinct);
}
