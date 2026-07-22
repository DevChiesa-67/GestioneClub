import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1)]; })
);

console.log("URL:", env.NEXT_PUBLIC_SUPABASE_URL);
console.log("KEY len:", env.SUPABASE_SERVICE_ROLE_KEY?.length);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: clubs, error: e1 } = await supabase.from("club").select("id,nome");
console.log("CLUBS err:", e1);
console.log("CLUBS:", clubs);
