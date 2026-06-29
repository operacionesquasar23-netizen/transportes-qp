"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Requerimiento, Status } from "@/lib/types";

// Secuencia lineal de los estados "normales" del flujo. CANCELADO y NO EJECUTADO
// son estados finales que rompen la secuencia, así que se muestran aparte.
const PASOS: Status[] = ["PENDIENTE", "PROGRAMADO", "EJECUTADO"];

const PASO_LABEL: Record<string, string> = {
  PENDIENTE: "Solicitud registrada",
  PROGRAMADO: "Transporte programado",
  EJECUTADO: "Servicio completado",
};

const STATUS_BADGE: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  PROGRAMADO: "bg-blue-100 text-blue-700",
  EJECUTADO: "bg-green-100 text-green-700",
  "NO EJECUTADO": "bg-red-100 text-red-700",
  CANCELADO: "bg-gray-100 text-gray-500",
};

function formatFecha(valor: string): string {
  if (!valor) return "—";
  const dmy = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;
  const ymd = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function SeguimientoPage() {
  const [reqs, setReqs] = useState<Requerimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    const r = await api.getAllRequerimientos();
    if (r.ok) setReqs(r.data);
    setCargando(false);
  }

  const filtrados = reqs.filter((r) => {
    const matchStatus = filtroStatus === "TODOS" || r.STATUS === filtroStatus;
    const q = busqueda.toLowerCase();
    const matchBusqueda = !q || [r.CLIENTE, r.CODIGO, r.ID_REQ, r["ENTREGA EN"], r.SOLICITANTE]
      .some((v) => String(v).toLowerCase().includes(q));
    return matchStatus && matchBusqueda;
  }).sort((a, b) => b.ID_REQ.localeCompare(a.ID_REQ));

  const esFinalAnomalo = (s: string) => s === "CANCELADO" || s === "NO EJECUTADO";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1e2d5a] px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-white/40 flex items-center justify-center text-white font-bold text-sm shrink-0">QP</div>
          <div>
            <p className="text-white font-semibold text-base leading-tight">Transportes QP — Seguimiento</p>
            <p className="text-white/60 text-xs">Consulta el estado de cualquier solicitud</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href="/" className="text-white/70 hover:text-white text-sm transition">← Inicio</a>
          <button onClick={cargar} className="bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded-lg transition">
            ↺ Actualizar
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6">
        {/* Buscador */}
        <div className="bg-white rounded-2xl border p-4 sm:p-5 mb-6 shadow-sm">
          <input
            type="text"
            placeholder="Buscar por cliente, código, ID o tienda..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"
          />
          <div className="flex flex-wrap gap-2">
            {["TODOS", "PENDIENTE", "PROGRAMADO", "EJECUTADO", "NO EJECUTADO", "CANCELADO"].map((s) => (
              <button
                key={s}
                onClick={() => setFiltroStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                  filtroStatus === s
                    ? "bg-[#1e2d5a] text-white border-[#1e2d5a]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {s === "TODOS" ? "Todos" : s}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">{filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Lista de tarjetas */}
        {cargando ? (
          <p className="text-center text-gray-400 text-sm py-12">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm">No se encontraron solicitudes con esos filtros.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtrados.map((r) => {
              const pasoActualIdx = PASOS.indexOf(r.STATUS as Status);
              const anomalo = esFinalAnomalo(r.STATUS);

              return (
                <div key={r.ID_REQ} className="bg-white rounded-2xl border p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="font-mono text-xs text-gray-400">{r.ID_REQ}{r.CODIGO ? ` · ${r.CODIGO}` : ""}</p>
                      <h3 className="font-semibold text-gray-900">{r.CLIENTE || "—"}</h3>
                      <p className="text-sm text-gray-500">{r["ENTREGA EN"]} · {formatFecha(r.FECHA)}</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[r.STATUS] || "bg-gray-100 text-gray-500"}`}>
                      {r.STATUS}
                    </span>
                  </div>

                  {/* Línea de tiempo */}
                  {anomalo ? (
                    <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                      r.STATUS === "CANCELADO" ? "bg-gray-50 text-gray-500" : "bg-red-50 text-red-600"
                    }`}>
                      <span>{r.STATUS === "CANCELADO" ? "⊘" : "⚠"}</span>
                      <span>{r.STATUS === "CANCELADO" ? "Esta solicitud fue cancelada." : "El servicio no pudo ejecutarse."}</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      {PASOS.map((paso, i) => {
                        const completado = i < pasoActualIdx;
                        const actual = i === pasoActualIdx;
                        const activo = completado || actual;
                        return (
                          <div key={paso} className="flex items-center flex-1 last:flex-initial">
                            <div className="flex flex-col items-center text-center w-20 sm:w-28">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                                completado ? "bg-[#1e2d5a] text-white" :
                                actual ? "bg-blue-500 text-white ring-4 ring-blue-100" :
                                "bg-gray-100 text-gray-400"
                              }`}>
                                {completado ? "✓" : i + 1}
                              </div>
                              <p className={`text-[11px] mt-1.5 leading-tight ${activo ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                                {PASO_LABEL[paso]}
                              </p>
                            </div>
                            {i < PASOS.length - 1 && (
                              <div className={`flex-1 h-0.5 -mt-5 ${i < pasoActualIdx ? "bg-[#1e2d5a]" : "bg-gray-200"}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
