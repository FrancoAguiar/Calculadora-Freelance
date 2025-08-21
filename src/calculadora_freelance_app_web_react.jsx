import React, { useEffect, useMemo, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// nd. CALCULADORA FREELANCE – v7.1 (Reporte para Diseñador + CSV fix)
// - Corrige error: downloadCSV no definido → implementado
// - Mantiene v7: Registro mensual, KPIs, Export PDF con insights
// - Suma tests extra de robustez (sin tocar los existentes)
// - Mobile-first, dark theme nd, sin dependencias externas
// ─────────────────────────────────────────────────────────────────────────────

// ───────── Brand / Config ─────────
const BRAND = { name: "Necesito Diseños", handle: "@necesitodisenos", orange: "#F64D08" };

const CURRENCIES = [
  { code: "USD", locale: "en-US" },
  { code: "UYU", locale: "es-UY" },
  { code: "ARS", locale: "es-AR" },
  { code: "MXN", locale: "es-MX" },
  { code: "EUR", locale: "es-ES" },
];

// ───────── Utils ─────────
function fmtMoney(code, locale, n, decimals = 2) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(isFinite(n) ? n : 0);
  } catch {
    const d = isFinite(n) ? Number(n).toFixed(decimals) : (0).toFixed(decimals);
    return `${code} ${d}`;
  }
}
function num(v, d = 0) { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : d; }
const nearly = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
function escapeHtml(str){ return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }

// ───────── Defaults ─────────
const DEFAULTS = {
  currency: "USD",
  // PRO (estilo Excel)
  pro_monthlyTarget: 1500,
  pro_projectsPerMonth: 6,
  pro_hoursPerProject: 8,
  pro_toolsMonthly: 15,
  pro_taxPct: 10,
  // Comparador
  cmp_name: "Logo básico",
  cmp_price: 250,
  cmp_hours: 6,
  // Propuesta (cliente)
  prop_client: "Cliente Ejemplo S.A.",
  prop_project: "Identidad visual",
  prop_date: new Date().toISOString().slice(0,10),
  prop_terms: "Incluye 1 ronda de cambios. Entrega en 7–10 días hábiles. Validez: 7 días.",
};

// ───────── Core maths (PRO) ─────────
function computePro(s) {
  const target = Math.max(num(s.pro_monthlyTarget), 0.01);
  const projects = Math.max(num(s.pro_projectsPerMonth), 1);
  const hrsPer = Math.max(num(s.pro_hoursPerProject), 0.1);
  const tools = Math.max(num(s.pro_toolsMonthly), 0);
  const taxPct = Math.max(num(s.pro_taxPct), 0) / 100;
  const totalHours = projects * hrsPer;
  const minHourly = (target + tools) / totalHours; // sin impuestos
  const minProject = minHourly * hrsPer;
  const finalPrice = minProject * (1 + taxPct);
  return { totalHours, minHourly, minProject, finalPrice, minMonthlyRevenue: minProject * projects };
}

// ───────── Clipboard-safe helpers ─────────
async function safeCopyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } throw new Error("clipboard-api-unavailable"); }
  catch { try { const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length); const ok = document.execCommand("copy"); document.body.removeChild(ta); if (ok) return true; } catch {}
    try { const m = window.prompt("Copiá manualmente (Ctrl/Cmd+C, Enter)", text); return !!m || true; } catch { return false; } }
}

// ───────── Tests (básicos + extra) ─────────
function runTests() {
  const pro = computePro({ ...DEFAULTS });
  console.assert(nearly(pro.minHourly, 31.56), "[Test] minHourly ≈ 31.56");
  console.assert(nearly(pro.minProject, 252.5), "[Test] minProject ≈ 252.50");
  console.assert(nearly(pro.finalPrice, 277.75), "[Test] finalPrice ≈ 277.75");
  // Extras (no modifican los existentes)
  const A = computePro({ ...DEFAULTS, pro_toolsMonthly: 0 });
  const B = computePro({ ...DEFAULTS, pro_toolsMonthly: 100 });
  console.assert(B.minHourly > A.minHourly, "[Test] +herramientas ⇒ +tarifa/h");
  console.assert(typeof downloadCSV === "function", "[Test] downloadCSV definido");
}

