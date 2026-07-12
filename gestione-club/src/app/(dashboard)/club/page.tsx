import Image from "next/image";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";

type Squadra = {
  id: string;
  club_id: string;
  nome: string;
  categoria: string | null;
  stagione: string | null;
  logo_url: string | null;
  giocatori?: { id: string }[];
};

type Club = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  stagione_corrente: string | null;
  colore_primario: string | null;
  colore_secondario: string | null;
  colore_flag: string | null;
  attivo: boolean;
  squadre?: Squadra[];
};

type ProfiloClub = {
  club_id: string[] | null;
};

const BUCKET_CLUB_LOGHI = "club-loghi";

const CATEGORIE_SQUADRE = [
  "U16",
  "U18",
  "U20",
  "Seniores C",
  "Seniores B",
  "Seniores A",
  "Élite",
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[àáâä]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function uploadLogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  folder: string
) {
  if (!file || file.size === 0) return null;

  const ext = file.name.split(".").pop() || "png";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_CLUB_LOGHI)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from(BUCKET_CLUB_LOGHI)
    .getPublicUrl(path);

  return data.publicUrl;
}

async function creaClub(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profiloUtente, error: profiloUtenteError } = await supabase
    .from("profili")
    .select("tipo_profilo, club_id")
    .eq("auth_user_id", user.id)
    .single<{ tipo_profilo: string | null } & ProfiloClub>();

  if (profiloUtenteError) throw new Error(profiloUtenteError.message);

  if (String(profiloUtente?.tipo_profilo || "").toLowerCase() !== "admin") {
    throw new Error("Non autorizzato: solo un amministratore può creare un club.");
  }

  const nome = String(formData.get("nome") || "").trim();
  const stagioneCorrente = String(
    formData.get("stagione_corrente") || "2026/2027"
  ).trim();

  const colorePrimario = String(
    formData.get("colore_primario") || "#d71920"
  ).trim();

  const coloreSecondario = String(
    formData.get("colore_secondario") || "#111827"
  ).trim();

  const coloreFlagScelta = String(
    formData.get("colore_flag_scelta") || "primario"
  );

  const coloreFlag =
    coloreFlagScelta === "secondario" ? coloreSecondario : colorePrimario;

  const logo = formData.get("logo") as File | null;

  if (!nome) return;

  const logoUrl = logo ? await uploadLogo(supabase, logo, "club") : null;

  const { data: nuovoClub, error: clubError } = await supabase
    .from("club")
    .insert({
      nome,
      slug: slugify(nome),
      stagione_corrente: stagioneCorrente,
      logo_url: logoUrl,
      colore_primario: colorePrimario,
      colore_secondario: coloreSecondario,
      colore_flag: coloreFlag,
      attivo: true,
    })
    .select("id")
    .single();

  if (clubError) throw new Error(clubError.message);

  const clubIdsAttuali = profiloUtente?.club_id ?? [];

  const nuoviClubIds = clubIdsAttuali.includes(nuovoClub.id)
    ? clubIdsAttuali
    : [...clubIdsAttuali, nuovoClub.id];

  const { error: profiloUpdateError } = await supabase
    .from("profili")
    .update({
      club_id: nuoviClubIds,
      last_club_id: nuovoClub.id,
      updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", user.id);

  if (profiloUpdateError) throw new Error(profiloUpdateError.message);

  revalidatePath("/club");
}

async function aggiornaClub(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("tipo_profilo")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError) throw new Error(profiloError.message);

  if (String(profilo?.tipo_profilo || "").toLowerCase() !== "admin") {
    throw new Error("Non autorizzato: solo un amministratore può modificare il club.");
  }

  const clubId = String(formData.get("club_id") || "").trim();
  const nome = String(formData.get("nome") || "").trim();

  const stagioneCorrente = String(
    formData.get("stagione_corrente") || ""
  ).trim();

  const colorePrimario = String(
    formData.get("colore_primario") || "#d71920"
  ).trim();

  const coloreSecondario = String(
    formData.get("colore_secondario") || "#111827"
  ).trim();

  const coloreFlagScelta = String(
    formData.get("colore_flag_scelta") || "primario"
  );

  const coloreFlag =
    coloreFlagScelta === "secondario" ? coloreSecondario : colorePrimario;

  const logo = formData.get("logo") as File | null;

  if (!clubId || !nome) return;

  const logoUrl = logo ? await uploadLogo(supabase, logo, "club") : null;

  const payload: {
    nome: string;
    slug: string;
    stagione_corrente: string | null;
    colore_primario: string;
    colore_secondario: string;
    colore_flag: string;
    logo_url?: string;
  } = {
    nome,
    slug: slugify(nome),
    stagione_corrente: stagioneCorrente || null,
    colore_primario: colorePrimario,
    colore_secondario: coloreSecondario,
    colore_flag: coloreFlag,
  };

  if (logoUrl) {
    payload.logo_url = logoUrl;
  }

  const { error } = await supabase
    .from("club")
    .update(payload)
    .eq("id", clubId);

  if (error) throw new Error(error.message);

  revalidatePath("/club");
}

