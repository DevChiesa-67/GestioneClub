import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1)]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: profili, error: pErr } = await supabase
  .from("profili")
  .select("id,tipo_profilo,last_club_id,club_id,auth_user_id,email")
  .ilike("tipo_profilo", "admin");
console.log("ADMIN PROFILI:", JSON.stringify(profili, null, 2));
if (pErr) console.log("profili err", pErr);

const { data: giocatori, error: gErr } = await supabase
  .from("giocatori")
  .select("id,nome,cognome,club_id")
  .limit(10);
console.log("\nGIOCATORI sample:", JSON.stringify(giocatori, null, 2));
if (gErr) console.log("giocatori err", gErr);

// cross-check: for each admin, do their last_club_id's giocatori match?
if (profili && giocatori) {
  for (const p of profili) {
    const matchCount = giocatori.filter(g => g.club_id === p.last_club_id).length;
    console.log(`Admin ${p.email}: last_club_id=${p.last_club_id}, club_id array=${JSON.stringify(p.club_id)}, giocatori-in-sample-matching=${matchCount}`);
  }
}
