export type CategoriaUnitaTest = "tempo" | "peso" | "lunghezza";
export type ComponenteUnitaTest =
  | "minuti"
  | "secondi"
  | "centesimi"
  | "kg"
  | "g"
  | "metri"
  | "centimetri";

export type ConfigurazioneUnitaTest = {
  categoria: CategoriaUnitaTest | "altro";
  componenti: ComponenteUnitaTest[];
  valoreOriginale: string;
};

const COMPONENTI: Record<CategoriaUnitaTest, ComponenteUnitaTest[]> = {
  tempo: ["minuti", "secondi", "centesimi"],
  peso: ["kg", "g"],
  lunghezza: ["metri", "centimetri"],
};

export function componentiPerCategoria(categoria: CategoriaUnitaTest) {
  return COMPONENTI[categoria];
}

export function serializzaUnitaTest(
  categoria: CategoriaUnitaTest,
  componenti: ComponenteUnitaTest[]
) {
  const valide = COMPONENTI[categoria].filter((voce) =>
    componenti.includes(voce)
  );
  return `${categoria}:${valide.join(",")}`;
}

export function unitaEffettivaTest(nomeTest: string, unita: string) {
  if (/agility/i.test(nomeTest)) {
    return serializzaUnitaTest("tempo", ["secondi", "centesimi"]);
  }
  return unita;
}

export function parseUnitaTest(valore: string): ConfigurazioneUnitaTest {
  const normalizzato = String(valore ?? "").trim().toLowerCase();
  const [categoria, elenco = ""] = normalizzato.split(":", 2);

  if (
    categoria === "tempo" ||
    categoria === "peso" ||
    categoria === "lunghezza"
  ) {
    const componenti = COMPONENTI[categoria].filter((voce) =>
      elenco.split(",").includes(voce)
    );
    return {
      categoria,
      componenti:
        componenti.length > 0 ? componenti : [COMPONENTI[categoria][0]],
      valoreOriginale: valore,
    };
  }

  // Compatibilita' con i test creati prima della configurazione composta.
  if (normalizzato === "secondi") {
    return {
      categoria: "tempo",
      componenti: ["minuti", "secondi"],
      valoreOriginale: valore,
    };
  }
  if (normalizzato === "kg") {
    return {
      categoria: "peso",
      componenti: ["kg", "g"],
      valoreOriginale: valore,
    };
  }
  if (normalizzato === "metri" || normalizzato === "cm") {
    return {
      categoria: "lunghezza",
      componenti:
        normalizzato === "cm" ? ["centimetri"] : ["metri", "centimetri"],
      valoreOriginale: valore,
    };
  }

  return { categoria: "altro", componenti: [], valoreOriginale: valore };
}

export function etichettaUnitaTest(valore: string) {
  const config = parseUnitaTest(valore);
  if (config.categoria === "altro") return valore;
  return config.componenti.join(" + ");
}

export function valoreComponenteTest(
  valoreNormalizzato: string,
  unita: string,
  componente: ComponenteUnitaTest
) {
  if (valoreNormalizzato === "") return "";
  const valore = Number(valoreNormalizzato);
  if (!Number.isFinite(valore)) return "";
  const config = parseUnitaTest(unita);

  if (config.categoria === "tempo") {
    const haMinuti = config.componenti.includes("minuti");
    if (componente === "minuti") return String(Math.floor(valore / 60));
    if (componente === "secondi") {
      return String(Math.floor(haMinuti ? valore % 60 : valore));
    }
    if (componente === "centesimi") {
      return String(Math.round((valore - Math.floor(valore)) * 100));
    }
  }

  if (config.categoria === "peso") {
    const haKg = config.componenti.includes("kg");
    if (componente === "kg") return String(haKg && config.componenti.includes("g") ? Math.floor(valore) : valore);
    if (componente === "g") return String(Math.round((haKg ? valore % 1 : valore) * 1000));
  }

  if (config.categoria === "lunghezza") {
    const haMetri = config.componenti.includes("metri");
    if (componente === "metri") {
      return String(
        haMetri && config.componenti.includes("centimetri")
          ? Math.floor(valore)
          : valore
      );
    }
    if (componente === "centimetri") {
      return String(Math.round((haMetri ? valore % 1 : valore) * 100));
    }
  }

  return "";
}

export function aggiornaComponenteTest(params: {
  valoreNormalizzato: string;
  unita: string;
  componente: ComponenteUnitaTest;
  nuovoValore: string;
}) {
  const config = parseUnitaTest(params.unita);
  const parti = new Map<ComponenteUnitaTest, number>();
  for (const componente of config.componenti) {
    parti.set(
      componente,
      Number(valoreComponenteTest(params.valoreNormalizzato, params.unita, componente)) || 0
    );
  }
  parti.set(
    params.componente,
    Math.max(0, Number(params.nuovoValore) || 0)
  );

  const tuttoVuoto =
    params.nuovoValore === "" &&
    Array.from(parti.entries()).every(
      ([componente, valore]) => componente === params.componente || valore === 0
    );
  if (tuttoVuoto) return "";

  if (config.categoria === "tempo") {
    return String(
      (parti.get("minuti") ?? 0) * 60 +
        (parti.get("secondi") ?? 0) +
        Math.min(99, parti.get("centesimi") ?? 0) / 100
    );
  }
  if (config.categoria === "peso") {
    return String((parti.get("kg") ?? 0) + (parti.get("g") ?? 0) / 1000);
  }
  if (config.categoria === "lunghezza") {
    return String(
      (parti.get("metri") ?? 0) +
        (parti.get("centimetri") ?? 0) / 100
    );
  }
  return params.nuovoValore;
}

export function formattaValoreTest(valore: number | null, unita: string) {
  if (valore === null || valore === undefined) return "—";
  const config = parseUnitaTest(unita);
  if (config.categoria === "altro") return `${valore} ${unita}`;

  return config.componenti
    .map((componente) => {
      const parte = valoreComponenteTest(String(valore), unita, componente);
      const simbolo: Record<ComponenteUnitaTest, string> = {
        minuti: "min",
        secondi: "s",
        centesimi: "cs",
        kg: "kg",
        g: "g",
        metri: "m",
        centimetri: "cm",
      };
      return `${parte} ${simbolo[componente]}`;
    })
    .join(" ");
}
