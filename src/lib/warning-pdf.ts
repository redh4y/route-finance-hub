/**
 * Gerador de Termo de Advertência — abre janela com HTML formatado + print dialog.
 * Segue o mesmo padrão de exportToPDF em export-utils.ts (window.open + window.print).
 */

export interface WarningData {
  aluno_nome: string;
  coordenador_nome: string;
  onibus_cor?: string;
  data_ocorrencia: string; // ISO date string YYYY-MM-DD
  infracoes: string[];
  outro_motivo?: string;
  gravidade: "LEVE_MODERADA" | "GRAVE";
  penalidade: "ADVERTENCIA_ESCRITA" | "SUSPENSAO" | "EXCLUSAO";
  numero_advertencia?: number;
  suspensao_dias?: number;
  suspensao_data_inicio?: string; // ISO date string
  suspensao_data_fim?: string;    // ISO date string
  suspensao_motivo?: "REINCIDENCIA" | "FALTA_GRAVE";
  observacoes?: string;
}

const INFRACOES_MAP: Record<string, { label: string; paragrafo: string }> = {
  DESRESPEITO: {
    label: "Desrespeito / Desacato a colegas, motoristas ou coordenadores",
    paragrafo: "§2°, §5°, §9°",
  },
  BRIGAS: {
    label: "Brigas, discussões, provocações ou faltas graves",
    paragrafo: "§3°, §4°",
  },
  BARULHO: {
    label: "Barulho excessivo, uso de som sem fones ou promoção de 'festinhas'",
    paragrafo: "§3°, §5°",
  },
  CONSUMO: {
    label: "Consumo ou porte de bebidas alcoólicas, cigarros, armas ou afins",
    paragrafo: "§3°",
  },
  LIMPEZA: {
    label: "Sujeira ou dano ao veículo",
    paragrafo: "§7°",
  },
  ASSENTOS: {
    label: "Ocupação indevida ou reserva de assentos com objetos pessoais",
    paragrafo: "§8°, §8-A",
  },
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function buildInfracoesSection(data: WarningData): string {
  const ALL_KEYS = ["DESRESPEITO", "BRIGAS", "BARULHO", "CONSUMO", "LIMPEZA", "ASSENTOS"];
  const rows = ALL_KEYS.map((key) => {
    const checked = data.infracoes.includes(key);
    const info = INFRACOES_MAP[key];
    return `
      <tr>
        <td style="padding:4px 8px;width:24px;text-align:center;font-size:16px">${checked ? "☑" : "☐"}</td>
        <td style="padding:4px 8px;font-size:12px">${info.label}</td>
        <td style="padding:4px 8px;font-size:11px;color:#555;white-space:nowrap">${info.paragrafo}</td>
      </tr>`;
  }).join("");

  const hasOutro = data.infracoes.includes("OUTRO");
  const outroRow = `
    <tr>
      <td style="padding:4px 8px;text-align:center;font-size:16px">${hasOutro ? "☑" : "☐"}</td>
      <td style="padding:4px 8px;font-size:12px" colspan="2">
        Outro: ${hasOutro && data.outro_motivo ? `<strong>${data.outro_motivo}</strong>` : "_______________________________"}
      </td>
    </tr>`;

  return `<table style="width:100%;border-collapse:collapse">${rows}${outroRow}</table>`;
}

function buildPenalidadeSection(data: WarningData): string {
  if (data.penalidade === "ADVERTENCIA_ESCRITA") {
    const n = data.numero_advertencia ?? 1;
    const ordinal = n === 1 ? "1ª" : n === 2 ? "2ª" : n === 3 ? "3ª" : `${n}ª`;
    return `
      <p style="margin:8px 0;font-size:13px">
        Conforme as diretrizes estipuladas no <strong>§10°</strong> do regulamento, aplica-se:
        <strong>ADVERTÊNCIA ESCRITA</strong> — esta é a <strong>${ordinal} advertência</strong> do(a) aluno(a).
      </p>
      <p style="margin:8px 0;font-size:12px;color:#555">
        Em caso de reincidência ou nova infração grave, o(a) aluno(a) estará sujeito(a) a penalidades mais severas,
        podendo chegar à exclusão definitiva do transporte.
      </p>`;
  }

  if (data.penalidade === "SUSPENSAO") {
    const dias = data.suspensao_dias ?? 1;
    const diasExt = dias === 1 ? "1 (um) dia" : `${dias} (${dias}) dias`;
    const motivo = data.suspensao_motivo === "REINCIDENCIA" ? "reincidência em infração anterior" : "gravidade da infração";
    const inicio = data.suspensao_data_inicio ? formatDate(data.suspensao_data_inicio) : "___/___/______";
    const fim = data.suspensao_data_fim ? formatDate(data.suspensao_data_fim) : "___/___/______";
    const dataStr = `${inicio} até ${fim}`;
    return `
      <p style="margin:8px 0;font-size:13px">
        Conforme as diretrizes estipuladas no <strong>§10°</strong> do regulamento, e devido à ${motivo},
        fica estabelecida a <strong>SUSPENSÃO TEMPORÁRIA de ${diasExt}</strong> do uso do transporte.
      </p>
      <p style="margin:8px 0;font-size:13px">
        A suspensão será cumprida em <strong>${dataStr}</strong>, ficando o(a) aluno(a)
        terminantemente proibido(a) de embarcar no veículo, tanto no trajeto de ida quanto no de volta.
      </p>
      <p style="margin:8px 0;font-size:12px;color:#555">
        Em caso de reincidência ou nova infração, o(a) aluno(a) estará sujeito(a) a penalidades mais severas,
        podendo chegar à exclusão definitiva do transporte.
      </p>`;
  }

  // EXCLUSAO
  return `
    <p style="margin:8px 0;font-size:13px">
      Conforme as diretrizes estipuladas no <strong>§10°</strong> do regulamento, e diante da gravidade
      da infração e/ou reincidência, fica determinada a <strong>EXCLUSÃO DEFINITIVA</strong> do(a) aluno(a)
      do serviço de transporte da Tavares Transportes.
    </p>`;
}

export function printWarning(data: WarningData): void {
  const gravLabel = data.gravidade === "GRAVE" ? "⚠ GRAVE" : "Leve / Moderada";
  const penLabel =
    data.penalidade === "ADVERTENCIA_ESCRITA"
      ? "Advertência Escrita"
      : data.penalidade === "SUSPENSAO"
      ? "Suspensão Temporária"
      : "Exclusão Definitiva";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Advertência — ${data.aluno_nome}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', serif;
      margin: 0;
      padding: 32px 40px;
      color: #111;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header h1 { margin: 0 0 2px; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
    .header h2 { margin: 0; font-size: 14px; font-weight: normal; text-transform: uppercase; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 24px;
      margin-bottom: 16px;
      border: 1px solid #ccc;
      padding: 10px 14px;
      border-radius: 4px;
    }
    .meta-grid .item { font-size: 12px; }
    .meta-grid .item strong { display: block; font-size: 11px; text-transform: uppercase; color: #555; }
    .section { margin-bottom: 16px; }
    .section-title {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      border-bottom: 1px solid #999;
      padding-bottom: 3px;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .gravidade-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: bold;
      background: ${data.gravidade === "GRAVE" ? "#fee2e2" : "#fef9c3"};
      color: ${data.gravidade === "GRAVE" ? "#991b1b" : "#854d0e"};
      border: 1px solid ${data.gravidade === "GRAVE" ? "#fca5a5" : "#fde047"};
    }
    .penalidade-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: bold;
      background: #fef3c7;
      border: 1px solid #f59e0b;
    }
    .obs-box {
      border: 1px dashed #aaa;
      padding: 8px 12px;
      min-height: 36px;
      font-size: 12px;
      border-radius: 3px;
      color: #333;
    }
    .assinaturas {
      margin-top: 32px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .assinatura-line {
      border-top: 1px solid #000;
      padding-top: 4px;
      font-size: 11px;
      text-align: center;
    }
    .aviso-final {
      margin-top: 12px;
      font-size: 11px;
      color: #555;
      border-top: 1px solid #ddd;
      padding-top: 8px;
      text-align: center;
    }
    @media print {
      body { padding: 16px 24px; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>Tavares Transportes de Guaíra Ltda</h1>
    <h2>Termo Formal de Advertência — Regulamento de Transporte 2026</h2>
  </div>

  <div class="meta-grid">
    <div class="item"><strong>Data da Ocorrência</strong>${formatDate(data.data_ocorrencia)}</div>
    <div class="item"><strong>Ônibus / Cor</strong>${data.onibus_cor || "—"}</div>
    <div class="item"><strong>Aluno(a)</strong>${data.aluno_nome}</div>
    <div class="item"><strong>Coordenador(a)</strong>${data.coordenador_nome}</div>
  </div>

  <div class="section">
    <div class="section-title">1. Infrações Identificadas</div>
    ${buildInfracoesSection(data)}
    <p style="margin:8px 0 0;font-size:12px">
      Gravidade: <span class="gravidade-badge">${gravLabel}</span>
      &nbsp;&nbsp;
      Penalidade aplicada (§10°): <span class="penalidade-badge">${penLabel}</span>
    </p>
  </div>

  <div class="section">
    <div class="section-title">2. Penalidade Aplicada (§10°)</div>
    ${buildPenalidadeSection(data)}
  </div>

  <div class="section">
    <div class="section-title">3. Advertência Final</div>
    <p style="margin:0;font-size:12px">
      Ressaltamos que o transporte é coletivo e exige respeito às normas para a segurança e o bom convívio
      de todos os passageiros (<strong>§2°</strong>). O motorista e os coordenadores possuem autoridade
      operacional e devem ser respeitados integralmente (<strong>§5°</strong>).
      As regras se aplicam em todos os dias da semana, inclusive sextas-feiras (<strong>§3°</strong>).
    </p>
  </div>

  ${data.observacoes ? `
  <div class="section">
    <div class="section-title">Observações</div>
    <div class="obs-box">${data.observacoes}</div>
  </div>` : ""}

  <div class="assinaturas">
    <div>
      <div class="assinatura-line">
        ${data.aluno_nome}<br>Aluno(a) Contratante
      </div>
    </div>
    <div>
      <div class="assinatura-line">
        ${data.coordenador_nome}<br>Coordenador(a) Responsável
      </div>
    </div>
  </div>

  <div class="aviso-final">
    Guaíra/SP · Tavares Transportes de Guaíra Ltda · CNPJ 18.595.332/0001-21
  </div>

</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
