/**
 * Gerador de dados de demonstração e simulação com suporte a Presidente, Governador e Senador.
 */

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO"
];

const UF_NAMES = {
  "AC": "Acre", "AL": "Alagoas", "AM": "Amazonas", "AP": "Amapá", "BA": "Bahia",
  "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás",
  "MA": "Maranhão", "MG": "Minas Gerais", "MS": "Mato Grosso do Sul", "MT": "Mato Grosso",
  "PA": "Pará", "PB": "Paraíba", "PE": "Pernambuco", "PI": "Piauí", "PR": "Paraná",
  "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte", "RO": "Rondônia", "RR": "Roraima",
  "RS": "Rio Grande do Sul", "SC": "Santa Catarina", "SE": "Sergipe", "SP": "São Paulo",
  "TO": "Tocantins"
};

const PARTY_COLORS = {
  "PL": "#1f4fbf",
  "PT": "#c8202f",
  "PSD": "#6366f1",
  "REPUBLICANOS": "#0284c7",
  "NOVO": "#f97316",
  "MISSÃO": "#059669",
  "AVANTE": "#d97706",
  "UNIÃO": "#0d9488",
  "MDB": "#f59e0b",
  "PDT": "#ea580c",
  "PSB": "#e11d48",
  "REDE": "#10b981",
  "PSOL": "#dc2626",
  "PP": "#0284c7",
  "DC": "#0284c7",
  "PCB": "#b91c1c",
  "PSTU": "#991b1b",
  "UP": "#dc2626",
  "DEMOCRATA": "#2563eb",
  "PCO": "#7f1d1d",
  "PSDB": "#0284c7",
  "PRD": "#f59e0b",
  "AGIR": "#10b981",
  "SOLIDARIEDADE": "#ea580c",
  "CIDADANIA": "#ec4899",
  "PMB": "#8b5cf6",
  "MOBILIZA": "#06b6d4",
  "PRTB": "#1e40af"
};

// Candidatos à Presidência 2026
const CANDIDATES_PRESIDENT_2026 = [
  {
    n: "22",
    nm: "FLAVIO BOLSONARO",
    nmCompleto: "FLAVIO NANTES BOLSONARO",
    sg: "PL",
    colig: "PARTIDO LIBERAL",
    sqcand: "280002551544",
    foto: "https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002551544.jpeg",
    cor: "#1f4fbf",
    baseShare: 0.442
  },
  {
    n: "13",
    nm: "LULA",
    nmCompleto: "LUIZ INÁCIO LULA DA SILVA",
    sg: "PT",
    colig: "BRASIL PRONTO PRA MAIS",
    sqcand: "280002542548",
    foto: "https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002542548.jpeg",
    cor: "#c8202f",
    baseShare: 0.435
  },
  {
    n: "55",
    nm: "RONALDO CAIADO",
    nmCompleto: "RONALDO RAMOS CAIADO",
    sg: "PSD",
    colig: "PARTIDO SOCIAL DEMOCRÁTICO",
    sqcand: "280002551932",
    foto: "https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002551932.jpeg",
    cor: "#6366f1",
    baseShare: 0.058
  },
  {
    n: "30",
    nm: "ZEMA",
    nmCompleto: "ROMEU ZEMA NETO",
    sg: "NOVO",
    colig: "PARTIDO NOVO",
    sqcand: "280002539826",
    foto: "https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002539826.jpeg",
    cor: "#f97316",
    baseShare: 0.038
  },
  {
    n: "14",
    nm: "RENAN SANTOS",
    nmCompleto: "RENAN ANTONIO FERREIRA DOS SANTOS",
    sg: "MISSÃO",
    colig: "PARTIDO MISSÃO",
    sqcand: "280002540694",
    foto: "https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002540694.jpeg",
    cor: "#059669",
    baseShare: 0.012
  },
  {
    n: "70",
    nm: "ESCRITOR AUGUSTO CURY",
    nmCompleto: "AUGUSTO JORGE CURY",
    sg: "AVANTE",
    colig: "BRASIL DOS NOSSOS SONHOS",
    sqcand: "280002551547",
    foto: "https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002551547.jpeg",
    cor: "#d97706",
    baseShare: 0.007
  }
];

