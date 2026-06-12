"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Requerimiento, STATUSES, Status } from "@/lib/types";

const STATUS_PILL: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  PROGRAMADO: "bg-blue-100 text-blue-700",
  EJECUTADO: "bg-green-100 text-green-700",
  "NO EJECUTADO": "bg-red-100 text-red-700",
  CANCELADO: "bg-gray-100 text-gray-500",
};

function formatFecha(valor: string): string {
  if (!valor) return "—";
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AnalistaPage() {
  const [reqs, setReqs] = useState<Requerimiento[]>([]);
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState<Requerimiento | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    const r = await api.getAllRequerimientos();
    if (r.ok) setReqs(r.data);
    setCargando(false);
  }

  function abrirDetalle(req: Requerimiento) {
    setSelected(req);
    setForm({
      COTIZACION: req.COTIZACION,
      TRANSPORTISTA: req.TRANSPORTISTA,
      PLACA: req.PLACA,
      "APROBADO POR": req["APROBADO POR"],
      STATUS: req.STATUS,
    });
    setMsg("");
  }

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar() {
    if (!selected) return;
    setLoading(true);
    const { STATUS: newStatus, ...resto } = form;
    const [r1, r2] = await Promise.all([
      api.editarRequerimiento(selected.ID_REQ, "analista", resto),
      api.cambiarStatus(selected.ID_REQ, newStatus),
    ]);
    setLoading(false);
    if (r1.ok && r2.ok) {
      setMsg("Guardado correctamente.");
      cargar();
      setSelected(null);
      setTimeout(() => setMsg(""), 3000);
    } else {
      setMsg("Error al guardar.");
    }
  }

  const filtrados = reqs.filter((r) => {
    const matchStatus = filtroStatus === "TODOS" || r.STATUS === filtroStatus;
    const q = busqueda.toLowerCase();
    const matchBusqueda = !q || [r.CLIENTE, r.SOLICITANTE, r.ID_REQ, r.ELEMENTOS, r.CODIGO]
      .some((v) => String(v).toLowerCase().includes(q));
    return matchStatus && matchBusqueda;
  });

  const conteos = {
    total: reqs.length,
    pendiente: reqs.filter(r => r.STATUS === "PENDIENTE").length,
    programado: reqs.filter(r => r.STATUS === "PROGRAMADO").length,
    ejecutado: reqs.filter(r => r.STATUS === "EJECUTADO").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Transportes QP</h1>
          <p className="text-sm text-gray-400 mt-0.5">Panel de operaciones</p>
        </div>
        <button
          onClick={cargar}
          className="text-sm text-gray-500 border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          ↺ Actualizar
        </button>
      </header>

      <main className="px-8 py-6">
        {msg && (
          <div className="mb-5 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {msg}
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard label="Total" value={conteos.total} color="text-blue-600" bg="bg-blue-50" />
          <MetricCard label="Pendientes" value={conteos.pendiente} color="text-amber-600" bg="bg-amber-50" />
          <MetricCard label="Programados" value={conteos.programado} color="text-indigo-600" bg="bg-indigo-50" />
          <MetricCard label="Ejecutados" value={conteos.ejecutado} color="text-green-600" bg="bg-green-50" />
        </div>

        {/* Búsqueda */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar por cliente, solicitante, código, ID..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full max-w-md border rounded-xl px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
        </div>

        {/* Filtros pill */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["TODOS", ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition border ${
                filtroStatus === s
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {s === "TODOS" ? "Todos" : s}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {["ID REQ", "CLIENTE", "CÓDIGO", "SOLICITANTE", "FECHA", "RECOJO → ENTREGA", "SERVICIO", "ELEMENTOS", "COTIZACIÓN", "TRANSPORTISTA", "ESTADO", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-gray-400 text-sm">
                      Cargando...
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-gray-400 text-sm">
                      No hay requerimientos que coincidan.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((r, i) => (
                    <tr key={r.ID_REQ} className={`border-b last:border-0 hover:bg-gray-50 transition ${i % 2 === 0 ? "" : ""}`}>
                      <td className="px-5 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">{r.ID_REQ}</td>
                      <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">{r.CLIENTE}</td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.CODIGO || "—"}</td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.SOLICITANTE}</td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{formatFecha(r.FECHA)}</td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap text-sm">
                        {r["RECOJO EN"]} → {r["ENTREGA EN"]}
                      </td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.SERVICIO}</td>
                      <td className="px-5 py-4 text-gray-600 max-w-xs">
                        <div className="space-y-0.5">
                          {r.ELEMENTOS ? r.ELEMENTOS.split(" | ").map((item, i) => {
                            const [elem, marca, cant] = item.split("-");
                            return (
                              <p key={i} className="text-xs text-gray-500 whitespace-nowrap">
                                {elem}{marca ? ` · ${marca}` : ""}{cant ? ` · ${cant}` : ""}
                              </p>
                            );
                          }) : <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-700 whitespace-nowrap font-medium">
                        {r.COTIZACION ? `S/ ${r.COTIZACION}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.TRANSPORTISTA || "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_PILL[r.STATUS] || "bg-gray-100 text-gray-500"}`}>
                          {r.STATUS}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => abrirDetalle(r)}
                          className="text-sm text-blue-600 font-medium hover:underline whitespace-nowrap"
                        >
                          Ver →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Modal header */}
            <div className="px-6 py-5 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-blue-600">{selected.ID_REQ}</span>
                    {selected.CODIGO && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="font-mono text-sm font-bold text-gray-600">{selected.CODIGO}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{selected.CLIENTE}</h2>
                  <p className="text-sm text-gray-400">{selected["RAZON SOCIAL"]}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-2xl leading-none mt-1">×</button>
              </div>
            </div>

            {/* Info del requerimiento */}
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Info label="Solicitante" value={selected.SOLICITANTE} />
                <Info label="Fecha" value={formatFecha(selected.FECHA)} />
                <Info label="Servicio" value={selected.SERVICIO} />
                <Info label="Personas" value={selected.PERSONAS} />
                <Info label="Recojo en" value={selected["RECOJO EN"]} />
                <Info label="Entrega en" value={selected["ENTREGA EN"]} />
              </div>
              {selected.ELEMENTOS && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 mb-2">Elementos</p>
                  <div className="space-y-1">
                    {selected.ELEMENTOS.split(" | ").map((item, i) => {
                      const [elem, marca, cant] = item.split("-");
                      return (
                        <div key={i} className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2 text-sm">
                          <span className="font-medium text-gray-800">{elem}</span>
                          {marca && <span className="text-gray-400">{marca}</span>}
                          {cant && <span className="text-gray-500 ml-auto">× {cant}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Gestión analista */}
            <div className="px-6 py-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">Gestión</p>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Cotización (S/)" value={form.COTIZACION} onChange={(v) => set("COTIZACION", v)} type="number" />
                <Campo label="Aprobado por" value={form["APROBADO POR"]} onChange={(v) => set("APROBADO POR", v)} />
                <Campo label="Transportista" value={form.TRANSPORTISTA} onChange={(v) => set("TRANSPORTISTA", v)} />
                <Campo label="Placa" value={form.PLACA} onChange={(v) => set("PLACA", v)} />
              </div>
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <select
                  value={form.STATUS}
                  onChange={(e) => set("STATUS", e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={guardar}
                  disabled={loading}
                  className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {loading ? "Guardando..." : "Guardar cambios"}
                </button>
                <button onClick={() => setSelected(null)} className="text-sm text-gray-400 hover:text-gray-600 px-3">
                  Cerrar
                </button>
              </div>
              {msg && <p className="mt-3 text-sm text-green-600">{msg}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl px-6 py-5 text-center`}>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className={`text-sm mt-1 ${color} opacity-80`}>{label}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value || "—"}</p>
    </div>
  );
}

function Campo({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );
}
