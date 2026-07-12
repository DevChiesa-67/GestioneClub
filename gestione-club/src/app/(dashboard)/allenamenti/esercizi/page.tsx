import { PageHeader } from "@/components/layout/PageHeader";
import { AppCard } from "@/components/ui/AppCard";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Esercizi"
        description="Sezione Esercizi del gestionale Monferrato Rugby."
      />

      <AppCard>
        <p className="text-zinc-400">
          Contenuto della pagina Esercizi.
        </p>
      </AppCard>
    </>
  );
}
