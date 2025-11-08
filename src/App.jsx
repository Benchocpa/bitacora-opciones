import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts";

function notify(msg){ alert(msg); }
const STORAGE_KEY = "options_ledger_v1";
const STRATEGIES = ["CSP","CC","IC","CALL","PUT"];
const STATES = ["ABIERTA","CERRADA","ROLL","ASIGNADA","VENDIDA"];

const emptyRow = {
  id: "",
  fechaInicio: "",
  fechaVencimiento: "",   // ✅ ya estaba; lo dejamos igual
  fechaCierre: "",
  ticker: "",
  estrategia: "CSP",
  precioCompra: 0,
  acciones: 100,
  strike: 0,
  primaRecibida: 0,
  comision: 0,
  costoCierre: 0,
  estado: "ABIERTA",
  precioCierre: 0,
  notas: "",
};

function parseNumber(v){ if(v===null||v===undefined||v==="") return 0; return Number(String(v).replace(/[$,]/g,""))||0; }

function computeDerived(r){
  const acciones = parseNumber(r.acciones)||0;
  const primaTotal = parseNumber(r.primaRecibida);
  const costos = parseNumber(r.comision)+parseNumber(r.costoCierre);
  const resultado = primaTotal - costos;
  const be = parseNumber(r.strike) - (acciones ? primaTotal/acciones : 0);
  const duracion = r.fechaInicio && r.fechaCierre ? Math.max(0,(new Date(r.fechaCierre)-new Date(r.fechaInicio))/(1000*60*60*24)) : null;
  const riesgo = parseNumber(r.strike)*acciones;
  const resultadoPct = riesgo? (resultado/riesgo)*100 : 0;
  return { primaTotal, costos, resultado, breakEven: be, duracion, resultadoPct };
}