// ───────── Main App ─────────
export default function FreelanceCalculatorApp() {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem("nd_calc_v7_1");
    let base = { ...DEFAULTS };
    try { const params = new URLSearchParams(window.location.search); if ([...params.keys()].length) base = { ...base, ...Object.fromEntries(params.entries()) }; } catch {}
    try { return saved ? { ...base, ...JSON.parse(saved) } : base; } catch { return base; }
  });
  const [toast, setToast] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showComparator, setShowComparator] = useState(true);
  const [showLog, setShowLog] = useState(true);
  const [logInput, setLogInput] = useState({ name: "", price: "", hours: "", date: new Date().toISOString().slice(0,10) });
  const [log, setLog] = useState(() => { try { return JSON.parse(localStorage.getItem("nd_calc_v7_1_log") || "[]"); } catch { return []; } });

  const currencyObj = useMemo(() => CURRENCIES.find((c) => c.code === state.currency) || CURRENCIES[0], [state.currency]);
  const pro = computePro(state);
  const money = (n) => fmtMoney(currencyObj.code, currencyObj.locale, n, 2);

  useEffect(() => { localStorage.setItem("nd_calc_v7_1", JSON.stringify(state)); }, [state]);
  useEffect(() => { localStorage.setItem("nd_calc_v7_1_log", JSON.stringify(log)); }, [log]);
  useEffect(() => { runTests(); }, []);

  const notify = (msg) => { setToast(msg); if (notify._t) window.clearTimeout(notify._t); notify._t = window.setTimeout(() => setToast(""), 2200); };
  const copyText = async (t) => { const ok = await safeCopyText(t); notify(ok ? "Copiado ✅" : "No se pudo copiar auto"); };

  // Comparador derivaciones
  const realHourly = Math.max(num(state.cmp_price), 0.01) / Math.max(num(state.cmp_hours), 0.1);
  const diffHourly = realHourly - pro.minHourly;
  const diagText = diffHourly >= 0 ? "Bien: estás cobrando en o por encima de tu mínima." : "Atención: estás por debajo de tu mínima. Subí precio, recortá alcance o extendé plazos.";
  const diagColor = diffHourly >= 0 ? "#16a34a" : "#ef4444";

  // Registro KPIs
  const totals = log.reduce((acc, r) => {
    const price = num(r.price, 0); const hours = num(r.hours, 0);
    const realH = hours > 0 ? price / hours : 0;
    acc.projects += 1; acc.hours += hours; acc.revenue += price;
    acc.realHourlyWeighted += realH * hours; // ponderado por horas
    if (hours > 0) { if (realH >= pro.minHourly) acc.above += 1; else acc.below += 1; }
    return acc;
  }, { projects:0, hours:0, revenue:0, realHourlyWeighted:0, above:0, below:0 });
  const avgRealHourly = totals.hours > 0 ? totals.realHourlyWeighted / totals.hours : 0;
  const avgDiff = avgRealHourly - pro.minHourly;
  const pctAbove = totals.projects > 0 ? (totals.above / totals.projects) * 100 : 0;
  const pctBelow = totals.projects > 0 ? (totals.below / totals.projects) * 100 : 0;

  // Handlers Registro
  const addLog = () => {
    const rec = { ...logInput, id: cryptoRandom(), name: logInput.name || "Proyecto", price: String(num(logInput.price,0)), hours: String(num(logInput.hours,0)), date: logInput.date || new Date().toISOString().slice(0,10) };
    setLog((L) => [rec, ...L]); setLogInput({ name: "", price: "", hours: "", date: new Date().toISOString().slice(0,10) }); notify("Proyecto agregado ✅");
  };
  const delLog = (id) => setLog((L) => L.filter(r => r.id !== id));
  const clearLog = () => { if (confirm("¿Vaciar registro?")) setLog([]); };
  function cryptoRandom(){ try { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(a[0]); } catch { return String(Date.now()); } }

  // CSV Export (Resuelve el error)
  function downloadCSV() {
    // Sección 1: Configuración y resultados actuales
    const header1 = ["Sección","Métrica","Valor"];
    const rows1 = [
      ["Resumen","Moneda", state.currency],
      ["Resumen","Objetivo mensual", state.pro_monthlyTarget],
      ["Resumen","Proyectos/mes", state.pro_projectsPerMonth],
      ["Resumen","Horas/proyecto", state.pro_hoursPerProject],
      ["Resumen","Herramientas/mes", state.pro_toolsMonthly],
      ["Resumen","Impuestos (%)", state.pro_taxPct],
      ["Cálculo","Tarifa mínima/h", pro.minHourly],
      ["Cálculo","Mínimo por proyecto (sin imp.)", pro.minProject],
      ["Cálculo","Precio final (con imp.)", pro.finalPrice],
      ["Cálculo","Horas totales/mes", pro.totalHours],
      ["Cálculo","Ingreso mínimo/mes", pro.minMonthlyRevenue],
    ];

    // Sección 2: Registro de proyectos
    const header2 = ["Fecha","Proyecto","Precio","Horas","$/h real"];
    const rows2 = log.map(r => [r.date, r.name, num(r.price,0), num(r.hours,0), (num(r.hours,0)>0? (num(r.price,0)/num(r.hours,0)) : 0)]);

    // Build CSV text with proper quoting
    const q = (v) => `"${String(v).replace(/"/g,'""')}"`;
    const part1 = [header1, ...rows1].map(row => row.map(q).join(",")).join("\n");
    const part2 = [header2, ...rows2].map(row => row.map(q).join(",")).join("\n");
    const csv = part1 + "\n\n" + part2 + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calculadora_freelance_nd_reporte.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // PDF Reporte Diseñador
  const exportDesignerReport = () => {
    const htmlRows = log.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.name)}</td><td style="text-align:right">${money(num(r.price))}</td><td style="text-align:right">${num(r.hours).toFixed(2)}</td><td style="text-align:right">${num(r.hours)>0? money(num(r.price)/num(r.hours)) : '-'}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Reporte del Diseñador – ${BRAND.name}</title>
    <style>
      :root{ --brand:${BRAND.orange}; --ink:#111; }
      *{ box-sizing:border-box; }
      body{ font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial; color:var(--ink); margin:28px; }
      .hdr{ display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
      .logo{ background:var(--brand); color:#000; font-weight:900; width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:10px; }
      h1{ margin:0; font-size:22px; }
      .muted{ color:#666; font-size:12px; }
      .grid4{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:10px 0; }
      .kpi{ border:1px solid #eee; border-radius:10px; padding:10px; }
      .kpi .t{ color:#666; font-size:12px; }
      .kpi .v{ font-size:18px; font-weight:800; }
      table{ width:100%; border-collapse:collapse; margin-top:10px; }
      th, td{ border:1px solid #e9e9e9; padding:8px; font-size:12px; }
      th{ background:#fafafa; text-align:left; }
      .insights{ border:1px solid #eee; border-radius:10px; padding:12px; margin-top:12px; }
      .footer{ margin-top:18px; font-size:12px; color:#666; }
      @media print { .no-print{ display:none; } }
    </style></head><body>
      <div class="hdr">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="logo">nd</div>
          <div>
            <h1>Reporte del Diseñador</h1>
            <div class="muted">Generado con la Calculadora Freelance de ${BRAND.name} (${BRAND.handle})</div>
          </div>
        </div>
        <div style="text-align:right; font-size:12px; color:#444">
          <div><b>Fecha:</b> ${escapeHtml(new Date().toISOString().slice(0,10))}</div>
          <div><b>Moneda:</b> ${escapeHtml(state.currency)}</div>
        </div>
      </div>

      <div class="grid4">
        <div class="kpi"><div class="t">Tarifa mínima/h (actual)</div><div class="v">${money(pro.minHourly)}</div></div>
        <div class="kpi"><div class="t">Proyectos (mes)</div><div class="v">${totals.projects}</div></div>
        <div class="kpi"><div class="t">Horas totales</div><div class="v">${totals.hours.toFixed(2)} h</div></div>
        <div class="kpi"><div class="t">Facturación</div><div class="v">${money(totals.revenue)}</div></div>
      </div>
      <div class="grid4">
        <div class="kpi"><div class="t">$/h real promedio</div><div class="v">${money(avgRealHourly)}</div></div>
        <div class="kpi"><div class="t">Desvío vs mínima</div><div class="v">${money(avgDiff)}</div></div>
        <div class="kpi"><div class="t">% por encima de mínima</div><div class="v">${pctAbove.toFixed(0)}%</div></div>
        <div class="kpi"><div class="t">% por debajo de mínima</div><div class="v">${pctBelow.toFixed(0)}%</div></div>
      </div>

      <table>
        <thead><tr><th>#</th><th>Fecha</th><th>Proyecto</th><th style="text-align:right">Precio</th><th style="text-align:right">Horas</th><th style="text-align:right">$/h real</th></tr></thead>
        <tbody>${htmlRows || '<tr><td colspan="6" class="muted">Sin proyectos registrados</td></tr>'}</tbody>
      </table>

      <div class="insights">
        <div style="font-weight:700; margin-bottom:6px">Insights del mes</div>
        <ul style="margin:0; padding-left:16px">
          <li>${totals.projects>0 ? (pctBelow>0? `${pctBelow.toFixed(0)}% de tus proyectos están bajo tu mínima: revisá alcance o precios.` : `Todos los proyectos están sobre tu mínima. Excelente.`) : `Registrá proyectos para ver insights.`}</li>
          <li>${avgDiff>=0? `Tu $/h real promedio está ${money(avgDiff)} por encima de tu mínima.` : `Tu $/h real promedio está ${money(Math.abs(avgDiff))} por debajo de tu mínima.`}</li>
          <li>Tarifa mínima/h actual usada como referencia: ${money(pro.minHourly)}.</li>
        </ul>
      </div>

      <div class="footer">© 2025 ${BRAND.name}. Reporte interno del diseñador. No compartir con clientes.</div>
      <script>window.print();</script>
    </body></html>`;
    const w = window.open("", "_blank"); if (!w) return; w.document.write(html); w.document.close();
  };

  // THEME: dark fijo (negro, blanco, naranja)
  const cssVars = { "--bg": "#000000", "--fg": "#ffffff", "--muted": "#bfbfbf", "--card": "#111111", "--brand": BRAND.orange };

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--bg)", color: "var(--fg)", ...cssVars }}>
      <div className="max-w-3xl mx-auto px-5 pt-10 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-black" style={{ background: "var(--brand)" }}>nd</div>
            <h1 className="text-2xl font-black tracking-tight">Calculadora Freelance</h1>
          </div>
          <div className="flex gap-2">
            <HoverButton onClick={() => setState(DEFAULTS)} variant="ghost">Reset</HoverButton>
            <HoverButton onClick={downloadCSV}>CSV</HoverButton>
          </div>
        </header>

        {/* Inputs (PRO) */}
        <section className="mt-8 grid md:grid-cols-2 gap-5">
          <Field label="Objetivo mensual" prefix={currencyObj.code} value={state.pro_monthlyTarget} onChange={(v)=>setState(s=>({...s, pro_monthlyTarget:v}))} />
          <Field label="Proyectos/mes" value={state.pro_projectsPerMonth} onChange={(v)=>setState(s=>({...s, pro_projectsPerMonth:v}))} />
          <Field label="Horas/proyecto" value={state.pro_hoursPerProject} onChange={(v)=>setState(s=>({...s, pro_hoursPerProject:v}))} />
          <Field label="Herramientas/mes" prefix={currencyObj.code} value={state.pro_toolsMonthly} onChange={(v)=>setState(s=>({...s, pro_toolsMonthly:v}))} />
          <Field label="Impuestos (%)" value={state.pro_taxPct} onChange={(v)=>setState(s=>({...s, pro_taxPct:v}))} />
          <Select label="Moneda" value={state.currency} onChange={(v)=>setState(s=>({...s, currency:v}))} options={CURRENCIES.map(c=>({label:c.code, value:c.code}))} />
        </section>

        {/* Resultados */}
        <section className="mt-8 grid md:grid-cols-3 gap-5">
          <KPI title="Tarifa mínima/h" label="Base de cálculo" value={money(pro.minHourly)} />
          <KPI title="Mínimo por proyecto" label="Sin impuestos" value={money(pro.minProject)} />
          <KPI title="Final con impuestos" label="Precio al cliente" value={money(pro.finalPrice)} accent />
        </section>

        {/* Comparador */}
        <section className="mt-6">
          <HoverButton variant="ghost" onClick={()=>setShowComparator(v=>!v)}>{showComparator? "Ocultar comparador" : "Comparar un proyecto"}</HoverButton>
          {showComparator && (
            <div className="mt-3 grid md:grid-cols-3 gap-5">
              <Field label="Proyecto (logo/identidad/landing)" value={state.cmp_name} onChange={(v)=>setState(s=>({...s, cmp_name:v}))} />
              <Field label="Precio pensado" prefix={currencyObj.code} value={state.cmp_price} onChange={(v)=>setState(s=>({...s, cmp_price:v}))} />
              <Field label="Horas estimadas" value={state.cmp_hours} onChange={(v)=>setState(s=>({...s, cmp_hours:v}))} />
              <KPI title="Tu tarifa real/h" label="Sobre este proyecto" value={money(Math.max(num(state.cmp_price),0.01)/Math.max(num(state.cmp_hours),0.1))} />
              <KPI title="Diferencia vs mínima" label="(real − mínima)" value={money(diffHourly)} />
              <div className="rounded-xl p-4" style={{ background: diagColor }}>
                <div className="text-sm font-semibold text-black">Diagnóstico</div>
                <div className="text-sm text-black">{diagText}</div>
              </div>
            </div>
          )}
        </section>

        {/* Registro mensual del Diseñador */}
        <section className="mt-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Registro mensual de proyectos</h2>
            <div className="flex gap-2">
              <HoverButton variant="ghost" onClick={()=>setShowLog(v=>!v)}>{showLog? "Ocultar" : "Mostrar"}</HoverButton>
              <HoverButton variant="ghost" onClick={clearLog}>Vaciar</HoverButton>
              <HoverButton onClick={exportDesignerReport}>Exportar Reporte (PDF)</HoverButton>
            </div>
          </div>

          {showLog && (
            <div className="mt-3">
              <div className="grid md:grid-cols-4 gap-3">
                <Field label="Proyecto" value={logInput.name} onChange={(v)=>setLogInput(s=>({...s,name:v}))} />
                <Field label="Precio" value={logInput.price} onChange={(v)=>setLogInput(s=>({...s,price:v}))} prefix={currencyObj.code} />
                <Field label="Horas" value={logInput.hours} onChange={(v)=>setLogInput(s=>({...s,hours:v}))} />
                <Field label="Fecha" value={logInput.date} onChange={(v)=>setLogInput(s=>({...s,date:v}))} />
              </div>
              <div className="mt-2"><HoverButton onClick={addLog}>Agregar al registro</HoverButton></div>

              {/* KPIs del registro */}
              <div className="mt-5 grid md:grid-cols-4 gap-4">
                <KPI title="Proyectos" value={String(totals.projects)} />
                <KPI title="Horas totales" value={`${totals.hours.toFixed(2)} h`} />
                <KPI title="Facturación" value={money(totals.revenue)} />
                <KPI title="$ / h real prom." value={money(avgRealHourly)} />
              </div>
              <div className="mt-2 grid md:grid-cols-3 gap-4">
                <KPI title="Desvío vs mínima" value={money(avgDiff)} />
                <KPI title="% encima de mínima" value={`${pctAbove.toFixed(0)}%`} />
                <KPI title="% debajo de mínima" value={`${pctBelow.toFixed(0)}%`} />
              </div>

              {/* Tabla */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {['Fecha','Proyecto','Precio','Horas','$ / h real',''].map(h=> (
                        <th key={h} className="text-left border-b border-white/10 pb-2 pr-2" style={{ color: "var(--muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {log.length===0 && (
                      <tr><td colSpan={6} className="py-3" style={{ color: "var(--muted)" }}>Sin proyectos registrados.</td></tr>
                    )}
                    {log.map((r)=>{
                      const h = num(r.hours); const p = num(r.price); const rh = h>0? p/h : 0;
                      return (
                        <tr key={r.id} className="border-b border-white/5">
                          <td className="py-2 pr-2">{r.date}</td>
                          <td className="py-2 pr-2">{r.name}</td>
                          <td className="py-2 pr-2 tabular-nums">{money(p)}</td>
                          <td className="py-2 pr-2 tabular-nums">{h.toFixed(2)}</td>
                          <td className="py-2 pr-2 tabular-nums">{money(rh)}</td>
                          <td className="py-2 pr-2"><button onClick={()=>delLog(r.id)} className="text-xs px-2 py-1 rounded border" style={{ borderColor:'rgba(255,255,255,.1)' }}>Eliminar</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg text-black" style={{ background: "var(--brand)", boxShadow: "0 8px 24px rgba(246,77,8,.4)" }}>{toast}</div>
        )}

        <footer className="mt-12 text-center text-xs" style={{ color: "var(--muted)" }}>
          © 2025 {BRAND.name} — Calculadora profesional de tarifas.
        </footer>
      </div>
    </div>
  );
}

// ───────── UI components ─────────
function HoverButton({ children, onClick, variant = "solid" }) {
  const [hover, setHover] = useState(false);
  const styles = variant === "ghost"
    ? { background: "#111111", color: "#ffffff", border: "1px solid rgba(255,255,255,.1)" }
    : { background: "var(--brand)", color: "#000", border: "1px solid rgba(246,77,8,.6)" };
  return (
    <button
      onClick={onClick}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      onFocus={()=>setHover(true)} onBlur={()=>setHover(false)}
      className="px-3 py-2 rounded-lg"
      style={{ ...styles, transition: "transform .15s ease, box-shadow .2s ease, background .2s ease", transform: hover ? "translateY(-1px)" : "translateY(0)", boxShadow: hover ? "0 8px 24px rgba(246,77,8,.35)" : "0 0 0 rgba(0,0,0,0)" }}
    >{children}</button>
  );
}
function Field({ label, value, onChange, prefix }) {
  const isNumeric = /^-?\d*(?:[\.,]\d*)?$/.test(String(value));
  const inputType = isNumeric ? "number" : (label === 'Fecha' ? 'date' : 'text');
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm" style={{ color: "var(--muted)" }}>{label}</span>
      <div className="flex items-center gap-2 border border-white/10 rounded-xl p-2.5 bg-[#0c0c0c]">
        {prefix ? <span className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10">{prefix}</span> : null}
        <input className="w-full outline-none bg-transparent text-white" type={inputType} step="0.01" value={value} onChange={(e)=>onChange(e.target.value)} />
      </div>
    </label>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm" style={{ color: "var(--muted)" }}>{label}</span>
      <select className="rounded-xl p-2.5 bg-[#0c0c0c] border border-white/10 text-white" value={value} onChange={(e)=>onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
function KPI({ title, value, label, accent }) {
  return (
    <div className="rounded-xl p-4 border border-white/10 bg-[#0c0c0c]">
      <div className="text-xs" style={{ color: "var(--muted)" }}>{title}</div>
      {label && <div className="text-[10px] mb-1" style={{ color: "#999" }}>{label}</div>}
      <div className="text-2xl font-black tracking-tight" style={{ color: accent ? "var(--brand)" : "var(--fg)" }}>{value}</div>
    </div>
  );
}