async function creaSquadra(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("tipo_profilo")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError) throw new Error(profiloError.message);

  if (String(profilo?.tipo_profilo || "").toLowerCase() !== "admin") {
    throw new Error("Non autorizzato: solo un amministratore può creare una squadra.");
  }

  const clubId = String(formData.get("club_id") || "").trim();
  const nome = String(formData.get("nome") || "").trim();
  const categoria = String(formData.get("categoria") || "").trim();
  const stagione = String(formData.get("stagione") || "").trim();
  const logo = formData.get("logo") as File | null;

  if (!clubId || !nome) return;

  const { data: squadraEsistente, error: checkError } = await supabase
    .from("squadre")
    .select("id")
    .eq("club_id", clubId)
    .ilike("nome", nome)
    .maybeSingle();

  if (checkError) throw new Error(checkError.message);

  if (squadraEsistente) {
    throw new Error("Esiste già una squadra con questo nome per questo club.");
  }

  const logoUrl = logo
    ? await uploadLogo(supabase, logo, `squadre/${clubId}`)
    : null;

  const { error } = await supabase.from("squadre").insert({
    club_id: clubId,
    nome,
    categoria: categoria || null,
    stagione: stagione || null,
    logo_url: logoUrl,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/club");
}

export default async function ClubPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;

  if (user) {
    const { data: profiloCorrente } = await supabase
      .from("profili")
      .select("tipo_profilo")
      .eq("auth_user_id", user.id)
      .single();

    isAdmin =
      String(profiloCorrente?.tipo_profilo || "").toLowerCase() === "admin";
  }

  const { data: clubs = [], error: clubsError } = await supabase
    .from("club")
    .select(
      "id,nome,slug,logo_url,stagione_corrente,colore_primario,colore_secondario,colore_flag,attivo"
    )
    .order("created_at", { ascending: false });

  if (clubsError) throw new Error(clubsError.message);

  const clubIds = (clubs as Club[]).map((club) => club.id);

  let squadre: Squadra[] = [];

  if (clubIds.length > 0) {
    const { data: squadreData, error: squadreError } = await supabase
      .from("squadre")
      .select("id,club_id,nome,categoria,stagione,logo_url")
      .in("club_id", clubIds)
      .order("created_at", { ascending: false });

    if (squadreError) throw new Error(squadreError.message);

    squadre = squadreData || [];
  }
  async function eliminaClub(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("tipo_profilo")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError) throw new Error(profiloError.message);

  if (String(profilo?.tipo_profilo || "").toLowerCase() !== "admin") {
    throw new Error("Non autorizzato: solo un amministratore può eliminare il club.");
  }

  const clubId = String(formData.get("club_id") || "").trim();

  if (!clubId) return;

  const { error } = await supabase
    .from("club")
    .delete()
    .eq("id", clubId);

  if (error) throw new Error(error.message);

  revalidatePath("/club");
}
  const squadraIds = squadre.map((squadra) => squadra.id);

  let giocatori: { id: string; squadra_id: string | null; attivo: boolean }[] =
    [];

  if (squadraIds.length > 0) {
    const { data: giocatoriData, error: giocatoriError } = await supabase
      .from("giocatori")
      .select("id,squadra_id,attivo")
      .in("squadra_id", squadraIds)
      .eq("attivo", true);

    if (giocatoriError) throw new Error(giocatoriError.message);

    giocatori = giocatoriData || [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestione Club"
        description="Gestisci club, squadre e giocatori associati."
      />

      {isAdmin && (
      <AppCard title="Nuovo club">
        <form action={creaClub} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <label className="text-sm font-medium text-white">
                Nome club
              </label>
              <input
                name="nome"
                required
                placeholder="Es. Monferrato Rugby"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder:text-zinc-500 outline-none transition focus:border-[#d71920]"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-white">
                Stagione
              </label>
              <input
                name="stagione_corrente"
                defaultValue="2026/2027"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none transition focus:border-[#d71920]"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-white">
                Logo club
              </label>
              <input
                name="logo"
                type="file"
                accept="image/*"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-[#d71920] file:px-3 file:py-1 file:text-white hover:file:bg-[#b9151b]"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-white">
                Colore 1
              </label>
              <input
                name="colore_primario"
                type="color"
                defaultValue="#d71920"
                className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-white">
                Colore 2
              </label>
              <input
                name="colore_secondario"
                type="color"
                defaultValue="#111827"
                className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-2"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
            <label className="text-sm font-medium text-white">
              Colore da usare nel gestionale
            </label>

            <div className="mt-3 flex flex-wrap gap-6 text-sm text-zinc-300">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="colore_flag_scelta"
                  value="primario"
                  defaultChecked
                />
                Usa Colore 1
              </label>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="colore_flag_scelta"
                  value="secondario"
                />
                Usa Colore 2
              </label>
            </div>
          </div>

          <AppButton type="submit">Crea club</AppButton>
        </form>
      </AppCard>
      )}

      <div className="space-y-5">
        {(clubs as Club[]).map((club) => {
          const squadreClub = squadre.filter(
            (squadra) => squadra.club_id === club.id
          );

          const coloreGestionale =
            club.colore_flag || club.colore_primario || "#d71920";

          const coloreFlagScelta =
            club.colore_flag === club.colore_secondario
              ? "secondario"
              : "primario";

          return (
            <AppCard key={club.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {club.logo_url ? (
                    <Image
                      src={club.logo_url}
                      alt={club.nome}
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-500">
                      Logo
                    </div>
                  )}

                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {club.nome}
                    </h2>

                    <p className="text-sm text-zinc-400">
                      Slug: {club.slug} · Stagione:{" "}
                      {club.stagione_corrente || "Non impostata"}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="h-5 w-10 rounded-full border border-zinc-700"
                        style={{
                          backgroundColor: club.colore_primario || "#d71920",
                        }}
                      />

                      <span
                        className="h-5 w-10 rounded-full border border-zinc-700"
                        style={{
                          backgroundColor:
                            club.colore_secondario || "#111827",
                        }}
                      />

                      <span className="ml-3 text-xs text-zinc-500">
                        Gestionale:
                      </span>

                      <span
                        className="h-5 w-10 rounded-full border border-white"
                        style={{
                          backgroundColor: coloreGestionale,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {isAdmin && (
                <div className="flex gap-2">
                  <details className="relative">
                    <summary
                      className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-white transition"
                      style={{
                        borderColor: coloreGestionale,
                      }}
                    >
                      ✏️
                    </summary>

                    <div className="absolute right-0 z-20 mt-3 w-[720px] rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl">
                      
                      <form action={aggiornaClub} className="space-y-6">
  <input type="hidden" name="club_id" value={club.id} />

  <div className="flex items-start gap-4">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d71920] text-2xl">
      ✎
    </div>

    <div>
      <h3 className="text-3xl font-black text-white">Modifica club</h3>
      <p className="mt-1 text-sm text-zinc-400">
        Aggiorna le informazioni del club e lo stile del gestionale.
      </p>
    </div>
  </div>

  <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
    <h4 className="mb-5 flex items-center gap-3 text-lg font-bold text-white">
      <span className="text-[#d71920]">◎</span>
      Informazioni generali
    </h4>

    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label className="text-sm font-semibold text-zinc-300">
          Nome club
        </label>
        <input
          name="nome"
          required
          defaultValue={club.nome}
          className="mt-2 w-full rounded-2xl border border-zinc-700 bg-[#111217] px-5 py-4 text-lg text-white outline-none transition focus:border-[#d71920]"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-zinc-300">
          Stagione
        </label>
        <input
          name="stagione_corrente"
          defaultValue={club.stagione_corrente || ""}
          className="mt-2 w-full rounded-2xl border border-zinc-700 bg-[#111217] px-5 py-4 text-lg text-white outline-none transition focus:border-[#d71920]"
        />
      </div>
    </div>
  </div>

  <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
    <h4 className="mb-5 flex items-center gap-3 text-lg font-bold text-white">
      <span className="text-[#d71920]">◌</span>
      Colori del club
    </h4>

    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label className="text-sm font-semibold text-zinc-300">
          Colore 1 <span className="font-normal text-zinc-500">(Primario)</span>
        </label>

        <div className="mt-2 flex items-center gap-4 rounded-2xl border border-zinc-700 bg-[#111217] px-4 py-3">
          <input
            name="colore_primario"
            type="color"
            defaultValue={club.colore_primario || "#d71920"}
            className="h-11 w-14 cursor-pointer rounded-xl border-0 bg-transparent p-0"
          />
          <span className="font-mono text-lg text-white">
            {club.colore_primario || "#d71920"}
          </span>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-zinc-300">
          Colore 2{" "}
          <span className="font-normal text-zinc-500">(Secondario)</span>
        </label>

        <div className="mt-2 flex items-center gap-4 rounded-2xl border border-zinc-700 bg-[#111217] px-4 py-3">
          <input
            name="colore_secondario"
            type="color"
            defaultValue={club.colore_secondario || "#111827"}
            className="h-11 w-14 cursor-pointer rounded-xl border-0 bg-transparent p-0"
          />
          <span className="font-mono text-lg text-white">
            {club.colore_secondario || "#111827"}
          </span>
        </div>
      </div>
    </div>

    <div className="mt-5 rounded-3xl border border-[#d71920]/70 bg-[#d71920]/5 p-5">
      <label className="text-base font-bold text-white">
        Colore da usare nel gestionale
      </label>

      <p className="mt-1 text-sm text-zinc-400">
        Questo sarà il colore principale utilizzato per bottoni, header e altri
        elementi del gestionale.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label
          className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${
            coloreFlagScelta === "primario"
              ? "border-[#d71920] bg-[#d71920]/10"
              : "border-zinc-700 bg-[#111217] hover:border-zinc-500"
          }`}
        >
          <input
            type="radio"
            name="colore_flag_scelta"
            value="primario"
            defaultChecked={coloreFlagScelta === "primario"}
            className="h-4 w-4 accent-[#d71920]"
          />

          <span
            className="h-14 w-14 rounded-full border border-white/20"
            style={{
              backgroundColor: club.colore_primario || "#d71920",
            }}
          />

          <span>
            <span className="block font-bold text-white">
              Usa Colore 1 (Primario)
            </span>
            <span className="mt-1 block font-mono text-sm text-zinc-400">
              {club.colore_primario || "#d71920"}
            </span>
          </span>
        </label>

        <label
          className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${
            coloreFlagScelta === "secondario"
              ? "border-[#d71920] bg-[#d71920]/10"
              : "border-zinc-700 bg-[#111217] hover:border-zinc-500"
          }`}
        >
          <input
            type="radio"
            name="colore_flag_scelta"
            value="secondario"
            defaultChecked={coloreFlagScelta === "secondario"}
            className="h-4 w-4 accent-[#d71920]"
          />

          <span
            className="h-14 w-14 rounded-full border border-white/20"
            style={{
              backgroundColor: club.colore_secondario || "#111827",
            }}
          />

          <span>
            <span className="block font-bold text-white">
              Usa Colore 2 (Secondario)
            </span>
            <span className="mt-1 block font-mono text-sm text-zinc-400">
              {club.colore_secondario || "#111827"}
            </span>
          </span>
        </label>
      </div>
    </div>
  </div>

  <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
    <h4 className="mb-4 flex items-center gap-3 text-lg font-bold text-white">
      <span className="text-[#d71920]">▱</span>
      Logo del club
    </h4>

    <label className="text-sm text-zinc-400">
      Carica un nuovo logo (facoltativo)
    </label>

    <div className="mt-3 rounded-2xl border border-dashed border-zinc-700 bg-[#111217] p-5">
      <input
        name="logo"
        type="file"
        accept="image/*"
        className="w-full text-zinc-300 file:mr-4 file:rounded-xl file:border file:border-zinc-700 file:bg-zinc-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-zinc-800"
      />
      <p className="mt-2 text-xs text-zinc-500">
        Formati supportati: JPG, PNG, WEBP. Dimensione massima consigliata: 5MB.
      </p>
    </div>
  </div>

  <div className="grid gap-4 md:grid-cols-2">
    <button
      type="submit"
      className="rounded-2xl bg-[#d71920] px-6 py-4 text-base font-black text-white transition hover:bg-[#b9151b]"
    >
      💾 Salva modifiche
    </button>

    <button
      type="submit"
      form="delete-club-form"
      className="rounded-2xl border border-red-500/60 bg-red-500/5 px-6 py-4 text-base font-black text-red-400 transition hover:bg-red-500 hover:text-white"
    >
      🗑 Elimina club definitivamente
    </button>
  </div>
</form>

<form id="delete-club-form" action={eliminaClub}>
  <input type="hidden" name="club_id" value={club.id} />
</form>

                    </div>
                  </details>

                  <details className="relative">
                    <summary
                      className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl text-xl text-white transition"
                      style={{
                        backgroundColor: coloreGestionale,
                      }}
                    >
                      +
                    </summary>

                    <div className="absolute right-0 z-20 mt-3 w-[720px] rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl">
                      <form action={creaSquadra} className="space-y-4">
                        <input type="hidden" name="club_id" value={club.id} />

                        <h3 className="font-semibold text-white">
                          Crea nuova squadra
                        </h3>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="text-sm font-medium text-white">
                              Nome
                            </label>
                            <input
                              name="nome"
                              required
                              placeholder="Es. Monferrato U18"
                              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder:text-zinc-500 outline-none transition focus:border-[#d71920]"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium text-white">
                              Categoria
                            </label>
                            <select
                              name="categoria"
                              defaultValue=""
                              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none transition focus:border-[#d71920]"
                            >
                              <option value="" disabled>
                                Seleziona categoria
                              </option>

                              {CATEGORIE_SQUADRE.map((categoria) => (
                                <option key={categoria} value={categoria}>
                                  {categoria}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-white">
                              Stagione
                            </label>
                            <input
                              name="stagione"
                              defaultValue={
                                club.stagione_corrente || "2026/2027"
                              }
                              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none transition focus:border-[#d71920]"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium text-white">
                              Logo
                            </label>
                            <input
                              name="logo"
                              type="file"
                              accept="image/*"
                              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-[#d71920] file:px-3 file:py-1 file:text-white hover:file:bg-[#b9151b]"
                            />
                          </div>
                        </div>

                        <AppButton type="submit">Crea squadra</AppButton>
                      </form>
                    </div>
                  </details>
                </div>
                )}
              </div>

              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-white">Squadre</h3>
                  <span className="text-sm text-zinc-400">
                    {squadreClub.length} squadre
                  </span>
                </div>

                {squadreClub.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    Nessuna squadra associata a questo club.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {squadreClub.map((squadra) => {
                      const numeroGiocatori = giocatori.filter(
                        (giocatore) => giocatore.squadra_id === squadra.id
                      ).length;

                      return (
                        <div
                          key={squadra.id}
                          className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 transition"
                          style={{
                            borderColor: `${coloreGestionale}55`,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {squadra.logo_url ? (
                              <Image
                                src={squadra.logo_url}
                                alt={squadra.nome}
                                width={48}
                                height={48}
                                className="h-12 w-12 rounded-lg border border-zinc-700 object-cover"
                              />
                            ) : (
                              <div
                                className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-700 text-xs font-semibold text-white"
                                style={{
                                  background: `linear-gradient(135deg, ${
                                    club.colore_primario || "#d71920"
                                  }, ${
                                    club.colore_secondario || "#111827"
                                  })`,
                                }}
                              >
                                MR
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">
                                {squadra.nome}
                              </p>
                              <p className="text-sm text-zinc-400">
                                {squadra.categoria || "Senza categoria"} ·{" "}
                                {squadra.stagione || "Senza stagione"}
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {numeroGiocatori} giocatori
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </AppCard>
          );
        })}
      </div>
    </div>
  );
}