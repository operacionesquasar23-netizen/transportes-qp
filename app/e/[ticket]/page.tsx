"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Requerimiento, STATUS_COLORS, SERVICIOS, Status } from "@/lib/types";

interface Elemento {
  elemento: string;
  marca: string;
  cantidad: string;
}

const EMPTY_FORM = {
  FECHA: "", AREA: "", CLIENTE: "", CODIGO: "", PERSONAS: "",
  "RECOJO EN": "", "ENTREGA EN": "", SERVICIO: "IDA", "RAZON SOCIAL": "",
};

const EMPTY_ELEMENTO: Elemento = { elemento: "", marca: "", cantidad: "" };

function elementosToString(items: Elemento[]): string {
  return items.filter(i => i.elemento).map(i => `${i.elemento}-${i.marca}-${i.cantidad}`).join(" | ");
}

function stringToElementos(str: string): Elemento[] {
  if (!str) return [{ ...EMPTY_ELEMENTO }];
  return str.split(" | ").map(item => {
    const [elemento = "", marca = "", cantidad = ""] = item.split("-");
    return { elemento, marca, cantidad };
  });
}

function formatFecha(valor: string): string {
  if (!valor) return "—";
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function EjecutivoPage({ params }: { params: { ticket: string } }) {
  const { ticket } = params;
  const [ejecutivo, setEjecutivo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reqs, setReqs] = useState<Requerimiento[]>([]);
  const [vista, setVista] = useState<"lista" | "nuevo" | "editar">("lista");
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);
  const [elementos, setElementos] = useState<Elemento[]>([{ ...EMPTY_ELEMENTO }]);
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

  function setF(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setElemento(idx: number, campo: keyof Elemento, valor: string) {
    setElementos(prev => prev.map((e, i) => i === idx ? { ...e, [campo]: valor } : e));
  }

  function agregarElemento() {
    setElementos(prev => [...prev, { ...EMPTY_ELEMENTO }]);
  }

  function eliminarElemento(idx: number) {
    setElementos(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  }

  async function guardar() {
    setLoading(true);
    const data = { ...form, ELEMENTOS: elementosToString(elementos) };
    let r;
    if (vista === "nuevo") {
      r = await api.crearRequerimiento(ticket, data);
    } else {
      r = await api.editarRequerimiento(editId, "ejecutivo", data);
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
      CODIGO: req.CODIGO, PERSONAS: req.PERSONAS,
      "RECOJO EN": req["RECOJO EN"], "ENTREGA EN": req["ENTREGA EN"],
      SERVICIO: req.SERVICIO, "RAZON SOCIAL": req["RAZON SOCIAL"],
    });
    setElementos(stringToElementos(req.ELEMENTOS));
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
            onClick={() => { setForm(EMPTY_FORM); setElementos([{ ...EMPTY_ELEMENTO }]); setVista("nuevo"); }}
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
                          {r.CODIGO && <span className="text-xs font-mono text-gray-600 font-medium">{r.CODIGO}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.STATUS as Status]}`}>
                            {r.STATUS}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900 mt-1">{r.CLIENTE || "—"}</p>
                        {r.ELEMENTOS && (
                          <div className="mt-1 space-y-0.5">
                            {r.ELEMENTOS.split(" | ").map((item, i) => {
                              const [elem, marca, cant] = item.split("-");
                              return (
                                <p key={i} className="text-sm text-gray-500">
                                  {elem}{marca ? ` · ${marca}` : ""}{cant ? ` · ${cant} und.` : ""}
                                </p>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-sm text-gray-500 mt-1">{r["RECOJO EN"]} → {r["ENTREGA EN"]}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatFecha(r.FECHA)} · {r.SERVICIO}</p>
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
              <Campo label="Fecha del servicio" value={form.FECHA} onChange={(v) => setF("FECHA", v)} type="date" required />
              <Campo label="Área" value={form.AREA} onChange={(v) => setF("AREA", v)} />
              <Campo label="Cliente" value={form.CLIENTE} onChange={(v) => setF("CLIENTE", v)} required />
              <Campo label="Razón social" value={form["RAZON SOCIAL"]} onChange={(v) => setF("RAZON SOCIAL", v)} />
              <Campo label="Código" value={form.CODIGO} onChange={(v) => setF("CODIGO", v)} />
              <div>
                <label className="block text-sm text-gray-600 mb-1">Servicio</label>
                <select
                  value={form.SERVICIO}
                  onChange={(e) => setF("SERVICIO", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SERVICIOS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <Campo label="Recojo en" value={form["RECOJO EN"]} onChange={(v) => setF("RECOJO EN", v)} required />
              <Campo label="Entrega en" value={form["ENTREGA EN"]} onChange={(v) => setF("ENTREGA EN", v)} required />
              <Campo label="Personas" value={form.PERSONAS} onChange={(v) => setF("PERSONAS", v)} type="number" />
            </div>

            {/* Sección elementos */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Elementos</label>
                <button
                  onClick={agregarElemento}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Agregar elemento
                </button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 px-1">
                  <span>Elemento</span><span>Marca</span><span>Cantidad</span>
                </div>
                {elementos.map((el, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Ej: Cajas"
                      value={el.elemento}
                      onChange={(e) => setElemento(idx, "elemento", e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Ej: Nike"
                      value={el.marca}
                      onChange={(e) => setElemento(idx, "marca", e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="0"
                        value={el.cantidad}
                        onChange={(e) => setElemento(idx, "cantidad", e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {elementos.length > 1 && (
                        <button
                          onClick={() => eliminarElemento(idx)}
                          className="text-red-400 hover:text-red-600 px-1 text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
