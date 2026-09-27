// Configuração do repositório onde este site vive.
const GITHUB_OWNER = "Kermexx";
const GITHUB_REPO = "cantinho-da-leitura";
const GITHUB_BRANCH = "main";
const DATA_PATH = "data/books.json";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];
const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez"
];

function parseDataParcial(valor) {
  if (!valor) return null;
  const s = String(valor).trim();
  const m = s.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return null;
  return {
    ano: Number(m[1]),
    mes: m[2] ? Number(m[2]) : null,
    dia: m[3] ? Number(m[3]) : null
  };
}

function formatarDataParcial(valor) {
  const d = parseDataParcial(valor);
  if (!d) return "";
  if (d.dia && d.mes) return `${d.dia} de ${MESES[d.mes - 1]} de ${d.ano}`;
  if (d.mes) return `${MESES[d.mes - 1]} de ${d.ano}`;
  return String(d.ano);
}

function anoDe(valor) {
  const d = parseDataParcial(valor);
  return d ? d.ano : null;
}

const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z";

function starIconsHtml(nota, max = 5) {
  const cheias = Math.round(Number(nota) || 0);
  let out = `<span class="star-row" role="img" aria-label="${cheias} de ${max} estrelas">`;
  for (let i = 1; i <= max; i++) {
    const on = i <= cheias;
    out += `<svg class="star-ico${on ? " on" : ""}" viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="${STAR_PATH}"/></svg>`;
  }
  out += "</span>";
  return out;
}

function hashTile(str, buckets = 5) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % buckets) + 1;
}

function coverTileHtml(title, cover) {
  if (cover) return `<img src="${escapeHtml(cover)}" alt="">`;
  const letter = (String(title || "?").trim().charAt(0) || "?").toUpperCase();
  return `<div class="mono-tile mono-${hashTile(title)}"><span class="mono-letter">${escapeHtml(letter)}</span></div>`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function carregarDadosPublicados() {
  const res = await fetch(`${DATA_PATH}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Não foi possível carregar data/books.json");
  return res.json();
}

function anosDisponiveis(dados) {
  const anos = new Set();
  (dados.read || []).forEach((b) => { const a = anoDe(b.finishedAt); if (a) anos.add(a); });
  (dados.abandoned || []).forEach((b) => { const a = anoDe(b.when); if (a) anos.add(a); });
  const atual = new Date().getFullYear();
  anos.add(atual);
  return Array.from(anos).sort((a, b) => b - a);
}

async function buscarNaOpenLibrary(titulo, autor) {
  const q = new URLSearchParams({ title: titulo || "", author: autor || "", limit: "1" });
  const res = await fetch(`https://openlibrary.org/search.json?${q.toString()}`);
  if (!res.ok) throw new Error("Falha ao consultar a Open Library");
  const data = await res.json();
  const doc = (data.docs || [])[0];
  if (!doc) return null;
  return {
    title: doc.title || titulo,
    author: (doc.author_name && doc.author_name[0]) || autor || "",
    pages: doc.number_of_pages_median || null,
    language: (doc.language && doc.language[0]) || null,
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : ""
  };
}
