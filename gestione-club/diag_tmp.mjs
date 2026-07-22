import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1)]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: clubs } = await supabase.from("club").select("id,nome");
console.log("CLUBS:", clubs);

const { data: squadre } = await supabase.from("squadre").select("id,nome,club_id");
console.log("SQUADRE:", squadre);

const { data: giocatori } = await supabase.from("giocatori").select("id,nome,cognome,club_id,squadra_id,attivo,ruolo_1,ruolo_2");
console.log("GIOCATORI count:", giocatori?.length);
console.log(giocatori);

const { data: profili } = await supabase.from("profili").select("id,tipo_profilo,last_club_id,last_squadra_id,auth_user_id");
console.log("PROFILI:", profili);
