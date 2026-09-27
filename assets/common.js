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

function estrelas(nota, max = 5) {
  const cheias = Math.round(Number(nota) || 0);
  let out = "";
  for (let i = 1; i <= max; i++) out += i <= cheias ? "★" : "☆";
  return out;
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
