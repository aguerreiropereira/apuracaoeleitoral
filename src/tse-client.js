/**
 * Cliente HTTP para a CDN oficial do TSE - Eleições Gerais 2026.
 * Suporta Presidente (Pleito 6257), Governador e Senador (Pleito 6259) por UF.
 */

const { UFS, UF_NAMES, PARTY_COLORS } = require("../data/mock-data");

class TseClient {
  constructor(options = {}) {
    this.ano = "2026";
    this.baseUrl = "https://resultados.tse.jus.br/oficial";
    this.cache = new Map();
    this.cacheTtlMs = 15 * 1000; // 15 segundos
  }

  /**
   * Constrói a URL oficial .jws do TSE conforme cargo e UF
   * - Cargo 1 (Presidente): Eleição 6257
   * - Cargo 3 (Governador) e 5 (Senador): Eleição 6259
   */
  buildJwsUrl(uf = "br", cargo = "1") {
    let ufLower = (uf || "br").toLowerCase();
    // Governador e Senador não existem no âmbito 'BR'; padroniza para 'SP' se nenhum for selecionado
    if ((cargo === "3" || cargo === "5") && (ufLower === "br" || !ufLower)) {
      ufLower = "sp";
    }

    const cargoCode = String(cargo).padStart(4, "0");
    const eleicaoId = (cargo === "1") ? "6257" : "6259";
    return `${this.baseUrl}/ele${this.ano}/${eleicaoId}/dados/${ufLower}/${ufLower}-c${cargoCode}-e00${eleicaoId}-u.jws`;
  }

  async fetchJws(url) {
    const cached = this.cache.get(url);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "*/*"
      }
    });

    if (!response.ok) {
      throw new Error(`TSE HTTP ${response.status} ao consultar ${url}`);
    }

    const rawText = await response.text();
    const parts = rawText.trim().split(".");
    if (parts.length < 2) {
      throw new Error("Formato JWS inválido retornado pelo TSE");
    }

    const payloadStr = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadStr);

    this.cache.set(url, { timestamp: now, data: payload });
    return payload;
  }

  parseCandidates(cargObj, eleicaoId, ufLower, cargo) {
    const candidates = [];
    const agrList = cargObj?.agr || [];

    agrList.forEach(colig => {
      (colig.par || []).forEach(partido => {
        (partido.cand || []).forEach(c => {
          const party = partido.sg || "";
          const color = PARTY_COLORS[party] || "#3b82f6";
          const votesNominal = parseInt(c.vap ? c.vap.replace(/\D/g, "") : "0", 10) || 0;
          const pvapStr = c.pvap || "0,00";
          const pctNum = parseFloat(pvapStr.replace(",", ".")) || 0;
          
          // Candidatos à presidência (cargo 1) sempre ficam na pasta 'br'
          const photoUf = (cargo === "1") ? "br" : ufLower;
          const photoUrl = c.sqcand 
            ? `https://resultados.tse.jus.br/oficial/ele2026/${eleicaoId}/fotos/${photoUf}/${c.sqcand}.jpeg`
            : null;

          // Suporte ao formato oficial do TSE 2026 para vice e suplentes (campo c.vs)
          const vicesList = (c.vs || c.vpos || []).map(v => {
            const role = v.tp === "v" ? "Vice" : (v.tp === "s1" ? "1º Suplente" : (v.tp === "s2" ? "2º Suplente" : ""));
            const name = v.nmu || v.nm;
            const partySg = v.sgp ? ` (${v.sgp})` : "";
            return role ? `${role}: ${name}${partySg}` : `${name}${partySg}`;
          });
          const vices = vicesList.join(" · ");

          candidates.push({
            n: c.n,
            nm: c.nmu || c.nm,
            nmCompleto: c.nm,
            vice: vices,
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
    return candidates;
  }

  async fetchLiveSnapshot(cargo = "1", uf = "br") {
    const now = Date.now();
    let ufLower = (uf || "br").toLowerCase();
    if ((cargo === "3" || cargo === "5") && (ufLower === "br" || !ufLower)) {
      ufLower = "sp";
    }

    const eleicaoId = (cargo === "1") ? "6257" : "6259";
    const jwsUrl = this.buildJwsUrl(ufLower, cargo);
    const data = await this.fetchJws(jwsUrl);

    const cargObj = data.carg?.[0] || {};
    const candidates = this.parseCandidates(cargObj, eleicaoId, ufLower, cargo);

    const s = data.s || {};
    const v = data.v || {};
    const e = data.e || {};

    const totalSec = parseInt(s.ts || "499248", 10);
    const procSec = parseInt(s.st || "0", 10);
    const pctSecStr = s.pst || "0,00";
    const pctSections = parseFloat(pctSecStr.replace(",", ".")) / 100;

    const totalVotes = parseInt(v.tv || "0", 10);
    const validVotes = parseInt(v.vv || v.vvc || "0", 10);
    const blankVotes = parseInt(v.vb || "0", 10);
    const nullVotes = parseInt(v.vn || "0", 10);
    const abstencoes = parseInt(e.a || "0", 10);
    const electorate = parseInt(e.te || "158745502", 10);

    const hasStarted = procSec > 0 || totalVotes > 0;
    const officeName = cargObj.nmn || (cargo === "1" ? "Presidente" : (cargo === "3" ? "Governador" : "Senador"));
    const ufUpper = ufLower.toUpperCase();
    const ufName = UF_NAMES[ufUpper] || (ufLower === "br" ? "Brasil" : ufUpper);

    return {
      mode: "tse",
      eleicaoId: eleicaoId,
      eleicaoNome: `Eleição 2026 - ${officeName} (${ufName})`,
      serverNow: now,
      refreshedAt: now,
      nextRefreshAt: now + 20000,
      intervalSec: 20,
      office: officeName,
      officeCode: cargo,
      uf: ufUpper,
      ufName: ufName,
      hasStarted: hasStarted,
      national: {
        totalSections: totalSec,
        sectionsProcessed: procSec,
        pctSections: pctSections,
        pctSectionsDisplay: pctSecStr,
        totalVotes,
        validVotes,
        blankVotes,
        nullVotes,
        abstencoes,
        electorate,
        candidates
      },
      states: UFS.reduce((acc, stateUf) => {
        acc[stateUf] = {
          uf: stateUf,
          name: UF_NAMES[stateUf] || stateUf,
          pctSections: 0,
          pctSectionsDisplay: "0,00",
          totalVotes: 0,
          leader: null
        };
        return acc;
      }, {}),
      collection: {
        state: hasStarted ? "updated" : "scheduled",
        title: hasStarted ? `Coleta Oficial TSE em Tempo Real (${officeName})` : "Aguardando 17h (Horário de Brasília)",
        detail: hasStarted 
          ? `Apuração oficial para ${officeName} em ${ufName}.`
          : "Os resultados oficiais do TSE estarão disponíveis a partir das 17h de Brasília.",
        lastCompleteAt: now
      },
      source: {
        ok: true,
        provider: `TSE CDN Oficial (${ufLower}-c${String(cargo).padStart(4, "0")}-e00${eleicaoId}-u.jws)`,
        lastSuccessAt: now
      }
    };
  }
}

module.exports = TseClient;
