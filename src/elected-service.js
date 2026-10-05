/**
 * Serviço de Consolidação e Consulta de Candidatos Eleitos
 * Fornece a lista e ranking de Presidente, Governadores, Senadores e Deputados eleitos
 * para eleições passadas (2022, 2018) e para a eleição corrente/simulada de 2026.
 */

const { getHistoricalDataset, HISTORICAL_2022_2T } = require("./historical-data");

class ElectedService {
  constructor(aggregator) {
    this.aggregator = aggregator;
    this.cache = new Map();
    this.cacheTtlMs = 45 * 1000; // 45s de cache para apuração rápida
  }

  async getElected(params = {}) {
    const ano = String(params.ano || "2026").trim();
    const pleitoParam = String(params.pleito || params.id || params.pleitoFed || "6257").trim();
    const pleitoFed = String(params.pleitoFed || (pleitoParam.length <= 4 && !pleitoParam.includes("_") && !pleitoParam.includes("-") ? pleitoParam : "6257")).trim();
    const pleitoEst = String(params.pleitoEst || "6259").trim();
    const filterUf = (params.uf || "").toUpperCase().trim();
    const filterCargo = String(params.cargo || "all").trim();
    const isFake = (params.mode === "fake" || params.mode === "sim");

    // 1. Eleições Históricas (2022, 2018)
    const historical = getHistoricalDataset(ano, pleitoParam) || getHistoricalDataset(ano, pleitoFed);
    if (historical && !isFake) {
      return this._formatHistoricalElected(historical, { filterUf, filterCargo });
    }

    // 2. Eleições 2026 (Oficial ou Simulação)
    return await this._build2026Elected({ ano, pleitoFed, pleitoEst, filterUf, filterCargo, isFake });
  }

  _formatHistoricalElected(hist, { filterUf, filterCargo }) {
    const presCand = hist.presidente?.candidates || [];
    const winnerPres = presCand.find(c => c.eleito) || presCand[0];
    const runnerPres = presCand.find(c => !c.eleito) || presCand[1];

    let governors = (hist.governors || []).map(g => ({
      uf: g.uf,
      office: "Governador",
      name: g.cand || g.name,
      party: g.party,
      votes: g.votes,
      pct: g.pct,
      status: g.status || "Eleito",
      cor: g.cor || "#1f4fbf"
    }));

    let senators = (hist.senators || []).map(s => ({
      uf: s.uf,
      office: "Senador",
      name: s.cand || s.name,
      party: s.party,
      votes: s.votes,
      pct: s.pct,
      status: s.status || "Eleito",
      cor: s.cor || "#0284c7"
    }));

    let deputiesFederal = (hist.topDeputiesFederal || hist.deputiesFederal || []).map(d => ({
      uf: d.uf,
      office: "Deputado Federal",
      name: d.cand || d.name,
      n: d.n,
      party: d.party,
      votes: d.votes,
      pct: d.pct,
      status: d.status || "Eleito por QP",
      cor: "#10b981"
    }));

    const totalGovernors = governors.length;
    const totalSenators = senators.length;
    const totalDeputies = deputiesFederal.length;

    if (filterUf && filterUf !== "BR" && filterUf !== "ALL") {
      governors = governors.filter(g => g.uf === filterUf);
      senators = senators.filter(s => s.uf === filterUf);
      deputiesFederal = deputiesFederal.filter(d => d.uf === filterUf);
    }

    return {
      ok: true,
      ano: hist.ano,
      turno: hist.turno,
      nomeEleicao: hist.nome,
      shortName: hist.shortName,
      dataApuracao: hist.dataApuracao,
      totalUrnasApuradas: hist.urnasApuradas,
      pctApurado: hist.pctUrnas,
      president: {
        winner: winnerPres,
        runnerUp: runnerPres,
        status: winnerPres?.eleito ? "Eleito" : (hist.turno === "2" ? "Eleito" : "2º Turno")
      },
      governors,
      senators,
      deputiesFederal,
      partyBenches: hist.partyBenches || {},
      stats: {
        totalGovernors,
        totalSenators,
        totalDeputies
      }
    };
  }

  _filterElectedPayload(payload, { filterUf, filterCargo }) {
    if (!filterUf || filterUf === "BR" || filterUf === "ALL") {
      return payload;
    }
    const ufUpper = filterUf.toUpperCase().trim();
    return {
      ...payload,
      governors: (payload.governors || []).filter(g => g.uf === ufUpper),
      senators: (payload.senators || []).filter(s => s.uf === ufUpper),
      deputiesFederal: (payload.deputiesFederal || []).filter(d => d.uf === ufUpper)
    };
  }

