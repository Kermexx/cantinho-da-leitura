let TOKEN = null;
let ESTADO = null; // { dados, sha }
let EDITANDO = { lidos: null, aband: null, quero: null, comprar: null };
let notaSelecionada = 0;
let capaEncontrada = "";

const LANG_MAP = { eng: "Inglês", por: "Português", spa: "Espanhol", fre: "Francês", fra: "Francês", ger: "Alemão", ita: "Italiano", jpn: "Japonês" };
function friendlyLang(code) { return LANG_MAP[code] || code || ""; }

function gerarId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function b64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function b64DecodeUtf8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function mensagemErroGh(status) {
  if (status === 401) return "Token inválido, expirado ou sem permissão.";
  if (status === 404) return "Repositório ou arquivo não encontrado. Confira GITHUB_OWNER/GITHUB_REPO em assets/common.js.";
  if (status === 403) return "Acesso negado (limite de taxa da API ou permissão insuficiente do token).";
  return `Erro do GitHub (status ${status}).`;
}

function contentsUrl() {
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_PATH}`;
}

async function ghGetFile() {
  const res = await fetch(`${contentsUrl()}?ref=${GITHUB_BRANCH}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" }
  });
  if (!res.ok) throw new Error(mensagemErroGh(res.status));
  const json = await res.json();
  const dados = JSON.parse(b64DecodeUtf8(json.content.replace(/\n/g, "")));
  ESTADO = { dados, sha: json.sha };
  return ESTADO;
}

