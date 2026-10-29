// The stud book UI. It talks to storage through the small `claude.use()` interface
// in ./platform.js, which is backed by Firebase on the hosted site.
import { platform } from "./platform.js";

export function runApp() {
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const SEXES = ["Mare", "Stallion", "Gelding", "Filly", "Colt"];
const MALE = new Set(["Stallion", "Gelding", "Colt"]);
const STATUSES = ["On property", "Agisted / away", "Sold", "Deceased", "Pedigree only"];
const HEALTH_TYPES = ["Vaccination", "Worming", "Faecal egg count", "Farrier", "Dental", "Vet visit", "Injury / illness", "Treatment", "Other"];
const WORMERS = ["Equest Plus Tape", "Equimax", "Equimax Elevation", "Strategy-T", "MecWorma & Tape", "MecWorma & Bot", "AMMO Allwormer", "AMMO Rotational Wormer"];
const SCHEDULE_URL = "https://claude.ai/artifact/JzhrvR4LXyoawzU2gYWCYu";
// Camelock rotational wormer schedule: 3-year cycle, Year 1 = 2027
const WORM_START = 2027;
const ROTATION = [
  { autumn: { name: "Equest Plus Tape", actives: "moxidectin + praziquantel", note: "Covers bots, tapeworm and encysted small strongyles." },
    spring: { name: "Strategy-T", actives: "oxfendazole + pyrantel", note: "Benzimidazole + tetrahydropyrimidine." } },
  { autumn: { name: "Equimax", actives: "abamectin + praziquantel", note: "Covers bots and tapeworm." },
    spring: { name: "Pyrantel or morantel wormer", actives: "no macrocyclic lactone", note: "Ask your vet which is stocked locally, or use Strategy-T again if your last reduction test showed it still works." } },
  { autumn: { name: "Equimax Elevation", actives: "ivermectin + praziquantel + pyrantel", note: "Covers bots and tapeworm, with a second strongyle class in the same dose." },
    spring: { name: "Strategy-T", actives: "oxfendazole + pyrantel", note: "Benzimidazole + tetrahydropyrimidine." } }
];
const FEC_LIMIT = 200, FEC_HIGH = 500;
// Genetic tests and the results Camelock records for each
const GENE_TESTS = [
  ["HYPP", "Hyperkalaemic periodic paralysis", ["N/N", "N/H", "N/R"]],
  ["MYHM", "Myosin heavy chain myopathy", ["N/N", "N/MYHM", "MYHM/MYHM"]],
  ["MH", "Malignant hyperthermia", ["N/N", "N/MH", "MH/MH"]],
  ["PSSM1", "Polysaccharide storage myopathy type 1", ["N/N", "N/PSSM1", "PSSM1/PSSM1"]],
  ["HERDA", "Hereditary equine regional dermal asthenia", ["N/N", "N/HDR", "N/R"]],
  ["OLWS", "Overo lethal white syndrome", ["N/N", "N/O", "O/O", "N/R"]],
  ["GBED", "Glycogen branching enzyme deficiency", ["N/N", "N/GBED"]],
  ["DNAPV", "DNA parentage verification", ["Untested", "Parent Verified", "Sire Verified"]]
];
const geneName = (k) => k === "DNAPV" ? "DNA PV" : k;
// N/N clear, N/R test not required (clear by pedigree), N/x one copy, x/x two copies
const geneClass = (v) => !v ? "" : v === "N/N" ? "clear" : v === "N/R" ? "nr" : v === "Untested" ? "untested" : v.endsWith("Verified") ? "verified" : v.startsWith("N/") ? "carrier" : "two";
const GENE_LABEL = { clear: "Clear", nr: "Not required (pedigree)", carrier: "One copy", two: "Two copies", verified: "Parentage confirmed", untested: "Not yet tested" };
const GENE_PILL = { clear: "ok", nr: "ok", carrier: "warn", two: "bad", verified: "ok", untested: "muted" };
const geneFlags = (h) => GENE_TESTS.map(([k]) => [k, (h.genetics || {})[k]]).filter(([, v]) => ["carrier", "two"].includes(geneClass(v)));
const BREED_TYPES = ["Covering / AI", "Pregnancy scan", "Foaling", "Other"];
const METHODS = ["Natural (paddock)", "Natural (hand)", "AI chilled", "AI frozen", "Embryo transfer"];
const SCAN_RESULTS = ["In foal", "Empty", "Twins", "Re-check"];
const FOAL_RESULTS = ["Filly", "Colt", "Lost / stillborn"];
const GESTATION = 340;
const FILTERS = [
  ["current", "Current herd"], ["Mare", "Mares"], ["Stallion", "Stallions"], ["Gelding", "Geldings"],
  ["young", "Young stock"], ["gone", "Sold & deceased"], ["Pedigree only", "Pedigree only"], ["all", "All"]
];

const S = {
  db: null, assets: null, downloads: null, canWrite: true, loaded: { horses: false, records: false },
  horses: new Map(), records: [], mate: { s: "", d: "" }, filter: "current", q: "", tab: "health", armed: null, failed: false
};

/* ---------- dates ---------- */
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const parse = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return y ? new Date(y, (m || 1) - 1, d || 1) : null; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const fmt = (s) => { const d = parse(s); return d ? d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : ""; };
const daysUntil = (s) => Math.round((parse(s) - today()) / 864e5);
// Australian convention: every horse ages a year on 1 August
const season = (d) => d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
const ageOf = (dob) => { const d = parse(dob); return d ? Math.max(0, season(today()) - season(d)) : null; };
const ageLabel = (h) => { const a = ageOf(h.dob); if (a === null) return ""; return a === 0 ? (h.dob ? "Foal" : "") : `${a}yo`; };

/* ---------- breeds ---------- */
const ASH = "Australian Stock Horse", AQHA = "Australian Quarter Horse";
// Older records keep breed as text plus one regNo; read them into the ASH/AQHA fields
function B(h) {
  const t = h.breed || "";
  const ash = h.ash ?? /stock horse/i.test(t), aqha = h.aqha ?? /quarter horse/i.test(t);
  const legacy = h.ash === undefined && h.aqha === undefined;
  const ashReg = h.ashReg ?? (legacy && ash && !aqha ? h.regNo || "" : "");
  const aqhaReg = h.aqhaReg ?? (legacy && aqha && !ash ? h.regNo || "" : "");
  const other = legacy ? (ash || aqha ? "" : t) : (h.otherBreed || "");
  const otherReg = legacy ? (ash !== aqha ? "" : h.regNo || "") : (h.regNo || "");
  return { ash, aqha, ashReg, aqhaReg, other, otherReg };
}
const breedShort = (h) => { const b = B(h); return [b.ash && "ASH", b.aqha && "AQHA", b.other].filter(Boolean).join(" & "); };

/* ---------- lookups ---------- */
const byName = (name) => { if (!name) return null; const n = name.trim().toLowerCase(); for (const h of S.horses.values()) if ((h.name || "").trim().toLowerCase() === n) return h; return null; };
const resolve = (id, name) => (id && S.horses.get(id)) || byName(name) || null;
const parentName = (h, which) => { const p = resolve(h[which + "Id"], h[which + "Name"]); return p ? p.name : (h[which + "Name"] || ""); };
const recsFor = (id) => S.records.filter(r => r.horseId === id);
const sortRecs = (a) => a.slice().sort((x, y) => (y.date || "").localeCompare(x.date || ""));

function photoHTML(h, cls = "photo") {
  if (h.photo) return `<div class="${cls}"><img data-photo="${esc(h.photo)}" alt=""></div>`;
  const init = (h.name || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return `<div class="${cls}" aria-hidden="true">${esc(init)}</div>`;
}

/* ---------- due items ---------- */
function dueItems() {
  const items = [];
  const latest = new Map();
  for (const r of S.records) {
    if (r.kind !== "health" || !S.horses.has(r.horseId) || r.type === "Worming" || r.type === "Faecal egg count") continue;
    const k = r.horseId + "|" + r.type;
    const cur = latest.get(k);
    if (!cur || (r.date || "") > (cur.date || "")) latest.set(k, r);
  }
  for (const r of latest.values()) {
    if (!r.due) continue;
    const h = S.horses.get(r.horseId);
    if (["Sold", "Deceased", "Pedigree only"].includes(h.status)) continue;
    const n = daysUntil(r.due);
    if (n <= 30) items.push({ h, n, what: `${r.type}${r.product ? " · " + r.product : ""}`, kind: "health" });
  }
  for (const h of S.horses.values()) {
    const f = foalingDue(h);
    if (f && f.n <= 60 && f.n >= -30) items.push({ h, n: f.n, what: `Foaling due (covered ${fmt(f.cover.date)}${f.cover.partnerName ? " to " + f.cover.partnerName : ""})`, kind: "breeding" });
  }
  const rd = currentRound(), sum = roundSummary(rd);
  if (sum.open && daysUntil(rd.remind) <= 30) {
    const bits = [];
    if (sum.due) bits.push(`${sum.due} to dose`);
    if (sum.fec) bits.push(`${sum.fec} need${sum.fec === 1 ? "s" : ""} an egg count`);
    items.push({ who: `${rd.label} worming`, n: today() > parse(rd.end) ? daysUntil(rd.end) : Math.max(0, daysUntil(rd.due)), what: `${rd.product.name} · ${bits.join(", ")}`, kind: "health", goto: "worming" });
  }
  return items.sort((a, b) => a.n - b.n);
}

/* ---------- worming plan ---------- */
const cycleYear = (y) => ((y - WORM_START) % 3 + 3) % 3;
function makeRound(season, y) {
  const p = ROTATION[cycleYear(y)][season];
  return season === "autumn"
    ? { season, year: y, label: `Autumn ${y}`, month: "May", product: p, start: `${y}-04-01`, remind: `${y}-04-01`, due: `${y}-05-01`, end: `${y}-05-31`, close: `${y}-06-30` }
    : { season, year: y, label: `Spring ${y}`, month: "October", product: p, start: `${y}-09-15`, remind: `${y}-08-15`, fecFrom: `${y}-07-01`, fecBy: `${y}-09-10`, due: `${y}-10-01`, end: `${y}-10-31`, close: `${y}-11-30` };
}
function currentRound(offset = 0) {
  const y = today().getFullYear(), t = iso(today());
  const all = [];
  for (let k = y - 1; k <= y + 2; k++) all.push(makeRound("autumn", k), makeRound("spring", k));
  const i = all.findIndex(r => r.close >= t);
  return all[i + offset];
}
const inWorming = (h) => ["On property", "Agisted / away", "", undefined].includes(h.status) && h.status !== "Pedigree only";
function wormStatus(h, rd) {
  const recs = recsFor(h.id);
  const dose = sortRecs(recs.filter(r => r.type === "Worming" && r.date >= rd.start && r.date <= rd.close))[0];
  const notes = [];
  const a = ageOf(h.dob);
  const f = foalingDue(h);
  const foaled = sortRecs(recs.filter(r => r.type === "Foaling"))[0];
  if (f && f.confirmed) notes.push("In foal: check the label suits pregnant mares");
  else if (foaled && daysUntil(foaled.date) > -180) notes.push("Lactating: check the label");
  if (dose) return { code: "done", label: `Done ${fmt(dose.date)}`, cls: "ok", notes: [dose.product].filter(Boolean), dose };
  if (a !== null && a < 2) return { code: "vet", label: "Own plan", cls: "muted", notes: ["Foals, weanlings and yearlings need a vet plan, including roundworm"] };
  let fec = null;
  if (rd.season === "spring") {
    fec = sortRecs(recs.filter(r => r.type === "Faecal egg count" && r.date >= rd.fecFrom && r.date <= rd.close))[0];
    if (!fec) return { code: "fec", label: "Egg count needed", cls: "warn", notes: [iso(today()) > rd.fecBy ? "Get an egg count before dosing (sample at least 6 weeks after the last wormer)" : `Test by ${fmt(rd.fecBy)}, at least 6 weeks after the last wormer`].concat(notes) };
    const epg = Number(fec.epg);
    if (epg < FEC_LIMIT) return { code: "skip", label: `Skip · ${epg} epg`, cls: "muted", notes: ["Low shedder: autumn dose only"], fec };
    if (epg > FEC_HIGH) notes.unshift(`High shedder (${epg} epg): ask the vet about an extra summer dose and retest`);
    else notes.unshift(`${epg} epg`);
  }
  const t = iso(today());
  const st = t > rd.end ? { label: "Overdue", cls: "bad" } : t >= rd.due ? { label: "Due now", cls: "warn" } : { label: `Due ${rd.month}`, cls: "ok" };
  return { code: "due", label: st.label, cls: st.cls, notes, fec };
}
function roundSummary(rd) {
  const s = { due: 0, fec: 0, done: 0, skip: 0, vet: 0, open: 0, rows: [] };
  for (const h of [...S.horses.values()].filter(inWorming).sort((a, b) => (a.name || "").localeCompare(b.name || ""))) {
    const st = wormStatus(h, rd);
    s[st.code]++; s.rows.push({ h, st });
  }
  s.open = s.due + s.fec;
  return s;
}
function foalingDue(h) {
  if (h.sex !== "Mare" || ["Sold", "Deceased", "Pedigree only"].includes(h.status)) return null;
  const rs = sortRecs(recsFor(h.id).filter(r => r.kind === "breeding"));
  const cover = rs.find(r => r.type === "Covering / AI");
  if (!cover) return null;
  const after = rs.filter(r => (r.date || "") >= cover.date && r !== cover);
  if (after.some(r => r.type === "Foaling")) return null;
  const scan = after.find(r => r.type === "Pregnancy scan");
  if (scan && scan.result === "Empty") return null;
  const date = addDays(cover.date, GESTATION);
  return { date, n: daysUntil(date), cover, confirmed: scan && scan.result !== "Re-check" };
}
function duePill(n) {
  if (n < 0) return `<span class="pill bad num">${-n}d overdue</span>`;
  if (n === 0) return `<span class="pill bad">Due today</span>`;
  if (n <= 14) return `<span class="pill warn num">in ${n}d</span>`;
  return `<span class="pill ok num">in ${n}d</span>`;
}

/* ---------- views ---------- */
function render() {
  const app = $("#app");
  $("#add-horse").hidden = !(S.db && S.canWrite);
  if (S.failed) {
    app.innerHTML = `<div class="empty"><h3>Records can't load here</h3><p>Check your internet connection, then sign out and sign in again.</p></div>`;
    return;
  }
  if (!S.loaded.horses || !S.loaded.records) return;
  const m = location.hash.match(/^#h-([A-Za-z0-9-]+)$/);
  const h = m && S.horses.get(m[1]);
  app.innerHTML = h ? fileView(h) : location.hash === "#worming" ? wormView() : location.hash === "#mating" ? matingView() : listView();
  loadPhotos();
}

function listView() {
  const parts = [];
  const examples = [...S.horses.values()].filter(h => h.example).length;
  if (examples && S.canWrite) parts.push(`<div class="notice"><p>The horses marked <span class="pill muted">Example</span> show how the book works. Remove them when you're ready to add your own.</p><button class="btn ${S.armed === "examples" ? "danger armed" : ""}" data-act="clear-examples">${S.armed === "examples" ? "Tap again to remove" : "Remove examples"}</button></div>`);

  const due = dueItems();
  parts.push(`<section class="panel" aria-labelledby="due-h"><div class="panel-h"><h2 id="due-h">Coming up</h2><span class="eyebrow">Next 30 days</span></div>${
    due.length ? `<ul class="due-list">${due.map(d => `<li><button ${d.goto ? `data-goto="${d.goto}"` : `data-open="${esc(d.h.id)}" data-tab="${d.kind}"`}><span class="who">${esc(d.who || d.h.name)}</span><span class="what">${esc(d.what)}</span><span class="pill-wrap pill ${d.n < 0 ? "bad" : d.n <= 14 ? "warn" : d.kind === "breeding" ? "breed" : "ok"} num">${d.n < 0 ? -d.n + "d overdue" : d.n === 0 ? (d.goto ? "Due now" : "Today") : "in " + d.n + "d"}</span></button></li>`).join("")}</ul>`
    : `<p class="empty-small">Nothing due. Add a "next due" date to a vaccination or farrier record and it will show here.</p>`}</section>`);

  const rd = currentRound(), sum = roundSummary(rd);
  parts.push(`<button class="worm-card mate-card" data-goto="mating"><span class="eyebrow">Breeding planner</span><span class="wc-prod">Plan a mating</span><span class="wc-sub">Pick a stallion and a mare to see the foal's pedigree and genetic odds</span><span class="wc-go">Open →</span></button>`);
  parts.push(`<button class="worm-card" data-goto="worming"><span class="eyebrow">Worming plan · ${esc(rd.label)} (${rd.month})</span><span class="wc-prod">${esc(rd.product.name)}</span><span class="wc-sub">${sum.rows.length ? [sum.due && `${sum.due} to dose`, sum.fec && `${sum.fec} need egg counts`, sum.done && `${sum.done} done`, sum.skip && `${sum.skip} skipping`].filter(Boolean).join(" · ") || "Nothing to do this round" : "Add horses to see who needs a dose"}</span><span class="wc-go">Open plan →</span></button>`);

  const q = S.q.trim().toLowerCase();
  const all = [...S.horses.values()];
  const list = all.filter(h => {
    const st = h.status || "On property";
    const f = S.filter;
    if (f === "current" && !["On property", "Agisted / away"].includes(st)) return false;
    if (["Mare", "Stallion", "Gelding"].includes(f) && (h.sex !== f || !["On property", "Agisted / away"].includes(st))) return false;
    if (f === "young" && (!(ageOf(h.dob) !== null && ageOf(h.dob) < 3) || !["On property", "Agisted / away"].includes(st))) return false;
    if (f === "gone" && !["Sold", "Deceased"].includes(st)) return false;
    if (f === "Pedigree only" && st !== "Pedigree only") return false;
    if (q && ![h.name, h.stableName, h.breed, breedShort(h), h.colour, h.microchip, h.brand, h.regNo, B(h).ashReg, B(h).aqhaReg].join(" ").toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  parts.push(`<section class="toolbar" aria-label="Find a horse">
    <input class="search" id="q" type="search" placeholder="Search name, microchip, brand…" value="${esc(S.q)}" autocomplete="off">
    <div class="chips" role="group" aria-label="Filter">${FILTERS.map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${S.filter === k}">${l}</button>`).join("")}</div>
  </section>`);

  if (!all.length) {
    parts.push(`<div class="empty"><h3>No horses yet</h3><p>Start with one horse: name, sex and date of birth are enough. You can add pedigree, health and breeding records after.</p>${S.canWrite ? `<button class="btn primary" data-act="add-horse">+ Add your first horse</button>` : ""}</div>`);
  } else {
    parts.push(`<section><div class="reg-head"><h2>Register</h2><span class="eyebrow num">${list.length} of ${all.length}</span></div></section>`);
    parts.push(list.length ? `<ul class="herd">${list.map(rowHTML).join("")}</ul>` : `<p class="empty-small">No horses match that search.</p>`);
  }
  parts.push(`<footer><span>Ages follow the 1 August horse birthday.</span><span class="actions"><button class="btn ghost" data-act="export-horses">Export horses (CSV)</button><button class="btn ghost" data-act="export-records">Export records (CSV)</button><button class="btn ghost" data-act="backup">Download backup</button>${S.canWrite ? `<button class="btn ghost" data-act="import">Import backup</button>` : ""}<button class="btn ghost" data-act="sign-out">Sign out</button></span></footer><input type="file" id="import-file" accept="application/json,.json" hidden>`);
  return parts.join("");
}

function rowHTML(h) {
  const sub = [h.sex, ageLabel(h), h.colour, breedShort(h)].filter(Boolean).join(" · ");
  const flags = [];
  if (h.example) flags.push(`<span class="pill muted">Example</span>`);
  if (h.status && h.status !== "On property") flags.push(`<span class="pill muted">${esc(h.status)}</span>`);
  const f = foalingDue(h);
  if (f) flags.push(`<span class="pill breed">${f.confirmed ? "In foal" : "Covered"}</span>`);
  const overdue = dueItems().filter(d => d.h && d.h.id === h.id && d.n < 0).length;
  if (overdue) flags.push(`<span class="pill bad num">${overdue} overdue</span>`);
  if (inWorming(h)) { const rd = currentRound(), ws = wormStatus(h, rd); if ((ws.code === "due" || ws.code === "fec") && daysUntil(rd.remind) <= 30) flags.push(`<span class="pill ${ws.cls}">${ws.code === "fec" ? "Egg count due" : ws.label === "Overdue" ? "Worming overdue" : "Worming due"}</span>`); }
  return `<li><button class="horse-row" data-open="${esc(h.id)}">${photoHTML(h)}<span class="meta"><span class="nm">${esc(h.name)}${h.stableName ? `<small>"${esc(h.stableName)}"</small>` : ""}</span><span class="sub" style="display:block">${esc(sub) || "&nbsp;"}</span><span class="sub" style="display:block">${esc([parentName(h, "sire") && "by " + parentName(h, "sire"), parentName(h, "dam") && "out of " + parentName(h, "dam")].filter(Boolean).join(" "))}</span></span><span class="flags">${flags.join("")}</span></button></li>`;
}

function fileView(h) {
  const a = ageOf(h.dob);
  const facts = [
    ["Foaled", h.dob ? `${fmt(h.dob)}${a !== null ? ` (${a === 0 ? "foal" : a + "yo"})` : ""}` : ""],
    ["Sex", h.sex], ["Colour", h.colour], ...(() => { const b = B(h); return [b.ash ? [ASH, b.ashReg ? "Reg. " + b.ashReg : "No number yet"] : ["", ""], b.aqha ? [AQHA, b.aqhaReg ? "Reg. " + b.aqhaReg : "No number yet"] : ["", ""], ["Breed", b.other], ["Registration", b.otherReg]]; })(),
    ["Height", h.height ? h.height + " hh" : ""], ["Microchip", h.microchip], ["Brand", h.brand],
    ["Status", h.status || "On property"], ["Location", h.location],
    ["Bred by", h.breeder], ["Owner", h.owner]
  ].filter(([, v]) => v);
  const tabs = [["health", "Health"], ["breeding", "Breeding"], ["genetics", "Genetics"], ["pedigree", "Pedigree"], ["progeny", "Progeny"]];
  return `
  <button class="btn ghost back" data-act="back">← Register</button>
  <section class="file-head">${photoHTML(h)}<div>
    <h2>${esc(h.name)}</h2>
    ${h.stableName ? `<div class="aka">Stable name "${esc(h.stableName)}"</div>` : ""}
    <div class="tags">${h.example ? `<span class="pill muted">Example</span>` : ""}${parentName(h, "sire") || parentName(h, "dam") ? `<span class="pill ok">${esc(parentName(h, "sire") || "Unknown")} × ${esc(parentName(h, "dam") || "Unknown")}</span>` : ""}${geneFlags(h).map(([k, v]) => `<span class="pill ${GENE_PILL[geneClass(v)]}">${esc(k)} ${esc(v)}</span>`).join("")}</div>
  </div></section>
  ${S.canWrite ? `<div class="actions"><button class="btn" data-act="edit-horse">Edit details</button><button class="btn primary" data-act="add-rec">+ Add record</button>${["Mare", "Filly", "Stallion", "Colt"].includes(h.sex) ? `<button class="btn" data-act="plan-mate">Plan a mating</button>` : ""}</div>` : ""}
  <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd class="num">${esc(v)}</dd></div>`).join("")}</dl>
  ${h.notes ? `<div class="notes">${esc(h.notes)}</div>` : ""}
  <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${S.tab === k}" data-tab-set="${k}">${l}</button>`).join("")}</div>
  <section>${tabBody(h)}</section>`;
}

function tabBody(h) {
  if (S.tab === "pedigree") return pedigreeHTML(h);
  if (S.tab === "genetics") return geneticsHTML(h);
  if (S.tab === "progeny") return progenyHTML(h);
  const kind = S.tab;
  let recs = recsFor(h.id).filter(r => r.kind === kind);
  if (kind === "breeding" && MALE.has(h.sex)) {
    recs = recs.concat(S.records.filter(r => r.kind === "breeding" && r.horseId !== h.id && (r.partnerId === h.id || (r.partnerName && byName(r.partnerName) === h))));
  }
  recs = sortRecs(recs);
  const f = kind === "breeding" ? foalingDue(h) : null;
  const head = `<div class="sec-h"><h3>${kind === "health" ? "Health records" : "Breeding records"}</h3>${S.canWrite ? `<button class="btn" data-act="add-rec">+ ${kind === "health" ? "Health" : "Breeding"} record</button>` : ""}</div>`;
  const preg = (kind === "health" ? wormBox(h) : "") + (f ? `<div class="notice" style="border-style:solid"><p><strong>${f.confirmed ? "In foal" : "Covered, not yet confirmed"}.</strong> Estimated foaling <strong class="num">${fmt(f.date)}</strong> (${GESTATION} days from ${fmt(f.cover.date)}).</p>${duePill(f.n)}</div>` : "");
  if (!recs.length) return head + preg + `<p class="empty-small" style="padding-inline:0">No ${kind} records yet.${kind === "health" ? " Vaccinations, worming, farrier, dental and vet visits all go here." : MALE.has(h.sex) ? " Coverings recorded on a mare's file will list here too." : " Record coverings, scans and foalings here."}</p>`;
  return head + preg + `<ul class="recs" style="margin-top:10px">${recs.map(r => recHTML(r, h)).join("")}</ul>`;
}

function recHTML(r, h) {
  const other = r.horseId !== h.id ? S.horses.get(r.horseId) : null;
  const bits = [];
  if (r.kind === "health") {
    if (r.product) bits.push(esc(r.product));
    if (r.by) bits.push("by " + esc(r.by));
    if (r.weight) bits.push(`<span class="num">${esc(r.weight)} kg</span>`);
    if (r.batch) bits.push("batch " + esc(r.batch));
  } else {
    if (other) bits.push(`Mare: <button class="link" data-open="${esc(other.id)}" data-tab="breeding">${esc(other.name)}</button>`);
    else if (r.partnerName || r.partnerId) { const p = resolve(r.partnerId, r.partnerName); bits.push(`${r.type === "Foaling" ? "Sire" : "Stallion"}: ${p ? `<button class="link" data-open="${esc(p.id)}" data-tab="breeding">${esc(p.name)}</button>` : esc(r.partnerName)}`); }
    if (r.method) bits.push(esc(r.method));
    if (r.type === "Covering / AI" && r.date) bits.push(`est. foaling ${fmt(addDays(r.date, GESTATION))}`);
    if (r.type === "Covering / AI") { const mare = other || h, stal = other ? h : resolve(r.partnerId, r.partnerName); const both = stal ? sharedGenes(mare, stal) : []; if (both.length) bits.push(`<span class="pill warn">Both carry ${esc(both.join(", "))}</span>`); }
  }
  const side = [];
  if (r.type === "Faecal egg count" && r.epg !== "" && r.epg != null) { const e = Number(r.epg); side.push(`<span class="pill ${e > FEC_HIGH ? "bad" : e >= FEC_LIMIT ? "warn" : "ok"} num">${e} epg</span>`); }
  if (r.result) side.push(`<span class="pill ${r.result === "Empty" || r.result.startsWith("Lost") ? "muted" : "breed"}">${esc(r.result)}</span>`);
  if (r.due) side.push(`<span class="d">Next ${fmt(r.due)}</span>${daysUntil(r.due) <= 30 ? duePill(daysUntil(r.due)) : ""}`);
  if (r.cost) side.push(`<span class="d num">$${Number(r.cost).toFixed(2)}</span>`);
  const foot = [];
  if (r.type === "Foaling" && r.foalId && S.horses.get(r.foalId)) foot.push(`<button class="link" data-open="${esc(r.foalId)}">Open foal: ${esc(S.horses.get(r.foalId).name)}</button>`);
  else if (r.type === "Foaling" && !other && S.canWrite && r.result && !r.result.startsWith("Lost")) foot.push(`<button class="link" data-act="add-foal" data-rec="${esc(r.id)}">Add this foal to the register</button>`);
  if (S.canWrite && !other) foot.push(`<button class="link" data-act="edit-rec" data-rec="${esc(r.id)}">Edit</button>`);
  return `<li class="rec ${r.kind}"><span class="t">${esc(r.type)}</span><span class="d num">${fmt(r.date)}</span>
    <span class="side">${side.join("")}</span>
    ${bits.length ? `<span class="body">${bits.join(" · ")}</span>` : ""}
    ${r.details ? `<span class="body" style="white-space:pre-wrap">${esc(r.details)}</span>` : ""}
    ${foot.length ? `<span class="foot">${foot.join("")}</span>` : ""}</li>`;
}

function wormBox(h) {
  if (!inWorming(h)) return "";
  const rd = currentRound(), ws = wormStatus(h, rd);
  const btns = !S.canWrite ? "" : ws.code === "fec"
    ? `<button class="btn" data-act="worm-fec" data-h="${esc(h.id)}">Record egg count</button>`
    : ws.code === "due" ? `<button class="btn primary" data-act="worm-dose" data-h="${esc(h.id)}">Record dose</button>` : "";
  return `<div class="worm-box"><div class="wb-main"><span class="eyebrow">Worming · ${esc(rd.label)} (${rd.month})</span>
    <strong>${ws.code === "skip" || ws.code === "vet" ? "No dose this round" : esc(rd.product.name)}</strong>
    <span class="wc-sub">${ws.code === "skip" || ws.code === "vet" ? "" : esc(rd.product.actives) + (ws.notes.length ? " · " : "")}${esc(ws.notes.join(" · "))}</span>
    <button class="link" data-goto="worming" style="justify-self:start;font-size:13px">See the full plan</button></div>
    <div class="wb-side"><span class="pill ${ws.cls}">${esc(ws.label)}</span>${btns}</div></div>`;
}

function wormView() {
  const rd = currentRound(), next = currentRound(1), sum = roundSummary(rd);
  const rule = rd.season === "autumn"
    ? "Give the autumn dose to every horse, whatever its egg count, to clear bots and tapeworm."
    : `Give the spring dose only to horses with an egg count over ${FEC_LIMIT} eggs per gram. Low shedders skip it. Collect samples in early September, at least 6 weeks after the last wormer.`;
  const rows = sum.rows.map(({ h, st }) => `<li class="wr"><button class="link wr-name" data-open="${esc(h.id)}" data-tab="health">${esc(h.name)}</button>
    <span class="pill ${st.cls}">${esc(st.label)}</span>
    ${st.notes.length ? `<span class="wr-note">${esc(st.notes.join(" · "))}</span>` : ""}
    ${S.canWrite && st.code === "due" ? `<button class="btn" data-act="worm-dose" data-h="${esc(h.id)}">Record dose</button>` : ""}
    ${S.canWrite && st.code === "fec" ? `<button class="btn" data-act="worm-fec" data-h="${esc(h.id)}">Record egg count</button>` : ""}</li>`).join("");
  const y0 = today().getFullYear();
  const years = [y0, y0 + 1, y0 + 2, y0 + 3];
  return `<button class="btn ghost back" data-act="back">← Register</button>
  <section class="worm-hero"><span class="eyebrow">This round · ${esc(rd.label)} (${rd.month})</span>
    <h2>${esc(rd.product.name)}</h2>
    <p class="wh-act">${esc(rd.product.actives)}. ${esc(rd.product.note)}</p>
    <p>${esc(rule)}</p>
    <p class="wc-sub">Dose window ${fmt(rd.start)} to ${fmt(rd.close)}. Dose to the heaviest horse in the group with a weight tape, and worm everyone in a paddock on the same day.</p>
  </section>
  <section><div class="sec-h"><h3>Horses this round</h3><span class="eyebrow num">${sum.done} of ${sum.rows.length - sum.skip - sum.vet} dosed</span></div>
    ${rows ? `<ul class="wlist">${rows}</ul>` : `<p class="empty-small" style="padding-inline:0">No horses on the property yet.</p>`}
  </section>
  <section class="notice" style="border-style:solid"><p><strong>Next round: ${esc(next.label)} (${next.month})</strong> · ${esc(next.product.name)} (${esc(next.product.actives)})${next.season === "spring" ? ". Egg counts first, in early September." : ". Every horse gets this one."}</p></section>
  <section><div class="sec-h"><h3>Three-year rotation</h3></div>
    <div class="ped-scroll" style="margin-top:10px"><table class="rot"><thead><tr><th>Year</th><th>Autumn (May) · all horses</th><th>Spring (Oct) · over ${FEC_LIMIT} epg</th></tr></thead><tbody>
    ${years.map(y => { const c = ROTATION[cycleYear(y)]; return `<tr class="${y === rd.year ? "cur" : ""}"><td class="num">${y}<br><small>Year ${cycleYear(y) + 1}</small></td><td><strong>${esc(c.autumn.name)}</strong><br><small>${esc(c.autumn.actives)}</small></td><td><strong>${esc(c.spring.name)}</strong><br><small>${esc(c.spring.actives)}</small></td></tr>`; }).join("")}
    </tbody></table></div>
    <p class="ped-legend" style="margin-top:8px">The cycle starts at Year 1 in 2027, so spring 2026 lines up with Year 3. Read the active ingredients on the tube, not the brand. Ask your vet before dosing foals, yearlings, or pregnant and lactating mares. Full details are in your <a href="${SCHEDULE_URL}" target="_blank" rel="noopener">rotational wormer schedule</a>.</p>
  </section>`;
}

const sharedGenes = (a, b) => GENE_TESTS.map(([k]) => k).filter(k => ["carrier", "two"].includes(geneClass((a.genetics || {})[k])) && ["carrier", "two"].includes(geneClass((b.genetics || {})[k])));

function geneticsHTML(h) {
  const g = h.genetics || {};
  const tested = GENE_TESTS.filter(([k]) => g[k]).length;
  const meta = [h.genDate && `Tested ${fmt(h.genDate)}`, h.genLab && `by ${h.genLab}`, h.genRef && `ref ${h.genRef}`].filter(Boolean).join(" · ");
  return `<div class="sec-h"><h3>Genetic testing</h3>${S.canWrite ? `<button class="btn" data-act="edit-genes">${tested ? "Edit results" : "+ Add results"}</button>` : ""}</div>
  ${meta ? `<p class="wc-sub" style="margin:6px 0 0">${esc(meta)}</p>` : ""}
  <ul class="wlist">${GENE_TESTS.map(([k, name]) => { const v = g[k], c = geneClass(v); return `<li class="wr"><span><strong>${geneName(k)}</strong><br><span class="wr-note">${esc(name)}</span></span>${v ? `<span class="gene-res"><span class="pill ${GENE_PILL[c]} num">${esc(v)}</span><span class="wr-note">${GENE_LABEL[c]}</span></span>` : `<span class="pill muted">Not tested</span>`}</li>`; }).join("")}</ul>
  <p class="ped-legend" style="margin-top:8px">N/N is clear. N/R means the test isn't required because the pedigree proves the horse is clear. One copy (N/…) means the horse can pass it on. Coverings warn you when the mare and stallion carry the same gene.</p>`;
}

function geneSheet(h) {
  const g = h.genetics || {};
  openSheet(`<h2>Genetic results · ${esc(h.name)}</h2>
    <div class="fgrid">${GENE_TESTS.map(([k, name, opts]) => fld("g-" + k, geneName(k), `<select id="g-${k}" name="g-${k}">${opt(opts, g[k], "Not tested")}</select>`, "", esc(name))).join("")}
      ${fld("g-date", "Test date", inp("g-date", h.genDate, 'type="date"'))}
      ${fld("g-lab", "Laboratory", inp("g-lab", h.genLab))}
      ${fld("g-ref", "Case / report no.", inp("g-ref", h.genRef))}
    </div>
    <div class="sheet-actions"><span class="right"><button type="button" class="btn ghost" data-act="cancel">Cancel</button><button type="submit" class="btn primary">Save results</button></span></div>`, async (f) => {
    const genetics = {};
    for (const [k] of GENE_TESTS) genetics[k] = val(f, "g-" + k);
    if (!(await write(() => S.db.collection("horses").doc(h.id).update({ genetics, genDate: val(f, "g-date"), genLab: val(f, "g-lab"), genRef: val(f, "g-ref") })))) return false;
    S.tab = "genetics"; toast("Genetic results saved");
  });
}

function pedigreeHTML(h) {
  const node = (id, name, sex) => { const horse = resolve(id, name); return { horse, name: horse ? horse.name : (name || ""), sex }; };
  const parents = (n) => n.horse ? [node(n.horse.sireId, n.horse.sireName, "m"), node(n.horse.damId, n.horse.damName, "f")] : [{ name: "", sex: "m" }, { name: "", sex: "f" }];
  const g1 = parents({ horse: h });
  const g2 = g1.flatMap(parents);
  const g3 = g2.flatMap(parents);
  const cell = (n, col, row, span) => {
    const yr = n.horse && n.horse.dob ? parse(n.horse.dob).getFullYear() : "";
    const d = n.horse ? [yr, n.horse.colour, breedShort(n.horse)].filter(Boolean).join(" · ") : "";
    const nm = n.name ? (n.horse && n.horse.id !== h.id ? `<button data-open="${esc(n.horse.id)}" data-tab="pedigree">${esc(n.name)}</button>` : esc(n.name)) : "Unknown";
    return `<div class="pc ${n.sex} ${n.name ? "" : "unk"}" style="grid-column:${col};grid-row:${row} / span ${span}"><span class="pn">${nm}</span>${d ? `<span class="pd">${esc(d)}</span>` : ""}</div>`;
  };
  const cells = [];
  g1.forEach((n, i) => cells.push(cell(n, 1, i * 4 + 1, 4)));
  g2.forEach((n, i) => cells.push(cell(n, 2, i * 2 + 1, 2)));
  g3.forEach((n, i) => cells.push(cell(n, 3, i + 1, 1)));
  return `<div class="sec-h"><h3>Pedigree</h3></div>
  <div class="ped-scroll" style="margin-top:10px"><div class="ped">${cells.join("")}</div></div>
  <p class="ped-legend" style="margin-top:8px">Sire line top, dam line bottom. Ancestors you add to the register (status "Pedigree only" keeps them out of the herd list) fill in the generations behind them.</p>`;
}

const gNorm = (n) => (n || "").trim().toLowerCase();
function alleles(v) { if (!v || v === "Untested") return null; if (v === "N/R") return ["N", "N"]; const p = v.split("/"); return p.length === 2 ? p : null; }
function foalOdds(a, b) {
  const out = [0, 0, 0];
  for (const x of a) for (const y of b) out[(x === "N" ? 0 : 1) + (y === "N" ? 0 : 1)] += 25;
  return out;
}
function matingView() {
  const all = [...S.horses.values()].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const stallions = all.filter(h => ["Stallion", "Colt"].includes(h.sex));
  const mares = all.filter(h => ["Mare", "Filly"].includes(h.sex));
  const sire = S.horses.get(S.mate.s), dam = S.horses.get(S.mate.d);
  const pick = (id, label, list, cur) => fld(id, label, `<select id="${id}" name="${id}">${`<option value="">Choose…</option>` + list.map(h => `<option value="${esc(h.id)}" ${h.id === cur ? "selected" : ""}>${esc(h.name)}${h.status && h.status !== "On property" ? " (" + esc(h.status) + ")" : ""}</option>`).join("")}</select>`);
  let body = "";
  if (!stallions.length || !mares.length) body = `<p class="empty-small" style="padding-inline:0">Add at least one stallion and one mare to the register to plan a mating. Outside stallions can be added with status "Pedigree only".</p>`;
  else if (sire && dam) body = matingResult(sire, dam);
  else body = `<p class="empty-small" style="padding-inline:0">Choose a stallion and a mare to see the foal's pedigree.</p>`;
  return `<button class="btn ghost back" data-act="back">← Register</button>
  <section class="worm-hero"><span class="eyebrow">Breeding planner</span><h2>Plan a mating</h2>
    <p>See the pedigree a foal from this joining would have, any ancestors that appear on both sides, and what the genetic test results mean for the foal. Nothing is saved until you record a covering.</p>
    <div class="fgrid">${pick("mate-s", "Stallion", stallions, S.mate.s)}${pick("mate-d", "Mare", mares, S.mate.d)}</div>
  </section>${body}`;
}
function matingResult(sire, dam) {
  const node = (id, name, sex) => { const horse = resolve(id, name); return { horse, name: horse ? horse.name : (name || ""), sex }; };
  const parents = (n) => n.horse ? [node(n.horse.sireId, n.horse.sireName, "m"), node(n.horse.damId, n.horse.damName, "f")] : [{ name: "", sex: "m" }, { name: "", sex: "f" }];
  const g1 = [{ horse: sire, name: sire.name, sex: "m" }, { horse: dam, name: dam.name, sex: "f" }];
  const g2 = g1.flatMap(parents), g3 = g2.flatMap(parents), g4 = g3.flatMap(parents);
  // ancestors on both the sire's and the dam's side
  const sideNames = (half) => { const set = new Map(); [[g1, 1], [g2, 2], [g3, 4], [g4, 8]].forEach(([g, w]) => g.slice(half * w, half * w + w).forEach((n, i) => { if (n.name) { const k = gNorm(n.name); if (!set.has(k)) set.set(k, []); set.get(k).push(g === g1 ? 1 : g === g2 ? 2 : g === g3 ? 3 : 4); } })); return set; };
  const sS = sideNames(0), dS = sideNames(1);
  const common = [...sS.keys()].filter(k => dS.has(k));
  const cell = (n, col, row, span) => {
    const yr = n.horse && n.horse.dob ? parse(n.horse.dob).getFullYear() : "";
    const d = n.horse ? [yr, n.horse.colour, breedShort(n.horse)].filter(Boolean).join(" · ") : "";
    const nm = n.name ? (n.horse ? `<button data-open="${esc(n.horse.id)}" data-tab="pedigree">${esc(n.name)}</button>` : esc(n.name)) : "Unknown";
    const c = n.name && common.includes(gNorm(n.name));
    return `<div class="pc ${n.sex} ${n.name ? "" : "unk"} ${c ? "common" : ""}" style="grid-column:${col};grid-row:${row} / span ${span}"><span class="pn">${nm}</span>${d ? `<span class="pd">${esc(d)}</span>` : ""}</div>`;
  };
  const cells = [];
  g1.forEach((n, i) => cells.push(cell(n, 1, i * 8 + 1, 8)));
  g2.forEach((n, i) => cells.push(cell(n, 2, i * 4 + 1, 4)));
  g3.forEach((n, i) => cells.push(cell(n, 3, i * 2 + 1, 2)));
  g4.forEach((n, i) => cells.push(cell(n, 4, i + 1, 1)));
  const commonHTML = common.length
    ? `<div class="notice" style="border-style:solid"><p><strong>Common ancestors:</strong> ${common.map(k => { const nm = [...g1, ...g2, ...g3, ...g4].find(n => gNorm(n.name) === k).name; return `${esc(nm)} (${sS.get(k).join(" and ")} generation${sS.get(k).length > 1 ? "s" : ""} back on the sire's side, ${dS.get(k).join(" and ")} on the dam's side)`; }).join("; ")}. They're highlighted in the chart.</p></div>`
    : `<p class="wc-sub" style="margin:0">No ancestor appears on both sides within four generations.</p>`;
  const rows = GENE_TESTS.filter(([k]) => k !== "DNAPV").map(([k, name]) => {
    const sv = (sire.genetics || {})[k], dv = (dam.genetics || {})[k], sa = alleles(sv), da = alleles(dv);
    const res = (v) => v ? `<span class="pill ${GENE_PILL[geneClass(v)]} num">${esc(v)}</span>` : `<span class="pill muted">Not tested</span>`;
    let foal;
    const risky = (a) => a && a.some(x => x !== "N");
    if (sa && da) {
      const [c0, c1, c2] = foalOdds(sa, da);
      const parts = [];
      if (c2) parts.push(`<span class="pill bad">${c2}% two copies</span>`);
      if (c1) parts.push(`<span class="pill warn">${c1}% one copy</span>`);
      if (c0) parts.push(`<span class="pill ok">${c0}% clear</span>`);
      foal = parts.join(" ") + (k === "OLWS" && c2 ? `<br><span class="wr-note">O/O foals are born lethal white and do not survive.</span>` : "");
    } else if (risky(sa) || risky(da)) foal = `<span class="pill warn">Unknown</span><br><span class="wr-note">Test the ${sa ? "mare" : "stallion"} to know the odds</span>`;
    else foal = `<span class="wr-note">${!sa && !da ? "Neither tested" : "Test the " + (sa ? "mare" : "stallion")}</span>`;
    return `<li class="gr"><span><strong>${k}</strong> <span class="wr-note">${esc(name)}</span></span><span class="gr-par"><span class="wr-note">Stallion</span> ${res(sv)} <span class="wr-note">Mare</span> ${res(dv)}</span><span class="gr-foal"><span class="wr-note">Foal</span> ${foal}</span></li>`;
  }).join("");
  return `<section><div class="sec-h"><h3>Foal's pedigree</h3><span class="eyebrow">${esc(sire.name)} × ${esc(dam.name)}</span></div>
    <div class="ped-scroll" style="margin-top:10px"><div class="ped ped4">${cells.join("")}</div></div>
    <p class="ped-legend" style="margin-top:8px">Four generations behind the foal. Sire line top, dam line bottom.</p></section>
  ${commonHTML}
  <section><div class="sec-h"><h3>Genetic odds for the foal</h3></div>
    <ul class="wlist">${rows}</ul>
    <p class="ped-legend" style="margin-top:8px">Odds assume each parent passes on one of its two copies at random. N/R counts as clear.</p></section>
  ${S.canWrite ? `<div class="actions"><button class="btn primary" data-act="mate-cover">Record a covering for ${esc(dam.name)}</button></div>` : ""}`;
}

function progenyHTML(h) {
  const kids = [...S.horses.values()].filter(k => k.id !== h.id && (resolve(k.sireId, k.sireName) === h || resolve(k.damId, k.damName) === h))
    .sort((a, b) => (b.dob || "").localeCompare(a.dob || ""));
  const head = `<div class="sec-h"><h3>Progeny</h3><span class="eyebrow num">${kids.length} recorded</span></div>`;
  if (!kids.length) return head + `<p class="empty-small" style="padding-inline:0">No offspring in the register yet. Foals list here once their sire or dam is set to ${esc(h.name)}.</p>`;
  return head + `<ul class="herd" style="margin-top:10px">${kids.map(rowHTML).join("")}</ul>`;
}

/* ---------- sheets ---------- */
let sheetEl = null;
function openSheet(html, onSubmit) {
  closeSheet();
  sheetEl = document.createElement("div");
  sheetEl.className = "scrim";
  sheetEl.innerHTML = `<form class="sheet" novalidate>${html}</form>`;
  document.body.appendChild(sheetEl);
  document.body.style.overflow = "hidden";
  const form = $("form", sheetEl);
  sheetEl.addEventListener("click", e => { if (e.target === sheetEl) closeSheet(); });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("[type=submit]", form); btn.disabled = true;
    try { if (await onSubmit(form) !== false) closeSheet(); } finally { btn.disabled = false; }
  });
  $("[data-act=cancel]", form).addEventListener("click", closeSheet);
  const first = $("input,select,textarea", form); if (first && matchMedia("(min-width:700px)").matches) first.focus();
  return form;
}
function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; document.body.style.overflow = ""; } }
const opt = (list, v, blank) => (blank ? `<option value="">${blank}</option>` : "") + list.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("");
const fld = (id, label, inner, cls = "", hint = "") => `<div class="field ${cls}"><label for="${id}">${label}</label>${inner}${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
const inp = (id, v, attrs = "") => `<input id="${id}" name="${id}" value="${esc(v)}" ${attrs}>`;
const val = (form, id) => { const el = form.elements[id]; return el ? el.value.trim() : ""; };
const nameList = (id, filter) => `<datalist id="${id}">${[...S.horses.values()].filter(filter).sort((a, b) => a.name.localeCompare(b.name)).map(h => `<option value="${esc(h.name)}"></option>`).join("")}</datalist>`;

function horseSheet(h, preset = {}) {
  const x = Object.assign({ status: "On property" }, preset, h || {});
  const xb = B(x);
  const form = openSheet(`
    <h2>${h ? "Edit " + esc(h.name) : "Add a horse"}</h2>
    <fieldset><legend>Identity</legend><div class="fgrid">
      ${fld("f-name", "Registered / full name *", inp("f-name", x.name, 'required autocomplete="off"'), "wide")}
      ${fld("f-stableName", "Stable name", inp("f-stableName", x.stableName))}
      ${fld("f-sex", "Sex", `<select id="f-sex" name="f-sex">${opt(SEXES, x.sex, "Choose")}</select>`)}
      ${fld("f-dob", "Date foaled", inp("f-dob", x.dob, 'type="date"'))}
      ${fld("f-colour", "Colour", inp("f-colour", x.colour, 'placeholder="Bay, chestnut, grey…"'))}
      <div class="field wide breeds"><span class="lbl">Breed and registration</span>
        <div class="breed-row"><label class="tick"><input type="checkbox" id="f-ash" name="f-ash" ${xb.ash ? "checked" : ""}> ${ASH}</label>${inp("f-ashReg", xb.ashReg, 'placeholder="Reg. no." aria-label="Stock Horse registration number"')}</div>
        <div class="breed-row"><label class="tick"><input type="checkbox" id="f-aqha" name="f-aqha" ${xb.aqha ? "checked" : ""}> ${AQHA}</label>${inp("f-aqhaReg", xb.aqhaReg, 'placeholder="Reg. no." aria-label="Quarter Horse registration number"')}</div>
      </div>
      ${fld("f-breed", "Other breed", inp("f-breed", xb.other, 'placeholder="e.g. Thoroughbred, QH x"'))}
      ${fld("f-regNo", "Other registration no.", inp("f-regNo", xb.otherReg))}
      ${fld("f-height", "Height (hands)", inp("f-height", x.height, 'inputmode="decimal" placeholder="15.2"'))}
      ${fld("f-microchip", "Microchip", inp("f-microchip", x.microchip, 'inputmode="numeric"'))}
      ${fld("f-brand", "Brand", inp("f-brand", x.brand))}
    </div></fieldset>
    <fieldset><legend>Pedigree</legend><div class="fgrid">
      ${fld("f-sire", "Sire", inp("f-sire", x.sireId && S.horses.get(x.sireId) ? S.horses.get(x.sireId).name : x.sireName, 'list="dl-m" autocomplete="off"'), "", "Pick from your register, or type any name")}
      ${fld("f-dam", "Dam", inp("f-dam", x.damId && S.horses.get(x.damId) ? S.horses.get(x.damId).name : x.damName, 'list="dl-f" autocomplete="off"'))}
    </div>${nameList("dl-m", k => MALE.has(k.sex) && (!h || k.id !== h.id))}${nameList("dl-f", k => !MALE.has(k.sex) && (!h || k.id !== h.id))}</fieldset>
    <fieldset><legend>Where and who</legend><div class="fgrid">
      ${fld("f-status", "Status", `<select id="f-status" name="f-status">${opt(STATUSES, x.status)}</select>`)}
      ${fld("f-location", "Paddock / location", inp("f-location", x.location))}
      ${fld("f-breeder", "Bred by", inp("f-breeder", x.breeder))}
      ${fld("f-owner", "Owner", inp("f-owner", x.owner))}
      ${S.assets ? fld("f-photo", "Photo", `<input id="f-photo" name="f-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif">`, "wide", x.photo ? "Choose a file to replace the current photo" : "") : ""}
      ${fld("f-notes", "Notes", `<textarea id="f-notes" name="f-notes" placeholder="Temperament, markings, training, feed…">${esc(x.notes)}</textarea>`, "wide")}
    </div></fieldset>
    <div class="sheet-actions">${h ? `<button type="button" class="btn danger" data-act="del-horse">Delete horse</button>` : ""}<span class="right"><button type="button" class="btn ghost" data-act="cancel">Cancel</button><button type="submit" class="btn primary">${h ? "Save" : "Add horse"}</button></span></div>
  `, async (f) => {
    const name = val(f, "f-name");
    if (!name) { toast("Give the horse a name first."); f.elements["f-name"].focus(); return false; }
    const sire = byName(val(f, "f-sire")), dam = byName(val(f, "f-dam"));
    const id = h ? h.id : uid("h");
    const doc = {
      name, stableName: val(f, "f-stableName"), sex: val(f, "f-sex"), dob: val(f, "f-dob"), colour: val(f, "f-colour"),
      ...(() => { const ash = f.elements["f-ash"].checked, aqha = f.elements["f-aqha"].checked, other = val(f, "f-breed");
        return { ash, aqha, ashReg: ash ? val(f, "f-ashReg") : "", aqhaReg: aqha ? val(f, "f-aqhaReg") : "", otherBreed: other, breed: [ash && ASH, aqha && AQHA, other].filter(Boolean).join(" & ") }; })(),
      height: val(f, "f-height"), microchip: val(f, "f-microchip"), brand: val(f, "f-brand"),
      regNo: val(f, "f-regNo"), sireName: val(f, "f-sire"), sireId: sire && sire.id !== id ? sire.id : "",
      damName: val(f, "f-dam"), damId: dam && dam.id !== id ? dam.id : "", status: val(f, "f-status"),
      location: val(f, "f-location"), breeder: val(f, "f-breeder"), owner: val(f, "f-owner"), notes: val(f, "f-notes"),
      genetics: (h && h.genetics) || {}, genDate: (h && h.genDate) || "", genLab: (h && h.genLab) || "", genRef: (h && h.genRef) || "", photo: (h && h.photo) || "", example: !!(h && h.example), updatedAt: new Date().toISOString()
    };
    const file = f.elements["f-photo"] && f.elements["f-photo"].files[0];
    if (file && S.assets) {
      try { const up = await S.assets.upload(file); doc.photo = up.id; }
      catch (e) { toast(e && e.code === "too_large" ? "That photo is over 20 MB. Try a smaller one." : "The photo didn't upload. The rest will still save."); }
    }
    if (!(await write(() => S.db.collection("horses").doc(id).set(doc)))) return false;
    if (preset.fromFoaling) await write(() => S.db.collection("records").doc(preset.fromFoaling).update({ foalId: id }));
    toast(h ? "Saved" : `${name} added`);
    if (!h) { S.tab = "health"; location.hash = "h-" + id; }
  });
  const del = $("[data-act=del-horse]", form);
  if (del) del.addEventListener("click", async () => {
    if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "Tap again: deletes horse and its records"; return; }
    for (const r of recsFor(h.id)) await write(() => S.db.collection("records").doc(r.id).delete());
    await write(() => S.db.collection("horses").doc(h.id).delete());
    closeSheet(); location.hash = ""; toast(`${h.name} deleted`);
  });
}

function recSheet(h, kind, r, preset = {}) {
  const x = Object.assign({ kind, type: kind === "health" ? "Vaccination" : "Covering / AI", date: iso(today()) }, preset, r || {});
  const types = x.kind === "health" ? HEALTH_TYPES : BREED_TYPES;
  const partner = x.partnerId && S.horses.get(x.partnerId) ? S.horses.get(x.partnerId).name : (x.partnerName || "");
  const form = openSheet(`
    <h2>${r ? "Edit record" : (x.kind === "health" ? "Health record" : "Breeding record")} · ${esc(h.name)}</h2>
    <div class="tabs" role="tablist">${["health", "breeding"].map(k => `<button type="button" class="tab" role="tab" aria-selected="${x.kind === k}" data-kind="${k}" ${r ? "disabled" : ""}>${k === "health" ? "Health" : "Breeding"}</button>`).join("")}</div>
    <div class="fgrid">
      ${fld("r-type", "Type", `<select id="r-type" name="r-type">${opt(types, x.type)}</select>`)}
      ${fld("r-date", "Date", inp("r-date", x.date, 'type="date"'))}
      ${x.kind === "health" ? `
        ${fld("r-epg", "Eggs per gram", inp("r-epg", x.epg, 'inputmode="numeric"'), "only-fec", `Under ${FEC_LIMIT}: skip the spring dose`)}
        ${fld("r-product", "Product / work done", inp("r-product", x.product, 'list="dl-worm" autocomplete="off" placeholder="e.g. 2-in-1, Equimax, front shoes"'), "not-fec", "")}
        ${fld("r-weight", "Weight (kg)", inp("r-weight", x.weight, 'inputmode="decimal"'), "only-worm")}
        ${fld("r-batch", "Batch no.", inp("r-batch", x.batch), "only-worm")}
        ${fld("r-by", "Vet / farrier / dentist / lab", inp("r-by", x.by))}
        ${fld("r-due", "Next due", inp("r-due", x.due, 'type="date"'), "not-plan", `<span id="due-quick"></span>`)}
        <datalist id="dl-worm">${WORMERS.map(w => `<option value="${esc(w)}"></option>`).join("")}</datalist>
      ` : `
        ${fld("r-partner", h.sex === "Mare" || h.sex === "Filly" ? "Stallion" : "Mare", inp("r-partner", partner, 'list="dl-p" autocomplete="off"'))}
        ${fld("r-method", "Method", `<select id="r-method" name="r-method">${opt(METHODS, x.method, "—")}</select>`)}
        ${fld("r-result", "Result", `<select id="r-result" name="r-result">${opt(x.type === "Foaling" ? FOAL_RESULTS : SCAN_RESULTS, x.result, "—")}</select>`)}
        ${nameList("dl-p", k => k.id !== h.id)}
      `}
      ${fld("r-cost", "Cost ($)", inp("r-cost", x.cost, 'inputmode="decimal"'))}
      ${fld("r-details", "Notes", `<textarea id="r-details" name="r-details">${esc(x.details)}</textarea>`, "wide")}
    </div>
    <div class="sheet-actions">${r ? `<button type="button" class="btn danger" data-act="del-rec">Delete</button>` : ""}<span class="right"><button type="button" class="btn ghost" data-act="cancel">Cancel</button><button type="submit" class="btn primary">Save record</button></span></div>
  `, async (f) => {
    const date = val(f, "r-date");
    if (!date) { toast("Add the date."); return false; }
    const doc = { horseId: h.id, kind: x.kind, type: val(f, "r-type"), date, cost: val(f, "r-cost"), details: val(f, "r-details"), example: !!(r && r.example), foalId: (r && r.foalId) || "" };
    if (x.kind === "health") {
      const t = doc.type;
      Object.assign(doc, { product: t === "Faecal egg count" ? "" : val(f, "r-product"), by: val(f, "r-by"), due: t === "Worming" || t === "Faecal egg count" ? "" : val(f, "r-due"),
        epg: t === "Faecal egg count" ? val(f, "r-epg") : "", weight: t === "Worming" ? val(f, "r-weight") : "", batch: t === "Worming" ? val(f, "r-batch") : "" });
      if (t === "Faecal egg count" && (doc.epg === "" || isNaN(Number(doc.epg)))) { toast("Enter the egg count as a number of eggs per gram."); return false; }
    }
    else { const p = byName(val(f, "r-partner")); Object.assign(doc, { partnerName: val(f, "r-partner"), partnerId: p ? p.id : "", method: val(f, "r-method"), result: val(f, "r-result") }); }
    const id = r ? r.id : uid("r");
    if (!(await write(() => S.db.collection("records").doc(id).set(doc)))) return false;
    S.tab = x.kind; toast("Record saved"); render();
  });
  form.querySelectorAll("[data-kind]").forEach(b => b.addEventListener("click", () => recSheet(h, b.dataset.kind)));
  const typeSel = form.elements["r-type"], resSel = form.elements["r-result"];
  if (resSel) typeSel.addEventListener("change", () => { resSel.innerHTML = opt(typeSel.value === "Foaling" ? FOAL_RESULTS : SCAN_RESULTS, "", "—"); });
  if (x.kind === "health") {
    const sync = () => {
      const t = typeSel.value, worm = t === "Worming", fec = t === "Faecal egg count";
      form.querySelectorAll(".only-fec").forEach(el => el.hidden = !fec);
      form.querySelectorAll(".only-worm").forEach(el => el.hidden = !worm);
      form.querySelectorAll(".not-fec").forEach(el => el.hidden = fec);
      form.querySelectorAll(".not-plan").forEach(el => el.hidden = worm || fec);
      const p = form.elements["r-product"];
      if (worm && !p.value && !r) { const d = val(form, "r-date"); const rd = d ? [makeRound("autumn", parse(d).getFullYear()), makeRound("spring", parse(d).getFullYear())].find(k => d >= k.start && d <= k.close) : null; if (rd || !d) p.value = (rd || currentRound()).product.name; }
    };
    typeSel.addEventListener("change", sync); sync();
  }
  const quick = $("#due-quick", form);
  if (quick) {
    quick.innerHTML = [["6 wks", 42], ["8 wks", 56], ["3 mths", 91], ["6 mths", 182], ["1 yr", 365]].map(([l, n]) => `<button type="button" class="link" data-plus="${n}" style="margin-right:10px;font-size:12px">+${l}</button>`).join("");
    quick.addEventListener("click", e => { const b = e.target.closest("[data-plus]"); if (b && val(form, "r-date")) form.elements["r-due"].value = addDays(val(form, "r-date"), +b.dataset.plus); });
  }
  const del = $("[data-act=del-rec]", form);
  if (del) del.addEventListener("click", async () => {
    if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "Tap again to delete"; return; }
    await write(() => S.db.collection("records").doc(r.id).delete()); closeSheet(); toast("Record deleted");
  });
}

/* ---------- data ---------- */
async function write(fn) {
  try { await fn(); return true; }
  catch (e) {
    if (e && e.code === "invalid_argument") { S.canWrite = false; render(); toast("You can view this stud book but not change it."); }
    else if (e && e.code === "quota_exceeded") toast("The stud book is full. Delete some old records to make room.");
    else if (e && e.code === "unavailable") { try { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); await fn(); return true; } catch { toast("Couldn't save. Check your connection and try again."); } }
    else toast("Couldn't save. Try again in a moment.");
    return false;
  }
}

const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCSV = (cols, rows) => [cols.map(c => c[0]).join(","), ...rows.map(r => cols.map(c => csvCell(c[1](r))).join(","))].join("\n");
async function exportCSV(which) {
  const stamp = iso(today());
  const data = which === "horses"
    ? toCSV([["Name", h => h.name], ["Stable name", h => h.stableName], ["Sex", h => h.sex], ["Foaled", h => h.dob], ["Age", h => ageOf(h.dob) ?? ""], ["Colour", h => h.colour], ["Breed", h => h.breed], ["Height (hh)", h => h.height], ["Microchip", h => h.microchip], ["Brand", h => h.brand], ["ASH reg. no.", h => B(h).ash ? B(h).ashReg || "Yes" : ""], ["AQHA reg. no.", h => B(h).aqha ? B(h).aqhaReg || "Yes" : ""], ["Other registration", h => B(h).otherReg], ["Sire", h => parentName(h, "sire")], ["Dam", h => parentName(h, "dam")], ["Status", h => h.status], ["Location", h => h.location], ["Bred by", h => h.breeder], ["Owner", h => h.owner], ...GENE_TESTS.map(([k]) => [geneName(k), h => (h.genetics || {})[k] || ""]), ["Genetic test date", h => h.genDate], ["Notes", h => h.notes]], [...S.horses.values()].sort((a, b) => a.name.localeCompare(b.name)))
    : toCSV([["Horse", r => (S.horses.get(r.horseId) || {}).name], ["Kind", r => r.kind], ["Type", r => r.type], ["Date", r => r.date], ["Product / work", r => r.product], ["By", r => r.by], ["Next due", r => r.due], ["Eggs per gram", r => r.epg], ["Weight (kg)", r => r.weight], ["Batch", r => r.batch],["Partner", r => r.partnerName], ["Method", r => r.method], ["Result", r => r.result], ["Cost", r => r.cost], ["Notes", r => r.details]], sortRecs(S.records));
  try { await S.downloads.save({ filename: `camelock-${which}-${stamp}.csv`, data }); }
  catch (e) { if (e && e.code !== "cancelled" && e.code !== "declined") toast("The export didn't save."); }
}

async function clearExamples() {
  for (const r of S.records.filter(r => r.example)) await write(() => S.db.collection("records").doc(r.id).delete());
  for (const h of [...S.horses.values()].filter(h => h.example)) await write(() => S.db.collection("horses").doc(h.id).delete());
  S.armed = null; toast("Examples removed");
}

/* ---------- photos ---------- */
const photoCache = new Map();
function loadPhotos() {
  document.querySelectorAll("img[data-photo]").forEach(async img => {
    const id = img.dataset.photo;
    try {
      if (!photoCache.has(id)) photoCache.set(id, platform.photo(id));
      const url = await photoCache.get(id);
      if (url) { img.src = url; img.removeAttribute("data-photo"); } else img.remove();
    } catch { img.remove(); }
  });
}

/* ---------- backup ---------- */
async function saveBackup() {
  const data = JSON.stringify({
    app: "camelock-horses", saved: new Date().toISOString(),
    horses: Object.fromEntries([...S.horses.values()].map(({ id, ...d }) => [id, d])),
    records: Object.fromEntries(S.records.map(({ id, ...d }) => [id, d])),
    photos: await platform.allPhotos()
  });
  try { await S.downloads.save({ filename: `camelock-backup-${iso(today())}.json`, data }); } catch { toast("The backup didn't save."); }
}
document.addEventListener("change", async e => {
  if (e.target.id !== "import-file" || !e.target.files[0]) return;
  let b;
  try { b = JSON.parse(await e.target.files[0].text()); } catch { toast("That file isn't a Camelock backup."); return; }
  e.target.value = "";
  if (!b || typeof b.horses !== "object" || typeof b.records !== "object") { toast("That file isn't a Camelock backup."); return; }
  if (!navigator.onLine) { toast("Connect to the internet to import a backup."); return; }
  const n = Object.keys(b.horses).length, m = Object.keys(b.records).length;
  toast(`Importing ${n} horses and ${m} records…`);
  try {
    await platform.importBackup(b, (done, total) => toast(`Importing… ${done} of ${total}`));
    toast(`Imported ${n} horses and ${m} records`);
  } catch (err) { console.error(err); toast("The import stopped part-way. Check your connection and import the same file again."); }
});

/* ---------- events ---------- */
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }

document.addEventListener("click", e => {
  const open = e.target.closest("[data-open]");
  if (open) { if (open.dataset.tab) S.tab = open.dataset.tab; else if (!location.hash.startsWith("#h-")) S.tab = "health"; location.hash = "h-" + open.dataset.open; window.scrollTo(0, 0); return; }
  const g = e.target.closest("[data-goto]");
  if (g) { location.hash = g.dataset.goto; window.scrollTo(0, 0); return; }
  const f = e.target.closest("[data-filter]");
  if (f) { S.filter = f.dataset.filter; render(); return; }
  const t = e.target.closest("[data-tab-set]");
  if (t) { S.tab = t.dataset.tabSet; render(); return; }
  const a = e.target.closest("[data-act]");
  if (!a || a.closest(".sheet")) return;
  const m = location.hash.match(/^#h-(.+)$/); const h = m && S.horses.get(m[1]);
  switch (a.dataset.act) {
    case "back": location.hash = ""; break;
    case "worm-dose": { const wh = S.horses.get(a.dataset.h); if (wh) recSheet(wh, "health", null, { type: "Worming", product: currentRound().product.name }); break; }
    case "worm-fec": { const wh = S.horses.get(a.dataset.h); if (wh) recSheet(wh, "health", null, { type: "Faecal egg count" }); break; }
    case "add-horse": horseSheet(null); break;
    case "edit-horse": horseSheet(h); break;
    case "edit-genes": geneSheet(h); break;
    case "plan-mate": if (h) { if (["Mare", "Filly"].includes(h.sex)) S.mate.d = h.id; else S.mate.s = h.id; } location.hash = "mating"; break;
    case "mate-cover": { const d = S.horses.get(S.mate.d), st = S.horses.get(S.mate.s); if (d && st) recSheet(d, "breeding", null, { type: "Covering / AI", partnerName: st.name, partnerId: st.id }); break; }
    case "add-rec": recSheet(h, S.tab === "breeding" ? "breeding" : "health"); break;
    case "edit-rec": { const r = S.records.find(x => x.id === a.dataset.rec); if (r) recSheet(h, r.kind, r); break; }
    case "add-foal": {
      const r = S.records.find(x => x.id === a.dataset.rec);
      const sire = resolve(r.partnerId, r.partnerName);
      horseSheet(null, { dob: r.date, sex: r.result === "Colt" ? "Colt" : "Filly", damName: h.name, damId: h.id, sireName: sire ? sire.name : (r.partnerName || ""), sireId: sire ? sire.id : "", ash: B(h).ash, aqha: B(h).aqha, otherBreed: B(h).other, fromFoaling: r.id, breeder: h.breeder });
      break;
    }
    case "clear-examples": if (S.armed === "examples") clearExamples(); else { S.armed = "examples"; render(); } break;
    case "export-horses": exportCSV("horses"); break;
    case "export-records": exportCSV("records"); break;
    case "backup": saveBackup(); break;
    case "import": $("#import-file").click(); break;
    case "sign-out": platform.signOut(); break;
  }
});
document.addEventListener("input", e => { if (e.target.id === "q") { S.q = e.target.value; const pos = e.target.selectionStart; render(); const q = $("#q"); if (q) { q.focus(); q.setSelectionRange(pos, pos); } } });
document.addEventListener("change", e => { if (e.target.id === "mate-s" || e.target.id === "mate-d") { S.mate[e.target.id === "mate-s" ? "s" : "d"] = e.target.value; render(); } });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
$("#add-horse").addEventListener("click", () => horseSheet(null));
window.addEventListener("hashchange", () => { closeSheet(); render(); window.scrollTo(0, 0); });

async function start() {
  const c = platform;
  if (!c || !c.use) { S.failed = true; render(); return; }
  const db = await c.use("db");
  if (!db) { S.failed = true; render(); return; }
  S.db = db;
  c.use("user").then(async u => { if (u) { const can = await u.can("data.write"); S.canWrite = can !== false; render(); } });
  c.use("assets").then(a => { S.assets = a; });
  c.use("downloads").then(d => { S.downloads = d; render(); });
  const onErr = () => { S.failed = true; render(); };
  db.collection("horses").onSnapshot(snap => {
    S.horses = new Map(snap.docs.map(d => [d.id, Object.assign({ id: d.id }, d.data())]));
    S.loaded.horses = true; render();
  }, onErr);
  db.collection("records").onSnapshot(snap => {
    S.records = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    S.loaded.records = true; render();
  }, onErr);
}
start();
}
