/**
 * Serviço de Apuração Geográfica por Regiões e Estados do Brasil 2026.
 * Consolida dados oficiais do TSE para coloração do mapa e visualização em Sidebar.
 */

const { UFS, UF_NAMES } = require("../data/mock-data");

const REGIONS = {
  "Norte": ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
  "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MT", "MS"],
  "Sudeste": ["ES", "MG", "RJ", "SP"],
  "Sul": ["PR", "RS", "SC"]
};

const UF_TO_REGION = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste", PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul"
};

class GeoService {
  constructor(aggregator) {
    this.aggregator = aggregator;
    this.cache = null;
    this.lastFetch = 0;
    this.ttlMs = 15000; // 15 segundos de cache
  }

  async getSummary(params = {}) {
    const isFake = params.mode === "fake" || params.fake === "true";
    const now = Date.now();

    if (!isFake && this.cache && (now - this.lastFetch < this.ttlMs)) {
      return this.cache;
    }

    const tseClient = this.aggregator.tseClient;

    // Coleta dados dos 27 estados em paralelo
    const stateSnaps = await Promise.all(
      UFS.map(async (uf) => {
        try {
          const snap = await tseClient.fetchLiveSnapshot("1", uf.toLowerCase());
          const cands = snap.national?.candidates || [];
          const c1 = cands[0] || null;
          const c2 = cands[1] || null;
          return {
            uf,
            name: UF_NAMES[uf] || uf,
            region: UF_TO_REGION[uf] || "Outros",
            secPct: snap.national?.pctSectionsDisplay || "0,00",
            secPctNum: parseFloat(String(snap.national?.pctSectionsDisplay || "0").replace(",", ".")) || 0,
            secProcessed: snap.national?.sectionsProcessed || 0,
            secTotal: snap.national?.totalSections || 0,
            validVotes: snap.national?.validVotes || 0,
            totalVotes: snap.national?.totalVotes || 0,
            leader: c1 ? { n: c1.n, nm: c1.nm, sg: c1.sg, cor: c1.cor, vap: c1.vap, pvap: c1.pvap } : null,
            runnerUp: c2 ? { n: c2.n, nm: c2.nm, sg: c2.sg, cor: c2.cor, vap: c2.vap, pvap: c2.pvap } : null,
            candidates: cands.map(c => ({ n: c.n, nm: c.nm, sg: c.sg, cor: c.cor, vap: c.vap, pvap: c.pvap }))
          };
        } catch (e) {
          return {
            uf,
            name: UF_NAMES[uf] || uf,
            region: UF_TO_REGION[uf] || "Outros",
            secPct: "0,00",
            secPctNum: 0,
            secProcessed: 0,
            secTotal: 0,
            validVotes: 0,
            totalVotes: 0,
            leader: null,
            runnerUp: null,
            candidates: []
          };
        }
      })
    );

    // Contagem de estados liderados por candidato
    const leadingCandidateMap = {};
    stateSnaps.forEach(s => {
      if (s.leader) {
        const id = s.leader.n;
        if (!leadingCandidateMap[id]) {
          leadingCandidateMap[id] = {
            n: s.leader.n,
            nm: s.leader.nm,
            sg: s.leader.sg,
            cor: s.leader.cor,
            statesCount: 0,
            leadingStates: []
          };
        }
        leadingCandidateMap[id].statesCount += 1;
        leadingCandidateMap[id].leadingStates.push(s.uf);
      }
    });

    const topNationalLeaders = Object.values(leadingCandidateMap).sort((a, b) => b.statesCount - a.statesCount);

    // Consolidação por 5 Regiões do Brasil
    const regionSummaries = Object.entries(REGIONS).map(([regName, ufs]) => {
      const statesInReg = stateSnaps.filter(s => ufs.includes(s.uf));
      const totalSec = statesInReg.reduce((sum, s) => sum + s.secTotal, 0);
      const procSec = statesInReg.reduce((sum, s) => sum + s.secProcessed, 0);
      const validVotes = statesInReg.reduce((sum, s) => sum + s.validVotes, 0);
      const pctSec = totalSec > 0 ? ((procSec / totalSec) * 100).toFixed(2).replace(".", ",") : "0,00";

      // Votos consolidados por candidato na região
      const candMap = {};
      statesInReg.forEach(s => {
        (s.candidates || []).forEach(c => {
          if (!candMap[c.n]) {
            candMap[c.n] = { n: c.n, nm: c.nm, sg: c.sg, cor: c.cor, vap: 0 };
          }
          candMap[c.n].vap += c.vap;
        });
      });

      const candList = Object.values(candMap).sort((a, b) => b.vap - a.vap);
      candList.forEach(c => {
        c.pvap = validVotes > 0 ? ((c.vap / validVotes) * 100).toFixed(2).replace(".", ",") : "0,00";
      });

      return {
        region: regName,
        statesCount: ufs.length,
        pctSections: pctSec,
        pctSectionsNum: parseFloat(pctSec.replace(",", ".")),
        sectionsProcessed: procSec,
        totalSections: totalSec,
        validVotes,
        leader: candList[0] || null,
        runnerUp: candList[1] || null,
        ufs
      };
    });

    // Mapeamento indexado por UF para o mapa
    const statesMap = {};
    stateSnaps.forEach(s => {
      statesMap[s.uf] = s;
    });

    const result = {
      ok: true,
      refreshedAt: now,
      topTwo: topNationalLeaders.slice(0, 2),
      allLeaders: topNationalLeaders,
      regions: regionSummaries,
      states: statesMap,
      statesList: stateSnaps
    };

    if (!isFake) {
      this.cache = result;
      this.lastFetch = now;
    }

    return result;
  }
}

module.exports = GeoService;
