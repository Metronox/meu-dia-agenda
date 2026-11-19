const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const IC = {
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  repeat:
    '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause:
    '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  calendar:
    '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  target:
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
};
const ic = (n, z = 20) =>
  `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const today = () => iso(new Date());
const fd = (d) =>
  d === today()
    ? "Hoje"
    : d === iso(new Date(Date.now() + 864e5))
      ? "Amanhã"
      : d.split("-").reverse().join("/");

const seed = () => ({ tasks: [], pages: [] });
let S = null;
try {
  S = JSON.parse(localStorage.getItem("meudia"));
} catch (e) {}
if (!S || !S.tasks) S = seed();
const save = () => {
  try {
    localStorage.setItem("meudia", JSON.stringify(S));
  } catch (e) {}
};

let pendImp = null,
  impErr = "",
  edit = null,
  askX = null,
  askDel = null,
  tab = "hoje",
  cur = null,
  ring = null,
  ac = null,
  loop = null,
  on = false;

/* ---------- views ---------- */
const addD = (d, n) => {
  const x = new Date(d + "T12:00");
  x.setDate(x.getDate() + n);
  return iso(x);
};
function matches(t, d) {
  const r = t.rep;
  if (!r) return false;
  const x = new Date(d + "T12:00"),
    w = x.getDay();
  if (r.type === "daily") return true;
  if (r.type === "weekdays") return w > 0 && w < 6;
  if (r.type === "days") return r.days.includes(w);
  if (r.type === "monthly") {
    const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    return x.getDate() === Math.min(r.dom, last);
  }
  return false;
}
const nextOcc = (t, from) => {
  for (let n = 1; n < 800; n++) {
    const d = addD(from, n);
    if (matches(t, d)) return d;
  }
  return null;
};
function reset(t, d) {
  if (d) t.date = d;
  t.done = false;
  t.started = false;
  t.skipped = false;
  t.snooze = 0;
  t.pf = false;
}
const advance = (t) => {
  const n = nextOcc(t, t.date);
  if (n) reset(t, n);
};
function rollover() {
  const T = today();
  let c = false;
  S.tasks.forEach((t) => {
    if (t.rep && t.date < T) {
      const n = nextOcc(t, addD(T, -1));
      if (n) {
        reset(t, n);
        c = true;
      }
    }
  });
  if (c) save();
}
const repL = (t) => {
  const r = t.rep,
    D = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  return (
    { daily: "todo dia", weekdays: "seg a sex", monthly: "todo mês, dia " + r.dom }[r.type] ||
    r.days.map((d) => D[d]).join(", ")
  );
};
const when = (t) => {
  if (!t.time) return "Sem horário";
  const m = Math.round((new Date(t.date + "T" + t.time) - Date.now()) / 6e4);
  return t.time + (m >= 0 ? " · em " + fh(m * 60) : " · atrasada " + fh(-m * 60));
};
const editRow = (k, v) =>
  `<div class="row" style="margin:6px 0"><input id="ev" value="${esc(v)}" aria-label="Novo nome"><button class="btn" data-a="saveE" data-k="${k}">Salvar</button><button class="btn sec" data-a="askN">Cancelar</button></div>`;
function taskForm(t) {
  const r = t.rep ? t.rep.type : "none",
    D = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const op = (v, l, c) => `<option value="${v}"${v == c ? " selected" : ""}>${l}</option>`;
  return `<div class="card" style="border-color:var(--ac)"><input id="et" value="${esc(t.title)}" aria-label="Título">
  <div class="row"><input id="etd" type="date" value="${t.date || ""}"><input id="etm" data-hm="1" inputmode="numeric" maxlength="5" placeholder="Hora (ex: 0730)" value="${t.time || ""}" aria-label="Hora"></div>
  <div class="row"><select id="etr" style="flex:1;max-width:none" aria-label="Repetir">${[
    ["none", "Não repete"],
    ["daily", "Todo dia"],
    ["weekdays", "Seg a sex"],
    ["days", "Dias escolhidos"],
    ["monthly", "Todo mês"],
  ]
    .map((a) => op(a[0], a[1], r))
    .join("")}</select>
  <select id="etp" style="flex:1;max-width:none" aria-label="Pré-alarme">${[
    [0, "Sem pré-alarme"],
    [5, "Avisar 5 min antes"],
    [10, "Avisar 10 min antes"],
    [15, "Avisar 15 min antes"],
    [30, "Avisar 30 min antes"],
    [60, "Avisar 1 h antes"],
  ]
    .map((a) => op(a[0], a[1], t.pre || 0))
    .join("")}</select></div>
  <div class="row" id="etdays" style="display:${r === "days" ? "flex" : "none"};flex-wrap:wrap">${D.map((d, n) => `<label class="chip"><input type="checkbox" value="${n}"${t.rep && t.rep.days && t.rep.days.includes(n) ? " checked" : ""}>${d}</label>`).join("")}</div>
  <div class="row"><select id="etsnd" style="flex:1;max-width:none" aria-label="Som do alarme">${sndOpts(t.snd || "sirene")}</select><button class="btn sec" data-prev="etsnd">Ouvir</button></div>
  <div class="row"><button class="btn sec" style="flex:1;opacity:.65" data-soon="1">Escolher som do celular ou PC (em breve)</button></div>
  <div class="row"><label class="chip"><input type="checkbox" id="etl"${t.lock === false ? "" : " checked"}>${ic("lock", 14)} Exigir código para silenciar</label></div>
  <div class="row"><button class="btn" style="flex:1" data-a="saveT" data-i="${t.id}">Salvar alterações</button><button class="btn sec" data-a="askN">Cancelar</button></div></div>`;
}
function taskRow(t) {
  if (edit === "t:" + t.id) return taskForm(t);
  const tg = [
    `<button class="tag" style="border:0;cursor:pointer;font-size:15px" data-a="togL" data-i="${t.id}" aria-label="${t.lock === false ? "Sem código. Tocar para exigir" : "Com código. Tocar para dispensar"}">${ic(t.lock === false ? "unlock" : "lock", 15)}</button>`,
  ];
  if (t.rep) tg.push(`<span class="tag">${ic("repeat", 12)} ${repL(t)}</span>`);
  if (t.started && !t.done) tg.push('<span class="tag">Em andamento</span>');
  if (t.skipped) tg.push('<span class="tag">Não deu para fazer</span>');
  return `<div class="item"><button class="ck ${t.done && !t.skipped ? "on" : ""}" data-a="togT" data-i="${t.id}" aria-label="Concluir">${ic("check", 15)}</button>
  <div class="grow"><div class="${t.done ? "dn" : ""}">${esc(t.title)}</div><div class="mut sm">${t.time || "Sem horário"}${t.pre ? " · aviso " + t.pre + " min antes" : ""} ${tg.join(" ")}</div></div>
  <button class="x" data-a="editT" data-i="${t.id}" aria-label="Editar tarefa" style="font-size:18px">${ic("pencil", 18)}</button><button class="x" data-a="delT" data-i="${t.id}" aria-label="Apagar">${ic("x", 18)}</button></div>`;
}
function vHoje() {
  const T = today(),
    k = (t) => (t.started ? "0" : "1") + t.date + (t.time || "99");
  const L = S.tasks
    .filter((t) => !t.done && t.date && t.date <= T)
    .sort((a, b) => k(a).localeCompare(k(b)));
  const f = L[0];
  if (!f)
    return `<div class="card" style="text-align:center;padding:32px 16px"><div style="font-size:22px;font-weight:800">Tudo em dia por hoje</div><p class="mut">Nada pendente. Na aba Agenda você marca o que vem a seguir.</p></div>`;
  let h = `<div class="card" style="border-color:var(--ac);padding:18px"><div class="gh"><span class="tag">${f.started ? "Fazendo agora" : "Próxima"}</span><button class="x" data-a="editT" data-i="${f.id}" aria-label="Editar tarefa" style="font-size:18px">${ic("pencil", 18)}</button></div><div style="font-size:28px;font-weight:800;margin:10px 0 4px">${esc(f.title)}</div><div class="mut">${f.started ? "Em andamento" : when(f)}</div>
  <div class="row" style="flex-direction:column">${f.started ? "" : `<button class="btn" style="flex:1;min-height:52px" data-a="begin" data-i="${f.id}">${ic("play", 16)} Comecei agora</button>`}<button class="btn ${f.started ? "" : "sec"}" style="flex:1;min-height:52px" data-a="togT" data-i="${f.id}">${f.started ? "Terminei" : "Já fiz"}</button></div></div>`;
  if (edit === "t:" + f.id) h = taskForm(f);
  const rest = L.slice(1);
  if (rest.length) h += "<h3>Depois, hoje</h3>" + rest.map(taskRow).join("");
  return h;
}
function vAgenda() {
  const open = S.tasks
    .filter((t) => !t.done)
    .sort((a, b) =>
      ((a.date || "9") + (a.time || "")).localeCompare((b.date || "9") + (b.time || "")),
    );
  const done = S.tasks.filter((t) => t.done);
  let h = `<div class="card"><input id="tt" placeholder="O que você precisa fazer?">
  <div class="row"><input id="td" type="date" value="${today()}"><input id="tm" data-hm="1" inputmode="numeric" maxlength="5" placeholder="Hora (ex: 0730)" aria-label="Hora"></div>
  <div class="row"><select id="tr" style="flex:1;max-width:none" aria-label="Repetir"><option value="none">Não repete</option><option value="daily">Todo dia</option><option value="weekdays">Seg a sex</option><option value="days">Dias escolhidos</option><option value="monthly">Todo mês</option></select>
  <select id="tp" style="flex:1;max-width:none" aria-label="Pré-alarme"><option value="0">Sem pré-alarme</option><option value="5">Avisar 5 min antes</option><option value="10">Avisar 10 min antes</option><option value="15">Avisar 15 min antes</option><option value="30">Avisar 30 min antes</option><option value="60">Avisar 1 h antes</option></select></div>
  <div class="row" id="tdays" style="display:none;flex-wrap:wrap">${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d, n) => `<label class="chip"><input type="checkbox" value="${n}">${d}</label>`).join("")}</div>
  <div class="row"><select id="tsnd" style="flex:1;max-width:none" aria-label="Som do alarme">${sndOpts(S.lastSnd || "sirene")}</select><button class="btn sec" data-prev="tsnd">Ouvir</button></div>
  <div class="row"><button class="btn sec" style="flex:1;opacity:.65" data-soon="1">Escolher som do celular ou PC (em breve)</button></div>
  <div class="row"><label class="chip"><input type="checkbox" id="tl" checked>${ic("lock", 14)} Exigir código para silenciar</label></div>
  <div class="row"><button class="btn" style="flex:1" data-a="addT">Adicionar à agenda</button></div></div>`;
  let last = null;
  open.forEach((t) => {
    if (t.date !== last) {
      last = t.date;
      h += `<h3>${t.date ? fd(t.date) : "Sem data"}</h3>`;
    }
    h += taskRow(t);
  });
  if (!open.length)
    h +=
      '<p class="mut">Nada marcado ainda. Escreva a primeira tarefa e defina o horário do alarme.</p>';
  if (done.length) h += "<h3>Concluídas</h3>" + done.map(taskRow).join("");
  return h;
}
const fmt = (v) => {
  v = Math.max(0, Math.ceil(v));
  const h = Math.floor(v / 3600),
    m = Math.floor((v % 3600) / 60),
    q = v % 60,
    p = (n) => String(n).padStart(2, "0");
  return (h ? h + ":" : "") + p(m) + ":" + p(q);
};
const hm = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  if (!d) return "";
  let h, m;
  if (d.length <= 2) {
    h = +d;
    m = 0;
  } else if (d.length === 3) {
    h = +d[0];
    m = +d.slice(1);
  } else {
    h = +d.slice(0, 2);
    m = +d.slice(2, 4);
  }
  return h < 24 && m < 60 ? String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") : "";
};
const fhs = (v) => {
  v = Math.round(v);
  const h = Math.floor(v / 3600),
    m = Math.floor((v % 3600) / 60),
    q = v % 60;
  return [h && h + "h", m && m + "min", (q || !(h || m)) && q + "s"].filter(Boolean).join(" ");
};
const fh = (v) => {
  v = Math.round(v / 60);
  const h = Math.floor(v / 60),
    m = v % 60;
  return h ? h + "h" + (m ? String(m).padStart(2, "0") : "") : m + " min";
};
const sec = (i) => (i.acc || 0) + (i.run ? (Date.now() - i.run) / 1000 : 0);
const cfm = (msg, yes, attrs) =>
  `<div class="card" style="border-color:#ef4444;margin:8px 0"><b>${msg}</b><div class="mut sm" style="margin-top:4px">Não dá para desfazer.</div><div class="row"><button class="btn" style="background:#ef4444;flex:1" data-a="${yes}" ${attrs}>Sim, apagar</button><button class="btn sec" style="flex:1" data-a="askN">Cancelar</button></div></div>`;
const bad = (l) => (l.t === "check" && !l.done ? "color:#f87171" : "");
const dm = (d) => d.slice(8) + "/" + d.slice(5, 7);
const sum = (l) =>
  [
    l.t === "check" ? (l.done ? "feito ✓" : "não feito") : "",
    l.t === "time" ? fhs(l.secs || 0) + (l.goal ? " de " + fhs(l.goal) : "") : "",
    l.note,
  ]
    .filter(Boolean)
    .join(" · ");
function hist(i, k) {
  const L = i.log || [];
  if (!L.length) return "";
  return `<div class="sm" style="margin-top:8px;padding:8px;border-radius:0 10px 10px 0;border-left:3px solid ${bad(L[0]) ? "#f87171" : "var(--ac)"};background:var(--card2)"><span class="tag">Última vez · ${dm(L[0].d)}</span> <span style="${bad(L[0])}">${esc(sum(L[0]))}</span></div>
  <details class="sm" style="margin-top:6px"><summary class="mut">Histórico (${L.length})</summary>${L.map((l, n) => `<div class="gh" style="padding:4px 0;gap:8px"><span class="grow" style="${bad(l)}">${dm(l.d)}: ${esc(sum(l))}</span><button class="x" data-a="delL" ${k} data-l="${n}" aria-label="Apagar registro">${ic("x", 18)}</button></div>`).join("")}</details>`;
}
function itemRow(g, i) {
  const k = `data-g="${g.id}" data-i="${i.id}"`,
    ty = i.type || "check";
  const del = `<button class="x" data-a="ed" data-k="i:${g.id}:${i.id}" aria-label="Renomear item" style="font-size:18px">${ic("pencil", 18)}</button><button class="x" data-a="delI" ${k} aria-label="Apagar item">${ic("x", 18)}</button>`;
  const nm = edit === "i:" + g.id + ":" + i.id ? editRow("i:" + g.id + ":" + i.id, i.text) : "";
  const cf = askX === "i:" + i.id ? cfm('Apagar "' + esc(i.text) + '"?', "delIY", k) : "";
  if (ty === "time") {
    const g0 = i.goal || 3600;
    return `<div class="item" style="flex-wrap:wrap"><div class="grow">${nm || `<b>${esc(i.text)}</b>`}</div>${del}
  <div style="flex:0 0 100%;min-width:0">
  <div class="row" style="align-items:center;flex-wrap:wrap"><span data-sw="${i.id}" style="font-size:28px;font-weight:800;min-width:110px">${fmt(g0 - sec(i))}</span><button class="btn" data-a="sw" ${k}>${i.run ? ic("pause", 16) + " Pausar" : ic("play", 16) + " Iniciar"}</button><button class="btn sec" data-a="swr" ${k} aria-label="Zerar">${ic("rotate-ccw", 16)}</button></div>
  <div class="mut sm" data-el="${i.id}" style="margin-top:6px">Feito: ${fhs(sec(i))}</div>
  <div class="row" style="align-items:center;flex-wrap:wrap"><span class="mut sm">Meta</span>${[
    ["gh", "h", Math.floor(g0 / 3600)],
    ["gm", "min", Math.floor((g0 % 3600) / 60)],
    ["gs", "s", g0 % 60],
  ]
    .map(
      (a) =>
        `<input data-f="${a[0]}" ${k} inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${a[2]}" style="width:56px;text-align:center" aria-label="${a[1]}"><span class="mut sm">${a[1]}</span>`,
    )
    .join("")}</div>${hist(i, k)}${cf}</div></div>`;
  }
  if (ty !== "check")
    return `<div class="item"><div class="grow">${nm || `<b>${esc(i.text)}</b>`}<textarea data-f="note" ${k} rows="3" placeholder="Escreva aqui...">${esc(i.note)}</textarea>${hist(i, k)}${cf}</div>${del}</div>`;
  return `<div class="item"><button class="ck ${i.done ? "on" : ""}" data-a="togI" ${k} aria-label="Marcar">${ic("check", 15)}</button><div class="grow">${nm || `<div class="${i.done ? "dn" : ""}">${esc(i.text)}</div>`}<textarea data-f="note" ${k} rows="2" placeholder="Anotações (opcional)">${esc(i.note)}</textarea>${hist(i, k)}${cf}</div>${del}</div>`;
}
function backupCard() {
  const n = pendImp ? `${pendImp.tasks.length} tarefas e ${pendImp.pages.length} páginas` : "";
  return (
    `<h3>Backup</h3><div class="card"><div class="mut sm">Seus dados ficam só neste aparelho. Exporte um arquivo de tempos em tempos para não perdê-los se limpar os dados do navegador, ou para levar para outro aparelho.</div>
  <div class="row"><button class="btn" style="flex:1" data-a="exportB">Exportar backup</button><button class="btn sec" style="flex:1" data-a="pickB">Importar backup</button></div>
  <input type="file" id="bf" accept=".json,application/json" hidden>
  ${impErr ? `<div class="sm" style="color:#f87171;margin-top:8px">${esc(impErr)}</div>` : ""}</div>` +
    (pendImp
      ? cfm("Substituir tudo pelo backup (" + n + ")?", "impY", "")
          .replace("Sim, apagar", "Sim, substituir")
          .replace(
            "Não dá para desfazer.",
            "Os dados atuais deste aparelho serão trocados. Exporte um backup antes se quiser guardá-los.",
          )
      : "")
  );
}
function vPages() {
  if (!cur) {
    return (
      `` +
      S.pages
        .map(
          (p) =>
            `<button class="pg" data-a="openP" data-p="${p.id}"><span>${esc(p.name)}</span><span class="mut sm">${p.groups.length} ${p.groups.length === 1 ? "seção" : "seções"}</span></button>`,
        )
        .join("") +
      `${S.pages.length ? "" : '<p class="mut">Páginas organizam o que você quiser: uma rotina, um projeto, uma lista. Crie a primeira abaixo.</p>'}<div class="row"><input id="np" placeholder="Nome da nova página"><button class="btn" data-a="addP">Criar</button></div>` +
      backupCard()
    );
  }
  const p = S.pages.find((x) => x.id === cur);
  if (!p) {
    cur = null;
    return vPages();
  }
  let h = `<div class="row" style="margin:0 0 6px"><button class="btn sec" data-a="back">${ic("arrow-left", 16)} Voltar</button><button class="btn sec" data-a="delP" data-p="${p.id}">Apagar página</button></div>${edit === "p:" + p.id ? editRow("p:" + p.id, p.name) : `<h2 class="gh" style="gap:8px"><span>${esc(p.name)}</span><button class="x" data-a="ed" data-k="p:${p.id}" aria-label="Renomear página" style="font-size:18px">${ic("pencil", 18)}</button></h2>`}`;
  if (askDel === p.id)
    h += `<div class="card" style="border-color:#ef4444"><b>Apagar "${esc(p.name)}"?</b><div class="mut sm" style="margin-top:4px">Todas as seções, itens e históricos desta página serão apagados. Não dá para desfazer.</div><div class="row"><button class="btn" style="background:#ef4444;flex:1" data-a="delPY" data-p="${p.id}">Sim, apagar</button><button class="btn sec" style="flex:1" data-a="delPN">Cancelar</button></div></div>`;
  p.groups.forEach((g) => {
    h +=
      `<div class="card">${edit === "g:" + g.id ? editRow("g:" + g.id, g.name) : ""}<div class="gh"${edit === "g:" + g.id ? ' style="display:none"' : ""}><button class="x" style="font-size:16px;font-weight:700;color:var(--tx);text-align:left;justify-content:flex-start;gap:6px;flex:1;padding:6px 0" data-a="togC" data-g="${g.id}" aria-expanded="${!g.c}">${ic(g.c ? "chevron-right" : "chevron-down", 18)} ${esc(g.name)}</button><span style="display:flex;align-items:center">${(() => {
        const c = g.items.filter((i) => (i.type || "check") === "check");
        return c.length
          ? `<span class="tag" style="background:rgba(52,211,153,.15);color:#34d399">${c.filter((i) => i.done).length} de ${c.length}</span>`
          : "";
      })()}<button class="x" data-a="ed" data-k="g:${g.id}" aria-label="Renomear seção" style="font-size:18px">${ic("pencil", 18)}</button><button class="x" data-a="delG" data-g="${g.id}" aria-label="Apagar seção">${ic("x", 18)}</button></span></div>` +
      (askX === "g:" + g.id
        ? cfm(
            'Apagar a seção "' + esc(g.name) + '" e seus ' + g.items.length + " itens?",
            "delGY",
            `data-g="${g.id}"`,
          )
        : "") +
      (g.c
        ? `<div class="mut sm" style="margin-top:4px">${g.items.length} itens</div>`
        : g.items.map((i) => itemRow(g, i)).join("") +
          `<div class="row"><input data-in="${g.id}" placeholder="Novo item"><select data-ty="${g.id}" aria-label="Tipo do item"><option value="check">Checklist</option><option value="text">Texto</option><option value="time">Tempo</option></select><button class="btn" data-a="addI" data-g="${g.id}">+</button></div>` +
          `<div class="mut sm" style="margin:14px 0 6px">Salvar com a data de</div><div class="row" style="margin-top:0"><input type="date" data-f="sd" data-g="${g.id}" value="${g.sd || today()}" max="${today()}"><button class="btn" data-a="saveD" data-g="${g.id}">Salvar</button></div>`) +
      "</div>";
  });
  h += `${p.groups.length ? "" : '<p class="mut">Esta página está vazia. Crie uma seção para começar. Dentro dela você adiciona itens com caixinha, texto ou cronômetro.</p>'}<div class="row"><input id="ng" placeholder="Nova seção"><button class="btn" data-a="addG">Criar</button></div>`;
  return h;
}
function render() {
  const T = today(),
    pend = S.tasks.filter((t) => !t.done && t.date && t.date <= T).length,
    dn = (S.dn || {})[T] || 0;
  $("nav").innerHTML = [
    ["hoje", "target", "Hoje"],
    ["agenda", "calendar", "Agenda"],
    ["paginas", "book", "Páginas"],
  ]
    .map(
      (a) =>
        `<button class="tab${tab === a[0] ? " on" : ""}" data-t="${a[0]}">${ic(a[1], 22)}<span>${a[2]}</span></button>`,
    )
    .join("");
  $("#ttl").textContent = { hoje: "Hoje", agenda: "Agenda", paginas: "Páginas" }[tab];
  $("#prog").innerHTML =
    tab === "hoje" && dn + pend
      ? `<div class="mut sm" style="text-align:right;color:var(--ac2)">${dn} de ${dn + pend} feitas</div><div class="pbar"><div style="width:${Math.round((dn / (dn + pend)) * 100)}%"></div></div>`
      : "";
  $("#sub").textContent = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  $("#en").innerHTML = on
    ? ""
    : `<div class="banner"><b>Ative os alarmes</b><div class="sm mut" style="margin:4px 0 8px">Libera o som e as notificações deste aparelho. Mantenha o app aberto para o alarme tocar.</div><button class="btn" data-a="enable">Ativar e testar som</button></div>`;
  $("#main").innerHTML = tab === "hoje" ? vHoje() : tab === "agenda" ? vAgenda() : vPages();
  if (edit) {
    const el = $("#ev") || $("#et");
    if (el) {
      el.focus();
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch (e) {}
    }
  }
}

/* ---------- alarme ---------- */
let vol = 0.25,
  tn = 0,
  code = "";
const SND = {
  sirene: { n: "Sirene", t: "square", f: [800, 1200], d: 0.22, ms: 450 },
  bipe: { n: "Bipe", t: "square", f: [1000], d: 0.15, ms: 700 },
  campainha: { n: "Campainha", t: "sine", f: [880, 660], d: 0.5, ms: 900 },
  digital: { n: "Digital", t: "triangle", f: [1500], d: 0.08, ms: 250 },
  suave: { n: "Suave", t: "sine", f: [523, 659], d: 0.4, ms: 1000 },
};
const sndOpts = (c) =>
  Object.keys(SND)
    .map((k) => `<option value="${k}"${k === c ? " selected" : ""}>${SND[k].n}</option>`)
    .join("");
function beep(loud, sn) {
  const p = SND[sn] || SND.sirene;
  if (ac) {
    try {
      if (ac.state === "suspended") ac.resume();
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = loud ? p.t : "sine";
      o.frequency.value = loud ? p.f[tn++ % p.f.length] : 660;
      g.gain.value = loud ? Math.min(1, vol) : 0.15;
      if (loud) vol += 0.03;
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + (loud ? p.d : 0.3));
    } catch (e) {}
  }
  try {
    navigator.vibrate && navigator.vibrate(loud ? [400, 100, 400] : [200]);
  } catch (e) {}
}
let pvT = null;
function preview(sn) {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
  }
  clearInterval(pvT);
  vol = 0.6;
  const p = SND[sn] || SND.sirene;
  let n = 0;
  beep(true, sn);
  pvT = setInterval(() => {
    if (++n >= 4) {
      clearInterval(pvT);
      return;
    }
    beep(true, sn);
  }, p.ms);
}
const notify = (t, b) => {
  try {
    if ("Notification" in window && Notification.permission === "granted")
      new Notification(t, { body: b, requireInteraction: true });
  } catch (e) {}
};
function startRing(t) {
  ring = t.id;
  vol = 0.25;
  code = String(Math.floor(1000 + Math.random() * 9000));
  $("#at").textContent = t.title;
  $("#ah").textContent = "Marcado para " + (t.time || "");
  $("#code").textContent = code;
  $("#ci").value = "";
  $("#cerr").textContent = "";
  const L = t.lock !== false;
  $("#lock").style.display = L ? "block" : "none";
  $("#opts").style.display = L ? "none" : "block";
  $("#alarm").classList.add("on");
  const sn = t.snd || "sirene";
  beep(true, sn);
  clearInterval(loop);
  loop = setInterval(() => beep(true, sn), (SND[sn] || SND.sirene).ms);
  try {
    if (L) $("#ci").focus();
  } catch (e) {}
  notify("Chegou a hora", t.title);
}
function stopRing() {
  ring = null;
  clearInterval(loop);
  $("#alarm").classList.remove("on");
}
function pre(t) {
  $("#tmsg").textContent = "Em " + t.pre + " min: " + t.title;
  $("#toast").classList.add("on");
  beep();
  notify("Já vai começar", "Em " + t.pre + " min: " + t.title);
}
const due = (t) =>
  !t.done &&
  !t.skipped &&
  !t.started &&
  t.date &&
  t.time &&
  new Date(t.date + "T" + t.time).getTime() <= Date.now() &&
  (!t.snooze || t.snooze <= Date.now());
setInterval(() => {
  rollover();
  if (ring) return;
  const t = S.tasks.find(due);
  if (t) {
    startRing(t);
    return;
  }
  S.tasks.forEach((x) => {
    if (!x.done && !x.started && !x.pf && x.pre && x.time) {
      const at = new Date(x.date + "T" + x.time).getTime(),
        n = Date.now();
      if (n >= at - x.pre * 6e4 && n < at) {
        x.pf = true;
        save();
        pre(x);
      }
    }
  });
}, 4000);

/* ---------- ações ---------- */
const A = {
  enable() {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      beep();
      on = true;
    } catch (e) {
      on = true;
    }
    try {
      Notification.requestPermission();
    } catch (e) {}
  },
  addT() {
    const title = $("#tt").value.trim();
    if (!title) return;
    const ty = $("#tr").value;
    const t = {
      id: uid(),
      title,
      date: $("#td").value || today(),
      time: hm($("#tm").value),
      done: false,
      started: false,
      pre: +$("#tp").value,
      lock: $("#tl").checked,
      snd: $("#tsnd").value,
    };
    S.lastSnd = t.snd;
    if (ty !== "none") {
      const days = [...document.querySelectorAll("#tdays input:checked")].map((x) => +x.value);
      if (ty !== "days" || days.length) {
        t.rep = { type: ty, days, dom: +t.date.slice(8) };
        if (!matches(t, t.date)) {
          const n = nextOcc(t, t.date);
          if (n) t.date = n;
        }
      }
    }
    S.tasks.push(t);
  },
  togT(d) {
    const t = S.tasks.find((x) => x.id === d.i),
      T = today();
    S.dn = S.dn || {};
    if (t.rep && !t.done) {
      advance(t);
      S.dn[T] = (S.dn[T] || 0) + 1;
    } else {
      t.done = !t.done;
      if (t.done && !t.skipped) S.dn[T] = (S.dn[T] || 0) + 1;
      if (!t.done) {
        if (!t.skipped && S.dn[T]) S.dn[T]--;
        t.skipped = false;
      }
    }
  },
  begin(d) {
    S.tasks.find((x) => x.id === d.i).started = true;
  },
  okT() {
    $("#toast").classList.remove("on");
  },
  skip() {
    const t = S.tasks.find((x) => x.id === ring);
    if (t) {
      if (t.rep) advance(t);
      else {
        t.done = true;
        t.skipped = true;
      }
    }
    stopRing();
  },
  delT(d) {
    S.tasks = S.tasks.filter((x) => x.id !== d.i);
  },
  start() {
    const t = S.tasks.find((x) => x.id === ring);
    if (t) t.started = true;
    stopRing();
  },
  snooze() {
    const t = S.tasks.find((x) => x.id === ring);
    if (t) t.snooze = Date.now() + 3e5;
    stopRing();
  },
  openP(d) {
    cur = d.p;
  },
  back() {
    cur = null;
    askDel = null;
    askX = null;
    edit = null;
    pendImp = null;
    impErr = "";
  },
  addP() {
    const n = $("#np").value.trim();
    if (n) {
      const p = { id: uid(), name: n, groups: [] };
      S.pages.push(p);
      cur = p.id;
    }
  },
  delP(d) {
    askDel = d.p;
  },
  delPY(d) {
    S.pages = S.pages.filter((x) => x.id !== d.p);
    cur = null;
    askDel = null;
  },
  delPN() {
    askDel = null;
  },
  togC(d) {
    const g = grp(d.g);
    g.c = !g.c;
  },
  togL(d) {
    const t = S.tasks.find((x) => x.id === d.i);
    t.lock = t.lock === false;
  },
  addG() {
    const n = $("#ng").value.trim();
    if (n) S.pages.find((x) => x.id === cur).groups.push({ id: uid(), name: n, items: [] });
  },
  delG(d) {
    askX = "g:" + d.g;
  },
  delGY(d) {
    const p = S.pages.find((x) => x.id === cur);
    p.groups = p.groups.filter((g) => g.id !== d.g);
    askX = null;
  },
  askN() {
    askX = null;
    edit = null;
    pendImp = null;
    impErr = "";
  },
  exportB() {
    const d = new Date(),
      f = iso(d),
      blob = new Blob(
        [
          JSON.stringify(
            { app: "meu-dia-agenda", versao: 1, exportadoEm: d.toISOString(), dados: S },
            null,
            1,
          ),
        ],
        { type: "application/json" },
      ),
      u = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = u;
    a.download = "meu-dia-backup-" + f + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  },
  impY() {
    if (pendImp) {
      S = pendImp;
      pendImp = null;
      impErr = "";
      cur = null;
      rollover();
    }
  },
  ed(d) {
    edit = d.k;
    askX = null;
  },
  editT(d) {
    edit = "t:" + d.i;
    askX = null;
  },
  saveE(d) {
    const v = $("#ev").value.trim();
    if (!v) return;
    const k = d.k.split(":");
    if (k[0] === "p") S.pages.find((x) => x.id === k[1]).name = v;
    else if (k[0] === "g") grp(k[1]).name = v;
    else if (k[0] === "i") grp(k[1]).items.find((x) => x.id === k[2]).text = v;
    edit = null;
  },
  saveT(d) {
    const t = S.tasks.find((x) => x.id === d.i),
      title = $("#et").value.trim();
    if (!title) return;
    t.title = title;
    t.date = $("#etd").value || t.date;
    t.time = hm($("#etm").value);
    t.pre = +$("#etp").value;
    t.lock = $("#etl").checked;
    t.snd = $("#etsnd").value;
    const ty = $("#etr").value,
      days = [...document.querySelectorAll("#etdays input:checked")].map((x) => +x.value);
    if (ty === "none" || (ty === "days" && !days.length)) t.rep = null;
    else {
      t.rep = { type: ty, days, dom: +t.date.slice(8) };
      if (!matches(t, t.date)) {
        const n = nextOcc(t, t.date);
        if (n) t.date = n;
      }
    }
    t.pf = false;
    t.snooze = 0;
    edit = null;
  },
  addI(d) {
    const inp = document.querySelector(`[data-in="${d.g}"]`),
      n = inp.value.trim();
    const ty = document.querySelector(`[data-ty="${d.g}"]`).value;
    if (n) grp(d.g).items.push({ id: uid(), text: n, type: ty, done: false, note: "" });
  },
  togI(d) {
    const i = grp(d.g).items.find((x) => x.id === d.i);
    i.done = !i.done;
  },
  sw(d) {
    const i = grp(d.g).items.find((x) => x.id === d.i);
    if (i.run) {
      i.acc = sec(i);
      i.run = 0;
    } else i.run = Date.now();
  },
  swr(d) {
    const i = grp(d.g).items.find((x) => x.id === d.i);
    i.acc = 0;
    i.run = i.run ? Date.now() : 0;
  },
  saveD(d) {
    const g = grp(d.g),
      date = g.sd || today();
    g.items.forEach((i) => {
      const t = i.type || "check",
        q = Math.round(sec(i));
      if (t !== "check" && t !== "time" && !i.note) return;
      const r = {
        d: date,
        t,
        done: t === "check" && !!i.done,
        secs: t === "time" ? q : 0,
        goal: t === "time" ? i.goal || 3600 : 0,
        note: i.note || "",
      };
      const L = (i.log = i.log || []),
        ex = L.find((l) => l.d === date);
      if (ex) {
        ex.done = ex.done || r.done;
        ex.secs = (ex.secs || 0) + r.secs;
        if (r.goal) ex.goal = r.goal;
        if (r.note) ex.note = ex.note ? ex.note + " / " + r.note : r.note;
      } else L.push(r);
      L.sort((x, y) => y.d.localeCompare(x.d));
      i.done = false;
      i.note = "";
      i.acc = 0;
      i.run = 0;
    });
    g.sd = null;
  },
  delL(d) {
    grp(d.g)
      .items.find((x) => x.id === d.i)
      .log.splice(+d.l, 1);
  },
  delI(d) {
    askX = "i:" + d.i;
  },
  delIY(d) {
    const g = grp(d.g);
    g.items = g.items.filter((x) => x.id !== d.i);
    askX = null;
  },
};
const grp = (id) => S.pages.find((x) => x.id === cur).groups.find((g) => g.id === id);
document.addEventListener("click", (e) => {
  if (e.target.closest('[data-a="pickB"]')) {
    const i = $("#bf");
    if (i) {
      i.value = "";
      i.click();
    }
    return;
  }
  const pv = e.target.closest("[data-prev]");
  if (pv) {
    preview($("#" + pv.dataset.prev).value);
    return;
  }
  if (e.target.closest("[data-soon]")) {
    $("#tmsg").textContent =
      "Escolher um som do celular ou do PC ainda não funciona. Chega junto com o app.";
    $("#toast").classList.add("on");
    return;
  }
  const tb = e.target.closest(".tab");
  if (tb) {
    tab = tb.dataset.t;
    cur = null;
    edit = null;
    askX = null;
    pendImp = null;
    impErr = "";
    render();
    return;
  }
  const b = e.target.closest("[data-a]");
  if (!b || !A[b.dataset.a]) return;
  A[b.dataset.a](b.dataset);
  save();
  render();
});
document.addEventListener("keydown", (e) => {
  if (
    (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type === "text") ||
    (e.key === "Enter" && e.target.tagName === "INPUT" && !e.target.type)
  ) {
    const b = e.target.parentElement.querySelector("[data-a]");
    if (b) b.click();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "ci") {
    if (e.target.value === code) {
      clearInterval(loop);
      $("#lock").style.display = "none";
      $("#opts").style.display = "block";
    } else if (e.target.value.length >= 4) {
      e.target.value = "";
      $("#cerr").textContent = "Código errado. Olhe o número na tela e digite de novo.";
    }
  }
  const f = e.target.dataset.f;
  if (f === "sd") {
    grp(e.target.dataset.g).sd = e.target.value;
    save();
    return;
  }
  if (f) {
    const i = grp(e.target.dataset.g).items.find((x) => x.id === e.target.dataset.i);
    if (f === "note") i.note = e.target.value;
    if (/^g[hms]$/.test(f)) {
      e.target.value = e.target.value.replace(/\D/g, "");
      const r = e.target.parentElement,
        v = (n) => +r.querySelector('[data-f="' + n + '"]').value || 0;
      i.goal = Math.max(1, v("gh") * 3600 + v("gm") * 60 + v("gs"));
    }
    save();
  }
});
setInterval(() => {
  const all = S.pages.flatMap((p) => p.groups.flatMap((g) => g.items));
  document.querySelectorAll("[data-sw]").forEach((el) => {
    const i = all.find((x) => x.id === el.dataset.sw);
    if (i) {
      const r = (i.goal || 3600) - sec(i);
      el.textContent = fmt(r);
      if (r <= 0 && i.run) {
        i.acc = i.goal || 3600;
        i.run = 0;
        save();
        beep();
        render();
      }
    }
  });
  document.querySelectorAll("[data-el]").forEach((el) => {
    const i = all.find((x) => x.id === el.dataset.el);
    if (i) el.textContent = "Feito: " + fhs(sec(i));
  });
}, 500);
document.addEventListener("change", (e) => {
  if (e.target.id === "bf") {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onerror = () => {
      impErr = "Não foi possível ler o arquivo.";
      render();
    };
    r.onload = () => {
      try {
        const j = JSON.parse(r.result),
          d = j && j.dados ? j.dados : j;
        if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.pages)) throw 0;
        d.pages.forEach((p) => {
          if (!p || !Array.isArray(p.groups)) throw 0;
        });
        pendImp = d;
        impErr = "";
      } catch (x) {
        pendImp = null;
        impErr =
          'Esse arquivo não parece um backup do Meu Dia. Escolha um arquivo gerado por "Exportar backup".';
      }
      render();
    };
    r.readAsText(f);
    return;
  }
  if (e.target.dataset.hm !== undefined) e.target.value = hm(e.target.value);
  if (e.target.id === "tr") $("#tdays").style.display = e.target.value === "days" ? "flex" : "none";
  if (e.target.id === "etr")
    $("#etdays").style.display = e.target.value === "days" ? "flex" : "none";
});
setInterval(() => {
  if (tab === "hoje" && !ring && !edit) render();
}, 30000);
rollover();
render();
