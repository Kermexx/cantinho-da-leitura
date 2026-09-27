let DADOS = null;
let ANO_ATUAL = null;

async function iniciar() {
  try {
    DADOS = await carregarDadosPublicados();
  } catch (e) {
    document.getElementById("quote-text").textContent = "Não consegui carregar os dados (data/books.json).";
    console.error(e);
    return;
  }

  if (DADOS.meta?.quote?.text) {
    document.getElementById("quote-text").textContent = `"${DADOS.meta.quote.text}"`;
    document.getElementById("quote-author").textContent = DADOS.meta.quote.author || "";
  } else {
    document.getElementById("quote").style.display = "none";
  }

  renderLeituraAtual();
  renderProximaLeitura();
  renderListasSemAno();

  const anos = anosDisponiveis(DADOS);
  ANO_ATUAL = anos.find((a) => (DADOS.read || []).some((b) => anoDe(b.finishedAt) === a)) || anos[0];
  renderYearTabs(anos);
  renderAno(ANO_ATUAL);
}

function renderLeituraAtual() {
  const cr = DADOS.currentlyReading || {};
  document.getElementById("reading-title").textContent = cr.title || "Nada no momento";
  document.getElementById("reading-author").textContent = cr.author || "";
  document.getElementById("reading-cover").innerHTML = coverTileHtml(cr.title || "?", cr.cover);
  const pr = Number(cr.pagesRead) || 0;
  const tot = Number(cr.totalPages) || 0;
  const pct = tot > 0 ? Math.min(100, Math.round((pr / tot) * 100)) : 0;
  document.getElementById("reading-progress-fill").style.width = pct + "%";
  document.getElementById("reading-progress-label").textContent = tot > 0
    ? `${pr} / ${tot} páginas · ${pct}%`
    : "";
}

function renderProximaLeitura() {
  const nx = DADOS.nextUp || {};
  document.getElementById("next-up").textContent = nx.title
    ? `${nx.title}${nx.author ? " — " + nx.author : ""}`
    : "ainda não decidi";
}

function renderYearTabs(anos) {
  const el = document.getElementById("year-tabs");
  el.innerHTML = "";
  anos.forEach((ano) => {
    const b = document.createElement("button");
    b.className = "year-tab" + (ano === ANO_ATUAL ? " active" : "");
    b.textContent = ano;
    b.onclick = () => {
      if (ano === ANO_ATUAL) return;
      ANO_ATUAL = ano;
      [...el.children].forEach((c) => c.classList.remove("active"));
      b.classList.add("active");
      renderAno(ano);
    };
    el.appendChild(b);
  });
}

function trocarComFade(ids, atualizar) {
  const els = ids.map((id) => document.getElementById(id));
  els.forEach((el) => el.classList.add("fading"));
  setTimeout(() => {
    atualizar();
    els.forEach((el) => el.classList.remove("fading"));
  }, 160);
}

function renderAno(ano) {
  const lidosDoAno = (DADOS.read || []).filter((b) => anoDe(b.finishedAt) === ano);
  const abandonadosDoAno = (DADOS.abandoned || []).filter((b) => anoDe(b.when) === ano);

  trocarComFade(["stats-grid", "read-grid", "charts-grid", "abandoned-list"], () => {
    renderStats(lidosDoAno);
    renderReadGrid(lidosDoAno);
    renderCharts(lidosDoAno);
    renderAbandonedList(abandonadosDoAno);
  });
}

function renderStats(lidos) {
  const livros = lidos.length;
  const paginas = lidos.reduce((s, b) => s + (Number(b.pages) || 0), 0);
  const comNota = lidos.filter((b) => Number(b.rating) > 0);
  const notaMedia = comNota.length ? (comNota.reduce((s, b) => s + Number(b.rating), 0) / comNota.length) : 0;
  const nacionais = lidos.filter((b) => b.national).length;
  const pctNacional = livros ? Math.round((nacionais / livros) * 100) : 0;

  document.getElementById("avg-rating").innerHTML = notaMedia
    ? `${starIconsHtml(Math.round(notaMedia))} <span style="color:var(--ink-muted);font-size:12.5px;">(${notaMedia.toFixed(1)})</span>`
    : "—";

  const grid = document.getElementById("stats-grid");
  grid.innerHTML = "";
  const tiles = [
    { num: livros, lbl: "livros lidos" },
    { num: paginas.toLocaleString("pt-BR"), lbl: "páginas lidas" },
    { num: notaMedia ? notaMedia.toFixed(1) : "—", lbl: "nota média" },
    { num: pctNacional + "%", lbl: "autoria nacional" }
  ];
  tiles.forEach((t) => {
    const d = document.createElement("div");
    d.className = "card stat-tile";
    d.innerHTML = `<div class="num">${t.num}</div><div class="lbl">${t.lbl}</div>`;
    grid.appendChild(d);
  });
}

