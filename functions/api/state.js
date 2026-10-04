/**
 * Handler para Cloudflare Pages Functions: /api/state
 * Suporta filtros dinâmicos de Cargo (1=Presidente, 3=Governador, 5=Senador) e UF.
 * Consome os arquivos oficiais assinados (.jws) da CDN do TSE 2026.
 */

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
  "PL": "#1f4fbf", "PT": "#c8202f", "PSD": "#6366f1", "REPUBLICANOS": "#0284c7",
  "NOVO": "#f97316", "MISSÃO": "#059669", "AVANTE": "#d97706", "UNIÃO": "#0d9488",
  "MDB": "#f59e0b", "PDT": "#ea580c", "PSB": "#e11d48", "REDE": "#10b981",
  "PSOL": "#dc2626", "PP": "#0284c7", "DC": "#0284c7", "PCB": "#b91c1c",
  "PSTU": "#991b1b", "UP": "#dc2626", "DEMOCRATA": "#2563eb", "PCO": "#7f1d1d",
  "PSDB": "#0284c7", "PRD": "#f59e0b", "AGIR": "#10b981"
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const cargo = url.searchParams.get("cargo") || "1";
  let uf = (url.searchParams.get("uf") || "br").toLowerCase();
  
  if ((cargo === "3" || cargo === "5") && (uf === "br" || !uf)) {
    uf = "sp";
  }

  const ufUpper = uf.toUpperCase();
  const ufName = UF_NAMES[ufUpper] || (uf === "br" ? "Brasil" : ufUpper);
  const officeName = (cargo === "1") ? "Presidente" : ((cargo === "3") ? "Governador" : "Senador");
  const eleicaoId = (cargo === "1") ? "6257" : "6259";
  const cargoCode = String(cargo).padStart(4, "0");

  const jwsUrl = `https://resultados.tse.jus.br/oficial/ele2026/${eleicaoId}/dados/${uf}/${uf}-c${cargoCode}-e00${eleicaoId}-u.jws`;

  try {
    const res = await fetch(jwsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "*/*"
      }
    });

    if (!res.ok) {
      throw new Error(`TSE CDN HTTP ${res.status}`);
    }

    const text = await res.text();
    const parts = text.trim().split(".");
    if (parts.length < 2) {
      throw new Error("Formato JWS inválido");
    }

    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const jsonStr = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(jsonStr);

    const snapshot = formatTsePayload(data, cargo, uf, ufName, officeName, eleicaoId);
    return new Response(JSON.stringify(snapshot), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15"
      }
    });
  } catch (err) {
    const now = Date.now();
    const fallback = {
      mode: "tse",
      eleicaoId,
      eleicaoNome: `Eleição 2026 - ${officeName} (${ufName})`,
      serverNow: now,
      refreshedAt: now,
      nextRefreshAt: now + 20000,
      intervalSec: 20,
      office: officeName,
      officeCode: cargo,
      uf: ufUpper,
      ufName: ufName,
      hasStarted: false,
      national: {
        totalSections: 0,
        sectionsProcessed: 0,
        pctSections: 0,
        pctSectionsDisplay: "0,00",
        totalVotes: 0,
        validVotes: 0,
        blankVotes: 0,
        nullVotes: 0,
        abstencoes: 0,
        electorate: 0,
        candidates: []
      },
      states: {},
      collection: {
        state: "scheduled",
        title: "Aguardando 17h (Horário de Brasília)",
        detail: `Os resultados oficiais do TSE estarão disponíveis a partir das 17h de Brasília.`,
        lastCompleteAt: now
      },
      source: { ok: false, error: err.message, lastSuccessAt: 0 }
    };

    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

function formatTsePayload(data, cargo, ufLower, ufName, officeName, eleicaoId) {
  const now = Date.now();
  const cargObj = data.carg?.[0] || {};
  const s = data.s || {};
  const v = data.v || {};
  const e = data.e || {};

  const candidates = [];
  const agrList = cargObj.agr || [];

  agrList.forEach(colig => {
    (colig.par || []).forEach(partido => {
      (partido.cand || []).forEach(c => {
        const party = partido.sg || "";
        const color = PARTY_COLORS[party] || "#3b82f6";
        const votesNominal = parseInt(c.vap ? c.vap.replace(/\D/g, "") : "0", 10) || 0;
        const pvapStr = c.pvap || "0,00";
        const pctNum = parseFloat(pvapStr.replace(",", ".")) || 0;
        const photoUf = (cargo === "1") ? "br" : ufLower;
        const photoUrl = c.sqcand 
          ? `https://resultados.tse.jus.br/oficial/ele2026/${eleicaoId}/fotos/${photoUf}/${c.sqcand}.jpeg`
          : null;

        const vicesList = (c.vs || c.vpos || []).map(item => {
          const role = item.tp === "v" ? "Vice" : (item.tp === "s1" ? "1º Suplente" : (item.tp === "s2" ? "2º Suplente" : ""));
          const name = item.nmu || item.nm;
          const pSg = item.sgp ? ` (${item.sgp})` : "";
          return role ? `${role}: ${name}${pSg}` : `${name}${pSg}`;
        });

        candidates.push({
          n: c.n,
          nm: c.nmu || c.nm,
          nmCompleto: c.nm,
          vice: vicesList.join(" · "),
          sg: party,
          cc: colig.nm || party,
          cor: color,
          sqcand: c.sqcand,
          foto: photoUrl,
          vap: votesNominal,
          pvap: pvapStr,
          pctNum: pctNum,
          st: c.st || (votesNominal > 0 ? "Em apuração" : "Aguardando 17h"),
          eleito: c.e === "s"
        });
      });
    });
  });

  candidates.sort((a, b) => b.vap - a.vap);

  const totalSec = parseInt(s.ts || "499248", 10);
  const procSec = parseInt(s.st || "0", 10);
  const pctSecStr = s.pst || "0,00";
  const pctSections = parseFloat(pctSecStr.replace(",", ".")) / 100;
  const hasStarted = procSec > 0;

  return {
    mode: "tse",
    eleicaoId,
    eleicaoNome: `Eleição 2026 - ${officeName} (${ufName})`,
    serverNow: now,
    refreshedAt: now,
    nextRefreshAt: now + 20000,
    intervalSec: 20,
    office: officeName,
    officeCode: cargo,
    uf: ufLower.toUpperCase(),
    ufName,
    hasStarted,
    national: {
      totalSections: totalSec,
      sectionsProcessed: procSec,
      pctSections,
      pctSectionsDisplay: pctSecStr,
      totalVotes: parseInt(v.tv || "0", 10),
      validVotes: parseInt(v.vv || v.vvc || "0", 10),
      blankVotes: parseInt(v.vb || "0", 10),
      nullVotes: parseInt(v.vn || "0", 10),
      abstencoes: parseInt(e.a || "0", 10),
      electorate: parseInt(e.te || "158745502", 10),
      candidates
    },
    states: {},
    collection: {
      state: hasStarted ? "updated" : "scheduled",
      title: hasStarted ? `Coleta Oficial TSE (${officeName})` : "Aguardando 17h (Horário de Brasília)",
      detail: hasStarted ? `Apuração oficial para ${officeName} em ${ufName}.` : "Os resultados oficiais do TSE estarão disponíveis a partir das 17h de Brasília.",
      lastCompleteAt: now
    },
    source: {
      ok: true,
      provider: `TSE CDN Oficial (${ufLower}-c${cargoCode}-e00${eleicaoId}-u.jws)`,
      lastSuccessAt: now
    }
  };
}