async function ghPutFile(mensagem) {
  const res = await fetch(contentsUrl(), {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({
      message: mensagem,
      content: b64EncodeUtf8(JSON.stringify(ESTADO.dados, null, 2)),
      sha: ESTADO.sha,
      branch: GITHUB_BRANCH
    })
  });
  if (res.status === 409) {
    const fresh = await fetch(`${contentsUrl()}?ref=${GITHUB_BRANCH}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" }
    }).then((r) => r.json());
    ESTADO.sha = fresh.sha;
    throw new Error("Alguém salvou ao mesmo tempo. Atualizei a versão base — clique em salvar de novo.");
  }
  if (!res.ok) throw new Error(mensagemErroGh(res.status));
  const json = await res.json();
  ESTADO.sha = json.content.sha;
}

async function salvarNoGithub(mensagem) {
  try {
    await ghPutFile(mensagem);
    showToast("Salvo! o site pode levar ~1 min para atualizar.");
    renderTudo();
  } catch (e) {
    showToast(e.message, true);
    renderTudo();
  }
}

function showToast(msg, isError) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("error", !!isError);
  t.classList.add("show");
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => t.classList.remove("show"), 3600);
}

/* ---- Conexão ---- */

async function conectar(token) {
  TOKEN = token;
  document.getElementById("token-erro").textContent = "";
  try {
    await ghGetFile();
    localStorage.setItem("cantinho_gh_token", token);
    document.getElementById("token-panel").style.display = "none";
    document.getElementById("admin-area").style.display = "";
    document.getElementById("session-info").textContent = `conectado a ${GITHUB_OWNER}/${GITHUB_REPO}`;
    renderTudo();
  } catch (e) {
    TOKEN = null;
    document.getElementById("token-erro").textContent = e.message;
  }
}

function sair() {
  localStorage.removeItem("cantinho_gh_token");
  TOKEN = null;
  ESTADO = null;
  document.getElementById("admin-area").style.display = "none";
  document.getElementById("token-panel").style.display = "";
  document.getElementById("token-input").value = "";
}

/* ---- Render geral ---- */

function renderTudo() {
  carregarFormAtual();
  carregarFormProxima();
  renderLidosList();
  renderAbandList();
  renderQueroList();
  renderComprarList();
}

/* ---- Lendo agora ---- */

function carregarFormAtual() {
  const cr = ESTADO.dados.currentlyReading || {};
  document.getElementById("atual-titulo").value = cr.title || "";
  document.getElementById("atual-autor").value = cr.author || "";
  document.getElementById("atual-paginas-lidas").value = cr.pagesRead || "";
  document.getElementById("atual-paginas-total").value = cr.totalPages || "";
}
function salvarAtual() {
  const anterior = ESTADO.dados.currentlyReading || {};
  ESTADO.dados.currentlyReading = {
    title: document.getElementById("atual-titulo").value.trim(),
    author: document.getElementById("atual-autor").value.trim(),
    pagesRead: Number(document.getElementById("atual-paginas-lidas").value) || 0,
    totalPages: Number(document.getElementById("atual-paginas-total").value) || 0,
    cover: anterior.cover || ""
  };
  salvarNoGithub("Atualiza leitura atual");
}

function carregarFormProxima() {
  const nx = ESTADO.dados.nextUp || {};
  document.getElementById("proxima-titulo").value = nx.title || "";
  document.getElementById("proxima-autor").value = nx.author || "";
}
function salvarProxima() {
  ESTADO.dados.nextUp = {
    title: document.getElementById("proxima-titulo").value.trim(),
    author: document.getElementById("proxima-autor").value.trim()
  };
  salvarNoGithub("Atualiza próxima leitura");
}

/* ---- Lidos ---- */

function atualizarStarPicker() {
  document.querySelectorAll("#lidos-star-picker .star").forEach((star) => {
    star.classList.toggle("on", Number(star.dataset.v) <= notaSelecionada);
  });
}

function prepararNovoLido() {
  EDITANDO.lidos = null;
  document.getElementById("lidos-form-titulo").textContent = "Adicionar livro lido";
  document.getElementById("lidos-titulo").value = "";
  document.getElementById("lidos-autor").value = "";
  document.getElementById("lidos-paginas").value = "";
  document.getElementById("lidos-idioma").value = "";
  document.getElementById("lidos-quando").value = "";
  document.getElementById("lidos-nacional").checked = false;
  document.getElementById("lidos-capa-preview").style.display = "none";
  capaEncontrada = "";
  notaSelecionada = 0;
  atualizarStarPicker();
  document.getElementById("btn-salvar-lido").textContent = "Adicionar aos lidos";
  document.getElementById("btn-cancelar-lido").style.display = "none";
}

function editarLido(id) {
  const item = (ESTADO.dados.read || []).find((b) => b.id === id);
  if (!item) return;
  EDITANDO.lidos = id;
  document.getElementById("lidos-form-titulo").textContent = "Editar livro lido";
  document.getElementById("lidos-titulo").value = item.title || "";
  document.getElementById("lidos-autor").value = item.author || "";
  document.getElementById("lidos-paginas").value = item.pages || "";
  document.getElementById("lidos-idioma").value = item.language || "";
  document.getElementById("lidos-quando").value = item.finishedAt || "";
  document.getElementById("lidos-nacional").checked = !!item.national;
  capaEncontrada = item.cover || "";
  if (capaEncontrada) {
    document.getElementById("lidos-capa-img").src = capaEncontrada;
    document.getElementById("lidos-capa-preview").style.display = "";
  } else {
    document.getElementById("lidos-capa-preview").style.display = "none";
  }
  notaSelecionada = Number(item.rating) || 0;
  atualizarStarPicker();
  document.getElementById("btn-salvar-lido").textContent = "Salvar alterações";
  document.getElementById("btn-cancelar-lido").style.display = "";
  document.getElementById("panel-lidos").scrollIntoView({ behavior: "smooth", block: "start" });
}

function excluirLido(id) {
  const item = (ESTADO.dados.read || []).find((b) => b.id === id);
  if (!item || !confirm(`Excluir "${item.title}" dos lidos?`)) return;
  ESTADO.dados.read = ESTADO.dados.read.filter((b) => b.id !== id);
  salvarNoGithub(`Remove "${item.title}" dos lidos`);
}

function salvarLido() {
  const titulo = document.getElementById("lidos-titulo").value.trim();
  const quando = document.getElementById("lidos-quando").value.trim();
  if (!titulo) { showToast("Dá um título pro livro :)", true); return; }
  if (quando && !parseDataParcial(quando)) { showToast("Data inválida. Use AAAA, AAAA-MM ou AAAA-MM-DD.", true); return; }

  const obj = {
    id: EDITANDO.lidos || gerarId(),
    title: titulo,
    author: document.getElementById("lidos-autor").value.trim(),
    rating: notaSelecionada,
    pages: Number(document.getElementById("lidos-paginas").value) || 0,
    national: document.getElementById("lidos-nacional").checked,
    language: document.getElementById("lidos-idioma").value.trim(),
    finishedAt: quando,
    cover: capaEncontrada
  };

  if (!ESTADO.dados.read) ESTADO.dados.read = [];
  if (EDITANDO.lidos) {
    const idx = ESTADO.dados.read.findIndex((b) => b.id === EDITANDO.lidos);
    if (idx >= 0) ESTADO.dados.read[idx] = obj;
  } else {
    ESTADO.dados.read.push(obj);
  }
  prepararNovoLido();
  salvarNoGithub(`Adiciona/atualiza "${obj.title}" nos lidos`);
}

function renderLidosList() {
  const el = document.getElementById("lidos-list");
  const lista = [...(ESTADO.dados.read || [])].sort((a, b) => String(b.finishedAt || "").localeCompare(String(a.finishedAt || "")));
  el.innerHTML = lista.map((b) => `
    <div class="entry-row">
      <div class="info">
        <div class="t">${escapeHtml(b.title)} ${b.rating ? `<span style="color:var(--star-on)">${estrelas(b.rating)}</span>` : ""}</div>
        <div class="s">${escapeHtml(b.author || "")}${b.finishedAt ? " · " + escapeHtml(formatarDataParcial(b.finishedAt)) : ""}</div>
      </div>
      <button class="btn secondary small" onclick="editarLido('${b.id}')">editar</button>
      <button class="btn danger small" onclick="excluirLido('${b.id}')">excluir</button>
    </div>
  `).join("") || `<div class="empty-state">Nenhum livro lido cadastrado ainda.</div>`;
}

async function buscarCapa() {
  const titulo = document.getElementById("lidos-titulo").value.trim();
  const autor = document.getElementById("lidos-autor").value.trim();
  if (!titulo) { showToast("Digite o título antes de buscar.", true); return; }
  const btn = document.getElementById("btn-buscar-capa");
  btn.disabled = true; btn.textContent = "Buscando…";
  try {
    const r = await buscarNaOpenLibrary(titulo, autor);
    if (!r) { showToast("Não encontrei esse livro na Open Library."); return; }
    if (r.cover) {
      capaEncontrada = r.cover;
      document.getElementById("lidos-capa-img").src = capaEncontrada;
      document.getElementById("lidos-capa-preview").style.display = "";
    }
    const paginasEl = document.getElementById("lidos-paginas");
    if (!paginasEl.value && r.pages) paginasEl.value = r.pages;
    const idiomaEl = document.getElementById("lidos-idioma");
    if (!idiomaEl.value && r.language) idiomaEl.value = friendlyLang(r.language);
    showToast(r.cover ? "Capa encontrada!" : "Encontrei o livro, mas sem capa disponível.");
  } catch (e) {
    showToast("Erro ao buscar na Open Library.", true);
  } finally {
    btn.disabled = false; btn.textContent = "🔎 Buscar capa";
  }
}

/* ---- Abandonados ---- */

function prepararNovoAband() {
  EDITANDO.aband = null;
  document.getElementById("abandonados-form-titulo").textContent = "Adicionar livro abandonado";
  document.getElementById("aband-titulo").value = "";
  document.getElementById("aband-autor").value = "";
  document.getElementById("aband-quando").value = "";
  document.getElementById("btn-salvar-aband").textContent = "Adicionar aos abandonados";
  document.getElementById("btn-cancelar-aband").style.display = "none";
}
function editarAband(id) {
  const item = (ESTADO.dados.abandoned || []).find((b) => b.id === id);
  if (!item) return;
  EDITANDO.aband = id;
  document.getElementById("abandonados-form-titulo").textContent = "Editar livro abandonado";
  document.getElementById("aband-titulo").value = item.title || "";
  document.getElementById("aband-autor").value = item.author || "";
  document.getElementById("aband-quando").value = item.when || "";
  document.getElementById("btn-salvar-aband").textContent = "Salvar alterações";
  document.getElementById("btn-cancelar-aband").style.display = "";
}
function excluirAband(id) {
  const item = (ESTADO.dados.abandoned || []).find((b) => b.id === id);
  if (!item || !confirm(`Excluir "${item.title}" dos abandonados?`)) return;
  ESTADO.dados.abandoned = ESTADO.dados.abandoned.filter((b) => b.id !== id);
  salvarNoGithub(`Remove "${item.title}" dos abandonados`);
}
function salvarAband() {
  const titulo = document.getElementById("aband-titulo").value.trim();
  const quando = document.getElementById("aband-quando").value.trim();
  if (!titulo) { showToast("Dá um título pro livro :)", true); return; }
  if (quando && !parseDataParcial(quando)) { showToast("Data inválida. Use AAAA, AAAA-MM ou AAAA-MM-DD.", true); return; }
  const obj = { id: EDITANDO.aband || gerarId(), title: titulo, author: document.getElementById("aband-autor").value.trim(), when: quando };
  if (!ESTADO.dados.abandoned) ESTADO.dados.abandoned = [];
  if (EDITANDO.aband) {
    const idx = ESTADO.dados.abandoned.findIndex((b) => b.id === EDITANDO.aband);
    if (idx >= 0) ESTADO.dados.abandoned[idx] = obj;
  } else {
    ESTADO.dados.abandoned.push(obj);
  }
  prepararNovoAband();
  salvarNoGithub(`Adiciona/atualiza "${obj.title}" nos abandonados`);
}
function renderAbandList() {
  const el = document.getElementById("aband-list");
  const lista = [...(ESTADO.dados.abandoned || [])];
  el.innerHTML = lista.map((b) => `
    <div class="entry-row">
      <div class="info">
        <div class="t">${escapeHtml(b.title)}</div>
        <div class="s">${escapeHtml(b.author || "")}${b.when ? " · " + escapeHtml(formatarDataParcial(b.when)) : ""}</div>
      </div>
      <button class="btn secondary small" onclick="editarAband('${b.id}')">editar</button>
      <button class="btn danger small" onclick="excluirAband('${b.id}')">excluir</button>
    </div>
  `).join("") || `<div class="empty-state">Nenhum livro abandonado cadastrado.</div>`;
}

/* ---- Pretendo ler ---- */

function prepararNovoQuero() {
  EDITANDO.quero = null;
  document.getElementById("quero-form-titulo").textContent = "Adicionar à lista";
  document.getElementById("quero-titulo").value = "";
  document.getElementById("quero-quando").value = "";
  document.getElementById("btn-salvar-quero").textContent = "Adicionar";
  document.getElementById("btn-cancelar-quero").style.display = "none";
}
function editarQuero(id) {
  const item = (ESTADO.dados.wantToRead || []).find((b) => b.id === id);
  if (!item) return;
  EDITANDO.quero = id;
  document.getElementById("quero-form-titulo").textContent = "Editar item";
  document.getElementById("quero-titulo").value = item.title || "";
  document.getElementById("quero-quando").value = item.when || "";
  document.getElementById("btn-salvar-quero").textContent = "Salvar alterações";
  document.getElementById("btn-cancelar-quero").style.display = "";
}
function excluirQuero(id) {
  const item = (ESTADO.dados.wantToRead || []).find((b) => b.id === id);
  if (!item || !confirm(`Excluir "${item.title}" da lista?`)) return;
  ESTADO.dados.wantToRead = ESTADO.dados.wantToRead.filter((b) => b.id !== id);
  salvarNoGithub(`Remove "${item.title}" de pretendo ler`);
}
function salvarQuero() {
  const titulo = document.getElementById("quero-titulo").value.trim();
  if (!titulo) { showToast("Dá um título pro livro :)", true); return; }
  const obj = { id: EDITANDO.quero || gerarId(), title: titulo, when: document.getElementById("quero-quando").value.trim() };
  if (!ESTADO.dados.wantToRead) ESTADO.dados.wantToRead = [];
  if (EDITANDO.quero) {
    const idx = ESTADO.dados.wantToRead.findIndex((b) => b.id === EDITANDO.quero);
    if (idx >= 0) ESTADO.dados.wantToRead[idx] = obj;
  } else {
    ESTADO.dados.wantToRead.push(obj);
  }
  prepararNovoQuero();
  salvarNoGithub(`Adiciona/atualiza "${obj.title}" em pretendo ler`);
}
function renderQueroList() {
  const el = document.getElementById("quero-list");
  const lista = [...(ESTADO.dados.wantToRead || [])];
  el.innerHTML = lista.map((b) => `
    <div class="entry-row">
      <div class="info"><div class="t">${escapeHtml(b.title)}</div><div class="s">${escapeHtml(b.when || "")}</div></div>
      <button class="btn secondary small" onclick="editarQuero('${b.id}')">editar</button>
      <button class="btn danger small" onclick="excluirQuero('${b.id}')">excluir</button>
    </div>
  `).join("") || `<div class="empty-state">Nada na lista ainda.</div>`;
}

/* ---- Desejo comprar ---- */

function prepararNovoComprar() {
  EDITANDO.comprar = null;
  document.getElementById("comprar-form-titulo").textContent = "Adicionar à lista de compras";
  document.getElementById("comprar-titulo").value = "";
  document.getElementById("comprar-autor").value = "";
  document.getElementById("btn-salvar-comprar").textContent = "Adicionar";
  document.getElementById("btn-cancelar-comprar").style.display = "none";
}
function editarComprar(id) {
  const item = (ESTADO.dados.wishlist || []).find((b) => b.id === id);
  if (!item) return;
  EDITANDO.comprar = id;
  document.getElementById("comprar-form-titulo").textContent = "Editar item";
  document.getElementById("comprar-titulo").value = item.title || "";
  document.getElementById("comprar-autor").value = item.author || "";
  document.getElementById("btn-salvar-comprar").textContent = "Salvar alterações";
  document.getElementById("btn-cancelar-comprar").style.display = "";
}
function excluirComprar(id) {
  const item = (ESTADO.dados.wishlist || []).find((b) => b.id === id);
  if (!item || !confirm(`Excluir "${item.title}" da lista de compras?`)) return;
  ESTADO.dados.wishlist = ESTADO.dados.wishlist.filter((b) => b.id !== id);
  salvarNoGithub(`Remove "${item.title}" de desejo comprar`);
}
function salvarComprar() {
  const titulo = document.getElementById("comprar-titulo").value.trim();
  if (!titulo) { showToast("Dá um título pro livro :)", true); return; }
  const obj = { id: EDITANDO.comprar || gerarId(), title: titulo, author: document.getElementById("comprar-autor").value.trim() };
  if (!ESTADO.dados.wishlist) ESTADO.dados.wishlist = [];
  if (EDITANDO.comprar) {
    const idx = ESTADO.dados.wishlist.findIndex((b) => b.id === EDITANDO.comprar);
    if (idx >= 0) ESTADO.dados.wishlist[idx] = obj;
  } else {
    ESTADO.dados.wishlist.push(obj);
  }
  prepararNovoComprar();
  salvarNoGithub(`Adiciona/atualiza "${obj.title}" em desejo comprar`);
}
function renderComprarList() {
  const el = document.getElementById("comprar-list");
  const lista = [...(ESTADO.dados.wishlist || [])];
  el.innerHTML = lista.map((b) => `
    <div class="entry-row">
      <div class="info"><div class="t">${escapeHtml(b.title)}</div><div class="s">${escapeHtml(b.author || "")}</div></div>
      <button class="btn secondary small" onclick="editarComprar('${b.id}')">editar</button>
      <button class="btn danger small" onclick="excluirComprar('${b.id}')">excluir</button>
    </div>
  `).join("") || `<div class="empty-state">Nada na lista ainda.</div>`;
}

/* ---- Wiring ---- */

function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
    });
  });
}

function wireHandlers() {
  document.getElementById("btn-conectar").addEventListener("click", () => {
    const val = document.getElementById("token-input").value.trim();
    if (val) conectar(val);
  });
  document.getElementById("btn-sair").addEventListener("click", sair);

  document.getElementById("btn-salvar-atual").addEventListener("click", salvarAtual);
  document.getElementById("btn-salvar-proxima").addEventListener("click", salvarProxima);

  document.querySelectorAll("#lidos-star-picker .star").forEach((star) => {
    star.addEventListener("click", () => { notaSelecionada = Number(star.dataset.v); atualizarStarPicker(); });
  });
  document.getElementById("btn-buscar-capa").addEventListener("click", buscarCapa);
  document.getElementById("btn-salvar-lido").addEventListener("click", salvarLido);
  document.getElementById("btn-cancelar-lido").addEventListener("click", prepararNovoLido);

  document.getElementById("btn-salvar-aband").addEventListener("click", salvarAband);
  document.getElementById("btn-cancelar-aband").addEventListener("click", prepararNovoAband);

  document.getElementById("btn-salvar-quero").addEventListener("click", salvarQuero);
  document.getElementById("btn-cancelar-quero").addEventListener("click", prepararNovoQuero);

  document.getElementById("btn-salvar-comprar").addEventListener("click", salvarComprar);
  document.getElementById("btn-cancelar-comprar").addEventListener("click", prepararNovoComprar);
}

async function iniciarAdmin() {
  wireTabs();
  wireHandlers();
  const salvo = localStorage.getItem("cantinho_gh_token");
  if (salvo) await conectar(salvo);
}
iniciarAdmin();