function renderReadGrid(lidos) {
  document.getElementById("read-count").textContent = lidos.length ? `${lidos.length}` : "";
  const grid = document.getElementById("read-grid");
  if (!lidos.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Nenhum livro lido ainda neste ano.</div>`;
    return;
  }
  const ordenados = [...lidos].sort((a, b) => String(b.finishedAt || "").localeCompare(String(a.finishedAt || "")));
  grid.innerHTML = ordenados.map((b, i) => `
    <div class="book-card" style="animation-delay:${Math.min(i, 14) * 35}ms">
      <div class="cover-wrap">${coverTileHtml(b.title, b.cover)}</div>
      <div class="info">
        <div class="title">${escapeHtml(b.title)}</div>
        <div class="author">${escapeHtml(b.author)}</div>
        ${starIconsHtml(b.rating)}
        <div class="meta-row">
          ${b.pages ? `<span class="tag">${b.pages} pág.</span>` : ""}
          ${b.national === true ? `<span class="tag">Nacional</span>` : ""}
          ${b.national === false ? `<span class="tag">Estrangeiro</span>` : ""}
          ${b.language ? `<span class="tag">${escapeHtml(b.language)}</span>` : ""}
        </div>
      </div>
    </div>
  `).join("");
}

function renderAbandonedList(lista) {
  document.getElementById("abandoned-count").textContent = lista.length ? `${lista.length}` : "";
  const el = document.getElementById("abandoned-list");
  if (!lista.length) { el.innerHTML = `<div class="empty-state">Nenhum livro abandonado neste ano.</div>`; return; }
  el.innerHTML = lista.map((b, i) => `
    <div class="simple-row" style="animation-delay:${i * 35}ms">
      <div><div class="title">${escapeHtml(b.title)}</div><div class="author">${escapeHtml(b.author || "")}</div></div>
      <div class="when">${escapeHtml(formatarDataParcial(b.when))}</div>
    </div>
  `).join("");
}

function renderListasSemAno() {
  const want = DADOS.wantToRead || [];
  const wantEl = document.getElementById("want-list");
  wantEl.innerHTML = want.length ? want.map((b, i) => `
    <div class="simple-row" style="animation-delay:${i * 35}ms">
      <div class="title">${escapeHtml(b.title)}</div>
      <div class="when">${escapeHtml(b.when || "")}</div>
    </div>
  `).join("") : `<div class="empty-state">Nada na lista ainda.</div>`;

  const wish = DADOS.wishlist || [];
  const wishEl = document.getElementById("wishlist-list");
  wishEl.innerHTML = wish.length ? wish.map((b, i) => `
    <div class="simple-row" style="animation-delay:${i * 35}ms">
      <div><div class="title">${escapeHtml(b.title)}</div><div class="author">${escapeHtml(b.author || "")}</div></div>
    </div>
  `).join("") : `<div class="empty-state">Nada na lista ainda.</div>`;
}

/* ---- Gráficos (SVG simples, sem dependências) ---- */

function roundedTopBarPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h));
  if (h <= 0) return "";
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

function renderBarChart(containerEl, items) {
  const W = 320, H = 130, padL = 4, padR = 4, padT = 18, padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(1, ...items.map((i) => i.value));
  const gap = 3;
  const barW = plotW / items.length - gap;
  const peakIdx = items.reduce((best, it, i) => it.value > items[best].value ? i : best, 0);

  let bars = "";
  items.forEach((it, i) => {
    const x = padL + i * (barW + gap);
    const h = (it.value / max) * plotH;
    const y = padT + (plotH - h);
    bars += `<path class="bar" style="animation-delay:${i * 28}ms" d="${roundedTopBarPath(x, y, barW, h, 3)}" data-idx="${i}"></path>`;
    if (it.value > 0 && i === peakIdx) {
      bars += `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-weight="700">${it.value}</text>`;
    }
    bars += `<text x="${x + barW / 2}" y="${H - 6}" text-anchor="middle">${it.label}</text>`;
  });

  containerEl.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible">
      <line class="axis-line" x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}"></line>
      ${bars}
    </svg>
    <div class="viz-tooltip"></div>
  `;

  const tooltip = containerEl.querySelector(".viz-tooltip");
  containerEl.querySelectorAll(".bar").forEach((el) => {
    const it = items[Number(el.dataset.idx)];
    el.addEventListener("mouseenter", () => {
      tooltip.textContent = `${it.tooltipLabel || it.label}: ${it.value}`;
      tooltip.classList.add("show");
    });
    el.addEventListener("mousemove", (ev) => {
      const rect = containerEl.getBoundingClientRect();
      tooltip.style.left = (ev.clientX - rect.left) + "px";
      tooltip.style.top = (ev.clientY - rect.top) + "px";
    });
    el.addEventListener("mouseleave", () => tooltip.classList.remove("show"));
  });
}

function renderCharts(lidos) {
  const porMes = MESES_ABREV.map((label, i) => {
    const value = lidos.filter((b) => { const d = parseDataParcial(b.finishedAt); return d && d.mes === i + 1; }).length;
    return { label, value, tooltipLabel: MESES[i] };
  });
  renderBarChart(document.getElementById("chart-months"), porMes);

  const porNota = [1, 2, 3, 4, 5].map((n) => ({
    label: String(n),
    tooltipLabel: `${n} estrela${n > 1 ? "s" : ""}`,
    value: lidos.filter((b) => Math.round(Number(b.rating)) === n).length
  }));
  renderBarChart(document.getElementById("chart-ratings"), porNota);
}

iniciar();
