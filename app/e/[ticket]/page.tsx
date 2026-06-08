"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Requerimiento, STATUS_COLORS, SERVICIOS, Status } from "@/lib/types";

const EMPTY_FORM = {
  FECHA: "", AREA: "", CLIENTE: "", CODIGO: "", PERSONAS: "",
  ELEMENTOS: "", MARCA: "", CANTIDAD: "", "RECOJO EN": "",
  "ENTREGA EN": "", SERVICIO: "IDA", "RAZON SOCIAL": "",
};

export default function EjecutivoPage({ params }: { params: { ticket: string } }) {
  const { ticket } = params;
  const [ejecutivo, setEjecutivo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reqs, setReqs] = useState<Requerimiento[]>([]);
  const [vista, setVista] = useState<"lista" | "nuevo" | "editar">("lista");
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);
  const [editId, setEditId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.validarTicket(ticket).then((r) => {
      if (r.ok) {
        setEjecutivo(r.ejecutivo);
        cargarReqs();
      } else {
        setError("Acceso no válido. Verifica tu link.");
      }
    });
  }, [ticket]);

  async function cargarReqs() {
    const r = await api.getRequerimientos(ticket);
    if (r.ok) setReqs(r.data);
  }

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar() {
    setLoading(true);
    let r;
    if (vista === "nuevo") {
      r = await api.crearRequerimiento(ticket, form);
    } else {
      r = await api.editarRequerimiento(editId, "ejecutivo", form);
    }
    setLoading(false);
    if (r.ok) {
      setMsg(vista === "nuevo" ? "Requerimiento creado." : "Requerimiento actualizado.");
      setVista("lista");
      cargarReqs();
      setTimeout(() => setMsg(""), 3000);
    } else {
      setMsg("Error: " + r.error);
    }
  }

  function abrirEditar(req: Requerimiento) {
    setForm({
      FECHA: req.FECHA, AREA: req.AREA, CLIENTE: req.CLIENTE,
      CODIGO: req.CODIGO, PERSONAS: req.PERSONAS, ELEMENTOS: req.ELEMENTOS,
      MARCA: req.MARCA, CANTIDAD: req.CANTIDAD, "RECOJO EN": req["RECOJO EN"],
      "ENTREGA EN": req["ENTREGA EN"], SERVICIO: req.SERVICIO, "RAZON SOCIAL": req["RAZON SOCIAL"],
    });
    setEditId(req.ID_REQ);
    setVista("editar");
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl border text-center max-w-sm">
        <p className="text-red-600 font-medium">{error}</p>
      </div>
    </div>
  );

  if (!ejecutivo) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">Validando acceso...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Transportes QP</h1>
          <p className="text-sm text-gray-500">{ejecutivo}</p>
        </div>
        {vista === "lista" && (
          <button
            onClick={() => { setForm(EMPTY_FORM); setVista("nuevo"); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Nueva solicitud
          </button>
        )}
        {vista !== "lista" && (
          <button onClick={() => setVista("lista")} className="text-sm text-gray-500 hover:text-gray-800">
            ← Volver
          </button>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {msg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {msg}
          </div>
        )}

        {vista === "lista" && (
          <>
            {reqs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-lg">No tienes solicitudes aún.</p>
                <p className="text-sm mt-1">Crea tu primera solicitud de transporte.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reqs.map((r) => (
                  <div key={r.ID_REQ} className="bg-white border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-gray-400">{r.ID_REQ}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.STATUS as Status]}`}>
                            {r.STATUS}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900 mt-1">{r.CLIENTE || "—"}</p>
                        <p className="text-sm text-gray-500">{r.ELEMENTOS} {r.MARCA && `· ${r.MARCA}`} {r.CANTIDAD && `· ${r.CANTIDAD} und.`}</p>
                        <p className="text-sm text-gray-500">{r["RECOJO EN"]} → {r["ENTREGA EN"]}</p>
                        <p className="text-xs text-gray-400 mt-1">{r.FECHA} · {r.SERVICIO}</p>
                        {r.COTIZACION && (
                          <p className="text-sm text-blue-700 mt-1 font-medium">Cotización: S/ {r.COTIZACION}</p>
                        )}
                      </div>
                      {(r.STATUS === "PENDIENTE" || r.STATUS === "PROGRAMADO") && (
                        <button
                          onClick={() => abrirEditar(r)}
                          className="text-xs text-blue-600 hover:underline shrink-0"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {(vista === "nuevo" || vista === "editar") && (
          <div className="bg-white border rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-5">
              {vista === "nuevo" ? "Nueva solicitud de transporte" : `Editar ${editId}`}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Fecha del servicio" value={form.FECHA} onChange={(v) => set("FECHA", v)} type="date" required />
              <Campo label="Área" value={form.AREA} onChange={(v) => set("AREA", v)} />
              <Campo label="Cliente" value={form.CLIENTE} onChange={(v) => set("CLIENTE", v)} required />
              <Campo label="Razón social" value={form["RAZON SOCIAL"]} onChange={(v) => set("RAZON SOCIAL", v)} />
              <Campo label="Código" value={form.CODIGO} onChange={(v) => set("CODIGO", v)} />
              <div>
                <label className="block text-sm text-gray-600 mb-1">Servicio</label>
                <select
                  value={form.SERVICIO}
                  onChange={(e) => set("SERVICIO", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SERVICIOS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <Campo label="Recojo en" value={form["RECOJO EN"]} onChange={(v) => set("RECOJO EN", v)} required />
              <Campo label="Entrega en" value={form["ENTREGA EN"]} onChange={(v) => set("ENTREGA EN", v)} required />
              <Campo label="Elementos" value={form.ELEMENTOS} onChange={(v) => set("ELEMENTOS", v)} />
              <Campo label="Marca" value={form.MARCA} onChange={(v) => set("MARCA", v)} />
              <Campo label="Cantidad" value={form.CANTIDAD} onChange={(v) => set("CANTIDAD", v)} type="number" />
              <Campo label="Personas" value={form.PERSONAS} onChange={(v) => set("PERSONAS", v)} type="number" />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={guardar}
                disabled={loading}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? "Guardando..." : vista === "nuevo" ? "Enviar solicitud" : "Guardar cambios"}
              </button>
              <button onClick={() => setVista("lista")} className="text-sm text-gray-500 hover:text-gray-800 px-3">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Campo({ label, value, onChange, type = "text", required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
