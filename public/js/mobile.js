/**
 * Mobile-First JavaScript - Apuração Eleitoral Brasil 2026
 * Otimizado para smartphones, toque ágil e renderização fluida de Deputados.
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Estado da Aplicação
  const urlParams = new URLSearchParams(window.location.search);
  let selectedCargo = urlParams.get("cargo") || "1";
  let selectedUf = (urlParams.get("uf") || (selectedCargo === "1" ? "" : "MS")).toUpperCase();
  const isFakeMode = urlParams.get("mode") === "fake";
  
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
  const mUfDrawerSheet = document.getElementById("mUfDrawerSheet");
  const mBtnCloseUfDrawer = document.getElementById("mBtnCloseUfDrawer");
  const mDrawerUfSearch = document.getElementById("mDrawerUfSearch");
  const mUfList = document.getElementById("mUfList");

  // Candidate Performance Modal Elements
  const mCandModalOverlay = document.getElementById("mCandModalOverlay");
  const mCandModalSheet = document.getElementById("mCandModalSheet");
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

  let currentModalData = null;
  let currentModalSort = "pct";
  let currentModalFilter = "";

  // ========================================================
  // 2. Gerenciamento de Tema (Claro / Escuro)
  // ========================================================
  const savedTheme = localStorage.getItem("tse_panel_theme") || "light";
  applyTheme(savedTheme);

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tse_panel_theme", theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (theme === "dark") {
      mIconSun.style.display = "inline-block";
      mIconMoon.style.display = "none";
      if (metaTheme) metaTheme.setAttribute("content", "#0b1120");
    } else {
      mIconSun.style.display = "none";
      mIconMoon.style.display = "inline-block";
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
  // 3. Controle de Seleção de Cargo & UF
  // ========================================================
  if (mCargoScroll) {
    mCargoScroll.querySelectorAll(".m-cargo-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        mCargoScroll.querySelectorAll(".m-cargo-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        selectedCargo = chip.dataset.cargo;

        // Se for cargo estadual e UF for Brasil, define para MS ou estado anterior
        if (selectedCargo !== "1" && (!selectedUf || selectedUf === "BR")) {
          selectedUf = "MS";
        }

        updateUfDisplay();
        fetchSnapshot();
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
  // 4. Drawer de Seleção de Estado (Bottom Sheet)
  // ========================================================
  function renderUfList(filterText = "") {
    if (!mUfList) return;
    const q = filterText.toLowerCase().trim();
    const isPresident = selectedCargo === "1";

    // Para presidente, pode selecionar 'Brasil'; para cargos estaduais, apenas estados
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
          ${isSelected ? `<span style="color:var(--m-green); font-weight:800;">✓</span>` : ""}
        </div>
      `;
    }).join("");

    mUfList.querySelectorAll(".m-uf-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        selectedUf = opt.dataset.uf;
        closeUfDrawer();
        updateUfDisplay();
        fetchSnapshot();
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
    if (mUfDrawerOverlay) mUfDrawerOverlay.style.display = "none";
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
  // 5. Conexão em Tempo Real & Carregamento de Dados
  // ========================================================
  async function fetchSnapshot() {
    if (mIconRefresh) mIconRefresh.classList.add("spinning");

    const query = new URLSearchParams({
      cargo: selectedCargo,
      uf: selectedUf || (selectedCargo === "1" ? "br" : "sp")
    });
    if (isFakeMode) query.set("mode", "fake");

    try {
      const res = await fetch(`/api/state?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderSnapshot(data);
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

    const query = new URLSearchParams({
      cargo: selectedCargo,
      uf: selectedUf || (selectedCargo === "1" ? "br" : "sp")
    });
    if (isFakeMode) query.set("mode", "fake");

    sseEventSource = new EventSource(`/api/events?${query.toString()}`);
    sseEventSource.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse(e.data);
        renderSnapshot(data);
      } catch (err) {
        console.error("[SSE Parse Error]:", err);
      }
    });

    sseEventSource.onerror = () => {
      if (sseEventSource) sseEventSource.close();
      // Reconexão / polling a cada 15 segundos
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(fetchSnapshot, 15000);
    };
  }

  // ========================================================
  // 6. Renderização dos Dados na Tela Mobile
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
    if (mModeIndicator) mModeIndicator.textContent = data.mode === "fake" ? "Modo Simulação" : "Oficial TSE";

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

    renderCandidatesFeed();
  }

  function getOfficeName(cargo, uf) {
    switch (String(cargo)) {
      case "1": return "Presidente da República";
      case "3": return "Governador";
      case "5": return "Senador";
      case "6": return "Deputado Federal";
      case "7": return uf === "DF" ? "Deputado Distrital" : "Deputado Estadual";
      case "8": return "Deputado Distrital";
      default: return "Candidatos";
    }
  }

  // ========================================================
  // 7. Feed de Candidatos com Busca em Tempo Real (Deputados)
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
          <div style="font-size:32px; margin-bottom:8px;">🔍</div>
          <strong style="color:var(--text-main); font-size:14px;">Nenhum candidato localizado</strong>
          <p style="font-size:12px; margin-top:4px;">Tente pesquisar por outro nome, sigla ou número de urna.</p>
        </div>
      `;
      return;
    }

    // Calcula o percentual máximo para barras proporcionais
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
        <article class="m-cand-card" data-sqcand="${cand.sqcand || ""}" data-n="${cand.n || ""}">
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
            <span class="m-cand-detail-hint">Ver Desempenho 📊</span>
          </div>
        </article>
      `;
    }).join("");

    // Adiciona listener para abrir o modal de desempenho detalhado
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
  // 8. Modal / Bottom Sheet de Desempenho do Candidato
  // ========================================================
  function openCandidateModal(sqcand, n) {
    if (!mCandModalOverlay) return;

    mCandModalOverlay.style.display = "flex";
    mModalLoading.style.display = "flex";
    mModalContent.style.display = "none";
    if (mModalSearchInput) mModalSearchInput.value = "";
    currentModalFilter = "";
    currentModalSort = "pct";

    const query = new URLSearchParams({
      cargo: selectedCargo,
      uf: selectedUf || (selectedCargo === "1" ? "br" : "sp"),
      sqcand: sqcand || "",
      n: n || ""
    });
    if (isFakeMode) query.set("mode", "fake");

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
    if (mCandModalOverlay) mCandModalOverlay.style.display = "none";
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
  // 9. Inicialização
  // ========================================================
  // Ativa o chip de cargo correto
  if (mCargoScroll) {
    mCargoScroll.querySelectorAll(".m-cargo-chip").forEach(c => {
      c.classList.toggle("active", c.dataset.cargo === selectedCargo);
    });
  }

  updateUfDisplay();
  fetchSnapshot();
  startSSE();
});
