"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { useToast } from "@/components/ui/Toast";

export function DeleteGiocatoreButton({
  giocatoreId,
  fotoUrl,
  isAdmin,
}: {
  giocatoreId: string;
  fotoUrl: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!isAdmin) return;

    const conferma = window.confirm(
      "Sei sicuro di voler eliminare questo giocatore? L'azione non può essere annullata."
    );

    if (!conferma) return;

    setLoading(true);

    if (fotoUrl) {
      const marker = "/giocatori/";
      const index = fotoUrl.indexOf(marker);

      if (index !== -1) {
        const filePath = fotoUrl.substring(index + marker.length);

        await supabase.storage.from("giocatori").remove([filePath]);
      }
    }

    const { error } = await supabase
      .from("giocatori")
      .delete()
      .eq("id", giocatoreId);

    if (error) {
      console.error(error);
      showToast({ type: "error", message: error.message });
      setLoading(false);
      return;
    }

    router.push("/giocatori");
    router.refresh();
  }

  if (!isAdmin) return null;

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 size={16} />
      {loading ? "Eliminazione..." : "Elimina"}
    </button>
  );
}