// Principais Candidatos a Governador 2026 por Estado (TSE 6259)
const STATE_GOVERNORS_2026 = {
  "SP": [
    { n: "10", nm: "TARCÍSIO", sg: "REPUBLICANOS", cor: "#0284c7", sqcand: "250002541303", share: 0.542, st: "Eleito" },
    { n: "13", nm: "FERNANDO HADDAD", sg: "PT", cor: "#c8202f", sqcand: "250002549705", share: 0.428, st: "Não eleito" },
    { n: "80", nm: "VIVIAN MENDES", sg: "UP", cor: "#dc2626", sqcand: "250002544912", share: 0.018, st: "Não eleito" },
    { n: "16", nm: "VERA LÚCIA", sg: "PSTU", cor: "#991b1b", sqcand: "250002536915", share: 0.008, st: "Não eleito" },
    { n: "21", nm: "CARLOS MACHADO", sg: "PCB", cor: "#b91c1c", sqcand: "250002550913", share: 0.004, st: "Não eleito" }
  ],
  "RJ": [
    { n: "55", nm: "EDUARDO PAES", sg: "PSD", cor: "#6366f1", sqcand: "190002543380", share: 0.514, st: "Eleito" },
    { n: "22", nm: "DOUGLAS RUAS", sg: "PL", cor: "#1f4fbf", sqcand: "190002542887", share: 0.386, st: "Não eleito" },
    { n: "10", nm: "GAROTINHO", sg: "REPUBLICANOS", cor: "#0284c7", sqcand: "190002550196", share: 0.052, st: "Não eleito" },
    { n: "30", nm: "ANDRÉ MARINHO", sg: "NOVO", cor: "#f97316", sqcand: "190002537524", share: 0.031, st: "Não eleito" },
    { n: "16", nm: "CYRO GARCIA", sg: "PSTU", cor: "#991b1b", sqcand: "190002540198", share: 0.017, st: "Não eleito" }
  ],
  "MG": [
    { n: "10", nm: "CLEITINHO AZEVEDO", sg: "REPUBLICANOS", cor: "#0284c7", sqcand: "130002552296", share: 0.448, st: "2º Turno" },
    { n: "13", nm: "PATRUS ANANIAS", sg: "PT", cor: "#c8202f", sqcand: "130002550464", share: 0.382, st: "2º Turno" },
    { n: "55", nm: "MATEUS SIMÕES", sg: "PSD", cor: "#6366f1", sqcand: "130002541911", share: 0.098, st: "Não eleito" },
    { n: "12", nm: "ALEXANDRE KALIL", sg: "PDT", cor: "#ea580c", sqcand: "130002539775", share: 0.052, st: "Não eleito" },
    { n: "15", nm: "GABRIEL", sg: "MDB", cor: "#f59e0b", sqcand: "130002549557", share: 0.020, st: "Não eleito" }
  ],
  "BA": [
    { n: "13", nm: "JERÔNIMO RODRIGUES", sg: "PT", cor: "#c8202f", sqcand: "50002536314", share: 0.528, st: "Eleito" },
    { n: "44", nm: "ACM NETO", sg: "UNIÃO", cor: "#0d9488", sqcand: "50002533190", share: 0.442, st: "Não eleito" },
    { n: "50", nm: "RONALDO MANSUR", sg: "PSOL", cor: "#dc2626", sqcand: "50002532269", share: 0.030, st: "Não eleito" }
  ]
};

// Principais Candidatos a Senador 2026 por Estado (TSE 6259)
const STATE_SENATORS_2026 = {
  "SP": [
    { n: "222", nm: "ANDRÉ DO PRADO", sg: "PL", cor: "#1f4fbf", sqcand: "250002541308", share: 0.382, st: "Eleito" },
    { n: "400", nm: "SIMONE TEBET", sg: "PSB", cor: "#e11d48", sqcand: "250002551502", share: 0.354, st: "Eleita" },
    { n: "111", nm: "GUILHERME DERRITE", sg: "PP", cor: "#0284c7", sqcand: "250002541312", share: 0.142, st: "Não eleito" },
    { n: "180", nm: "MARINA SILVA", sg: "REDE", cor: "#10b981", sqcand: "250002551501", share: 0.082, st: "Não eleito" },
    { n: "232", nm: "SONINHA FRANCINE", sg: "CIDADANIA", cor: "#f59e0b", sqcand: "250002552369", share: 0.040, st: "Não eleito" }
  ],
  "RJ": [
    { n: "222", nm: "FLÁVIO BOLSONARO (SENADO)", sg: "PL", cor: "#1f4fbf", sqcand: "190002542887", share: 0.421, st: "Eleito" },
    { n: "133", nm: "BENEDITA DA SILVA", sg: "PT", cor: "#c8202f", sqcand: "190002543380", share: 0.365, st: "Eleita" },
    { n: "555", nm: "ALESSANDRO MOLON", sg: "PSB", cor: "#e11d48", sqcand: "190002550196", share: 0.214, st: "Não eleito" }
  ]
};

