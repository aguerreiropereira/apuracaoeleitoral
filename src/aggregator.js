/**
 * Agregador e Orquestrador dos Dados Eleitorais 2026.
 * Suporta filtros dinâmicos de Cargo (1=Presidente, 3=Governador, 5=Senador) e UF.
 */

const TseClient = require("./tse-client");
const { getSimulationSnapshot, UF_NAMES } = require("../data/mock-data");

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

    if (forceFake) {
      const snap = await getSimulationSnapshot(cargo, uf, this.tseClient);
      this.cachedSnapshot = snap;
      return snap;
    }

    try {
      const liveSnapshot = await this.tseClient.fetchLiveSnapshot(cargo, uf);
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

      const cleanSnapshot = {
        mode: "tse",
        eleicaoId: (cargo === "1") ? "6257" : "6259",
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
}

module.exports = ElectionAggregator;
