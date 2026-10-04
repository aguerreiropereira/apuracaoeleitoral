/**
 * Aplicação Frontend do Painel de Apuração Eleitoral Brasil
 * Suporta alternância dinâmica de Abrangência (Brasil e 27 UFs) e Cargo (Presidente, Governador, Senador).
 */

document.addEventListener("DOMContentLoaded", () => {
  // Estado da aplicação
  let currentSnapshot = null;
  let selectedUf = ""; // "" = Brasil
  let selectedCargo = "1"; // 1 = Presidente, 3 = Governador, 5 = Senador
  let nextRefreshTime = Date.now() + 20000;
  let eventSource = null;
  let pollingTimer = null;

  // Parâmetros de URL
  const urlParams = new URLSearchParams(window.location.search);
  let isFakeMode = urlParams.get("mode") === "fake";
  if (urlParams.get("uf")) selectedUf = urlParams.get("uf").toUpperCase();
  if (urlParams.get("cargo")) selectedCargo = urlParams.get("cargo");

  // Elementos do DOM
  const svgMap = document.getElementById("brazilMap");
  const tooltip = document.getElementById("mapTooltip");
  const ufSelect = document.getElementById("ufSelect");
  const btnResetMap = document.getElementById("btnResetMap");
  const cargoTabs = document.getElementById("cargoTabs");
  const modeBadge = document.getElementById("modeBadge");
  const btnToggleMode = document.getElementById("btnToggleMode");
  const btnToggleTheme = document.getElementById("btnToggleTheme");
  const themeIconSun = document.getElementById("themeIconSun");
  const themeIconMoon = document.getElementById("themeIconMoon");
  const themeBtnText = document.getElementById("themeBtnText");
  const mapLegend = document.getElementById("mapLegend");
  const electionHeading = document.getElementById("electionHeading");
  const preApurationBanner = document.getElementById("preApurationBanner");
  const preApurationDesc = document.getElementById("preApurationDesc");
  const statusIndicator = document.querySelector(".status-indicator");
  
  // Resumo
  const apurationStatusText = document.getElementById("apurationStatusText");
  const currentViewScope = document.getElementById("currentViewScope");
  const lastUpdateText = document.getElementById("lastUpdateText");
  const totalSecPct = document.getElementById("totalSecPct");
  const totalSecBar = document.getElementById("totalSecBar");
  const sectionsCountDisplay = document.getElementById("sectionsCountDisplay");
  const metricValid = document.getElementById("metricValid");
  const metricValidPct = document.getElementById("metricValidPct");
  const metricBlank = document.getElementById("metricBlank");
  const metricBlankPct = document.getElementById("metricBlankPct");
  const metricNull = document.getElementById("metricNull");
  const metricNullPct = document.getElementById("metricNullPct");
  const metricAbst = document.getElementById("metricAbst");
  const metricAbstPct = document.getElementById("metricAbstPct");

  // Candidatos
  const resultsTitle = document.getElementById("resultsTitle");
  const resultsSubtitle = document.getElementById("resultsSubtitle");
  const candidatesContainer = document.getElementById("candidatesContainer");
  const countdownTimer = document.getElementById("countdownTimer");
  const syncStatusText = document.getElementById("syncStatusText");

  // Gestão de Tema Claro / Escuro (Padrão: Claro com Fundo Branco)
  let currentTheme = localStorage.getItem("painel_eleitoral_theme") || "light";

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("painel_eleitoral_theme", theme);

    if (theme === "light") {
      if (themeIconSun) themeIconSun.style.display = "none";
      if (themeIconMoon) themeIconMoon.style.display = "inline-block";
      if (themeBtnText) themeBtnText.textContent = "Fundo Escuro";
    } else {
      if (themeIconSun) themeIconSun.style.display = "inline-block";
      if (themeIconMoon) themeIconMoon.style.display = "none";
      if (themeBtnText) themeBtnText.textContent = "Fundo Claro";
    }

    updateMapThemeColors();
  }

  if (btnToggleTheme) {
    btnToggleTheme.addEventListener("click", () => {
      const nextTheme = (currentTheme === "light") ? "dark" : "light";
      applyTheme(nextTheme);
    });
  }

  // Aplica tema inicial
  applyTheme(currentTheme);

  // Sincroniza estado inicial dos selects
  if (selectedUf) ufSelect.value = selectedUf;
  cargoTabs.querySelectorAll(".cargo-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.cargo === selectedCargo);
  });

  function setupModeUI() {
    if (isFakeMode) {
      modeBadge.textContent = "Modo Simulação 2026";
      modeBadge.className = "badge-pill sim";
      btnToggleMode.textContent = "Mudar para Oficial TSE";
    } else {
      modeBadge.textContent = "Oficial TSE (Pleito 6257/6259)";
      modeBadge.className = "badge-pill";
      btnToggleMode.textContent = "Ver Simulação";
    }
  }
  setupModeUI();

  btnToggleMode.addEventListener("click", () => {
    isFakeMode = !isFakeMode;
    const url = new URL(window.location);
    if (isFakeMode) {
      url.searchParams.set("mode", "fake");
    } else {
      url.searchParams.delete("mode");
    }
    window.location.href = url.toString();
  });

  function updateMapThemeColors() {
    if (!svgMap) return;
    const isLight = (currentTheme === "light");
    const defaultFill = isLight ? "#cbd5e1" : "#0d2636";

    document.querySelectorAll(".uf").forEach(path => {
      const uf = path.dataset?.uf;
      const ufData = currentSnapshot?.states?.[uf];
      if (ufData && ufData.pctSections >= 0.01 && ufData.leader?.color) {
        path.style.fill = ufData.leader.color;
      } else {
        path.style.fill = defaultFill;
      }
    });
  }

  // 1. Inicialização do Mapa SVG
  function initSvgMap() {
    const mapData = (typeof MAP !== 'undefined') ? MAP : (typeof window !== 'undefined' ? window.MAP : null);
    
    if (!mapData || !mapData.s) {
      console.error("[Erro]: Dados do mapa não encontrados.");
      return;
    }

    const NS = "http://www.w3.org/2000/svg";
    const states = mapData.s;
    const smallUfs = new Set(["DF", "SE", "AL", "PB", "RN", "ES", "RJ"]);

    svgMap.innerHTML = "";

    const isLight = (currentTheme === "light");
    const initialFill = isLight ? "#cbd5e1" : "#0d2636";

    Object.keys(states).forEach(uf => {
      const stateObj = states[uf];

      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", stateObj.d);
      path.setAttribute("class", "uf");
      path.setAttribute("id", `uf-${uf}`);
      path.dataset.uf = uf;
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
      path.setAttribute("aria-label", `${stateObj.n} (${uf})`);
      path.style.fill = initialFill;

      path.addEventListener("click", () => {
        if (selectedUf === uf) {
          // Se for presidente, permite voltar para Brasil; se for governador/senador, mantém o estado
          if (selectedCargo === "1") {
            selectedUf = "";
          }
        } else {
          selectedUf = uf;
        }
        ufSelect.value = selectedUf;
        syncMapSelection();
        startRealtimeConnection();
      });

      svgMap.appendChild(path);

      if (!smallUfs.has(uf) && stateObj.c) {
        const text = document.createElementNS(NS, "text");
        text.setAttribute("x", stateObj.c[0]);
        text.setAttribute("y", stateObj.c[1]);
        text.setAttribute("class", "uf-label");
        text.textContent = uf;
        svgMap.appendChild(text);
      }
    });

    svgMap.addEventListener("pointermove", handleMapMouseMove);
    svgMap.addEventListener("pointerleave", () => {
      tooltip.hidden = true;
    });

    syncMapSelection();
  }

  function handleMapMouseMove(e) {
    const uf = e.target.dataset?.uf;
    if (!uf || !currentSnapshot) {
      tooltip.hidden = true;
      return;
    }

    const mapData = (typeof MAP !== 'undefined') ? MAP : window.MAP;
    const stateMeta = mapData?.s?.[uf] || { n: uf };
    const ufData = currentSnapshot.states?.[uf];
    const mapRect = svgMap.getBoundingClientRect();

    let html = `<h4>${stateMeta.n} (${uf})</h4>`;
    if (ufData && ufData.pctSections > 0 && ufData.leader) {
      html += `
        <div class="row"><span>Seções Totalizadas:</span><span class="val">${ufData.pctSectionsDisplay || "0,00"}%</span></div>
      `;
      html += `
        <div class="row" style="margin-top:4px;">
          <span>Líder:</span>
          <span class="val" style="color:${ufData.leader.color || '#fff'}">${ufData.leader.name} (${ufData.leader.party})</span>
        </div>
        <div class="row">
          <span>Votação:</span>
          <span class="val">${Number(ufData.leader.votes).toLocaleString("pt-BR")} (${ufData.leader.pct}%)</span>
        </div>
      `;
      if (ufData.runnerUp) {
        html += `
          <div class="row" style="opacity:0.85; margin-top:2px;">
            <span>2º colocado:</span>
            <span class="val">${ufData.runnerUp.name} (${ufData.runnerUp.pct}%)</span>
          </div>
        `;
      }
    } else {
      html += `
        <div class="row" style="color:#94a3b8; font-size:12px;"><span>Aguardando início da apuração (17h).</span></div>
        <div class="row" style="color:#60a5fa; font-size:11px; margin-top:6px;"><span>Clique para filtrar este estado.</span></div>
      `;
    }

    tooltip.innerHTML = html;
    tooltip.hidden = false;

    const x = e.clientX - mapRect.left + 15;
    const y = e.clientY - mapRect.top + 15;
    tooltip.style.left = `${Math.min(x, mapRect.width - 240)}px`;
    tooltip.style.top = `${Math.max(10, y)}px`;
  }

  function syncMapSelection() {
    document.querySelectorAll(".uf").forEach(p => {
      if (selectedUf && p.dataset.uf === selectedUf) {
        p.classList.add("selected");
      } else {
        p.classList.remove("selected");
      }
    });

    if (btnResetMap) {
      btnResetMap.hidden = (!selectedUf || selectedCargo !== "1");
    }
  }

  // Mudança no Dropdown de UF
  ufSelect.addEventListener("change", (e) => {
    let val = e.target.value;
    // Se for Governador ou Senador e tentar selecionar 'Brasil', força para SP
    if ((selectedCargo === "3" || selectedCargo === "5") && !val) {
      val = "SP";
      ufSelect.value = "SP";
    }
    selectedUf = val;
    syncMapSelection();
    startRealtimeConnection();
  });

  if (btnResetMap) {
    btnResetMap.addEventListener("click", () => {
      selectedUf = "";
      ufSelect.value = "";
      syncMapSelection();
      startRealtimeConnection();
    });
  }

  // Alternância de Cargo (Presidente, Governador, Senador)
  cargoTabs.querySelectorAll(".cargo-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      cargoTabs.querySelectorAll(".cargo-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      selectedCargo = tab.dataset.cargo;

      // Governador, Senador e Deputados exigem um estado específico
      if (selectedCargo !== "1" && (!selectedUf || selectedUf === "BR")) {
        selectedUf = "MS";
        ufSelect.value = "MS";
      }

      syncMapSelection();
      startRealtimeConnection();
    });
  });

  // 2. Atualização dos Dados e Renderização
  function onSnapshotReceived(snapshot) {
    currentSnapshot = snapshot;
    nextRefreshTime = snapshot.nextRefreshAt || (Date.now() + 20000);

    // Colorir estados do mapa
    const isLight = (currentTheme === "light");
    const defaultFill = isLight ? "#cbd5e1" : "#0d2636";

    if (snapshot.states && Object.keys(snapshot.states).length > 0) {
      Object.keys(snapshot.states).forEach(uf => {
        const ufData = snapshot.states[uf];
        const path = document.getElementById(`uf-${uf}`);
        if (!path) return;

        if (!ufData.leader || ufData.pctSections < 0.01) {
          path.style.fill = defaultFill;
        } else {
          path.style.fill = ufData.leader.color || "#1f4fbf";
        }
      });
    }

    renderDashboard();
  }

  function renderDashboard() {
    if (!currentSnapshot) return;

    const office = currentSnapshot.office || (selectedCargo === "1" ? "Presidente" : (selectedCargo === "3" ? "Governador" : "Senador"));
    const locationName = currentSnapshot.ufName || (selectedUf ? `Estado de ${selectedUf}` : "Brasil (Total Nacional)");
    const scopeData = currentSnapshot.national;

    const now = new Date(currentSnapshot.refreshedAt || Date.now());
    lastUpdateText.textContent = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    currentViewScope.textContent = `· ${locationName}`;
    resultsTitle.textContent = `Candidatos a ${office}`;
    resultsSubtitle.textContent = `${office} · ${locationName}`;

    // Atualiza cabeçalho oficial
    if (electionHeading) {
      if (selectedCargo === "1") {
        electionHeading.textContent = `Eleição Geral Federal 2026 - Presidente (Pleito 6257)`;
      } else {
        electionHeading.textContent = `Eleição Geral Estadual 2026 - ${office} · ${locationName} (Pleito 6259)`;
      }
    }

    const pctStr = scopeData?.pctSectionsDisplay || "0,00";
    totalSecPct.textContent = `${pctStr}%`;
    
    const pctNum = parseFloat(pctStr.replace(",", ".")) || 0;
    totalSecBar.style.width = `${Math.min(100, Math.max(0, pctNum))}%`;

    const totalSec = scopeData?.totalSections || 499248;
    const procSec = scopeData?.sectionsProcessed || Math.round(totalSec * (pctNum / 100));
    sectionsCountDisplay.textContent = `${Number(procSec).toLocaleString("pt-BR")} de ${Number(totalSec).toLocaleString("pt-BR")} seções`;

    // Status da Apuração e Banner Informativo
    const isWaiting = (currentSnapshot.hasStarted === false) || (pctNum === 0);

    if (preApurationBanner) {
      if (isWaiting && !isFakeMode) {
        preApurationBanner.style.display = "flex";
        if (preApurationDesc) {
          preApurationDesc.textContent = `Exibindo a lista oficial de candidaturas registradas no TSE para ${office} em ${locationName}. Os votos oficiais começarão a ser totalizados a partir das 17h (Horário de Brasília).`;
        }
      } else {
        preApurationBanner.style.display = "none";
      }
    }

    if (statusIndicator) {
      statusIndicator.classList.toggle("waiting", isWaiting);
    }

    if (isWaiting) {
      apurationStatusText.textContent = "Aguardando 17h (Horário de Brasília)";
    } else if (pctNum >= 99.9) {
      apurationStatusText.textContent = "Apuração Totalizada";
    } else if (pctNum > 0) {
      apurationStatusText.textContent = "Apuração em Andamento";
    } else {
      apurationStatusText.textContent = "Aguardando Transmissão dos Boletins de Urna";
    }

    // Legenda do Mapa
    if (mapLegend) {
      if (isWaiting) {
        mapLegend.innerHTML = `
          <span class="legend-item"><i style="background: var(--map-path-fill); border: 1px solid var(--surface-border)"></i> Aguardando 17h (Sem apuração)</span>
          ${selectedUf ? `<span class="legend-item"><i style="background: var(--pct-color)"></i> Seleção ativa: ${locationName}</span>` : ""}
        `;
      } else if (currentSnapshot.states && Object.keys(currentSnapshot.states).length > 0) {
        const topParties = new Map();
        Object.values(currentSnapshot.states).forEach(st => {
          if (st.leader?.party) {
            topParties.set(st.leader.party, st.leader.color || "#3b82f6");
          }
        });
        if (topParties.size > 0) {
          mapLegend.innerHTML = Array.from(topParties.entries()).map(([party, color]) => `
            <span class="legend-item"><i style="background: ${color}"></i> ${party}</span>
          `).join("") + '<span class="legend-item"><i style="background: var(--map-path-fill); border: 1px solid var(--surface-border)"></i> Outros / Sem dados</span>';
        }
      }
    }

    const totalVotes = scopeData?.totalVotes || 1;
    const valVotes = scopeData?.validVotes || 0;
    const blankVotes = scopeData?.blankVotes || 0;
    const nullVotes = scopeData?.nullVotes || 0;
    const abstVotes = scopeData?.abstencoes || 0;

    metricValid.textContent = Number(valVotes).toLocaleString("pt-BR");
    metricValidPct.textContent = totalVotes > 1 ? `${((valVotes / totalVotes) * 100).toFixed(2).replace(".", ",")}%` : "0,00%";

    metricBlank.textContent = Number(blankVotes).toLocaleString("pt-BR");
    metricBlankPct.textContent = totalVotes > 1 ? `${((blankVotes / totalVotes) * 100).toFixed(2).replace(".", ",")}%` : "0,00%";

    metricNull.textContent = Number(nullVotes).toLocaleString("pt-BR");
    metricNullPct.textContent = totalVotes > 1 ? `${((nullVotes / totalVotes) * 100).toFixed(2).replace(".", ",")}%` : "0,00%";

    metricAbst.textContent = Number(abstVotes).toLocaleString("pt-BR");
    metricAbstPct.textContent = totalVotes > 1 ? `${((abstVotes / (totalVotes + abstVotes)) * 100).toFixed(2).replace(".", ",")}%` : "0,00%";

    const candidates = scopeData?.candidates || [];
    renderCandidateCards(candidates);
  }

  function renderCandidateCards(candidates) {
    if (!candidates || candidates.length === 0) {
      candidatesContainer.innerHTML = `
        <div class="loading-state">
          <span>Nenhum candidato localizado para este cargo na região selecionada.</span>
        </div>
      `;
      return;
    }

    const maxVotes = Math.max(1, ...candidates.map(c => parseInt(String(c.vap).replace(/\D/g, "") || "0", 10)));

    candidatesContainer.innerHTML = candidates.map((cand, idx) => {
      const votesNominal = parseInt(String(cand.vap).replace(/\D/g, "") || "0", 10);
      const barWidth = maxVotes > 1 ? ((votesNominal / maxVotes) * 100).toFixed(1) : "0";
      const candColor = cand.cor || "#38bdf8";

      let badgeHtml = "";
      if (cand.st === "Eleito" || cand.eleito) {
        badgeHtml = `<span class="cand-badge-status eleito">Eleito</span>`;
      } else if (cand.st === "2º Turno") {
        badgeHtml = `<span class="cand-badge-status turno2">2º Turno</span>`;
      } else if (cand.st === "Em apuração" && votesNominal > 0) {
        badgeHtml = `<span class="cand-badge-status apuracao">Em apuração</span>`;
      } else {
        badgeHtml = `<span class="cand-badge-status aguardando">Aguardando 17h</span>`;
      }

      const avatarHtml = cand.foto
        ? `<img src="${cand.foto}" alt="${cand.nm}" class="cand-avatar-img" onerror="this.remove();"><span>${cand.n}</span>`
        : `<span>${cand.n || (idx + 1)}</span>`;

      const viceRow = cand.vice ? `<div class="cand-vice">${cand.vice}</div>` : "";

      return `
        <div class="candidate-card clickable" style="--cand-color: ${candColor}" data-sqcand="${cand.sqcand || ''}" data-n="${cand.n}" title="Clique para ver o desempenho detalhado por estados e cidades">
          <div class="cand-avatar-wrap">
            ${avatarHtml}
          </div>

          <div class="cand-meta">
            <div class="cand-name-row">
              <span class="cand-name">${cand.nm}</span>
              ${badgeHtml}
            </div>
            <div class="cand-party-row">
              <strong>${cand.n}</strong> · ${cand.sg || ""} ${cand.cc ? "· " + cand.cc : ""}
            </div>
            ${viceRow}
            <div class="cand-action-hint">Ver desempenho por regiões <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle;">arrow_forward</span></div>
          </div>

          <div class="cand-votes-box">
            <div class="cand-pct">${cand.pvap}%</div>
            <div class="cand-total-votes">${votesNominal.toLocaleString("pt-BR")} votos</div>
          </div>

          <div class="cand-progress-bar">
            <div class="cand-progress-fill" style="width: ${barWidth}%"></div>
          </div>
        </div>
      `;
    }).join("");

    // Adiciona listener de clique para cada card de candidato
    candidatesContainer.querySelectorAll(".candidate-card").forEach(card => {
      card.addEventListener("click", () => {
        const sqcand = card.dataset.sqcand;
        const n = card.dataset.n;
        openCandidateModal(sqcand, n);
      });
    });
  }

  // ========================================================
  // 2b. Modal de Desempenho Detalhado do Candidato
  // ========================================================
  const candidateModal = document.getElementById("candidateModal");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const modalLoading = document.getElementById("modalLoading");
  const modalContent = document.getElementById("modalContent");
  const modalCandFoto = document.getElementById("modalCandFoto");
  const modalCandNumero = document.getElementById("modalCandNumero");
  const modalCandName = document.getElementById("modalCandName");
  const modalCandBadge = document.getElementById("modalCandBadge");
  const modalCandParty = document.getElementById("modalCandParty");
  const modalCandColig = document.getElementById("modalCandColig");
  const modalCandVice = document.getElementById("modalCandVice");
  const modalCandViceRow = document.getElementById("modalCandViceRow");
  const modalScopeTag = document.getElementById("modalScopeTag");
  const modalCandPct = document.getElementById("modalCandPct");
  const modalCandVotes = document.getElementById("modalCandVotes");
  const modalBestRegion = document.getElementById("modalBestRegion");
  const modalCapitalCard = document.getElementById("modalCapitalCard");
  const modalCapitalVotes = document.getElementById("modalCapitalVotes");
  const modalRatioCard = document.getElementById("modalRatioCard");
  const modalCapitalBar = document.getElementById("modalCapitalBar");
  const modalInteriorBar = document.getElementById("modalInteriorBar");
  const modalRatioLabels = document.getElementById("modalRatioLabels");
  const modalSearchInput = document.getElementById("modalSearchInput");
  const modalSortTabs = document.getElementById("modalSortTabs");
  const modalTableHead = document.getElementById("modalTableHead");
  const modalTableBody = document.getElementById("modalTableBody");

  let currentModalData = null;
  let currentSortMode = "pct";
  let currentFilterText = "";

  function openCandidateModal(sqcand, n) {
    if (!candidateModal) return;

    candidateModal.style.display = "flex";
    modalLoading.style.display = "flex";
    modalContent.style.display = "none";
    if (modalSearchInput) modalSearchInput.value = "";
    currentFilterText = "";

    const query = `cargo=${selectedCargo}&uf=${selectedUf || "br"}&sqcand=${sqcand || ""}&n=${n || ""}${isFakeMode ? "&mode=fake" : ""}`;
    fetch(`/api/candidate-performance?${query}`)
      .then(res => res.json())
      .then(data => {
        if (!data.ok) throw new Error(data.error || "Erro ao consultar desempenho");
        currentModalData = data;
        renderModalData(data);
      })
      .catch(err => {
        modalLoading.innerHTML = `
          <div style="color:#ef4444; font-weight:700;">Falha ao carregar desempenho do candidato.</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${err.message}</div>
        `;
      });
  }

  function closeModal() {
    if (candidateModal) candidateModal.style.display = "none";
  }

  if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
  if (candidateModal) {
    candidateModal.addEventListener("click", (e) => {
      if (e.target === candidateModal) closeModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && candidateModal && candidateModal.style.display !== "none") {
      closeModal();
    }
  });

  function renderModalData(data) {
    const cand = data.candidate;
    const isPresident = data.scope === "national";

    if (cand.foto) {
      modalCandFoto.src = cand.foto;
      modalCandFoto.style.display = "block";
      modalCandNumero.style.display = "none";
    } else {
      modalCandFoto.style.display = "none";
      modalCandNumero.textContent = cand.n;
      modalCandNumero.style.display = "block";
    }

    modalCandName.textContent = cand.nm;
    modalCandBadge.textContent = cand.st;
    modalCandBadge.className = "cand-badge-status " + (cand.eleito ? "eleito" : (cand.st === "2º Turno" ? "turno2" : (cand.vap > 0 ? "apuracao" : "aguardando")));
    modalCandParty.textContent = `${cand.n} · ${cand.sg}`;
    modalCandColig.textContent = cand.cc || cand.sg;

    if (cand.vice) {
      modalCandVice.textContent = cand.vice;
      modalCandViceRow.style.display = "block";
    } else {
      modalCandViceRow.style.display = "none";
    }

    modalScopeTag.textContent = `${data.cargoNome} · ${data.scopeNome}`;
    modalCandPct.textContent = `${cand.pvap}%`;
    modalCandVotes.textContent = `${Number(cand.vap).toLocaleString("pt-BR")} votos válidos`;

    if (isPresident) {
      modalBestRegion.textContent = data.summary.bestState || "-";
      modalCapitalCard.querySelector(".m-label").textContent = "Estados que Lidera";
      modalCapitalVotes.textContent = `${data.summary.leadingStatesCount} de 27 estados`;
    } else {
      modalBestRegion.textContent = data.summary.bestCity || "-";
      modalCapitalCard.querySelector(".m-label").textContent = "Votação na Capital";
      modalCapitalVotes.textContent = data.summary.capitalResult || "-";
    }

    if (data.summary.capitalVsInterior) {
      modalRatioCard.style.display = "flex";
      const capPct = parseFloat(data.summary.capitalVsInterior.capitalPct) || 50;
      const intPct = 100 - capPct;
      modalCapitalBar.style.width = `${capPct}%`;
      modalInteriorBar.style.width = `${intPct}%`;
      modalRatioLabels.textContent = `Capital: ${data.summary.capitalVsInterior.capitalPct} (${Number(data.summary.capitalVsInterior.capitalVotes).toLocaleString("pt-BR")}) · Interior: ${data.summary.capitalVsInterior.interiorPct} (${Number(data.summary.capitalVsInterior.interiorVotes).toLocaleString("pt-BR")})`;
    } else {
      modalRatioCard.style.display = "none";
    }

    modalLoading.style.display = "none";
    modalContent.style.display = "flex";

    renderModalTable();
  }

  function renderModalTable() {
    if (!currentModalData) return;
    const isPresident = currentModalData.scope === "national";
    let items = [...currentModalData.items];

    if (currentFilterText.trim()) {
      const q = currentFilterText.toLowerCase();
      items = items.filter(it => {
        const text = (it.stateName || it.name || "") + " " + (it.uf || "") + " " + (it.capitalName || "");
        return text.toLowerCase().includes(q);
      });
    }

    if (currentSortMode === "pct") {
      items.sort((a, b) => b.pctNum - a.pctNum);
    } else if (currentSortMode === "votes") {
      items.sort((a, b) => b.votes - a.votes);
    } else if (currentSortMode === "alpha") {
      items.sort((a, b) => (a.stateName || a.name || "").localeCompare(b.stateName || b.name || ""));
    }

    if (isPresident) {
      modalTableHead.innerHTML = `
        <tr>
          <th>Estado (UF)</th>
          <th style="text-align: right;">Votos no Estado</th>
          <th style="text-align: right;">% Válidos</th>
          <th style="text-align: center;">Posição</th>
          <th>Capital do Estado</th>
          <th style="text-align: right;">Votos na Capital</th>
          <th style="text-align: right;">% na Capital</th>
        </tr>
      `;
      modalTableBody.innerHTML = items.map(item => {
        const rankBadge = item.rank === 1 ? `<span class="rank-badge rank-1">1º</span>` : (item.rank === 2 ? `<span class="rank-badge rank-2">2º</span>` : `<span>${item.rank}</span>`);
        return `
          <tr>
            <td><strong>${item.stateName}</strong> <span style="color:var(--text-dim)">(${item.uf})</span></td>
            <td style="text-align: right;">${Number(item.votes).toLocaleString("pt-BR")}</td>
            <td style="text-align: right; font-weight: 700; color: var(--pct-color);">${item.pct}%</td>
            <td style="text-align: center;">${rankBadge}</td>
            <td>${item.capitalName}</td>
            <td style="text-align: right;">${Number(item.capitalVotes).toLocaleString("pt-BR")}</td>
            <td style="text-align: right; font-weight: 700;">${item.capitalPct}%</td>
          </tr>
        `;
      }).join("");
    } else {
      modalTableHead.innerHTML = `
        <tr>
          <th>Cidade / Município</th>
          <th>Classificação</th>
          <th style="text-align: right;">Eleitorado Estimado</th>
          <th style="text-align: right;">Votos Obtidos</th>
          <th style="text-align: right;">% Válidos</th>
          <th style="text-align: center;">Posição</th>
        </tr>
      `;
      modalTableBody.innerHTML = items.map(item => {
        const rankBadge = item.rank === 1 ? `<span class="rank-badge rank-1">1º</span>` : (item.rank === 2 ? `<span class="rank-badge rank-2">2º</span>` : `<span>${item.rank}</span>`);
        const badgeCap = item.isCapital ? `<span class="cand-badge-status" style="background:rgba(0,151,57,0.15); color:var(--pct-color); border:1px solid rgba(0,151,57,0.3); font-size:9px;">Capital</span>` : `<span style="font-size:11px; color:var(--text-dim)">Interior</span>`;
        return `
          <tr>
            <td><strong>${item.name}</strong></td>
            <td>${badgeCap}</td>
            <td style="text-align: right; color: var(--text-dim);">${Number(item.electorate).toLocaleString("pt-BR")}</td>
            <td style="text-align: right; font-weight: 700;">${Number(item.votes).toLocaleString("pt-BR")}</td>
            <td style="text-align: right; font-weight: 800; color: var(--pct-color);">${item.pct}%</td>
            <td style="text-align: center;">${rankBadge}</td>
          </tr>
        `;
      }).join("");
    }
  }

  if (modalSearchInput) {
    modalSearchInput.addEventListener("input", (e) => {
      currentFilterText = e.target.value;
      renderModalTable();
    });
  }

  if (modalSortTabs) {
    modalSortTabs.querySelectorAll(".sort-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        modalSortTabs.querySelectorAll(".sort-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentSortMode = tab.dataset.sort;
        renderModalTable();
      });
    });
  }

  // 3. Conexões com API e Streaming SSE
  function startRealtimeConnection() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }

    const query = `cargo=${selectedCargo}&uf=${selectedUf || "br"}${isFakeMode ? "&mode=fake" : ""}`;
    const url = `/api/state?${query}`;
    const sseUrl = `/api/events?${query}`;

    // Busca REST imediata
    fetch(url)
      .then(res => res.json())
      .then(data => onSnapshotReceived(data))
      .catch(err => {
        console.warn("Falha no fetch REST:", err);
        syncStatusText.textContent = "Tentando reconectar...";
      });

    // Inicia streaming SSE
    try {
      if (window.EventSource) {
        eventSource = new EventSource(sseUrl);
        
        eventSource.addEventListener("snapshot", (e) => {
          try {
            const data = JSON.parse(e.data);
            syncStatusText.textContent = isFakeMode ? "Conectado (Simulação 2026)" : "Conectado ao TSE Oficial";
            onSnapshotReceived(data);
          } catch (err) {
            console.error("Erro no parse SSE:", err);
          }
        });

        eventSource.onerror = () => {
          syncStatusText.textContent = "Modo de polling ativo (15s)";
          if (!pollingTimer) {
            pollingTimer = setInterval(() => {
              fetch(url).then(r => r.json()).then(onSnapshotReceived).catch(console.warn);
            }, 15000);
          }
        };
      }
    } catch (e) {
      pollingTimer = setInterval(() => {
        fetch(url).then(r => r.json()).then(onSnapshotReceived).catch(console.warn);
      }, 15000);
    }
  }

  // 4. Temporizador
  setInterval(() => {
    const now = Date.now();
    const diff = Math.max(0, Math.ceil((nextRefreshTime - now) / 1000));
    const mins = String(Math.floor(diff / 60)).padStart(2, "0");
    const secs = String(diff % 60).padStart(2, "0");
    countdownTimer.textContent = `${mins}:${secs}`;
  }, 1000);

  // Inicialização
  initSvgMap();
  startRealtimeConnection();
});
