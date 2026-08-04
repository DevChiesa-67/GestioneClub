"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type AggregazioneCatapult = "media" | "somma" | "min" | "max" | "ultima";

type SalvaReportInput = {
  nome: string;
  descrizione?: string | null;
  sezione_performance: "presenze" | "performance" | "test";
  tipo_visualizzazione: "bar" | "line" | "pie" | "table" | "kpi";
  configurazione: Record<string, unknown>;
  pubblicato?: boolean;
  tipi_profilo_visibili?: string[];
  campo_catapult?: string | null;
  aggregazione_catapult?: AggregazioneCatapult | null;
};

export async function salvaReportPersonalizzato(input: SalvaReportInput) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "Utente non autenticato.",
    };
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id, tipo_profilo, last_club_id, club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo) {
    return {
      success: false,
      message: "Profilo non trovato.",
    };
  }

  // Il report builder e la pubblicazione nel riepilogo sono funzionalità
  // riservate agli admin: la pagina che chiama questa action è già
  // protetta lato server, ma ripetiamo il controllo qui perché è
  // un'action pubblica invocabile direttamente.
  const isAdmin =
    String(profilo.tipo_profilo ?? "").toLowerCase() === "admin";

  if (!isAdmin) {
    return {
      success: false,
      message: "Solo gli amministratori possono creare report.",
    };
  }

  const clubId = profilo.last_club_id ?? profilo.club_id;

  if (!clubId) {
    return {
      success: false,
      message: "Nessun club selezionato.",
    };
  }

  const nome = input.nome.trim();

  if (!nome) {
    return {
      success: false,
      message: "Inserisci un titolo per il report.",
    };
  }

  const pubblicato = Boolean(input.pubblicato);
  const tipiProfiloVisibili = input.tipi_profilo_visibili ?? [];

  if (pubblicato) {
    if (input.sezione_performance !== "performance") {
      return {
        success: false,
        message:
          "Puoi pubblicare nel riepilogo solo i report con destinazione Performance.",
      };
    }

    if (!input.campo_catapult) {
      return {
        success: false,
        message: "Seleziona un parametro Catapult da pubblicare.",
      };
    }

    if (!input.aggregazione_catapult) {
      return {
        success: false,
        message:
          "Scegli come aggregare il parametro pubblicato (media, somma, min, max o ultima sessione).",
      };
    }

    if (tipiProfiloVisibili.length === 0) {
      return {
        success: false,
        message:
          "Seleziona almeno un gruppo che può vedere il parametro pubblicato.",
      };
    }
  }

  const { error } = await supabase.from("report_personalizzati").insert({
    club_id: clubId,
    created_by: profilo.id,
    nome,
    descrizione: input.descrizione ?? null,
    sezione_performance: input.sezione_performance,
    tipo_visualizzazione: input.tipo_visualizzazione,
    configurazione: input.configurazione,
    pubblicato,
    tipi_profilo_visibili: tipiProfiloVisibili,
    campo_catapult: pubblicato ? input.campo_catapult : null,
    aggregazione_catapult: pubblicato ? input.aggregazione_catapult : null,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/reportistica");
  revalidatePath("/performance");

  return {
    success: true,
    message: pubblicato
      ? "Report salvato e pubblicato nel riepilogo Performance."
      : "Report salvato correttamente.",
  };
}

export async function impostaPubblicazioneReport(
  reportId: string,
  pubblicato: boolean,
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, message: "Utente non autenticato." };
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("tipo_profilo, last_club_id, club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo) {
    return { success: false, message: "Profilo non trovato." };
  }

  const isAdmin =
    String(profilo.tipo_profilo ?? "").toLowerCase() === "admin";

  if (!isAdmin) {
    return {
      success: false,
      message: "Solo gli amministratori possono pubblicare i report.",
    };
  }

  const clubId = profilo.last_club_id ?? profilo.club_id;

  if (pubblicato) {
    const { data: report, error: reportError } = await supabase
      .from("report_personalizzati")
      .select("campo_catapult, aggregazione_catapult, tipi_profilo_visibili")
      .eq("id", reportId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (reportError || !report) {
      return { success: false, message: "Report non trovato." };
    }

    if (
      !report.campo_catapult ||
      !report.aggregazione_catapult ||
      !report.tipi_profilo_visibili ||
      report.tipi_profilo_visibili.length === 0
    ) {
      return {
        success: false,
        message:
          "Questo report non ha un parametro/gruppo configurato: modificalo dal builder prima di pubblicarlo.",
      };
    }
  }

  const { error } = await supabase
    .from("report_personalizzati")
    .update({ pubblicato })
    .eq("id", reportId)
    .eq("club_id", clubId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/reportistica");
  revalidatePath("/performance");

  return {
    success: true,
    message: pubblicato ? "Report pubblicato." : "Pubblicazione rimossa.",
  };
}

export async function eliminaReportPersonalizzato(reportId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, message: "Utente non autenticato." };
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("tipo_profilo, last_club_id, club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo) {
    return { success: false, message: "Profilo non trovato." };
  }

  const isAdmin =
    String(profilo.tipo_profilo ?? "").toLowerCase() === "admin";

  if (!isAdmin) {
    return {
      success: false,
      message: "Solo gli amministratori possono eliminare i report.",
    };
  }

  const clubId = profilo.last_club_id ?? profilo.club_id;

  const { error } = await supabase
    .from("report_personalizzati")
    .delete()
    .eq("id", reportId)
    .eq("club_id", clubId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/reportistica");
  revalidatePath("/performance");

  return { success: true, message: "Report eliminato." };
}
