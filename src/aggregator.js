/**
 * Agregador e Orquestrador dos Dados Eleitorais 2026.
 * Suporta filtros dinâmicos de Cargo (1=Presidente, 3=Governador, 5=Senador) e UF.
 */

const TseClient = require("./tse-client");
const { getSimulationSnapshot, UF_NAMES } = require("../data/mock-data");
const { getHistoricalDataset } = require("./historical-data");

class ElectionAggregator {
  constructor(options = {}) {
    this.tseClient = new TseClient(options);
    this.cachedSnapshot = null;
    this.sseClients = new Set();
    this.pollIntervalMs = 15000;
    this.timer = null;
  }

  startBackgroundPoller() {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        const snap = await this.getSnapshot();
        this.broadcastSSE(snap);
      } catch (err) {
        console.error("[Poller Error]:", err.message);
      }
    }, this.pollIntervalMs);
  }

  stopBackgroundPoller() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  addSseClient(res, query = {}) {
    const client = { res, query };
    this.sseClients.add(client);
    res.on("close", () => {
      this.sseClients.delete(client);
    });

    this.getSnapshot(query).then(snap => {
      res.write(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`);
    }).catch(err => {
      console.error("[SSE Send Error]:", err);
    });
  }

  broadcastSSE(defaultSnapshot) {
    for (const client of this.sseClients) {
      try {
        this.getSnapshot(client.query).then(snap => {
          client.res.write(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`);
        }).catch(() => {});
      } catch (e) {
        this.sseClients.delete(client);
      }
    }
  }

  async getSnapshot(params = {}) {
    const forceFake = params.mode === "fake" || params.fake === "true";
    const cargo = params.cargo || "1";
    let uf = (params.uf || "").toLowerCase();
    
    // Cargos estaduais e proporcionais exigem uma UF estadual (padrão 'ms' se vier 'br' ou vazio)
    if (cargo !== "1" && (!uf || uf === "br")) {
      uf = "ms";
    }

    const ano = params.ano || "2026";
    const pleitoFed = params.pleitoFed || params.pleito || "6257";
    const historical = getHistoricalDataset(ano, pleitoFed);

    if (historical && !forceFake) {
      const histSnap = this._buildHistoricalSnapshot(historical, cargo, uf, params);
      this.cachedSnapshot = histSnap;
      return histSnap;
    }

    if (forceFake) {
      const snap = await getSimulationSnapshot(cargo, uf, this.tseClient);
      this.cachedSnapshot = snap;
      return snap;
    }

    try {
      const liveSnapshot = await this.tseClient.fetchLiveSnapshot(cargo, uf, params);
      this.cachedSnapshot = liveSnapshot;
      return liveSnapshot;
    } catch (err) {
      console.log(`[Aviso TSE]: ${err.message}. Retornando estado oficial.`);
      const ufUpper = (uf || "MS").toUpperCase();
      let officeName = "Candidato";
      switch(String(cargo)) {
        case "1": officeName = "Presidente"; break;
        case "3": officeName = "Governador"; break;
        case "5": officeName = "Senador"; break;
        case "6": officeName = "Deputado Federal"; break;
        case "7": officeName = (ufUpper === "DF") ? "Deputado Distrital" : "Deputado Estadual"; break;
        case "8": officeName = "Deputado Distrital"; break;
      }
      const ufName = UF_NAMES[ufUpper] || (ufUpper === "BR" ? "Brasil" : ufUpper);
      const now = Date.now();
      const ano = params.ano || "2026";
      const eleicaoId = (cargo === "1") ? (params.pleitoFed || params.pleito || "6257") : (params.pleitoEst || "6259");

      const cleanSnapshot = {
        mode: "tse",
        ano: ano,
        eleicaoId: eleicaoId,
        pleitoFed: params.pleitoFed || params.pleito || "6257",
        pleitoEst: params.pleitoEst || "6259",
        eleicaoNome: `Eleição ${ano} - ${officeName} (${ufName}) [Pleito ${eleicaoId}]`,
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
        source: {
          ok: false,
          error: err.message,
          lastSuccessAt: 0
        }
      };
      this.cachedSnapshot = cleanSnapshot;
      return cleanSnapshot;
    }
  }

  _buildHistoricalSnapshot(hist, cargo, uf, params) {
    const ufUpper = (uf || "BR").toUpperCase();
    const ufName = UF_NAMES[ufUpper] || (ufUpper === "BR" ? "Brasil" : ufUpper);
    const now = Date.now();
    let officeName = "Presidente";
    let candidates = [];
    let validVotes = hist.votosValidos || 118552353;
    let totalVotes = validVotes + (hist.votosBrancos || 0) + (hist.votosNulos || 0);

    if (String(cargo) === "1") {
      officeName = "Presidente da República";
      if (ufUpper === "BR") {
        candidates = hist.presidente?.candidates || [];
      } else {
        const stateVote = hist.presidente?.statesVoting?.[ufUpper];
        if (stateVote) {
          validVotes = stateVote.total;
          totalVotes = stateVote.total;
          const origCands = hist.presidente?.candidates || [];
          candidates = origCands.map(c => {
            if (c.n === stateVote.leader) {
              return { ...c, vap: stateVote.votesLeader, pvap: stateVote.pctLeader, eleito: (parseFloat(stateVote.pctLeader) > 50) };
            } else if (c.n === stateVote.runner) {
              return { ...c, vap: stateVote.votesRunner, pvap: stateVote.pctRunner, eleito: false };
            }
            return { ...c, vap: 0, pvap: "0,00", eleito: false };
          }).sort((a, b) => (parseFloat(b.pvap) || 0) - (parseFloat(a.pvap) || 0));
        } else {
          candidates = hist.presidente?.candidates || [];
        }
      }
    } else if (String(cargo) === "3") {
      officeName = "Governador";
      const gov = (hist.governors || []).find(g => g.uf === ufUpper);
      if (gov) {
        validVotes = gov.votes;
        totalVotes = gov.votes;
        candidates = [
          {
            n: "10",
            sqcand: "gov_" + ufUpper,
            nm: gov.cand.toUpperCase(),
            nmCompleto: gov.cand,
            sg: gov.party,
            vap: gov.votes,
            pvap: gov.pct,
            eleito: true,
            st: gov.status || "Eleito",
            cor: gov.cor || "#1f4fbf"
          }
        ];
      }
    } else if (String(cargo) === "5") {
      officeName = "Senador";
      const sen = (hist.senators || []).find(s => s.uf === ufUpper);
      if (sen) {
        validVotes = sen.votes;
        totalVotes = sen.votes;
        candidates = [
          {
            n: "100",
            sqcand: "sen_" + ufUpper,
            nm: sen.cand.toUpperCase(),
            nmCompleto: sen.cand,
            sg: sen.party,
            vap: sen.votes,
            pvap: sen.pct,
            eleito: true,
            st: sen.status || "Eleito",
            cor: sen.cor || "#0284c7"
          }
        ];
      }
    } else if (String(cargo) === "6") {
      officeName = "Deputado Federal";
      const deps = (hist.topDeputiesFederal || []).filter(d => d.uf === ufUpper);
      if (deps.length > 0) {
        candidates = deps.map(d => ({
          n: d.n || "1000",
          sqcand: "dep_" + d.cand,
          nm: d.cand.toUpperCase(),
          nmCompleto: d.cand,
          sg: d.party,
          vap: d.votes,
          pvap: d.pct,
          eleito: true,
          st: d.status || "Eleito por QP",
          cor: "#10b981"
        }));
      }
    }

    return {
      mode: "historical",
      ano: hist.ano,
      eleicaoId: hist.eleicaoId,
      pleitoFed: hist.pleitoFed,
      pleitoEst: hist.pleitoEst,
      eleicaoNome: `${hist.nome} - ${officeName} (${ufName})`,
      serverNow: now,
      refreshedAt: now,
      nextRefreshAt: now + 60000,
      intervalSec: 60,
      office: officeName,
      officeCode: cargo,
      uf: ufUpper,
      ufName: ufName,
      hasStarted: true,
      national: {
        totalSections: hist.totalUrnas || 472075,
        sectionsProcessed: hist.urnasApuradas || 472075,
        pctSections: 100,
        pctSectionsDisplay: hist.pctUrnas || "100,00",
        totalVotes: totalVotes,
        validVotes: validVotes,
        blankVotes: hist.votosBrancos || 0,
        nullVotes: hist.votosNulos || 0,
        abstencoes: hist.abstencoes || 0,
        electorate: totalVotes + (hist.abstencoes || 0),
        candidates: candidates
      },
      states: {},
      collection: {
        state: "final",
        title: "Apuração Concluída (100% Apurado)",
        detail: `Resultado oficial e definitivo homologado pelo Tribunal Superior Eleitoral.`,
        lastCompleteAt: now
      },
      source: {
        ok: true,
        historical: true,
        lastSuccessAt: now
      }
    };
  }
}

module.exports = ElectionAggregator;