let simProgress = 0.684; // 68,4%
let simCycle = 0;

async function getSimulationSnapshot(cargo = "1", uf = "br", tseClient = null) {
  simCycle++;
  if (simProgress < 0.99) {
    simProgress += 0.01;
    if (simProgress > 1) simProgress = 1;
  }

  const now = Date.now();
  let ufLower = (uf || "br").toLowerCase();
  if ((cargo === "3" || cargo === "5") && (ufLower === "br" || !ufLower)) {
    ufLower = "sp";
  }
  const ufUpper = ufLower.toUpperCase();
  const ufName = UF_NAMES[ufUpper] || (ufLower === "br" ? "Brasil" : ufUpper);

  let officeName = "Presidente";
  let eleicaoId = "6257";
  if (cargo === "3") {
    officeName = "Governador";
    eleicaoId = "6259";
  } else if (cargo === "5") {
    officeName = "Senador";
    eleicaoId = "6259";
  }

  // Tenta buscar os candidatos reais do TSE para este estado e cargo
  let candList = [];
  if (tseClient) {
    try {
      const jwsUrl = tseClient.buildJwsUrl(ufLower, cargo);
      const data = await tseClient.fetchJws(jwsUrl);
      const cargObj = data.carg?.[0] || {};
      const realCandidates = tseClient.parseCandidates(cargObj, eleicaoId, ufLower, cargo);
      if (realCandidates && realCandidates.length > 0) {
        candList = realCandidates;
      }
    } catch (e) {
      // Usa lista local pré-carregada se falhar
    }
  }

  // Se não obteve do TSE, usa os candidatos mock locais
  if (candList.length === 0) {
    if (cargo === "1") {
      candList = CANDIDATES_PRESIDENT_2026.map(c => ({
        n: c.n,
        nm: c.nm,
        nmCompleto: c.nmCompleto,
        sg: c.sg,
        cc: c.colig,
        sqcand: c.sqcand,
        foto: c.foto,
        cor: c.cor,
        share: c.baseShare
      }));
    } else if (cargo === "3") {
      candList = (STATE_GOVERNORS_2026[ufUpper] || STATE_GOVERNORS_2026["SP"]).map(c => ({
        n: c.n,
        nm: c.nm,
        sg: c.sg,
        cor: c.cor,
        sqcand: c.sqcand,
        foto: `https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/${ufLower}/${c.sqcand}.jpeg`,
        share: c.share,
        st: c.st
      }));
    } else {
      candList = (STATE_SENATORS_2026[ufUpper] || STATE_SENATORS_2026["SP"]).map(c => ({
        n: c.n,
        nm: c.nm,
        sg: c.sg,
        cor: c.cor,
        sqcand: c.sqcand,
        foto: `https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/${ufLower}/${c.sqcand}.jpeg`,
        share: c.share,
        st: c.st
      }));
    }
  }

  const totalSections = ufLower === "br" ? 499248 : Math.round(499248 * (ufUpper === "SP" ? 0.22 : 0.08));
  const sectionsProcessed = Math.round(totalSections * simProgress);
  const totalElectorate = ufLower === "br" ? 158745502 : Math.round(158745502 * (ufUpper === "SP" ? 0.22 : 0.08));
  const totalVotes = Math.round(totalElectorate * 0.79 * simProgress);
  const validVotes = Math.round(totalVotes * 0.942);
  const blankVotes = Math.round(totalVotes * 0.022);
  const nullVotes = Math.round(totalVotes * 0.036);
  const abstencoes = Math.round(totalElectorate * 0.21 * simProgress);

  // Calcula votos e percentuais simulados proporcionais
  const baseShares = candList.map((c, i) => c.share || Math.max(0.01, 0.45 - (i * 0.12)));
  const sumShares = baseShares.reduce((a, b) => a + b, 0);

  const formattedCandidates = candList.map((cand, idx) => {
    const r = baseShares[idx] / sumShares;
    const votes = Math.round(validVotes * r);
    const pvap = (r * 100).toFixed(2).replace(".", ",");
    const photoUrl = cand.foto || (cand.sqcand ? `https://resultados.tse.jus.br/oficial/ele2026/${eleicaoId}/fotos/${ufLower === "br" ? "br" : ufLower}/${cand.sqcand}.jpeg` : null);

    let st = cand.st || "Em apuração";
    if (simProgress > 0.95 && !cand.st) {
      if (idx === 0) st = r > 0.5 ? "Eleito" : "2º Turno";
      else if (idx === 1) st = "2º Turno";
      else st = "Não eleito";
    }

    return {
      n: cand.n,
      nm: cand.nm,
      nmCompleto: cand.nmCompleto || cand.nm,
      vice: cand.vice || "",
      sg: cand.sg,
      cc: cand.cc || cand.sg,
      sqcand: cand.sqcand,
      foto: photoUrl,
      cor: cand.cor || PARTY_COLORS[cand.sg] || "#3b82f6",
      vap: votes,
      pvap: pvap,
      pctNum: (r * 100).toFixed(2),
      st: st,
      eleito: st === "Eleito"
    };
  });

  formattedCandidates.sort((a, b) => b.vap - a.vap);

  // Gera dados dos estados para o mapa
  const states = {};
  UFS.forEach(stateUf => {
    const isThisState = stateUf === ufUpper;
    states[stateUf] = {
      uf: stateUf,
      name: UF_NAMES[stateUf],
      pctSections: simProgress,
      pctSectionsDisplay: (simProgress * 100).toFixed(2).replace(".", ","),
      totalVotes: Math.round(totalVotes * 0.08),
      leader: {
        name: formattedCandidates[0]?.nm || "Líder",
        number: formattedCandidates[0]?.n || "",
        party: formattedCandidates[0]?.sg || "",
        color: formattedCandidates[0]?.cor || "#1f4fbf",
        votes: Math.round(validVotes * 0.48 * 0.08),
        pct: "48.5"
      },
      runnerUp: {
        name: formattedCandidates[1]?.nm || "Vice-líder",
        number: formattedCandidates[1]?.n || "",
        party: formattedCandidates[1]?.sg || "",
        color: formattedCandidates[1]?.cor || "#c8202f",
        votes: Math.round(validVotes * 0.43 * 0.08),
        pct: "43.2"
      },
      candidates: formattedCandidates
    };
  });

  return {
    mode: "fake",
    eleicaoId: eleicaoId,
    eleicaoNome: `Eleições 2026 - ${officeName} (${ufName})`,
    serverNow: now,
    refreshedAt: now,
    nextRefreshAt: now + 20000,
    intervalSec: 20,
    office: officeName,
    officeCode: cargo,
    uf: ufUpper,
    ufName: ufName,
    hasStarted: true,
    national: {
      totalSections,
      sectionsProcessed,
      pctSections: simProgress,
      pctSectionsDisplay: (simProgress * 100).toFixed(2).replace(".", ","),
      totalVotes,
      validVotes,
      blankVotes,
      nullVotes,
      abstencoes,
      electorate: totalElectorate,
      candidates: formattedCandidates
    },
    states,
    collection: {
      state: "simulation",
      title: `Simulação 2026 · ${officeName} em ${ufName}`,
      detail: `Exibindo apuração para o cargo de ${officeName} no estado de ${ufName}.`,
      lastCompleteAt: now
    },
    source: {
      ok: true,
      provider: `TSE Simulador 2026 (Cargo ${cargo} · ${ufUpper})`,
      lastSuccessAt: now
    }
  };
}

module.exports = {
  UFS,
  UF_NAMES,
  PARTY_COLORS,
  CANDIDATES_PRESIDENT_2026,
  STATE_GOVERNORS_2026,
  STATE_SENATORS_2026,
  getSimulationSnapshot
};
