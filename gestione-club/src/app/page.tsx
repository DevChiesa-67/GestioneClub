import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LoginPage from "../app/(auth)/login/page"; // modifica il percorso se necessario

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Utente autenticato -> Dashboard
  if (session) {
    redirect("/dashboard");
  }

  // Utente non autenticato -> Login
  return <LoginPage />;
}