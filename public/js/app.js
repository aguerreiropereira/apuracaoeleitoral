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

  // Configuração e Estado de Pleito
  const PRESET_PLEITOS = [
    {
      id: "2026_1t",
      name: "Eleição Geral 2026 · 1º Turno (Oficial Ordinária)",
      shortName: "Eleições 2026 · 1ºT (6257/6259)",
      badge: "Oficial TSE",
      badgeClass: "official",
      ano: "2026",
      pleitoFed: "6257",
      pleitoEst: "6259",
      desc: "Presidente da República (6257), Governadores, Senadores e Deputados (6259)",
      isFake: false
    },
    {
      id: "2026_2t",
      name: "Eleição Geral 2026 · 2º Turno (Projeção/Oficial)",
      shortName: "Eleições 2026 · 2ºT (6258/6260)",
      badge: "2º Turno",
      badgeClass: "secondary",
      ano: "2026",
      pleitoFed: "6258",
      pleitoEst: "6260",
      desc: "Disputa de 2º Turno para Presidente (6258) e Governadores (6260)",
      isFake: false
    },
    {
      id: "2022_2t",
      name: "Eleições 2022 · 2º Turno (Lula Eleito)",
      shortName: "Eleições 2022 · 2ºT",
      badge: "Histórico 2022",
      badgeClass: "official",
      ano: "2022",
      pleitoFed: "545",
      pleitoEst: "547",
      desc: "Resultado definitivo do 2º Turno Presidencial (Lula vs Bolsonaro) e 27 Governadores",
      isFake: false
    },
    {
      id: "2022_1t",
      name: "Eleições 2022 · 1º Turno (Histórico Oficial)",
      shortName: "Eleições 2022 · 1ºT",
      badge: "Histórico 2022",
      badgeClass: "official",
      ano: "2022",
      pleitoFed: "544",
      pleitoEst: "546",
      desc: "1º Turno das Eleições 2022: Lula, Bolsonaro, Tebet, Gomes e Senadores/Deputados",
      isFake: false
    },
    {
      id: "2018_2t",
      name: "Eleições 2018 · 2º Turno (Bolsonaro Eleito)",
      shortName: "Eleições 2018 · 2ºT",
      badge: "Histórico 2018",
      badgeClass: "official",
      ano: "2018",
      pleitoFed: "296",
      pleitoEst: "298",
      desc: "Resultado oficial do 2º Turno das Eleições 2018 (Bolsonaro vs Haddad) e Governadores",
      isFake: false
    },
    {
      id: "sim_2026",
      name: "Simulação de Apuração 2026 (Dados de Teste)",
      shortName: "Simulação 2026 (Dados de Teste)",
      badge: "Simulação",
      badgeClass: "sim",
      ano: "2026",
      pleitoFed: "6257",
      pleitoEst: "6259",
      desc: "Totalização dinâmica com apuração progressiva e cenários de validação",
      isFake: true
    }
  ];

  const STORAGE_PLEITO_KEY = "painel_eleitoral_pleito_config";
  let activePleito = null;

  try {
    const saved = localStorage.getItem(STORAGE_PLEITO_KEY);
    if (saved) activePleito = JSON.parse(saved);
  } catch(e) {}

  if (!activePleito) {
    activePleito = PRESET_PLEITOS[0];
  }

  // URL overrides
  if (urlParams.get("pleitoFed")) {
    activePleito = {
      id: "custom_url",
      name: `Pleito Personalizado (${urlParams.get("pleitoFed")})`,
      shortName: `Pleito ${urlParams.get("pleitoFed")}`,
      ano: urlParams.get("ano") || "2026",
      pleitoFed: urlParams.get("pleitoFed"),
      pleitoEst: urlParams.get("pleitoEst") || "6259",
      desc: "Configurado via parâmetros de URL",
      isFake: isFakeMode
    };
  } else if (isFakeMode && !activePleito.isFake) {
    activePleito = PRESET_PLEITOS.find(p => p.isFake) || PRESET_PLEITOS[0];
  }

  function getPleitoQueryParams() {
    return {
      ano: activePleito.ano || "2026",
      pleitoFed: activePleito.pleitoFed || "6257",
      pleitoEst: activePleito.pleitoEst || "6259",
      ...((activePleito.isFake || isFakeMode) ? { mode: "fake" } : {})
    };
  }

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

  // Elementos do Seletor e Modal de Pleito
  const btnOpenPleitoModal = document.getElementById("btnOpenPleitoModal");
  const btnClosePleitoModal = document.getElementById("btnClosePleitoModal");
  const pleitoModal = document.getElementById("pleitoModal");
  const currentPleitoBadge = document.getElementById("currentPleitoBadge");
  const pleitosOptionsList = document.getElementById("pleitosOptionsList");
  const btnToggleCustomPleito = document.getElementById("btnToggleCustomPleito");
  const customToggleArrow = document.getElementById("customToggleArrow");
  const customPleitoContent = document.getElementById("customPleitoContent");
  const inpPleitoAno = document.getElementById("inpPleitoAno");
  const inpPleitoFed = document.getElementById("inpPleitoFed");
  const inpPleitoEst = document.getElementById("inpPleitoEst");
  const inpPleitoNome = document.getElementById("inpPleitoNome");
  const btnApplyCustomPleito = document.getElementById("btnApplyCustomPleito");
  
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

  // Placar do Mapa e Sidebar Geográfica
  const mapScoreboard = document.getElementById("mapScoreboard");
  const sbDot1 = document.getElementById("sbDot1");
  const sbName1 = document.getElementById("sbName1");
  const sbStates1 = document.getElementById("sbStates1");
  const sbBar1 = document.getElementById("sbBar1");
  const sbDot2 = document.getElementById("sbDot2");
  const sbName2 = document.getElementById("sbName2");
  const sbStates2 = document.getElementById("sbStates2");
  const sbBar2 = document.getElementById("sbBar2");
  const legDot1 = document.getElementById("legDot1");
  const legName1 = document.getElementById("legName1");
  const legDot2 = document.getElementById("legDot2");
  const legName2 = document.getElementById("legName2");

  const sidebarTabs = document.getElementById("sidebarTabs");
  const tabBtnRegions = document.getElementById("tabBtnRegions");
  const tabBtnStates = document.getElementById("tabBtnStates");
  const tabContentRegions = document.getElementById("tabContentRegions");
  const tabContentStates = document.getElementById("tabContentStates");
  const regionsFeed = document.getElementById("regionsFeed");
  const statesFeed = document.getElementById("statesFeed");
  const sidebarStateSearch = document.getElementById("sidebarStateSearch");

  // Elementos da Aba e Seção de Eleitos
  const tabBtnElected = document.getElementById("tabBtnElected");
  const tabContentElected = document.getElementById("tabContentElected");
  const sidebarElectedOfficePills = document.getElementById("sidebarElectedOfficePills");
  const sidebarElectedSearch = document.getElementById("sidebarElectedSearch");
  const sidebarElectedFeed = document.getElementById("sidebarElectedFeed");

  const electedShowcaseSection = document.getElementById("electedShowcaseSection");
  const electedShowcaseSubtitle = document.getElementById("electedShowcaseSubtitle");
  const showcaseOfficeTabs = document.getElementById("showcaseOfficeTabs");
  const partyBenchesChips = document.getElementById("partyBenchesChips");
  const benchesCategoryPills = document.getElementById("benchesCategoryPills");
  const showcaseUfFilter = document.getElementById("showcaseUfFilter");
  const showcaseSearchInput = document.getElementById("showcaseSearchInput");
  const sidebarElectedSortSelect = document.getElementById("sidebarElectedSortSelect");
  const showcaseSortSelect = document.getElementById("showcaseSortSelect");
  const electedShowcaseGrid = document.getElementById("electedShowcaseGrid");

  let electedData = null;
  let currentSidebarElectedOffice = "all";
  let currentSidebarElectedFilter = "";
  let currentSidebarElectedSort = "votes_desc";
  let currentShowcaseOffice = "all";
  let currentShowcaseUf = "all";
  let currentShowcaseSearch = "";
  let currentShowcaseSort = "votes_desc";
  let currentBenchesCategory = "gov";

  let geoSummary = null;
  let statesSearchQuery = "";

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
    if (currentPleitoBadge) {
      currentPleitoBadge.textContent = activePleito.shortName || activePleito.name;
    }
    if (isFakeMode) {
      modeBadge.textContent = "Modo Simulação 2026";
      modeBadge.className = "badge-pill sim";
      btnToggleMode.textContent = "Mudar para Oficial TSE";
    } else {
      modeBadge.textContent = `Oficial TSE (${activePleito.pleitoFed || "6257"})`;
      modeBadge.className = "badge-pill";
      btnToggleMode.textContent = "Ver Simulação";
    }
  }
  setupModeUI();

  btnToggleMode.addEventListener("click", () => {
    isFakeMode = !isFakeMode;
    if (isFakeMode) {
      activePleito = PRESET_PLEITOS.find(p => p.isFake) || PRESET_PLEITOS[0];
    } else {
      activePleito = PRESET_PLEITOS[0];
    }
    localStorage.setItem(STORAGE_PLEITO_KEY, JSON.stringify(activePleito));
    setupModeUI();
    startRealtimeConnection();
    fetchGeoSummary();
  });

  function updateMapColors() {
    if (!svgMap) return;
    const isLight = (currentTheme === "light");
    const defaultFill = isLight ? "#cbd5e1" : "#0d2636";

    document.querySelectorAll(".uf").forEach(path => {
      const uf = path.dataset?.uf;
      const ufGeo = geoSummary?.states?.[uf];
      const ufSnap = currentSnapshot?.states?.[uf];

      if (ufGeo && ufGeo.leader && ufGeo.secPctNum > 0) {
        path.style.fill = ufGeo.leader.cor || "#1f4fbf";
      } else if (ufSnap && ufSnap.leader && ufSnap.pctSections >= 0.01) {
        path.style.fill = ufSnap.leader.color || "#1f4fbf";
      } else {
        path.style.fill = defaultFill;
      }
    });
  }

  function updateMapThemeColors() {
    updateMapColors();
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
    if (!uf) {
      tooltip.hidden = true;
      return;
    }

    const mapData = (typeof MAP !== 'undefined') ? MAP : window.MAP;
    const stateMeta = mapData?.s?.[uf] || { n: uf };
    const ufGeo = geoSummary?.states?.[uf];
    const ufSnap = currentSnapshot?.states?.[uf];
    const mapRect = svgMap.getBoundingClientRect();

    let html = `<h4>${stateMeta.n} (${uf})</h4>`;
    if (ufGeo && ufGeo.secPctNum > 0 && ufGeo.leader) {
      html += `
        <div class="row"><span>Região:</span><span class="val">${ufGeo.region}</span></div>
        <div class="row"><span>Seções Totalizadas:</span><span class="val">${ufGeo.secPct}%</span></div>
      `;
      html += `
        <div class="row" style="margin-top:5px;">
          <span style="display:flex; align-items:center; gap:4px;">
            <i style="width:8px; height:8px; border-radius:50%; background:${ufGeo.leader.cor || '#1f4fbf'}; display:inline-block;"></i>
            <strong>1º ${ufGeo.leader.nm} (${ufGeo.leader.sg})</strong>
          </span>
          <span class="val" style="color:${ufGeo.leader.cor || 'var(--text-main)'}; font-weight:800;">${ufGeo.leader.pvap}%</span>
        </div>
        <div class="row" style="font-size:11px; color:var(--text-muted);">
          <span>Votos:</span>
          <span>${Number(ufGeo.leader.vap).toLocaleString("pt-BR")}</span>
        </div>
      `;
      if (ufGeo.runnerUp) {
        html += `
          <div class="row" style="margin-top:4px;">
            <span style="display:flex; align-items:center; gap:4px;">
              <i style="width:8px; height:8px; border-radius:50%; background:${ufGeo.runnerUp.cor || '#c8202f'}; display:inline-block;"></i>
              <strong>2º ${ufGeo.runnerUp.nm} (${ufGeo.runnerUp.sg})</strong>
            </span>
            <span class="val" style="color:${ufGeo.runnerUp.cor || 'var(--text-main)'}; font-weight:800;">${ufGeo.runnerUp.pvap}%</span>
          </div>
          <div class="row" style="font-size:11px; color:var(--text-muted);">
            <span>Votos:</span>
            <span>${Number(ufGeo.runnerUp.vap).toLocaleString("pt-BR")}</span>
          </div>
        `;
      }
      html += `<div class="row" style="color:var(--pct-color); font-size:11px; margin-top:6px;"><span>Clique para filtrar este estado</span></div>`;
    } else if (ufSnap && ufSnap.pctSections > 0 && ufSnap.leader) {
      html += `
        <div class="row"><span>Seções Totalizadas:</span><span class="val">${ufSnap.pctSectionsDisplay || "0,00"}%</span></div>
      `;
      html += `
        <div class="row" style="margin-top:4px;">
          <span>Líder:</span>
          <span class="val" style="color:${ufSnap.leader.color || '#fff'}">${ufSnap.leader.name} (${ufSnap.leader.party})</span>
        </div>
        <div class="row">
          <span>Votação:</span>
          <span class="val">${Number(ufSnap.leader.votes).toLocaleString("pt-BR")} (${ufSnap.leader.pct}%)</span>
        </div>
      `;
      if (ufSnap.runnerUp) {
        html += `
          <div class="row" style="opacity:0.85; margin-top:2px;">
            <span>2º colocado:</span>
            <span class="val">${ufSnap.runnerUp.name} (${ufSnap.runnerUp.pct}%)</span>
          </div>
        `;
      }
    } else {
      html += `
        <div class="row" style="color:#94a3b8; font-size:12px;"><span>Aguardando início da apuração.</span></div>
        <div class="row" style="color:var(--pct-color); font-size:11px; margin-top:6px;"><span>Clique para filtrar este estado.</span></div>
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

    updateMapColors();
    renderDashboard();
    fetchGeoSummary();
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

    // Atualiza cabeçalho oficial e badge de pleito
    if (currentPleitoBadge) {
      currentPleitoBadge.textContent = activePleito.shortName || activePleito.name;
    }
    if (electionHeading) {
      const activeCode = (selectedCargo === "1") ? activePleito.pleitoFed : activePleito.pleitoEst;
      if (selectedCargo === "1") {
        electionHeading.textContent = `${activePleito.name} - Presidente (Pleito ${activeCode})`;
      } else {
        electionHeading.textContent = `${activePleito.name} - ${office} · ${locationName} (Pleito ${activeCode})`;
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
        <div class="candidate-card clickable" style="--cand-color: ${candColor}; --stagger-i: ${idx}" data-sqcand="${cand.sqcand || ''}" data-n="${cand.n}" title="Clique para ver o desempenho detalhado por estados e cidades">
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
    const pleitoParams = getPleitoQueryParams();
    const query = new URLSearchParams({
      cargo: selectedCargo,
      uf: selectedUf || "br",
      sqcand: sqcand || "",
      n: n || "",
      ...pleitoParams
    }).toString();
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

  // ========================================================
  // 2.2 Placar de Líderes e Sidebar Geográfica (Regiões e Estados)
  // ========================================================
  function renderMapScoreboard() {
    if (!geoSummary || !geoSummary.topTwo || geoSummary.topTwo.length < 2) return;
    const c1 = geoSummary.topTwo[0];
    const c2 = geoSummary.topTwo[1];

    if (sbDot1) sbDot1.style.background = c1.cor || "#1f4fbf";
    if (sbName1) sbName1.textContent = `${c1.nm} (${c1.sg})`;
    if (sbStates1) sbStates1.textContent = `${c1.statesCount} ${c1.statesCount === 1 ? 'estado' : 'estados'}`;

    if (sbDot2) sbDot2.style.background = c2.cor || "#c8202f";
    if (sbName2) sbName2.textContent = `${c2.nm} (${c2.sg})`;
    if (sbStates2) sbStates2.textContent = `${c2.statesCount} ${c2.statesCount === 1 ? 'estado' : 'estados'}`;

    const totalWon = (c1.statesCount + c2.statesCount) || 1;
    const pct1 = Math.round((c1.statesCount / totalWon) * 100);
    const pct2 = 100 - pct1;

    if (sbBar1) {
      sbBar1.style.width = `${pct1}%`;
      sbBar1.style.background = c1.cor || "#1f4fbf";
    }
    if (sbBar2) {
      sbBar2.style.width = `${pct2}%`;
      sbBar2.style.background = c2.cor || "#c8202f";
    }

    // Atualiza Legenda do Mapa
    if (legDot1) legDot1.style.background = c1.cor || "#1f4fbf";
    if (legName1) legName1.textContent = `${c1.nm} (${c1.sg})`;
    if (legDot2) legDot2.style.background = c2.cor || "#c8202f";
    if (legName2) legName2.textContent = `${c2.nm} (${c2.sg})`;
  }

  function renderRegionsFeed() {
    if (!regionsFeed || !geoSummary?.regions) return;

    regionsFeed.innerHTML = geoSummary.regions.map((r, idx) => {
      const c1 = r.leader;
      const c2 = r.runnerUp;

      const c1Html = c1 ? `
        <div class="region-cand-item">
          <div class="region-cand-left">
            <span class="region-cand-dot" style="background: ${c1.cor || '#1f4fbf'};"></span>
            <span class="region-cand-name">1º ${c1.nm} (${c1.sg})</span>
          </div>
          <span class="region-cand-pct">${c1.pvap}%</span>
        </div>
      ` : `<div style="font-size:11px; color:var(--text-dim)">Sem apuração</div>`;

      const c2Html = c2 ? `
        <div class="region-cand-item">
          <div class="region-cand-left">
            <span class="region-cand-dot" style="background: ${c2.cor || '#c8202f'};"></span>
            <span class="region-cand-name">2º ${c2.nm} (${c2.sg})</span>
          </div>
          <span class="region-cand-pct">${c2.pvap}%</span>
        </div>
      ` : "";

      const chipsHtml = (r.ufs || []).map(uf => {
        const ufState = geoSummary.states?.[uf];
        const dotColor = ufState?.leader?.cor || '#94a3b8';
        const isCurrent = (selectedUf === uf);
        return `
          <button class="state-chip ${isCurrent ? 'selected' : ''}" data-uf="${uf}" title="${ufState?.name || uf} (${ufState?.secPct || 0}%)">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${dotColor}; margin-right:3px;"></span>${uf}
          </button>
        `;
      }).join("");

      return `
        <div class="region-card" style="--stagger-i: ${idx}">
          <div class="region-head">
            <span class="region-name">Região ${r.region}</span>
            <span class="region-sec-pct">${r.pctSections}% apurado</span>
          </div>
          <div class="region-bar-bg">
            <div class="region-bar-fill" style="width: ${r.pctSectionsNum}%;"></div>
          </div>
          <div class="region-candidates-row">
            ${c1Html}
            ${c2Html}
          </div>
          <div class="region-states-chips">
            ${chipsHtml}
          </div>
        </div>
      `;
    }).join("");

    regionsFeed.querySelectorAll(".state-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const uf = chip.dataset.uf;
        selectStateFromSidebar(uf);
      });
    });
  }

  function renderStatesFeed() {
    if (!statesFeed || !geoSummary?.statesList) return;

    let list = [...geoSummary.statesList];
    if (statesSearchQuery.trim()) {
      const q = statesSearchQuery.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.uf.toLowerCase().includes(q) || s.region.toLowerCase().includes(q));
    }

    list.sort((a, b) => b.secPctNum - a.secPctNum);

    if (list.length === 0) {
      statesFeed.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12px;">Nenhum estado encontrado.</div>`;
      return;
    }

    statesFeed.innerHTML = list.map((s, idx) => {
      const isSelected = (selectedUf === s.uf);
      const dotColor = s.leader?.cor || "#94a3b8";
      const leaderName = s.leader ? `${s.leader.nm} (${s.leader.sg})` : "Aguardando";
      const leaderPct = s.leader ? `${s.leader.pvap}%` : "0,00%";

      return `
        <div class="state-item-row ${isSelected ? 'selected' : ''}" style="--stagger-i: ${idx}" data-uf="${s.uf}">
          <div class="state-item-left">
            <span class="state-item-badge" style="background:${dotColor}">${s.uf}</span>
            <div>
              <div class="state-item-name">${s.name}</div>
              <div class="state-item-sec">${s.region} · ${s.secPct}% apurado</div>
            </div>
          </div>
          <div class="state-item-right">
            <div>
              <div style="font-size:11px; font-weight:700; color:var(--text-main); display:flex; align-items:center; justify-content:flex-end; gap:4px;">
                <span class="state-item-leader-dot" style="background:${dotColor}"></span>
                ${leaderName}
              </div>
              <div class="state-item-leader-pct" style="color:${dotColor}">${leaderPct}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    statesFeed.querySelectorAll(".state-item-row").forEach(row => {
      row.addEventListener("click", () => {
        const uf = row.dataset.uf;
        selectStateFromSidebar(uf);
      });
    });
  }

  function selectStateFromSidebar(uf) {
    if (selectedUf === uf) {
      if (selectedCargo === "1") {
        selectedUf = "";
      }
    } else {
      selectedUf = uf;
    }
    if (ufSelect) ufSelect.value = selectedUf;
    syncMapSelection();
    startRealtimeConnection();
    renderRegionsFeed();
    renderStatesFeed();
  }

  // Abas da Sidebar (Regiões, Estados e Eleitos)
  if (sidebarTabs) {
    sidebarTabs.querySelectorAll(".sidebar-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        sidebarTabs.querySelectorAll(".sidebar-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.dataset.tab;
        if (target === "regions") {
          tabContentRegions.style.display = "flex";
          tabContentStates.style.display = "none";
          if (tabContentElected) tabContentElected.style.display = "none";
        } else if (target === "states") {
          tabContentRegions.style.display = "none";
          tabContentStates.style.display = "flex";
          if (tabContentElected) tabContentElected.style.display = "none";
          renderStatesFeed();
        } else if (target === "elected") {
          tabContentRegions.style.display = "none";
          tabContentStates.style.display = "none";
          if (tabContentElected) {
            tabContentElected.style.display = "flex";
            renderSidebarElected();
          }
        }
      });
    });
  }

  if (sidebarStateSearch) {
    sidebarStateSearch.addEventListener("input", (e) => {
      statesSearchQuery = e.target.value;
      renderStatesFeed();
    });
  }

  // Controles e Filtros de Eleitos (Sidebar e Showcase)
  if (sidebarElectedOfficePills) {
    sidebarElectedOfficePills.querySelectorAll(".elected-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        sidebarElectedOfficePills.querySelectorAll(".elected-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        currentSidebarElectedOffice = pill.dataset.office || "all";
        renderSidebarElected();
      });
    });
  }

  function normStr(str) {
    return (str || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  if (sidebarElectedSearch) {
    sidebarElectedSearch.addEventListener("input", (e) => {
      currentSidebarElectedFilter = e.target.value;
      renderSidebarElected();
    });
  }

  if (showcaseOfficeTabs) {
    showcaseOfficeTabs.querySelectorAll(".cargo-tab, button").forEach(btn => {
      btn.addEventListener("click", () => {
        showcaseOfficeTabs.querySelectorAll(".cargo-tab, button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentShowcaseOffice = btn.dataset.office || "all";
        renderShowcaseElected();
      });
    });
  }

  if (showcaseUfFilter) {
    showcaseUfFilter.addEventListener("change", (e) => {
      currentShowcaseUf = e.target.value || "all";
      renderShowcaseElected();
    });
  }

  if (showcaseSearchInput) {
    showcaseSearchInput.addEventListener("input", (e) => {
      currentShowcaseSearch = e.target.value || "";
      renderShowcaseElected();
    });
  }

  if (benchesCategoryPills) {
    benchesCategoryPills.querySelectorAll(".elected-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        benchesCategoryPills.querySelectorAll(".elected-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        currentBenchesCategory = pill.dataset.bench || "gov";
        renderPartyBenches();
      });
    });
  }

  if (sidebarElectedSortSelect) {
    sidebarElectedSortSelect.addEventListener("change", (e) => {
      currentSidebarElectedSort = e.target.value || "votes_desc";
      renderSidebarElected();
    });
  }

  if (showcaseSortSelect) {
    showcaseSortSelect.addEventListener("change", (e) => {
      currentShowcaseSort = e.target.value || "votes_desc";
      renderShowcaseElected();
    });
  }

  function sortElectedList(list, sortMode) {
    const sorted = [...list];
    switch(sortMode) {
      case "votes_desc":
        sorted.sort((a, b) => {
          const vA = parseInt(String(a.votes || "0").replace(/\D/g, ""), 10) || 0;
          const vB = parseInt(String(b.votes || "0").replace(/\D/g, ""), 10) || 0;
          return vB - vA;
        });
        break;
      case "pct_desc":
        sorted.sort((a, b) => {
          const pA = parseFloat(String(a.pct || "0").replace(",", ".")) || 0;
          const pB = parseFloat(String(b.pct || "0").replace(",", ".")) || 0;
          return pB - pA;
        });
        break;
      case "uf_asc":
        sorted.sort((a, b) => {
          const uA = String(a.uf || a.scope || "").toUpperCase();
          const uB = String(b.uf || b.scope || "").toUpperCase();
          if (uA === "BR") return -1;
          if (uB === "BR") return 1;
          return uA.localeCompare(uB);
        });
        break;
      case "name_asc":
        sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      default:
        sorted.sort((a, b) => {
          const vA = parseInt(String(a.votes || "0").replace(/\D/g, ""), 10) || 0;
          const vB = parseInt(String(b.votes || "0").replace(/\D/g, ""), 10) || 0;
          return vB - vA;
        });
        break;
    }
    return sorted;
  }

  function updateShowcaseOfficeCounters() {
    if (!showcaseOfficeTabs || !electedData) return;
    const govCount = (electedData.governors || []).length;
    const senCount = (electedData.senators || []).length;
    const depCount = (electedData.deputiesFederal || []).length;

    const btnGov = showcaseOfficeTabs.querySelector('[data-office="gov"]');
    if (btnGov) {
      btnGov.innerHTML = `<span class="material-symbols-outlined" style="font-size: 15px;">account_balance</span>Governadores (${govCount})`;
    }

    const btnSen = showcaseOfficeTabs.querySelector('[data-office="sen"]');
    if (btnSen) {
      btnSen.innerHTML = `<span class="material-symbols-outlined" style="font-size: 15px;">gavel</span>Senadores (${senCount})`;
    }

    const btnDep = showcaseOfficeTabs.querySelector('[data-office="dep"]');
    if (btnDep) {
      btnDep.innerHTML = `<span class="material-symbols-outlined" style="font-size: 15px;">badge</span>Deputados (${depCount})`;
    }
  }

  function renderPartyBenches() {
    if (!partyBenchesChips || !electedData) return;
    let benches = [];
    const cat = currentBenchesCategory;
    if (cat === "gov") {
      benches = electedData.partyBenches?.governors || [];
    } else if (cat === "sen") {
      benches = electedData.partyBenches?.senators || [];
    } else if (cat === "dep") {
      benches = electedData.partyBenches?.deputiesFederal || [];
    }

    if (benches.length === 0) {
      benches = electedData.partyBenches?.governors || electedData.partyBenches?.senators || electedData.partyBenches?.deputiesFederal || [];
    }

    if (benches.length > 0) {
      partyBenchesChips.innerHTML = benches.map(b => `
        <span class="party-bench-chip" title="${b.party}: ${b.count} eleito(s)">
          <span>${b.party}</span>
          <span class="party-bench-num">${b.count}</span>
        </span>
      `).join("");
    } else {
      partyBenchesChips.innerHTML = `<span style="font-size:11px; color:var(--text-muted);">Totalização de bancadas em apuração</span>`;
    }
  }

  async function fetchElectedData() {
    try {
      const pleitoParams = getPleitoQueryParams();
      // Sempre busca o dataset nacional completo de eleitos para que a galeria contenha todos os cargos
      const q = new URLSearchParams(pleitoParams).toString();

      const res = await fetch(`/api/elected?${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.ok) {
        electedData = data;
        updateShowcaseOfficeCounters();
        renderSidebarElected();
        renderShowcaseElected();
      }
    } catch(err) {
      console.warn("Falha ao buscar dados de eleitos:", err);
    }
  }

  function getElectedListForOffice(officeType) {
    if (!electedData) return [];
    let list = [];

    if (officeType === "all" || officeType === "pres") {
      if (electedData.president?.winner) {
        const p = electedData.president.winner;
        list.push({
          office: "Presidente",
          scope: "Brasil",
          name: p.nmCompleto || p.nm,
          party: p.sg,
          n: p.n,
          votes: p.vap,
          pct: p.pvap,
          status: electedData.president.status || "Eleito",
          cor: p.cor || "var(--pct-color)",
          foto: p.foto,
          uf: "BR"
        });
      }
    }

    if (officeType === "all" || officeType === "gov") {
      (electedData.governors || []).forEach(g => {
        list.push({
          office: "Governador",
          scope: g.uf,
          name: g.name,
          party: g.party,
          votes: g.votes,
          pct: g.pct,
          status: g.status || "Eleito",
          cor: g.cor || "var(--br-blue)",
          foto: g.foto || null,
          uf: g.uf
        });
      });
    }

    if (officeType === "all" || officeType === "sen") {
      (electedData.senators || []).forEach(s => {
        list.push({
          office: "Senador",
          scope: s.uf,
          name: s.name,
          party: s.party,
          votes: s.votes,
          pct: s.pct,
          status: s.status || "Eleito",
          cor: s.cor || "var(--br-blue)",
          foto: s.foto || null,
          uf: s.uf
        });
      });
    }

    if (officeType === "all" || officeType === "dep") {
      (electedData.deputiesFederal || []).forEach(d => {
        list.push({
          office: "Dep. Federal",
          scope: d.uf,
          name: d.name,
          party: d.party,
          n: d.n,
          votes: d.votes,
          pct: d.pct,
          status: d.status || "Eleito por QP",
          cor: d.cor || "#10b981",
          foto: d.foto || null,
          uf: d.uf
        });
      });
    }

    return list;
  }

  function renderSidebarElected() {
    if (!sidebarElectedFeed || !electedData) return;
    let list = getElectedListForOffice(currentSidebarElectedOffice);

    if (currentSidebarElectedFilter.trim()) {
      const q = normStr(currentSidebarElectedFilter);
      list = list.filter(item => 
        normStr(item.name).includes(q) ||
        normStr(item.party).includes(q) ||
        normStr(item.scope).includes(q) ||
        normStr(item.uf).includes(q) ||
        normStr(item.office).includes(q)
      );
    }

    // Ordenação da lista na barra lateral
    list = sortElectedList(list, currentSidebarElectedSort);

    if (list.length === 0) {
      sidebarElectedFeed.innerHTML = `
        <div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:12px;">
          Nenhum candidato eleito encontrado com o filtro atual.
        </div>
      `;
      return;
    }

    sidebarElectedFeed.innerHTML = list.map((item, idx) => {
      const votesFmt = item.votes ? Number(item.votes).toLocaleString("pt-BR") : "";
      const rankClass = idx === 0 ? "rank-1" : (idx === 1 ? "rank-2" : (idx === 2 ? "rank-3" : ""));
      return `
        <div class="elected-card-item" style="--stagger-i: ${idx}">
          <div class="elected-card-left">
            <span class="elected-rank-badge ${rankClass}" style="margin-right: 2px;">#${idx + 1}</span>
            <span class="elected-card-badge" style="background:${item.cor}">${item.scope || item.uf || "BR"}</span>
            <div class="elected-card-info">
              <strong class="elected-card-name">${item.name}</strong>
              <div class="elected-card-meta">
                <span>${item.office}</span>
                <span>·</span>
                <strong style="color:var(--text-main);">${item.party}</strong>
              </div>
            </div>
          </div>
          <div class="elected-card-right">
            <div class="elected-card-pct">${item.pct}%</div>
            ${votesFmt ? `<div class="elected-card-votes">${votesFmt} votos</div>` : ""}
            <span class="status-pill-elected">
              <span class="material-symbols-outlined" style="font-size:10px;">check</span>
              ${item.status}
            </span>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderShowcaseElected() {
    if (!electedShowcaseGrid || !electedData) return;

    if (electedShowcaseSubtitle) {
      electedShowcaseSubtitle.textContent = `${electedData.nomeEleicao || activePleito.name} · Resultado Oficial Consolidado`;
    }

    // Atualiza barras de bancadas
    renderPartyBenches();

    let list = getElectedListForOffice(currentShowcaseOffice);

    // Filtro por Estado (UF) no Quadro
    if (currentShowcaseUf && currentShowcaseUf !== "all" && currentShowcaseUf !== "BR") {
      const ufTarget = currentShowcaseUf.toUpperCase();
      list = list.filter(item => (item.uf || item.scope || "").toUpperCase() === ufTarget || item.office === "Presidente");
    }

    // Busca textual no Quadro
    if (currentShowcaseSearch.trim()) {
      const q = normStr(currentShowcaseSearch);
      list = list.filter(item => 
        normStr(item.name).includes(q) ||
        normStr(item.party).includes(q) ||
        normStr(item.scope).includes(q) ||
        normStr(item.uf).includes(q) ||
        normStr(item.office).includes(q)
      );
    }

    // Ordenação dinâmica (Mais Votados, Maior %, UF, Nome)
    list = sortElectedList(list, currentShowcaseSort);

    if (list.length === 0) {
      electedShowcaseGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:var(--text-muted); font-size:13px;">
          Nenhum eleito encontrado para o filtro e categoria selecionados.
        </div>
      `;
      return;
    }

    electedShowcaseGrid.innerHTML = list.map((item, idx) => {
      const votesFmt = item.votes ? Number(item.votes).toLocaleString("pt-BR") : "";
      const rankClass = idx === 0 ? "rank-1" : (idx === 1 ? "rank-2" : (idx === 2 ? "rank-3" : ""));
      const avatarHtml = item.foto 
        ? `<img src="${item.foto}" alt="${item.name}" class="elected-grid-avatar" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
           <div class="elected-grid-avatar-fallback" style="display:none; border-color:${item.cor};">${item.n || item.party}</div>`
        : `<div class="elected-grid-avatar-fallback" style="border-color:${item.cor};">${item.n || item.party}</div>`;

      return `
        <article class="elected-grid-card" style="--stagger-i: ${idx}">
          <div class="elected-grid-card-head">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="elected-rank-badge ${rankClass}">#${idx + 1}</span>
              <span class="elected-grid-scope">${item.office} · ${item.scope || item.uf}</span>
            </div>
            <span class="status-pill-elected">
              <span class="material-symbols-outlined" style="font-size:10px;">verified</span>
              ${item.status}
            </span>
          </div>
          <div class="elected-grid-card-body">
            ${avatarHtml}
            <div class="elected-grid-card-meta">
              <strong>${item.name}</strong>
              <span>${item.party}${item.n ? ` (${item.n})` : ""}</span>
            </div>
          </div>
          <div class="elected-grid-card-foot">
            <span style="font-weight:700; color:var(--text-muted);">${votesFmt ? `${votesFmt} votos` : "Homologado"}</span>
            <strong style="color:var(--pct-color); font-size:13px;">${item.pct}%</strong>
          </div>
        </article>
      `;
    }).join("");
  }

  let geoFetchInProgress = false;
  function fetchGeoSummary() {
    if (geoFetchInProgress) return;
    geoFetchInProgress = true;
    const pleitoParams = getPleitoQueryParams();
    const query = new URLSearchParams(pleitoParams).toString();
    const url = `/api/geo-summary?${query}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        geoFetchInProgress = false;
        if (!data || !data.ok) return;
        geoSummary = data;
        renderMapScoreboard();
        updateMapColors();
        renderRegionsFeed();
        renderStatesFeed();
      })
      .catch(err => {
        geoFetchInProgress = false;
        console.warn("Erro ao buscar geo-summary:", err);
      });
  }

  // ========================================================
  // 2.3 Modal e Seleção de Pleito Eleitoral
  // ========================================================
  function renderPleitosOptions() {
    if (!pleitosOptionsList) return;

    pleitosOptionsList.innerHTML = PRESET_PLEITOS.map(p => {
      const isActive = (activePleito.id === p.id);
      return `
        <div class="pleito-card-option ${isActive ? 'active' : ''}" data-id="${p.id}">
          <div class="pleito-opt-left">
            <div class="pleito-radio-indicator"></div>
            <div>
              <div class="pleito-opt-title">${p.name}</div>
              <div class="pleito-opt-desc">${p.desc}</div>
            </div>
          </div>
          <span class="pleito-opt-badge ${p.badgeClass}">${p.badge}</span>
        </div>
      `;
    }).join("");

    pleitosOptionsList.querySelectorAll(".pleito-card-option").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        const target = PRESET_PLEITOS.find(p => p.id === id);
        if (!target) return;
        selectPleito(target);
      });
    });
  }

  function selectPleito(pleitoObj) {
    activePleito = pleitoObj;
    localStorage.setItem(STORAGE_PLEITO_KEY, JSON.stringify(activePleito));
    isFakeMode = pleitoObj.isFake === true;
    setupModeUI();

    if (pleitoModal) pleitoModal.style.display = "none";
    if (currentPleitoBadge) currentPleitoBadge.textContent = activePleito.shortName || activePleito.name;

    // Reinicia conexões em tempo real com o novo pleito
    startRealtimeConnection();
    fetchGeoSummary();
    fetchElectedData();
  }

  function openPleitoModal() {
    if (!pleitoModal) return;
    renderPleitosOptions();
    if (inpPleitoAno) inpPleitoAno.value = activePleito.ano || "2026";
    if (inpPleitoFed) inpPleitoFed.value = activePleito.pleitoFed || "6257";
    if (inpPleitoEst) inpPleitoEst.value = activePleito.pleitoEst || "6259";
    if (inpPleitoNome) inpPleitoNome.value = activePleito.id && activePleito.id.startsWith("custom") ? activePleito.name : "";
    pleitoModal.style.display = "flex";
  }

  function closePleitoModal() {
    if (pleitoModal) pleitoModal.style.display = "none";
  }

  if (btnOpenPleitoModal) btnOpenPleitoModal.addEventListener("click", openPleitoModal);
  if (btnClosePleitoModal) btnClosePleitoModal.addEventListener("click", closePleitoModal);
  if (pleitoModal) {
    pleitoModal.addEventListener("click", (e) => {
      if (e.target === pleitoModal) closePleitoModal();
    });
  }

  if (btnToggleCustomPleito) {
    btnToggleCustomPleito.addEventListener("click", () => {
      const isHidden = customPleitoContent.style.display === "none";
      customPleitoContent.style.display = isHidden ? "block" : "none";
      if (customToggleArrow) {
        customToggleArrow.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
      }
    });
  }

  if (btnApplyCustomPleito) {
    btnApplyCustomPleito.addEventListener("click", () => {
      const ano = (inpPleitoAno.value || "2026").trim();
      const fed = (inpPleitoFed.value || "6257").trim();
      const est = (inpPleitoEst.value || "6259").trim();
      const nome = (inpPleitoNome.value || "").trim() || `Pleito Personalizado (${fed}/${est})`;

      const customObj = {
        id: `custom_${fed}_${est}`,
        name: nome,
        shortName: `${nome} (${fed}/${est})`,
        badge: "Personalizado",
        badgeClass: "secondary",
        ano: ano,
        pleitoFed: fed,
        pleitoEst: est,
        desc: `Ano: ${ano} · Federal: ${fed} · Estadual: ${est}`,
        isFake: false
      };

      selectPleito(customObj);
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

    const pleitoParams = getPleitoQueryParams();
    const qObj = {
      cargo: selectedCargo,
      uf: selectedUf || "br",
      ...pleitoParams
    };
    const query = new URLSearchParams(qObj).toString();
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
  fetchGeoSummary();
  fetchElectedData();
});
