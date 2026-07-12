import { PageHeader } from "@/components/layout/PageHeader";
import { AppCard } from "@/components/ui/AppCard";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Nuovo"
        description="Sezione Nuovo del gestionale Monferrato Rugby."
      />

      <AppCard>
        <p className="text-zinc-400">
          Contenuto della pagina Nuovo.
        </p>
      </AppCard>
    </>
  );
}
