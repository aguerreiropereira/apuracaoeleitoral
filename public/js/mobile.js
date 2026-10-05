/**
 * Mobile-First JavaScript - Apuração Eleitoral Brasil 2026
 * Otimizado para smartphones, toque ágil, PWA e persistência robusta de filtros.
 */

document.addEventListener("DOMContentLoaded", () => {
  // ========================================================
  // 1. Estado da Aplicação & Persistência de Filtros
  // ========================================================
  const STORAGE_CARGO_KEY = "tse_mobile_selected_cargo";
  const STORAGE_UF_KEY = "tse_mobile_selected_uf";
  const STORAGE_THEME_KEY = "tse_panel_theme";

  const urlParams = new URLSearchParams(window.location.search);
  
  // Persistência: URL > LocalStorage > Padrão
  let selectedCargo = urlParams.get("cargo") || localStorage.getItem(STORAGE_CARGO_KEY) || "1";
  let selectedUf = (urlParams.get("uf") || localStorage.getItem(STORAGE_UF_KEY) || (selectedCargo === "1" ? "" : "MS")).toUpperCase();
  let isFakeMode = urlParams.get("mode") === "fake";

  // Configuração e Lista de Pleitos Eleitorais
  const PRESET_PLEITOS = [
    {
      id: "2026_1t",
      name: "Eleição Geral 2026 · 1º Turno (Oficial)",
      shortName: "Eleições 2026 · 1ºT (6257/6259)",
      badge: "Oficial 1ºT",
      badgeClass: "primary",
      ano: "2026",
      pleitoFed: "6257",
      pleitoEst: "6259",
      desc: "Presidente (6257), Gov., Sen. e Dep. (6259)",
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
      desc: "Disputa de 2º Turno Pres. (6258) e Gov. (6260)",
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
      desc: "Totalização dinâmica com apuração progressiva",
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

  // Se for cargo estadual e não tiver estado selecionado, padroniza para MS
  if (selectedCargo !== "1" && (!selectedUf || selectedUf === "BR")) {
    selectedUf = "MS";
  }

  // Grava estado inicial no localStorage
  localStorage.setItem(STORAGE_CARGO_KEY, selectedCargo);
  localStorage.setItem(STORAGE_UF_KEY, selectedUf);

  let currentSnapshot = null;
  let currentCandidates = [];
  let candidateSearchText = "";
  let sseEventSource = null;
  let refreshTimer = null;

  // Lista oficial de UFs brasileiras
  const ALL_UFS = [
    { uf: "", name: "Brasil (Total Nacional)", badge: "BR" },
    { uf: "AC", name: "Acre", badge: "AC" },
    { uf: "AL", name: "Alagoas", badge: "AL" },
    { uf: "AM", name: "Amazonas", badge: "AM" },
    { uf: "AP", name: "Amapá", badge: "AP" },
    { uf: "BA", name: "Bahia", badge: "BA" },
    { uf: "CE", name: "Ceará", badge: "CE" },
    { uf: "DF", name: "Distrito Federal", badge: "DF" },
    { uf: "ES", name: "Espírito Santo", badge: "ES" },
    { uf: "GO", name: "Goiás", badge: "GO" },
    { uf: "MA", name: "Maranhão", badge: "MA" },
    { uf: "MT", name: "Mato Grosso", badge: "MT" },
    { uf: "MS", name: "Mato Grosso do Sul", badge: "MS" },
    { uf: "MG", name: "Minas Gerais", badge: "MG" },
    { uf: "PA", name: "Pará", badge: "PA" },
    { uf: "PB", name: "Paraíba", badge: "PB" },
    { uf: "PR", name: "Paraná", badge: "PR" },
    { uf: "PE", name: "Pernambuco", badge: "PE" },
    { uf: "PI", name: "Piauí", badge: "PI" },
    { uf: "RJ", name: "Rio de Janeiro", badge: "RJ" },
    { uf: "RN", name: "Rio Grande do Norte", badge: "RN" },
    { uf: "RS", name: "Rio Grande do Sul", badge: "RS" },
    { uf: "RO", name: "Rondônia", badge: "RO" },
    { uf: "RR", name: "Roraima", badge: "RR" },
    { uf: "SC", name: "Santa Catarina", badge: "SC" },
    { uf: "SP", name: "São Paulo", badge: "SP" },
    { uf: "SE", name: "Sergipe", badge: "SE" },
    { uf: "TO", name: "Tocantins", badge: "TO" }
  ];

  // Elementos do DOM
  const mCargoScroll = document.getElementById("mCargoScroll");
  const mBtnOpenUfDrawer = document.getElementById("mBtnOpenUfDrawer");
  const mCurrentUfBadge = document.getElementById("mCurrentUfBadge");
  const mCurrentUfName = document.getElementById("mCurrentUfName");
  const mBtnTheme = document.getElementById("mBtnTheme");
  const mIconSun = document.getElementById("mIconSun");
  const mIconMoon = document.getElementById("mIconMoon");
  const mBtnRefresh = document.getElementById("mBtnRefresh");
  const mIconRefresh = document.getElementById("mIconRefresh");

  // Summary Elements
  const mOfficeBadge = document.getElementById("mOfficeBadge");
  const mSummaryLocation = document.getElementById("mSummaryLocation");
  const mProcPct = document.getElementById("mProcPct");
  const mProgressFill = document.getElementById("mProgressFill");
  const mSecCount = document.getElementById("mSecCount");
  const mValidVotes = document.getElementById("mValidVotes");
  const mTotalVotes = document.getElementById("mTotalVotes");
  const mLastUpdate = document.getElementById("mLastUpdate");

  // Candidates & Search Elements
  const mSearchInput = document.getElementById("mSearchInput");
  const mBtnClearSearch = document.getElementById("mBtnClearSearch");
  const mSearchCount = document.getElementById("mSearchCount");
  const mCandidatesList = document.getElementById("mCandidatesList");
  const mModeIndicator = document.getElementById("mModeIndicator");

  // UF Drawer Elements
  const mUfDrawerOverlay = document.getElementById("mUfDrawerOverlay");
  const mBtnCloseUfDrawer = document.getElementById("mBtnCloseUfDrawer");
  const mDrawerUfSearch = document.getElementById("mDrawerUfSearch");
  const mUfList = document.getElementById("mUfList");

  // Pleito Drawer Elements
  const mBtnOpenPleitoDrawer = document.getElementById("mBtnOpenPleitoDrawer");
  const mBtnClosePleitoDrawer = document.getElementById("mBtnClosePleitoDrawer");
  const mPleitoDrawerOverlay = document.getElementById("mPleitoDrawerOverlay");
  const mPleitosOptionsList = document.getElementById("mPleitosOptionsList");
  const mPleitoSubText = document.getElementById("mPleitoSubText");
  const mBtnToggleCustomPleito = document.getElementById("mBtnToggleCustomPleito");
  const mCustomToggleArrow = document.getElementById("mCustomToggleArrow");
  const mCustomPleitoContent = document.getElementById("mCustomPleitoContent");
  const mInpPleitoAno = document.getElementById("mInpPleitoAno");
  const mInpPleitoFed = document.getElementById("mInpPleitoFed");
  const mInpPleitoEst = document.getElementById("mInpPleitoEst");
  const mInpPleitoNome = document.getElementById("mInpPleitoNome");
  const mBtnApplyCustomPleito = document.getElementById("mBtnApplyCustomPleito");

  // Candidate Performance Modal Elements
  const mCandModalOverlay = document.getElementById("mCandModalOverlay");
  const mBtnCloseCandModal = document.getElementById("mBtnCloseCandModal");
  const mModalLoading = document.getElementById("mModalLoading");
  const mModalContent = document.getElementById("mModalContent");
  const mModalOfficeScope = document.getElementById("mModalOfficeScope");
  const mModalCandName = document.getElementById("mModalCandName");
  const mModalFoto = document.getElementById("mModalFoto");
  const mModalNumero = document.getElementById("mModalNumero");
  const mModalBadgeStatus = document.getElementById("mModalBadgeStatus");
  const mModalParty = document.getElementById("mModalParty");
  const mModalFullName = document.getElementById("mModalFullName");
  const mModalColig = document.getElementById("mModalColig");
  const mModalViceRow = document.getElementById("mModalViceRow");
  const mModalVice = document.getElementById("mModalVice");
  const mModalCandPct = document.getElementById("mModalCandPct");
  const mModalCandVotes = document.getElementById("mModalCandVotes");
  const mModalBestLabel = document.getElementById("mModalBestLabel");
  const mModalBestRegion = document.getElementById("mModalBestRegion");
  const mModalCapLabel = document.getElementById("mModalCapLabel");
  const mModalCapitalVotes = document.getElementById("mModalCapitalVotes");
  const mModalRatioCard = document.getElementById("mModalRatioCard");
  const mModalRatioText = document.getElementById("mModalRatioText");
  const mModalRatioCap = document.getElementById("mModalRatioCap");
  const mModalRatioInt = document.getElementById("mModalRatioInt");
  const mModalTableTitle = document.getElementById("mModalTableTitle");
  const mModalSortChips = document.getElementById("mModalSortChips");
  const mModalSearchInput = document.getElementById("mModalSearchInput");
  const mModalRegionsList = document.getElementById("mModalRegionsList");

  // Scoreboard e Drawer de Regiões
  const mScoreboardCard = document.getElementById("mScoreboardCard");
  const mSbDot1 = document.getElementById("mSbDot1");
  const mSbName1 = document.getElementById("mSbName1");
  const mSbCount1 = document.getElementById("mSbCount1");
  const mSbBar1 = document.getElementById("mSbBar1");
  const mSbDot2 = document.getElementById("mSbDot2");
  const mSbName2 = document.getElementById("mSbName2");
  const mSbCount2 = document.getElementById("mSbCount2");
  const mSbBar2 = document.getElementById("mSbBar2");
  const mBtnOpenRegions = document.getElementById("mBtnOpenRegions");

  const mRegionsDrawerOverlay = document.getElementById("mRegionsDrawerOverlay");
  const mBtnCloseRegionsDrawer = document.getElementById("mBtnCloseRegionsDrawer");
  const mTabBtnRegs = document.getElementById("mTabBtnRegs");
  const mTabBtnUfs = document.getElementById("mTabBtnUfs");
  const mTabBtnEleitos = document.getElementById("mTabBtnEleitos");
  const mEleitosWrap = document.getElementById("mEleitosWrap");
  const mElectedOfficePills = document.getElementById("mElectedOfficePills");
  const mElectedSearchInput = document.getElementById("mElectedSearchInput");
  const mEleitosList = document.getElementById("mEleitosList");
  const mElectedSortSelect = document.getElementById("mElectedSortSelect");
  const mBtnQuickEleitos = document.getElementById("mBtnQuickEleitos");

  let mElectedData = null;
  let currentMobileElectedOffice = "all";
  let currentMobileElectedFilter = "";
  let currentMobileElectedSort = "votes_desc";
  const mRegionsList = document.getElementById("mRegionsList");
  const mStatesList = document.getElementById("mStatesList");

  let mGeoSummary = null;

  let currentModalData = null;
  let currentModalSort = "pct";
  let currentModalFilter = "";

  // ========================================================
  // 2. Registro do PWA Service Worker
  // ========================================================
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registrado com escopo:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Erro ao registrar Service Worker:", err);
        });
    });
  }

  // ========================================================
  // 3. Gerenciamento de Tema (Claro / Escuro)
  // ========================================================
  const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) || "light";
  applyTheme(savedTheme);

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_THEME_KEY, theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (theme === "dark") {
      if (mIconSun) mIconSun.style.display = "inline-block";
      if (mIconMoon) mIconMoon.style.display = "none";
      if (metaTheme) metaTheme.setAttribute("content", "#0b1120");
    } else {
      if (mIconSun) mIconSun.style.display = "none";
      if (mIconMoon) mIconMoon.style.display = "inline-block";
      if (metaTheme) metaTheme.setAttribute("content", "#009739");
    }
  }

  if (mBtnTheme) {
    mBtnTheme.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(current === "light" ? "dark" : "light");
    });
  }

  // ========================================================
  // 4. Controle Persistente de Cargo & Abrangência
  // ========================================================
  function syncCargoUI() {
    if (!mCargoScroll) return;
    mCargoScroll.querySelectorAll(".m-cargo-chip").forEach(chip => {
      chip.classList.toggle("active", chip.dataset.cargo === selectedCargo);
    });
  }

  function setCargo(newCargo) {
    selectedCargo = String(newCargo);
    localStorage.setItem(STORAGE_CARGO_KEY, selectedCargo);

    // Governador, Senador e Deputados exigem UF estadual
    if (selectedCargo !== "1" && (!selectedUf || selectedUf === "BR")) {
      const savedUf = localStorage.getItem(STORAGE_UF_KEY);
      selectedUf = (savedUf && savedUf !== "BR") ? savedUf : "MS";
      localStorage.setItem(STORAGE_UF_KEY, selectedUf);
    }

    // Atualiza parâmetros da URL sem recarregar
    syncUrlParams();
    syncCargoUI();
    updateUfDisplay();

    // Requisita imediatamente e reinicia o listener SSE no novo cargo
    fetchSnapshot();
    startSSE();
  }

  function setUf(newUf) {
    selectedUf = newUf.toUpperCase();
    localStorage.setItem(STORAGE_UF_KEY, selectedUf);

    syncUrlParams();
    updateUfDisplay();

    fetchSnapshot();
    startSSE();
  }

  function syncUrlParams() {
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("cargo", selectedCargo);
    if (selectedUf && selectedUf !== "BR") {
      newUrl.searchParams.set("uf", selectedUf);
    } else {
      newUrl.searchParams.delete("uf");
    }
    window.history.replaceState({}, "", newUrl.toString());
  }

  if (mCargoScroll) {
    mCargoScroll.querySelectorAll(".m-cargo-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        setCargo(chip.dataset.cargo);
      });
    });
  }

  function updateUfDisplay() {
    const isNational = (!selectedUf || selectedUf === "BR");
    const found = ALL_UFS.find(u => u.uf === (isNational ? "" : selectedUf));
    const ufName = found ? found.name : selectedUf;
    const badge = isNational ? "BR" : selectedUf;

    if (mCurrentUfBadge) mCurrentUfBadge.textContent = badge;
    if (mCurrentUfName) mCurrentUfName.textContent = isNational ? "Brasil (Total Nacional)" : `${ufName} (${selectedUf})`;
  }

  // ========================================================
  // 5. Drawer de Seleção de Estado (Bottom Sheet)
  // ========================================================
  function renderUfList(filterText = "") {
    if (!mUfList) return;
    const q = filterText.toLowerCase().trim();
    const isPresident = (selectedCargo === "1");

    const ufsToShow = isPresident ? ALL_UFS : ALL_UFS.filter(u => u.uf !== "");
    const filtered = ufsToShow.filter(u => 
      u.name.toLowerCase().includes(q) || u.badge.toLowerCase().includes(q)
    );

    mUfList.innerHTML = filtered.map(item => {
      const isSelected = (item.uf === selectedUf) || (!selectedUf && item.uf === "");
      return `
        <div class="m-uf-opt ${isSelected ? "selected" : ""}" data-uf="${item.uf}">
          <div class="m-uf-opt-left">
            <span class="m-uf-opt-badge">${item.badge}</span>
            <span class="m-uf-opt-name">${item.name}</span>
          </div>
          ${isSelected ? `<span class="material-symbols-outlined" style="color:var(--m-green); font-size:18px; font-weight:800;">check</span>` : ""}
        </div>
      `;
    }).join("");

    mUfList.querySelectorAll(".m-uf-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        closeUfDrawer();
        setUf(opt.dataset.uf);
      });
    });
  }

  function openUfDrawer() {
    if (!mUfDrawerOverlay) return;
    renderUfList("");
    if (mDrawerUfSearch) mDrawerUfSearch.value = "";
    mUfDrawerOverlay.style.display = "flex";
  }

  function closeUfDrawer() {
    if (!mUfDrawerOverlay) return;
    mUfDrawerOverlay.style.display = "none";
  }

  if (mBtnOpenUfDrawer) mBtnOpenUfDrawer.addEventListener("click", openUfDrawer);
  if (mBtnCloseUfDrawer) mBtnCloseUfDrawer.addEventListener("click", closeUfDrawer);
  if (mUfDrawerOverlay) {
    mUfDrawerOverlay.addEventListener("click", (e) => {
      if (e.target === mUfDrawerOverlay) closeUfDrawer();
    });
  }
  if (mDrawerUfSearch) {
    mDrawerUfSearch.addEventListener("input", (e) => {
      renderUfList(e.target.value);
    });
  }

  // ========================================================
  // 5.2 Drawer de Seleção e Configuração de Pleito
  // ========================================================
  function renderMobilePleitosOptions() {
    if (!mPleitosOptionsList) return;

    mPleitosOptionsList.innerHTML = PRESET_PLEITOS.map(p => {
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

    mPleitosOptionsList.querySelectorAll(".pleito-card-option").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        const target = PRESET_PLEITOS.find(p => p.id === id);
        if (!target) return;
        selectMobilePleito(target);
      });
    });
  }

  function selectMobilePleito(pleitoObj) {
    activePleito = pleitoObj;
    localStorage.setItem(STORAGE_PLEITO_KEY, JSON.stringify(activePleito));
    isFakeMode = pleitoObj.isFake === true;
    closePleitoDrawer();

    if (mPleitoSubText) {
      mPleitoSubText.textContent = activePleito.shortName || activePleito.name;
    }

    fetchSnapshot();
    startSSE();
    fetchGeoSummaryMobile();
    fetchMobileElectedData();
  }

  function openPleitoDrawer() {
    if (!mPleitoDrawerOverlay) return;
    renderMobilePleitosOptions();
    if (mInpPleitoAno) mInpPleitoAno.value = activePleito.ano || "2026";
    if (mInpPleitoFed) mInpPleitoFed.value = activePleito.pleitoFed || "6257";
    if (mInpPleitoEst) mInpPleitoEst.value = activePleito.pleitoEst || "6259";
    if (mInpPleitoNome) mInpPleitoNome.value = activePleito.id && activePleito.id.startsWith("custom") ? activePleito.name : "";
    mPleitoDrawerOverlay.style.display = "flex";
  }

  function closePleitoDrawer() {
    if (!mPleitoDrawerOverlay) return;
    mPleitoDrawerOverlay.style.display = "none";
  }

  if (mBtnOpenPleitoDrawer) mBtnOpenPleitoDrawer.addEventListener("click", openPleitoDrawer);
  if (mBtnClosePleitoDrawer) mBtnClosePleitoDrawer.addEventListener("click", closePleitoDrawer);
  if (mPleitoDrawerOverlay) {
    mPleitoDrawerOverlay.addEventListener("click", (e) => {
      if (e.target === mPleitoDrawerOverlay) closePleitoDrawer();
    });
  }

  if (mBtnToggleCustomPleito) {
    mBtnToggleCustomPleito.addEventListener("click", () => {
      const isHidden = mCustomPleitoContent.style.display === "none";
      mCustomPleitoContent.style.display = isHidden ? "block" : "none";
      if (mCustomToggleArrow) {
        mCustomToggleArrow.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
      }
    });
  }

  if (mBtnApplyCustomPleito) {
    mBtnApplyCustomPleito.addEventListener("click", () => {
      const ano = (mInpPleitoAno?.value || "2026").trim();
      const fed = (mInpPleitoFed?.value || "6257").trim();
      const est = (mInpPleitoEst?.value || "6259").trim();
      const nome = (mInpPleitoNome?.value || "").trim() || `Pleito Personalizado (${fed}/${est})`;

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

      selectMobilePleito(customObj);
    });
  }

  // ========================================================
  // 6. Conexão em Tempo Real & Carregamento de Dados
  // ========================================================
  async function fetchSnapshot() {
    if (mIconRefresh) mIconRefresh.classList.add("spinning");

    const targetCargo = selectedCargo;
    const targetUf = selectedUf || (selectedCargo === "1" ? "br" : "ms");
    const pleitoParams = getPleitoQueryParams();

    const query = new URLSearchParams({
      cargo: targetCargo,
      uf: targetUf,
      ...pleitoParams
    });

    try {
      const res = await fetch(`/api/state?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      // Ignora resposta desatualizada se o usuário tiver trocado de cargo
      if (String(data.officeCode || "") === String(selectedCargo) || !data.officeCode) {
        renderSnapshot(data);
      }
    } catch (err) {
      console.error("[Mobile Fetch Error]:", err);
    } finally {
      if (mIconRefresh) {
        setTimeout(() => mIconRefresh.classList.remove("spinning"), 600);
      }
    }
  }

  if (mBtnRefresh) mBtnRefresh.addEventListener("click", fetchSnapshot);

  function startSSE() {
    if (sseEventSource) {
      sseEventSource.close();
      sseEventSource = null;
    }

    const currentReqCargo = selectedCargo;
    const currentReqUf = selectedUf || (selectedCargo === "1" ? "br" : "ms");
    const pleitoParams = getPleitoQueryParams();

    const query = new URLSearchParams({
      cargo: currentReqCargo,
      uf: currentReqUf,
      ...pleitoParams
    });

    sseEventSource = new EventSource(`/api/events?${query.toString()}`);
    sseEventSource.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse(e.data);
        // Garante que evento SSE antigo não sobreponha a seleção ativa do usuário
        if (String(data.officeCode || "") === String(selectedCargo)) {
          renderSnapshot(data);
        }
      } catch (err) {
        console.error("[SSE Parse Error]:", err);
      }
    });

    sseEventSource.onerror = () => {
      if (sseEventSource) sseEventSource.close();
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        fetchSnapshot();
        startSSE();
      }, 15000);
    };
  }

  // ========================================================
  // 7. Renderização dos Dados na Tela Mobile
  // ========================================================
  function renderSnapshot(data) {
    currentSnapshot = data;
    const scopeData = data.national || {};
    currentCandidates = scopeData.candidates || [];

    // Título e Abrangência
    const officeName = data.office || getOfficeName(selectedCargo, selectedUf);
    const locationName = (!selectedUf || selectedUf === "BR") ? "Brasil" : (data.ufName || selectedUf);

    if (mOfficeBadge) mOfficeBadge.textContent = officeName;
    if (mSummaryLocation) mSummaryLocation.textContent = locationName;
    if (mModeIndicator) mModeIndicator.textContent = (data.mode === "fake" || isFakeMode || activePleito.isFake) ? "Modo Simulação" : `Oficial TSE (${data.eleicaoId || activePleito.pleitoFed || '6257'})`;
    if (mPleitoSubText) mPleitoSubText.textContent = activePleito.shortName || `${data.ano || activePleito.ano || '2026'} · Pleito ${data.eleicaoId || activePleito.pleitoFed}`;

    // Progresso de Urnas
    const pctStr = scopeData.pctSectionsDisplay || "0,00";
    const pctNum = parseFloat(pctStr.replace(",", ".")) || 0;
    if (mProcPct) mProcPct.textContent = `${pctStr}%`;
    if (mProgressFill) mProgressFill.style.width = `${Math.min(100, pctNum)}%`;

    // Métricas Resumidas
    const secProc = Number(scopeData.sectionsProcessed || 0).toLocaleString("pt-BR");
    const secTotal = Number(scopeData.totalSections || 0).toLocaleString("pt-BR");
    if (mSecCount) mSecCount.textContent = `${secProc} / ${secTotal}`;
    if (mValidVotes) mValidVotes.textContent = Number(scopeData.validVotes || 0).toLocaleString("pt-BR");
    if (mTotalVotes) mTotalVotes.textContent = Number(scopeData.totalVotes || 0).toLocaleString("pt-BR");

    const now = new Date();
    if (mLastUpdate) mLastUpdate.textContent = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    // Garante que o chip ativo corresponda exatamente ao cargo
    syncCargoUI();

    renderCandidatesFeed();
    fetchGeoSummaryMobile();
  }

  function getOfficeName(cargo, uf) {
    switch (String(cargo)) {
      case "1": return "Presidente da República";
      case "3": return "Governador";
      case "5": return "Senador";
      case "6": return "Deputado Federal";
      case "7": return (uf === "DF") ? "Deputado Distrital" : "Deputado Estadual";
      case "8": return "Deputado Distrital";
      default: return "Candidatos";
    }
  }

  // ========================================================
  // 8. Feed de Candidatos com Busca Instantânea (Deputados)
  // ========================================================
  function renderCandidatesFeed() {
    if (!mCandidatesList) return;

    let list = [...currentCandidates];

    // Filtro por texto de pesquisa
    if (candidateSearchText.trim()) {
      const q = candidateSearchText.toLowerCase();
      list = list.filter(c => {
        const text = `${c.nm} ${c.n} ${c.sg} ${c.cc || ""} ${c.nmCompleto || ""}`.toLowerCase();
        return text.includes(q);
      });
    }

    if (mSearchCount) {
      if (candidateSearchText.trim()) {
        mSearchCount.textContent = `Mostrando ${list.length} de ${currentCandidates.length} candidatos`;
      } else {
        mSearchCount.textContent = `Total: ${currentCandidates.length} candidatos concorrendo`;
      }
    }

    if (list.length === 0) {
      mCandidatesList.innerHTML = `
        <div style="text-align:center; padding: 40px 16px; color:var(--text-dim); background:var(--bg-card); border-radius:14px; border:1px solid var(--border-subtle);">
          <div class="material-symbols-outlined" style="font-size:40px; margin-bottom:8px; color:var(--text-dim);">search_off</div>
          <strong style="color:var(--text-main); font-size:14px; display:block;">Nenhum candidato localizado</strong>
          <p style="font-size:12px; margin-top:4px;">Tente pesquisar por outro nome, sigla partidária ou número de urna.</p>
        </div>
      `;
      return;
    }

    const topPct = parseFloat(String(list[0]?.pvap || "0").replace(",", ".")) || 1;

    mCandidatesList.innerHTML = list.map((cand, idx) => {
      const pctStr = cand.pvap || "0,00";
      const pctNum = parseFloat(pctStr.replace(",", ".")) || 0;
      const barWidth = Math.min(100, Math.max(3, (pctNum / Math.max(0.1, topPct)) * 100));

      const statusCls = cand.eleito ? "eleito" : (cand.st === "2º Turno" ? "turno2" : (cand.vap > 0 ? "apuracao" : "aguardando"));
      const statusText = cand.eleito ? "Eleito" : (cand.st || "Em apuração");

      const photoHtml = cand.foto
        ? `<img src="${cand.foto}" alt="${cand.nm}" class="m-avatar-img" onerror="this.onerror=null; this.src=''; this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="m-avatar-fallback" style="display:none; width:100%; height:100%; border-radius:50%; background:var(--bg-input); font-weight:800; font-size:14px; align-items:center; justify-content:center;">${cand.n}</div>`
        : `<div style="width:100%; height:100%; border-radius:50%; background:var(--bg-input); font-weight:800; font-size:14px; display:flex; align-items:center; justify-content:center;">${cand.n}</div>`;

      return `
        <article class="m-cand-card" style="--stagger-i: ${idx}" data-sqcand="${cand.sqcand || ""}" data-n="${cand.n || ""}">
          <div class="m-cand-top-row">
            <div class="m-cand-person">
              <div class="m-avatar-container">
                ${photoHtml}
                <span class="m-number-pill" style="background:${cand.cor || "var(--m-blue)"}">${cand.n}</span>
              </div>
              <div class="m-cand-meta">
                <strong class="m-cand-name">${cand.nm}</strong>
                <span class="m-cand-party">${cand.sg}${cand.cc ? ` · ${cand.cc}` : ""}</span>
              </div>
            </div>
            <div class="m-cand-score">
              <span class="m-score-pct">${pctStr}%</span>
              <div class="m-score-votes">${Number(cand.vap || 0).toLocaleString("pt-BR")} votos</div>
            </div>
          </div>

          <div class="m-cand-bar-wrap">
            <div class="m-cand-bar-fill" style="width: ${barWidth}%; background: ${cand.cor || "var(--m-green)"}"></div>
          </div>

          <div class="m-cand-bottom-row">
            <span class="cand-badge-status ${statusCls}">${statusText}</span>
            <span class="m-cand-detail-hint">
              <span class="material-symbols-outlined" style="font-size:15px; vertical-align:middle;">analytics</span>
              Ver Desempenho
            </span>
          </div>
        </article>
      `;
    }).join("");

    mCandidatesList.querySelectorAll(".m-cand-card").forEach(card => {
      card.addEventListener("click", () => {
        const sqcand = card.dataset.sqcand;
        const n = card.dataset.n;
        openCandidateModal(sqcand, n);
      });
    });
  }

  // Busca de Candidatos
  if (mSearchInput) {
    mSearchInput.addEventListener("input", (e) => {
      candidateSearchText = e.target.value;
      if (mBtnClearSearch) mBtnClearSearch.style.display = candidateSearchText ? "block" : "none";
      renderCandidatesFeed();
    });
  }

  if (mBtnClearSearch) {
    mBtnClearSearch.addEventListener("click", () => {
      candidateSearchText = "";
      mSearchInput.value = "";
      mBtnClearSearch.style.display = "none";
      renderCandidatesFeed();
    });
  }

  // ========================================================
  // 9. Modal / Bottom Sheet de Desempenho do Candidato
  // ========================================================
  function openCandidateModal(sqcand, n) {
    if (!mCandModalOverlay) return;

    mCandModalOverlay.style.display = "flex";
    mModalLoading.style.display = "flex";
    mModalContent.style.display = "none";
    if (mModalSearchInput) mModalSearchInput.value = "";
    currentModalFilter = "";
    currentModalSort = "pct";

    const pleitoParams = getPleitoQueryParams();
    const query = new URLSearchParams({
      cargo: selectedCargo,
      uf: selectedUf || (selectedCargo === "1" ? "br" : "ms"),
      sqcand: sqcand || "",
      n: n || "",
      ...pleitoParams
    });

    fetch(`/api/candidate-performance?${query.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (!data.ok) throw new Error(data.error || "Erro ao consultar desempenho");
        currentModalData = data;
        renderModalPerformance(data);
      })
      .catch(err => {
        mModalLoading.innerHTML = `
          <div style="color:#ef4444; font-weight:800;">Falha ao carregar dados do TSE.</div>
          <div style="font-size:11px; color:var(--text-dim); margin-top:4px;">${err.message}</div>
        `;
      });
  }

  function closeCandidateModal() {
    if (!mCandModalOverlay) return;
    mCandModalOverlay.style.display = "none";
  }

  if (mBtnCloseCandModal) mBtnCloseCandModal.addEventListener("click", closeCandidateModal);
  if (mCandModalOverlay) {
    mCandModalOverlay.addEventListener("click", (e) => {
      if (e.target === mCandModalOverlay) closeCandidateModal();
    });
  }

  function renderModalPerformance(data) {
    const cand = data.candidate;
    const isPresident = (data.scope === "national");

    if (mModalOfficeScope) mModalOfficeScope.textContent = `${data.cargoNome} · ${data.scopeNome}`;
    if (mModalCandName) mModalCandName.textContent = cand.nm;
    if (mModalFullName) mModalFullName.textContent = cand.nmCompleto || cand.nm;
    if (mModalParty) mModalParty.textContent = `${cand.n} · ${cand.sg}`;
    if (mModalColig) mModalColig.textContent = cand.cc || cand.sg;

    if (cand.foto) {
      mModalFoto.src = cand.foto;
      mModalFoto.style.display = "block";
      mModalNumero.style.display = "none";
    } else {
      mModalFoto.style.display = "none";
      mModalNumero.textContent = cand.n;
      mModalNumero.style.display = "block";
    }

    mModalBadgeStatus.textContent = cand.eleito ? "Eleito" : (cand.st || "Em apuração");
    mModalBadgeStatus.className = "cand-badge-status " + (cand.eleito ? "eleito" : (cand.st === "2º Turno" ? "turno2" : "apuracao"));

    if (cand.vice) {
      mModalVice.textContent = cand.vice;
      mModalViceRow.style.display = "block";
    } else {
      mModalViceRow.style.display = "none";
    }

    if (mModalCandPct) mModalCandPct.textContent = `${cand.pvap}%`;
    if (mModalCandVotes) mModalCandVotes.textContent = Number(cand.vap).toLocaleString("pt-BR");

    if (isPresident) {
      mModalBestLabel.textContent = "Melhor Estado";
      mModalBestRegion.textContent = data.summary.bestState || "-";
      mModalCapLabel.textContent = "Estados que Lidera";
      mModalCapitalVotes.textContent = `${data.summary.leadingStatesCount} de 27 UFs`;
      mModalTableTitle.textContent = "Votação nos 27 Estados e Capitais";
    } else {
      mModalBestLabel.textContent = "Melhor Cidade";
      mModalBestRegion.textContent = data.summary.bestCity || "-";
      mModalCapLabel.textContent = "Votos na Capital";
      mModalCapitalVotes.textContent = data.summary.capitalResult || "-";
      mModalTableTitle.textContent = `Votação nos Municípios de ${data.uf}`;
    }

    // Proporção Capital vs Interior
    if (data.summary.capitalVsInterior) {
      mModalRatioCard.style.display = "flex";
      const capPct = parseFloat(data.summary.capitalVsInterior.capitalPct) || 50;
      const intPct = 100 - capPct;
      mModalRatioCap.style.width = `${capPct}%`;
      mModalRatioInt.style.width = `${intPct}%`;
      mModalRatioText.textContent = `Capital: ${data.summary.capitalVsInterior.capitalPct} (${Number(data.summary.capitalVsInterior.capitalVotes).toLocaleString("pt-BR")}) · Interior: ${data.summary.capitalVsInterior.interiorPct} (${Number(data.summary.capitalVsInterior.interiorVotes).toLocaleString("pt-BR")})`;
    } else {
      mModalRatioCard.style.display = "none";
    }

    mModalLoading.style.display = "none";
    mModalContent.style.display = "flex";

    renderModalRegionsList();
  }

  function renderModalRegionsList() {
    if (!currentModalData || !mModalRegionsList) return;
    const isPresident = (currentModalData.scope === "national");
    let items = [...(currentModalData.items || [])];

    // Filtro por texto
    if (currentModalFilter.trim()) {
      const q = currentModalFilter.toLowerCase();
      items = items.filter(it => {
        const text = `${it.stateName || it.name || ""} ${it.uf || ""} ${it.capitalName || ""}`.toLowerCase();
        return text.includes(q);
      });
    }

    // Ordenação
    if (currentModalSort === "pct") {
      items.sort((a, b) => (b.pctNum || 0) - (a.pctNum || 0));
    } else if (currentModalSort === "votes") {
      items.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    } else if (currentModalSort === "alpha") {
      items.sort((a, b) => (a.stateName || a.name || "").localeCompare(b.stateName || b.name || ""));
    }

    mModalRegionsList.innerHTML = items.map(item => {
      const rankBadge = item.rank === 1 ? `<span class="m-rank-badge rank-1">1º</span>` : (item.rank === 2 ? `<span class="m-rank-badge rank-2">2º</span>` : `<span class="m-rank-badge">${item.rank}</span>`);

      if (isPresident) {
        return `
          <div class="m-reg-row">
            <div class="m-reg-left">
              ${rankBadge}
              <div>
                <strong class="m-reg-name">${item.stateName} (${item.uf})</strong>
                <div class="m-reg-sub">Capital: ${item.capitalName} (${item.capitalPct}% · ${Number(item.capitalVotes).toLocaleString("pt-BR")})</div>
              </div>
            </div>
            <div class="m-reg-right">
              <div class="m-reg-pct">${item.pct}%</div>
              <div class="m-reg-votes">${Number(item.votes).toLocaleString("pt-BR")} votos</div>
            </div>
          </div>
        `;
      } else {
        const capTag = item.isCapital ? `<span style="color:var(--m-green); font-size:9px; font-weight:800; text-transform:uppercase;">[Capital] </span>` : "";
        return `
          <div class="m-reg-row">
            <div class="m-reg-left">
              ${rankBadge}
              <div>
                <strong class="m-reg-name">${capTag}${item.name}</strong>
                <div class="m-reg-sub">Eleitorado: ${Number(item.electorate || 0).toLocaleString("pt-BR")}</div>
              </div>
            </div>
            <div class="m-reg-right">
              <div class="m-reg-pct">${item.pct}%</div>
              <div class="m-reg-votes">${Number(item.votes).toLocaleString("pt-BR")} votos</div>
            </div>
          </div>
        `;
      }
    }).join("");
  }

  if (mModalSearchInput) {
    mModalSearchInput.addEventListener("input", (e) => {
      currentModalFilter = e.target.value;
      renderModalRegionsList();
    });
  }

  if (mModalSortChips) {
    mModalSortChips.querySelectorAll(".m-sort-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        mModalSortChips.querySelectorAll(".m-sort-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentModalSort = chip.dataset.sort;
        renderModalRegionsList();
      });
    });
  }

  // ========================================================
  // 9.2 Apuração Territorial Mobile (Regiões e Estados)
  // ========================================================
  function renderMobileScoreboard() {
    if (!mScoreboardCard) return;
    if (selectedCargo !== "1" || !mGeoSummary || !mGeoSummary.topTwo || mGeoSummary.topTwo.length < 2) {
      mScoreboardCard.style.display = "none";
      return;
    }

    const c1 = mGeoSummary.topTwo[0];
    const c2 = mGeoSummary.topTwo[1];

    if (mSbDot1) mSbDot1.style.background = c1.cor || "#1f4fbf";
    if (mSbName1) mSbName1.textContent = `${c1.nm} (${c1.sg})`;
    if (mSbCount1) mSbCount1.textContent = `${c1.statesCount} ${c1.statesCount === 1 ? 'estado' : 'estados'}`;

    if (mSbDot2) mSbDot2.style.background = c2.cor || "#c8202f";
    if (mSbName2) mSbName2.textContent = `${c2.nm} (${c2.sg})`;
    if (mSbCount2) mSbCount2.textContent = `${c2.statesCount} ${c2.statesCount === 1 ? 'estado' : 'estados'}`;

    const totalWon = (c1.statesCount + c2.statesCount) || 1;
    const pct1 = Math.round((c1.statesCount / totalWon) * 100);
    const pct2 = 100 - pct1;

    if (mSbBar1) {
      mSbBar1.style.width = `${pct1}%`;
      mSbBar1.style.background = c1.cor || "#1f4fbf";
    }
    if (mSbBar2) {
      mSbBar2.style.width = `${pct2}%`;
      mSbBar2.style.background = c2.cor || "#c8202f";
    }

    mScoreboardCard.style.display = "block";
  }

  function renderMobileRegionsDrawer() {
    if (!mRegionsList || !mGeoSummary?.regions) return;

    mRegionsList.innerHTML = mGeoSummary.regions.map(r => {
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
        const ufState = mGeoSummary.states?.[uf];
        const dotColor = ufState?.leader?.cor || '#94a3b8';
        const isCurrent = (selectedUf === uf);
        return `
          <button class="state-chip ${isCurrent ? 'selected' : ''}" data-uf="${uf}">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${dotColor}; margin-right:3px;"></span>${uf}
          </button>
        `;
      }).join("");

      return `
        <div class="region-card">
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

    mRegionsList.querySelectorAll(".state-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        setUf(chip.dataset.uf);
        closeRegionsDrawer();
      });
    });

    if (mStatesList && mGeoSummary.statesList) {
      const sorted = [...mGeoSummary.statesList].sort((a, b) => b.secPctNum - a.secPctNum);
      mStatesList.innerHTML = sorted.map(s => {
        const isSelected = (selectedUf === s.uf);
        const dotColor = s.leader?.cor || "#94a3b8";
        const leaderName = s.leader ? `${s.leader.nm} (${s.leader.sg})` : "Aguardando";
        const leaderPct = s.leader ? `${s.leader.pvap}%` : "0,00%";

        return `
          <div class="state-item-row ${isSelected ? 'selected' : ''}" data-uf="${s.uf}">
            <div class="state-item-left">
              <span class="state-item-badge" style="background:${dotColor}">${s.uf}</span>
              <div>
                <div class="state-item-name">${s.name}</div>
                <div class="state-item-sec">${s.region} · ${s.secPct}% apurado</div>
              </div>
            </div>
            <div class="state-item-right">
              <div>
                <div style="font-size:11px; font-weight:700; color:var(--text-main);">${leaderName}</div>
                <div class="state-item-leader-pct" style="color:${dotColor}">${leaderPct}</div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      mStatesList.querySelectorAll(".state-item-row").forEach(row => {
        row.addEventListener("click", () => {
          setUf(row.dataset.uf);
          closeRegionsDrawer();
        });
      });
    }
  }

  function openRegionsDrawer() {
    if (mRegionsDrawerOverlay) {
      mRegionsDrawerOverlay.style.display = "flex";
      renderMobileRegionsDrawer();
    }
  }

  function closeRegionsDrawer() {
    if (mRegionsDrawerOverlay) {
      mRegionsDrawerOverlay.style.display = "none";
    }
  }

  if (mBtnOpenRegions) mBtnOpenRegions.addEventListener("click", openRegionsDrawer);
  if (mBtnCloseRegionsDrawer) mBtnCloseRegionsDrawer.addEventListener("click", closeRegionsDrawer);
  if (mRegionsDrawerOverlay) {
    mRegionsDrawerOverlay.addEventListener("click", (e) => {
      if (e.target === mRegionsDrawerOverlay) closeRegionsDrawer();
    });
  }

  if (mTabBtnRegs && mTabBtnUfs) {
    mTabBtnRegs.addEventListener("click", () => {
      mTabBtnRegs.classList.add("active");
      mTabBtnUfs.classList.remove("active");
      if (mTabBtnEleitos) mTabBtnEleitos.classList.remove("active");
      mRegionsList.style.display = "flex";
      mStatesList.style.display = "none";
      if (mEleitosWrap) mEleitosWrap.style.display = "none";
    });
    mTabBtnUfs.addEventListener("click", () => {
      mTabBtnUfs.classList.add("active");
      mTabBtnRegs.classList.remove("active");
      if (mTabBtnEleitos) mTabBtnEleitos.classList.remove("active");
      mRegionsList.style.display = "none";
      mStatesList.style.display = "flex";
      if (mEleitosWrap) mEleitosWrap.style.display = "none";
    });
    if (mTabBtnEleitos) {
      mTabBtnEleitos.addEventListener("click", () => {
        mTabBtnEleitos.classList.add("active");
        mTabBtnRegs.classList.remove("active");
        mTabBtnUfs.classList.remove("active");
        mRegionsList.style.display = "none";
        mStatesList.style.display = "none";
        if (mEleitosWrap) {
          mEleitosWrap.style.display = "flex";
          renderMobileEleitosList();
        }
      });
    }
  }

  if (mBtnQuickEleitos) {
    mBtnQuickEleitos.addEventListener("click", () => {
      openRegionsDrawer();
      if (mTabBtnEleitos) {
        mTabBtnEleitos.click();
      }
    });
  }

  if (mElectedOfficePills) {
    mElectedOfficePills.querySelectorAll(".elected-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        mElectedOfficePills.querySelectorAll(".elected-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        currentMobileElectedOffice = pill.dataset.office || "all";
        renderMobileEleitosList();
      });
    });
  }

  if (mElectedSearchInput) {
    mElectedSearchInput.addEventListener("input", (e) => {
      currentMobileElectedFilter = e.target.value;
      renderMobileEleitosList();
    });
  }

  if (mElectedSortSelect) {
    mElectedSortSelect.addEventListener("change", (e) => {
      currentMobileElectedSort = e.target.value || "votes_desc";
      renderMobileEleitosList();
    });
  }

  function sortMobileElectedList(list, sortMode) {
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

  function mNormStr(str) {
    return (str || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  async function fetchMobileElectedData() {
    try {
      const pleitoParams = getPleitoQueryParams();
      const q = new URLSearchParams(pleitoParams).toString();

      const res = await fetch(`/api/elected?${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.ok) {
        mElectedData = data;
        renderMobileEleitosList();
      }
    } catch (err) {
      console.warn("Falha no fetchMobileElectedData:", err);
    }
  }

  function renderMobileEleitosList() {
    if (!mEleitosList || !mElectedData) return;
    let list = [];

    if (currentMobileElectedOffice === "all" || currentMobileElectedOffice === "pres") {
      if (mElectedData.president?.winner) {
        const p = mElectedData.president.winner;
        list.push({
          office: "Presidente",
          scope: "Brasil",
          name: p.nmCompleto || p.nm,
          party: p.sg,
          n: p.n,
          votes: p.vap,
          pct: p.pvap,
          status: mElectedData.president.status || "Eleito",
          cor: p.cor || "var(--m-green)",
          uf: "BR"
        });
      }
    }

    if (currentMobileElectedOffice === "all" || currentMobileElectedOffice === "gov") {
      (mElectedData.governors || []).forEach(g => {
        list.push({
          office: "Governador",
          scope: g.uf,
          name: g.name,
          party: g.party,
          votes: g.votes,
          pct: g.pct,
          status: g.status || "Eleito",
          cor: g.cor || "var(--m-blue)",
          uf: g.uf
        });
      });
    }

    if (currentMobileElectedOffice === "all" || currentMobileElectedOffice === "sen") {
      (mElectedData.senators || []).forEach(s => {
        list.push({
          office: "Senador",
          scope: s.uf,
          name: s.name,
          party: s.party,
          votes: s.votes,
          pct: s.pct,
          status: s.status || "Eleito",
          cor: s.cor || "var(--m-blue)",
          uf: s.uf
        });
      });
    }

    if (currentMobileElectedOffice === "all" || currentMobileElectedOffice === "dep") {
      (mElectedData.deputiesFederal || []).forEach(d => {
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
          uf: d.uf
        });
      });
    }

    if (currentMobileElectedFilter.trim()) {
      const q = mNormStr(currentMobileElectedFilter);
      list = list.filter(item => 
        mNormStr(item.name).includes(q) ||
        mNormStr(item.party).includes(q) ||
        mNormStr(item.scope).includes(q) ||
        mNormStr(item.uf).includes(q) ||
        mNormStr(item.office).includes(q)
      );
    }

    // Ordenação dinâmica
    list = sortMobileElectedList(list, currentMobileElectedSort);

    if (list.length === 0) {
      mEleitosList.innerHTML = `
        <div style="text-align:center; padding:30px 10px; color:var(--text-dim); font-size:12px;">
          Nenhum eleito encontrado para o filtro selecionado.
        </div>
      `;
      return;
    }

    mEleitosList.innerHTML = list.map((item, idx) => {
      const votesFmt = item.votes ? Number(item.votes).toLocaleString("pt-BR") : "";
      const rankClass = idx === 0 ? "rank-1" : (idx === 1 ? "rank-2" : (idx === 2 ? "rank-3" : ""));
      return `
        <div class="m-elected-card" style="--stagger-i: ${idx}">
          <div class="m-elected-left">
            <span class="elected-rank-badge ${rankClass}" style="margin-right:2px;">#${idx + 1}</span>
            <span class="m-elected-avatar-badge" style="background:${item.cor}">${item.scope || item.uf || "BR"}</span>
            <div class="m-elected-info">
              <strong class="m-elected-name">${item.name}</strong>
              <div class="m-elected-meta">
                <span>${item.office}</span>
                <span>·</span>
                <strong>${item.party}</strong>
              </div>
            </div>
          </div>
          <div class="m-elected-right">
            <div class="m-elected-pct">${item.pct}%</div>
            ${votesFmt ? `<div class="m-elected-votes">${votesFmt} votos</div>` : ""}
            <span class="status-pill-elected" style="font-size:8px; padding:1px 4px;">
              <span class="material-symbols-outlined" style="font-size:9px;">check</span>
              ${item.status}
            </span>
          </div>
        </div>
      `;
    }).join("");
  }

  let mGeoFetchInProgress = false;
  function fetchGeoSummaryMobile() {
    if (mGeoFetchInProgress) return;
    mGeoFetchInProgress = true;
    const pleitoParams = getPleitoQueryParams();
    const query = new URLSearchParams(pleitoParams).toString();
    fetch(`/api/geo-summary?${query}`)
      .then(res => res.json())
      .then(data => {
        mGeoFetchInProgress = false;
        if (!data || !data.ok) return;
        mGeoSummary = data;
        renderMobileScoreboard();
      })
      .catch(err => {
        mGeoFetchInProgress = false;
        console.warn("Falha no geo-summary mobile:", err);
      });
  }

  // ========================================================
  // 10. Inicialização
  // ========================================================
  if (mPleitoSubText) {
    mPleitoSubText.textContent = activePleito.shortName || activePleito.name;
  }
  syncCargoUI();
  updateUfDisplay();
  fetchSnapshot();
  fetchGeoSummaryMobile();
  fetchMobileElectedData();
  startSSE();
});