  async _build2026Elected({ ano, pleitoFed, pleitoEst, filterUf, filterCargo, isFake }) {
    const cacheKey = `2026_${pleitoFed}_${pleitoEst}_${isFake}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < this.cacheTtlMs)) {
      return this._filterElectedPayload(cached.data, { filterUf, filterCargo });
    }

    const ALL_UFS = [
      "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
      "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
      "RS", "RO", "RR", "SC", "SP", "SE", "TO"
    ];

    const DEP_KEY_UFS = [
      "SP", "RJ", "MG", "BA", "RS", "PR", "PE", "CE", "MS", "SC", 
      "GO", "DF", "PA", "AM", "MA", "PB", "ES", "MT", "AL", "RN"
    ];

    // Busca snapshot presidencial e estaduais em lote
    const presPromise = this.aggregator.getSnapshot({
      cargo: "1",
      uf: "br",
      ano,
      pleitoFed,
      pleitoEst,
      ...(isFake ? { mode: "fake" } : {})
    });

    const govPromises = ALL_UFS.map(uf =>
      this.aggregator.getSnapshot({
        cargo: "3",
        uf,
        ano,
        pleitoFed,
        pleitoEst,
        ...(isFake ? { mode: "fake" } : {})
      }).catch(() => null)
    );

    const senPromises = ALL_UFS.map(uf =>
      this.aggregator.getSnapshot({
        cargo: "5",
        uf,
        ano,
        pleitoFed,
        pleitoEst,
        ...(isFake ? { mode: "fake" } : {})
      }).catch(() => null)
    );

    const depPromises = DEP_KEY_UFS.map(uf =>
      this.aggregator.getSnapshot({
        cargo: "6",
        uf,
        ano,
        pleitoFed,
        pleitoEst,
        ...(isFake ? { mode: "fake" } : {})
      }).catch(() => null)
    );

    const [presSnapshot, govSnaps, senSnaps, depSnaps] = await Promise.all([
      presPromise,
      Promise.all(govPromises),
      Promise.all(senPromises),
      Promise.all(depPromises)
    ]);

    const nat = presSnapshot.national || {};
    const presCands = nat.candidates || [];
    const leaderPres = presCands[0];
    const runnerPres = presCands[1];

    const pctNum = parseFloat(String(leaderPres?.pvap || "0").replace(",", ".")) || 0;
    const secPct = parseFloat(String(nat.pctSectionsDisplay || "0").replace(",", ".")) || 0;

    let presStatus = "Em apuração";
    if (leaderPres?.eleito) {
      presStatus = "Eleito";
    } else if (secPct >= 99 && pctNum > 50) {
      presStatus = "Matematicamente Eleito";
    } else if (secPct >= 99 && pctNum <= 50) {
      presStatus = "2º Turno Confirmado";
    } else if (pctNum > 50) {
      presStatus = "Liderando (Maioria Absoluta)";
    } else {
      presStatus = "Liderando Apuração";
    }

    const governors = [];
    const senators = [];
    const deputiesFederal = [];

    // Consolida Governadores
    govSnaps.forEach((govSnap, i) => {
      const uf = ALL_UFS[i];
      if (!govSnap) return;
      const govList = govSnap.national?.candidates || [];
      if (govList.length > 0) {
        const g1 = govList[0];
        const g1Pct = parseFloat(String(g1.pvap || "0").replace(",", ".")) || 0;
        const isElected = g1.eleito || (g1Pct > 50 && parseFloat(govSnap.national?.pctSectionsDisplay || "0") >= 90);
        governors.push({
          uf,
          office: "Governador",
          name: g1.nm,
          party: g1.sg,
          votes: g1.vap,
          pct: g1.pvap,
          status: isElected ? "Eleito" : (g1.st || "Em Apuração"),
          cor: g1.cor || "#1f4fbf",
          foto: g1.foto || null
        });
      }
    });

    // Consolida Senadores (2 vagas por UF renovadas em 2026)
    senSnaps.forEach((senSnap, i) => {
      const uf = ALL_UFS[i];
      if (!senSnap) return;
      const senList = senSnap.national?.candidates || [];
      const electedSenators = senList.filter(c => c.eleito === true || c.st === "Eleito" || (c.st || "").toLowerCase().startsWith("eleito"));
      
      const toAdd = electedSenators.length > 0 ? electedSenators : senList.slice(0, 2);
      toAdd.forEach(s => {
        senators.push({
          uf,
          office: "Senador",
          name: s.nm,
          party: s.sg,
          votes: s.vap,
          pct: s.pvap,
          status: s.st || (s.eleito ? "Eleito" : "Liderando"),
          cor: s.cor || "#0284c7",
          foto: s.foto || null
        });
      });
    });

    // Consolida Deputados Federais mais votados
    depSnaps.forEach((depSnap, i) => {
      const uf = DEP_KEY_UFS[i];
      if (!depSnap) return;
      const depList = depSnap.national?.candidates || [];
      depList.slice(0, 2).forEach(c => {
        deputiesFederal.push({
          uf,
          office: "Deputado Federal",
          name: c.nm,
          n: c.n,
          party: c.sg,
          votes: c.vap,
          pct: c.pvap,
          status: c.eleito ? "Eleito por QP" : (c.st || "Mais Votado"),
          cor: c.cor || "#10b981",
          foto: c.foto || null
        });
      });
    });

    // Calcula distribuição partidária (bancadas)
    function countBenches(list) {
      const counts = {};
      list.forEach(item => {
        const party = item.party || "OUTROS";
        counts[party] = (counts[party] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([party, count]) => ({ party, count }))
        .sort((a, b) => b.count - a.count);
    }

    const partyBenches = {
      governors: countBenches(governors),
      senators: countBenches(senators),
      deputiesFederal: countBenches(deputiesFederal)
    };

    const fullPayload = {
      ok: true,
      ano,
      turno: "1",
      nomeEleicao: presSnapshot.eleicaoNome || `Eleições ${ano}`,
      shortName: `Eleições ${ano}`,
      dataApuracao: new Date().toLocaleDateString("pt-BR"),
      totalUrnasApuradas: nat.sectionsProcessed || 0,
      pctApurado: nat.pctSectionsDisplay || "0,00",
      president: {
        winner: leaderPres ? { ...leaderPres, eleito: (presStatus.includes("Eleito")) } : null,
        runnerUp: runnerPres,
        status: presStatus
      },
      governors,
      senators,
      deputiesFederal,
      partyBenches,
      stats: {
        totalGovernors: governors.length,
        totalSenators: senators.length,
        totalDeputies: deputiesFederal.length
      }
    };

    // Armazena no cache
    this.cache.set(cacheKey, { timestamp: now, data: fullPayload });

    return this._filterElectedPayload(fullPayload, { filterUf, filterCargo });
  }
}

module.exports = ElectedService;
