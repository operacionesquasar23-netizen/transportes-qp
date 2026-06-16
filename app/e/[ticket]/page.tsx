"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Requerimiento, SERVICIOS, Status } from "@/lib/types";

const STATUS_PILL: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  PROGRAMADO: "bg-blue-100 text-blue-700",
  EJECUTADO: "bg-green-100 text-green-700",
  "NO EJECUTADO": "bg-red-100 text-red-700",
  CANCELADO: "bg-gray-100 text-gray-500",
};

interface Elemento { elemento: string; marca: string; cantidad: string; }
const EMPTY_EL: Elemento = { elemento: "", marca: "", cantidad: "" };

const EMPTY_FORM = {
  FECHA: "", AREA: "", CLIENTE: "", CODIGO: "", PERSONAS: "",
  "RECOJO EN": "", "ENTREGA EN": "", SERVICIO: "IDA", "RAZON SOCIAL": "",
};

function elToStr(items: Elemento[]): string {
  return items.filter(i => i.elemento).map(i => `${i.elemento}-${i.marca}-${i.cantidad}`).join(" | ");
}
function strToEl(str: string): Elemento[] {
  if (!str) return [{ ...EMPTY_EL }];
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

function armarMailto(r: Requerimiento, ejecutivo: string): string {
  const to = "Luis.Cucho@quasar-btl.pe";
  const cc = "Ivan.Castro@quasar-btl.pe;Paul.Najarro@quasar-btl.pe";
  const asunto = `SOLICITUD DE MOVILIDAD - ${r.ID_REQ} - ${r.CODIGO || ''} - ${r.CLIENTE}`;

  const elementos = r.ELEMENTOS
    ? r.ELEMENTOS.split(" | ").map((item, i) => {
        const [elem, marca, cant] = item.split("-");
        return `  ${i + 1}. ${elem}${marca ? ` - ${marca}` : ""}${cant ? ` - ${cant} und.` : ""}`;
      }).join("\n")
    : "  —";

  const cuerpo = [
    `Estimado equipo,`,
    ``,
    `Se solicita el siguiente servicio de transporte:`,
    ``,
    `ID Requerimiento : ${r.ID_REQ}`,
    `Solicitante      : ${ejecutivo}`,
    `Fecha de servicio: ${formatFecha(r.FECHA)}`,
    `Cliente          : ${r.CLIENTE}`,
    r["RAZON SOCIAL"] ? `Razón social     : ${r["RAZON SOCIAL"]}` : "",
    r.CODIGO          ? `Código           : ${r.CODIGO}` : "",
    `Tipo de servicio : ${r.SERVICIO}`,
    `Recojo en        : ${r["RECOJO EN"]}`,
    `Entrega en       : ${r["ENTREGA EN"]}`,
    r.PERSONAS        ? `Personas         : ${r.PERSONAS}` : "",
    ``,
    `Elementos a transportar:`,
    elementos,
    ``,
    `Por favor confirmar disponibilidad y cotización.`,
    ``,
    `Saludos,`,
    ejecutivo,
  ].filter(l => l !== undefined && !(l === "" && false)).join("\n");

  return `mailto:${to}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

export default function EjecutivoPage({ params }: { params: { ticket: string } }) {
  const { ticket } = params;
  const [ejecutivo, setEjecutivo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reqs, setReqs] = useState<Requerimiento[]>([]);
  const [vista, setVista] = useState<"lista" | "nuevo" | "editar">("lista");
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);
  const [elementos, setElementos] = useState<Elemento[]>([{ ...EMPTY_EL }]);
  const [editId, setEditId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.validarTicket(ticket).then((r) => {
      if (r.ok) { setEjecutivo(r.ejecutivo); cargarReqs(); }
      else setError("Link no válido. Contacta al administrador.");
    });
  }, [ticket]);

  async function cargarReqs() {
    const r = await api.getRequerimientos(ticket);
    if (r.ok) setReqs(r.data);
  }

  function setF(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function setEl(idx: number, campo: keyof Elemento, val: string) {
    setElementos(prev => prev.map((e, i) => i === idx ? { ...e, [campo]: val } : e));
  }

  async function guardar() {
    setLoading(true);
    const data = { ...form, ELEMENTOS: elToStr(elementos) };
    const r = vista === "nuevo"
      ? await api.crearRequerimiento(ticket, data)
      : await api.editarRequerimiento(editId, "ejecutivo", data);
    setLoading(false);
    if (r.ok) {
      setMsg(vista === "nuevo" ? "Solicitud enviada correctamente." : "Solicitud actualizada.");
      setVista("lista");
      cargarReqs();
      setTimeout(() => setMsg(""), 4000);
    } else {
      setMsg("Error al guardar. Intenta nuevamente.");
    }
  }

  function abrirEditar(req: Requerimiento) {
    setForm({
      FECHA: req.FECHA, AREA: req.AREA, CLIENTE: req.CLIENTE, CODIGO: req.CODIGO,
      PERSONAS: req.PERSONAS, "RECOJO EN": req["RECOJO EN"], "ENTREGA EN": req["ENTREGA EN"],
      SERVICIO: req.SERVICIO, "RAZON SOCIAL": req["RAZON SOCIAL"],
    });
    setElementos(strToEl(req.ELEMENTOS));
    setEditId(req.ID_REQ);
    setVista("editar");
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-2xl border text-center max-w-sm shadow-sm">
        <p className="text-2xl mb-2">🔒</p>
        <p className="text-gray-700 font-medium">{error}</p>
        <a href="/" className="text-sm text-blue-600 hover:underline mt-4 block">← Volver al inicio</a>
      </div>
    </div>
  );

  if (!ejecutivo) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Verificando acceso...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-700 transition">← Inicio</a>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Transportes QP</h1>
            <p className="text-sm text-gray-400 mt-0.5">{ejecutivo}</p>
          </div>
        </div>
        {vista === "lista" ? (
          <button
            onClick={() => { setForm(EMPTY_FORM); setElementos([{ ...EMPTY_EL }]); setVista("nuevo"); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            + Nueva solicitud
          </button>
        ) : (
          <button onClick={() => setVista("lista")} className="text-sm text-gray-400 hover:text-gray-700 transition">
            ← Volver
          </button>
        )}
      </header>

      <main className="px-8 py-6 max-w-3xl mx-auto">
        {msg && (
          <div className="mb-5 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>
        )}

        {vista === "lista" && (
          reqs.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-base font-medium text-gray-500">No tienes solicitudes aún</p>
              <p className="text-sm mt-1">Usa el botón superior para crear tu primera solicitud.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reqs.map((r) => (
                <div key={r.ID_REQ} className="bg-white border rounded-2xl p-5 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-gray-400">{r.ID_REQ}</span>
                        {r.CODIGO && <span className="font-mono text-xs font-semibold text-gray-600">{r.CODIGO}</span>}
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_PILL[r.STATUS as Status] || "bg-gray-100 text-gray-500"}`}>
                          {r.STATUS}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">{r.CLIENTE || "—"}</p>
                      {r.ELEMENTOS && (
                        <div className="mt-1">
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
                        <p className="text-sm text-blue-600 font-semibold mt-2">Cotización: S/ {r.COTIZACION}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 items-end">
                      <a
                        href={armarMailto(r, ejecutivo)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1"
                      >
                        ✉️ Enviar correo
                      </a>
                      {(r.STATUS === "PENDIENTE" || r.STATUS === "PROGRAMADO") && (
                        <button
                          onClick={() => abrirEditar(r)}
                          className="text-sm text-blue-600 font-medium hover:underline"
                        >
                          Editar →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {(vista === "nuevo" || vista === "editar") && (
          <div className="bg-white border rounded-2xl p-7 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              {vista === "nuevo" ? "Nueva solicitud de transporte" : `Editar ${editId}`}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Fecha del servicio" value={form.FECHA} onChange={(v) => setF("FECHA", v)} type="date" required />
              <Campo label="Área" value={form.AREA} onChange={(v) => setF("AREA", v)} />
              <Campo label="Cliente" value={form.CLIENTE} onChange={(v) => setF("CLIENTE", v)} required />
              <Campo label="Razón social" value={form["RAZON SOCIAL"]} onChange={(v) => setF("RAZON SOCIAL", v)} />
              <Campo label="Código" value={form.CODIGO} onChange={(v) => setF("CODIGO", v)} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Servicio</label>
                <select value={form.SERVICIO} onChange={(e) => setF("SERVICIO", e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {SERVICIOS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <Campo label="Recojo en" value={form["RECOJO EN"]} onChange={(v) => setF("RECOJO EN", v)} required />
              <Campo label="Entrega en" value={form["ENTREGA EN"]} onChange={(v) => setF("ENTREGA EN", v)} required />
              <Campo label="Personas" value={form.PERSONAS} onChange={(v) => setF("PERSONAS", v)} type="number" />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">Elementos</p>
                <button onClick={() => setElementos(p => [...p, { ...EMPTY_EL }])} className="text-xs text-blue-600 hover:underline font-medium">
                  + Agregar elemento
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 px-1 mb-1">
                <span>Elemento</span><span>Marca</span><span>Cantidad</span>
              </div>
              <div className="space-y-2">
                {elementos.map((el, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                    <input type="text" placeholder="Ej: Cajas" value={el.elemento}
                      onChange={(e) => setEl(idx, "elemento", e.target.value)}
                      className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <input type="text" placeholder="Ej: Nike" value={el.marca}
                      onChange={(e) => setEl(idx, "marca", e.target.value)}
                      className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <div className="flex gap-1">
                      <input type="number" placeholder="0" value={el.cantidad}
                        onChange={(e) => setEl(idx, "cantidad", e.target.value)}
                        className="border rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      {elementos.length > 1 && (
                        <button onClick={() => setElementos(p => p.filter((_, i) => i !== idx))}
                          className="text-gray-300 hover:text-red-400 px-1 text-xl leading-none">×</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 flex gap-3">
              <button onClick={guardar} disabled={loading}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                {loading ? "Enviando..." : vista === "nuevo" ? "Enviar solicitud" : "Guardar cambios"}
              </button>
              <button onClick={() => setVista("lista")} className="text-sm text-gray-400 hover:text-gray-600 px-3 transition">
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
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
    </div>
  );
}
