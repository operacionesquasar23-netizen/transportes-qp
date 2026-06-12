"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Requerimiento, STATUS_COLORS, STATUSES, Status } from "@/lib/types";

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

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const r = await api.getAllRequerimientos();
    if (r.ok) setReqs(r.data);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Panel analista — Transportes QP</h1>
        <p className="text-sm text-gray-500">{reqs.length} requerimientos en total</p>
      </header>

      <main className="w-full px-4 py-6">
        {msg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {msg}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-5">
          <input
            type="text"
            placeholder="Buscar cliente, solicitante, código, ID..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODOS">Todos los estados</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={cargar} className="border rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            ↺ Actualizar
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["ID", "Fecha", "Solicitante", "Cliente", "Código", "Recojo → Entrega", "Servicio", "Elementos", "Cotización", "Transportista", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-10 text-gray-400">
                      No hay requerimientos que coincidan.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((r) => (
                    <tr key={r.ID_REQ} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">{r.ID_REQ}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatFecha(r.FECHA)}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.SOLICITANTE}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.CLIENTE}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.CODIGO || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {r["RECOJO EN"]} → {r["ENTREGA EN"]}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.SERVICIO}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.ELEMENTOS || "—"}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {r.COTIZACION ? `S/ ${r.COTIZACION}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.TRANSPORTISTA || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[r.STATUS as Status]}`}>
                          {r.STATUS}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => abrirDetalle(r)}
                          className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                        >
                          Gestionar
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

      {/* Modal detalle */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-blue-600">{selected.ID_REQ}</span>
                  <span className="text-gray-400">·</span>
                  <span className="font-mono text-sm font-bold text-gray-700">{selected.CODIGO || "Sin código"}</span>
                </div>
                <h2 className="font-semibold text-gray-900 mt-0.5">{selected.CLIENTE}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Info label="Solicitante" value={selected.SOLICITANTE} />
                <Info label="Fecha" value={formatFecha(selected.FECHA)} />
                <Info label="Servicio" value={selected.SERVICIO} />
                <Info label="Razón social" value={selected["RAZON SOCIAL"]} />
                <Info label="Recojo en" value={selected["RECOJO EN"]} />
                <Info label="Entrega en" value={selected["ENTREGA EN"]} />
                <Info label="Personas" value={selected.PERSONAS} />
                <Info label="Área" value={selected.AREA} />
              </div>
              {selected.ELEMENTOS && (
                <div className="mt-3">
                  <span className="text-xs text-gray-400 block mb-1">Elementos</span>
                  <div className="space-y-1">
                    {selected.ELEMENTOS.split(" | ").map((item, i) => {
                      const [elem, marca, cant] = item.split("-");
                      return (
                        <div key={i} className="flex gap-3 text-sm bg-white border rounded-lg px-3 py-1.5">
                          <span className="text-gray-800 font-medium">{elem}</span>
                          {marca && <span className="text-gray-500">{marca}</span>}
                          {cant && <span className="text-gray-500">× {cant}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-5">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Gestión del analista</h3>
              <div className="space-y-3">
                <Campo label="Cotización (S/)" value={form.COTIZACION} onChange={(v) => set("COTIZACION", v)} type="number" />
                <Campo label="Transportista" value={form.TRANSPORTISTA} onChange={(v) => set("TRANSPORTISTA", v)} />
                <Campo label="Placa" value={form.PLACA} onChange={(v) => set("PLACA", v)} />
                <Campo label="Aprobado por" value={form["APROBADO POR"]} onChange={(v) => set("APROBADO POR", v)} />
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Status</label>
                  <select
                    value={form.STATUS}
                    onChange={(e) => set("STATUS", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={guardar}
                  disabled={loading}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {loading ? "Guardando..." : "Guardar"}
                </button>
                <button onClick={() => setSelected(null)} className="text-sm text-gray-500 hover:text-gray-800 px-3">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-gray-400">{label}</span>
      <p className="text-gray-800">{value || "—"}</p>
    </div>
  );
}

function Campo({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
