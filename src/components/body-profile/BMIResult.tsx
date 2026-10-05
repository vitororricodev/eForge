import { Activity, ExternalLink, Target } from "lucide-react";
import {
  bmiWeightRange,
  calculateBMI,
  classifyBMI,
  formatBodyNumber,
  getBMIReference,
  heightCentimeters,
} from "@/lib/body-profile";

export function BMIResult({
  weight,
  height,
  age,
  goal,
  title = "IMC calculado",
}: {
  weight: number | null;
  height: number | null;
  age: number | null;
  goal?: string | null;
  title?: string;
}) {
  const bmi = calculateBMI(weight, height);
  const classification = classifyBMI(bmi, age);
  const reference = getBMIReference(age);
  const range = bmiWeightRange(height, age);
  const cm = heightCentimeters(height);
  const tone =
    classification?.state === "below"
      ? "text-sky-300"
      : classification?.state === "above"
        ? "text-yellow-300"
        : "text-neon";

  return (
    <section
      className="bmi-result min-w-0 rounded-2xl border border-neon/30 bg-neon/10 p-4 text-base"
      role="status"
      aria-label={title}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-muted-foreground">{title}</h2>
          <p className="mt-1 text-4xl leading-none text-neon">
            <strong>{formatBodyNumber(bmi)}</strong>
            {bmi != null && <span className="ml-2 text-base text-muted-foreground">kg/m²</span>}
          </p>
        </div>
        <Activity aria-hidden="true" className="mt-1 size-6 shrink-0 text-neon" />
      </div>
      {classification && (
        <p className={`mt-3 text-lg ${tone}`}>
          <strong>{classification.label}</strong>
          {classification.detail && <span> · {classification.detail}</span>}
        </p>
      )}
      {bmi == null && (
        <p className="mt-3 text-muted-foreground">
          Informe peso e altura válidos. Use 1,85 ou 185 para a altura.
        </p>
      )}
      {bmi != null && !reference && (
        <p className="mt-3 text-muted-foreground">
          {age != null && Number.isInteger(age) && age >= 10 && age < 20
            ? "Para menores de 20 anos, a classificação depende da idade em meses e das curvas de crescimento."
            : "Informe uma idade válida para ver a classificação e a faixa de referência."}
        </p>
      )}
      {reference && range && cm && (
        <div className="mt-4 border-t border-neon/20 pt-4">
          <h3 className="flex items-center gap-2 text-lg">
            <Target aria-hidden="true" className="size-4 shrink-0 text-neon" />
            IMC desejável · referência
          </h3>
          <dl className="mt-3 grid gap-3">
            <div>
              <dt className="text-muted-foreground">Faixa de IMC para sua idade</dt>
              <dd className="text-lg">
                {reference.minInclusive ? "De " : "Acima de "}
                {formatBodyNumber(reference.min)}
                {reference.minInclusive ? " até menos de " : " e abaixo de "}
                {formatBodyNumber(reference.max)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Peso correspondente à altura de {(cm / 100).toLocaleString("pt-BR")} m
              </dt>
              <dd className="text-lg">
                Aproximadamente {formatBodyNumber(range.min)} a {formatBodyNumber(range.max)} kg
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">
            {reference.group === "older"
              ? "Referência para 60 anos ou mais."
              : "Referência para adultos de 20 a 59 anos."}{" "}
            O IMC não distingue gordura de massa muscular. Esta faixa não define uma meta
            individual.
          </p>
        </div>
      )}
      {classification?.state === "below" && goal === "perder_peso" && (
        <p className="mt-3 rounded-xl border border-sky-300/30 bg-background/40 p-3 text-sky-200">
          Seu IMC está abaixo da faixa. Revise o objetivo de perder peso com um profissional de
          saúde.
        </p>
      )}
      {bmi != null && (
        <a
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon"
          href="https://www.gov.br/saude/pt-br/composicao/saps/vigilancia-alimentar-e-nutricional/arquivos/orientacoes-para-a-coleta-e-analise-de-dados-antropometricos-em-servicos-de-saude/view"
          target="_blank"
          rel="noopener noreferrer"
        >
          Referência: Ministério da Saúde
          <ExternalLink aria-hidden="true" size={14} />
          <span className="sr-only"> (abre em outra aba)</span>
        </a>
      )}
    </section>
  );
}
