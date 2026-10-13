import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LoginPage from "../app/(auth)/login/page"; // modifica il percorso se necessario

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Utente autenticato -> Dashboard
  if (user) {
    redirect("/dashboard");
  }

  // Utente non autenticato -> Login
  return <LoginPage />;
}