export default function App(){
  const fileRef = useRef(null);
  const [rows, setRows] = useState(()=>{
    try{ const raw = localStorage.getItem(STORAGE_KEY); return raw? JSON.parse(raw): []; }catch{ return []; }
  });
  const [showModal,setShowModal] = useState(false);
  const [form, setForm] = useState({...emptyRow});

  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); }, [rows]);

  const stats = useMemo(()=>{
    const primas = rows.reduce((s,r)=> s+parseNumber(r.primaRecibida), 0);
    const costos = rows.reduce((s,r)=> s+parseNumber(r.comision)+parseNumber(r.costoCierre), 0);
    const neto = primas - costos;
    const mensual = {};
    rows.forEach(r=>{
      const d = (r.fechaCierre||r.fechaInicio||"").slice(0,7);
      if(!d) return;
      const res = parseNumber(r.primaRecibida) - (parseNumber(r.comision)+parseNumber(r.costoCierre));
      mensual[d] = (mensual[d]||0)+res;
    });
    const byTicker = {};
    rows.forEach(r=>{
      const res = parseNumber(r.primaRecibida) - (parseNumber(r.comision)+parseNumber(r.costoCierre));
      byTicker[r.ticker] = (byTicker[r.ticker]||0) + res;
    });
    return { count: rows.length, primas, costos, neto, mensual, byTicker };
  }, [rows]);

  function saveRow(){
    if(!form.ticker) return notify("Ingresa el ticker");
    const withId = form.id? form : { ...form, id: Date.now().toString() };
    setRows(prev=>{
      const i = prev.findIndex(p=>p.id===withId.id);
      if(i>=0){ const next=[...prev]; next[i]=withId; return next; }
      return [withId, ...prev];
    });
    setShowModal(false);
    setForm({...emptyRow});
    notify("Operación guardada.");
  }

  function removeRow(id){
    if(!confirm("¿Eliminar operación?")) return;
    setRows(prev=>prev.filter(r=>r.id!==id));
  }

  function exportCSV(){
    // ✅ añadimos fechaVencimiento después de fechaInicio
    const headers = ["fechaInicio","fechaVencimiento","fechaCierre","ticker","estrategia","precioCompra","acciones","strike","primaRecibida","comision","costoCierre","estado","precioCierre","notas"];
    const escape = v => `"${String(v??"").replace(/"/g,'""')}"`;
    const lines = [headers.join(",")];
    rows.forEach(r=>{
      lines.push(headers.map(h=>escape(r[h]??"")).join(","));
    });
    const blob = new Blob([lines.join("\n")], {type: "text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "bitacora_operaciones.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function importCSV(file){
    const reader = new FileReader();
    reader.onload = ()=>{
      const text = String(reader.result);
      const [headerLine, ...rowsText] = text.split(/\r?\n/).filter(Boolean);
      const headers = headerLine.split(",").map(h=>h.replace(/^"|"$/g,"").trim());
      const imported = rowsText.map(line=>{
        const cols = []; let cur=""; let inQ=false;
        for(let i=0;i<line.length;i++){
          const ch=line[i];
          if(ch==='"'){ if(inQ && line[i+1]==='"'){ cur+='"'; i++; } else inQ=!inQ; }
          else if(ch===',' && !inQ){ cols.push(cur); cur=""; }
          else cur+=ch;
        }
        cols.push(cur);
        const obj = { ...emptyRow, id: Date.now().toString()+Math.random().toString(36).slice(2) };
        headers.forEach((h,idx)=> obj[h] = cols[idx]?.replace(/^"|"$/g,""));
        ["precioCompra","acciones","strike","primaRecibida","comision","costoCierre","precioCierre"].forEach(k=> obj[k]=parseNumber(obj[k]));
        return obj;
      });
      setRows(prev=>[...imported, ...prev]);
      notify(`Se importaron ${imported.length} filas.`);
    };
    reader.readAsText(file);
  }

  const monthData = Object.entries(stats.mensual).map(([k,v])=>({mes:k, neto:v}));
  const tickerData = Object.entries(stats.byTicker).map(([k,v])=>({ticker:k||"(sin)", neto:v}));

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Bitácora de Opciones</h1>
            <p className="text-sm text-neutral-500">Registra CSP/CC/IC, calcula Break Even y resultado neto. Datos en LocalStorage.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowModal(true)} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 bg-black text-white hover:opacity-90"><Plus size={16}/>Nueva</button>
            <button onClick={exportCSV} className="rounded-2xl px-3 py-2 border">Exportar CSV</button>
            <label className="rounded-2xl px-3 py-2 border cursor-pointer">
              Importar CSV
              <input onChange={e=> e.target.files?.[0] && importCSV(e.target.files[0])} type="file" accept=".csv" className="hidden"/>
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <StatCard title="Operaciones" value={stats.count.toLocaleString()} subtitle="Total registradas"/>
          <StatCard title="Prima Bruta" value={`$${stats.primas.toFixed(2)}`} subtitle="Suma de primas"/>
          <StatCard title="Costos" value={`$${stats.costos.toFixed(2)}`} subtitle="Comisiones + cierres"/>
          <StatCard title="Neto" value={`$${stats.neto.toFixed(2)}`} subtitle="Ganancia neta" positive={stats.neto >= 0}/>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="text-base font-semibold mb-2">Ganancia por mes</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthData}>
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <RTooltip formatter={(v)=>`$${Number(v).toFixed(2)}`}/>
                  <Bar dataKey="neto" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="text-base font-semibold mb-2">Top Tickers por Ganancia</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tickerData}>
                  <XAxis dataKey="ticker" />
                  <YAxis />
                  <RTooltip formatter={(v)=>`$${Number(v).toFixed(2)}`}/>
                  <Bar dataKey="neto" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border shadow-sm">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="text-base font-semibold">Operaciones</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  {/* ✅ Insertamos Vencimiento entre Inicio y Cierre */}
                  {["Inicio","Vencimiento","Cierre","Ticker","Estrategia","Acciones","Strike","Prima","Comisión","Costo Cierre","Estado","Notas",""].map(h=>(
                    <th key={h} className="px-2 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r=> (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-2">{r.fechaInicio}</td>
                    {/* ✅ Nueva celda con la fecha de vencimiento */}
                    <td className="px-2 py-2">{r.fechaVencimiento}</td>
                    <td className="px-2 py-2">{r.fechaCierre}</td>
                    <td className="px-2 py-2 font-medium">{r.ticker}</td>
                    <td className="px-2 py-2">{r.estrategia}</td>
                    <td className="px-2 py-2">{r.acciones}</td>
                    <td className="px-2 py-2">{r.strike}</td>
                    <td className="px-2 py-2">${r.primaRecibida}</td>
                    <td className="px-2 py-2">${r.comision}</td>
                    <td className="px-2 py-2">${r.costoCierre}</td>
                    <td className="px-2 py-2"><span className="px-2 py-1 rounded-full text-xs bg-neutral-100 border">{r.estado}</span></td>
                    <td className="px-2 py-2 max-w-[16rem] truncate" title={r.notas}>{r.notas}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button className="px-2 py-1 rounded-lg border" onClick={()=>{ setForm(r); setShowModal(true); }}>Editar</button>
                        <button className="px-2 py-1 rounded-lg border text-rose-600" onClick={()=>removeRow(r.id)}><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-3xl rounded-2xl p-4 md:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">{form?.id? "Editar operación":"Nueva operación"}</div>
              <button className="text-neutral-500" onClick={()=>setShowModal(false)}>✕</button>
            </div>
            <TradeForm form={form} setForm={setForm} onSave={saveRow} onCancel={()=>setShowModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({title, value, subtitle, positive}){
  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className={`text-2xl font-bold ${positive===undefined? "" : positive? "text-emerald-600":"text-rose-600"}`}>{value}</div>
      <div className="text-xs text-neutral-400">{subtitle}</div>
    </div>
  );
}

function FormRow({label, children}){
  return (
    <label className="space-y-1">
      <div className="text-xs text-neutral-500">{label}</div>
      {children}
    </label>
  );
}

function TradeForm({ form, setForm, onSave, onCancel }){
  const update = (k,v)=> setForm(prev=> ({...prev, [k]: v}));
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <FormRow label="Fecha Inicio"><input type="date" className="w-full border rounded-xl px-3 py-2" value={form.fechaInicio} onChange={e=>update("fechaInicio", e.target.value)} /></FormRow>
      <FormRow label="Fecha Cierre"><input type="date" className="w-full border rounded-xl px-3 py-2" value={form.fechaCierre} onChange={e=>update("fechaCierre", e.target.value)} /></FormRow>
      <FormRow label="Ticker"><input className="w-full border rounded-xl px-3 py-2" placeholder="INTC" value={form.ticker} onChange={e=>update("ticker", e.target.value.toUpperCase())} /></FormRow>

      <FormRow label="Estrategia">
        <select className="w-full border rounded-xl px-3 py-2" value={form.estrategia} onChange={e=>update("estrategia", e.target.value)}>
          {STRATEGIES.map(s=>(<option key={s} value={s}>{s}</option>))}
        </select>
      </FormRow>
      <FormRow label="Acciones"><input type="number" className="w-full border rounded-xl px-3 py-2" value={form.acciones} onChange={e=>update("acciones", e.target.value)} /></FormRow>
      <FormRow label="Strike"><input type="number" step="0.01" className="w-full border rounded-xl px-3 py-2" value={form.strike} onChange={e=>update("strike", e.target.value)} /></FormRow>

      {/* ✅ NUEVO: Fecha de Vencimiento (solo este bloque) */}
      <FormRow label="Fecha Vencimiento">
        <input type="date" className="w-full border rounded-xl px-3 py-2"
               value={form.fechaVencimiento || ""} onChange={e=>update("fechaVencimiento", e.target.value)} />
      </FormRow>

      <FormRow label="Precio Compra"><input type="number" step="0.01" className="w-full border rounded-xl px-3 py-2" value={form.precioCompra} onChange={e=>update("precioCompra", e.target.value)} /></FormRow>
      <FormRow label="Prima Recibida"><input type="number" step="0.01" className="w-full border rounded-xl px-3 py-2" value={form.primaRecibida} onChange={e=>update("primaRecibida", e.target.value)} /></FormRow>
      <FormRow label="Comisión"><input type="number" step="0.01" className="w-full border rounded-xl px-3 py-2" value={form.comision} onChange={e=>update("comision", e.target.value)} /></FormRow>

      <FormRow label="Costo Cierre"><input type="number" step="0.01" className="w-full border rounded-xl px-3 py-2" value={form.costoCierre} onChange={e=>update("costoCierre", e.target.value)} /></FormRow>
      <FormRow label="Estado">
        <select className="w-full border rounded-xl px-3 py-2" value={form.estado} onChange={e=>update("estado", e.target.value)}>
          {STATES.map(s=>(<option key={s} value={s}>{s}</option>))}
        </select>
      </FormRow>
      <FormRow label="Precio Cierre"><input type="number" step="0.01" className="w-full border rounded-xl px-3 py-2" value={form.precioCierre} onChange={e=>update("precioCierre", e.target.value)} /></FormRow>

      <div className="md:col-span-3">
        <FormRow label="Notas">
          <textarea rows={3} className="w-full border rounded-xl px-3 py-2" placeholder="Cerré con 50% de prima / Roll antes de earnings..." value={form.notas} onChange={e=>update("notas", e.target.value)} />
        </FormRow>
      </div>

      <div className="md:col-span-3 flex justify-end gap-2 pt-2">
        <button className="px-4 py-2 rounded-xl border" onClick={onCancel}>Cancelar</button>
        <button className="px-4 py-2 rounded-xl bg-black text-white inline-flex items-center gap-2" onClick={onSave}><Save size={16}/>Guardar</button>
      </div>
    </div>
  );
}

