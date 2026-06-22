"use client";
import { useEffect, useRef, useState } from "react";
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
  FECHA: "", AREA: "", CLIENTE: "", CODIGO: "", PERSONAS: "", MARCA: "",
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
  const dmy = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;
  const ymd = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function armarMailto(r: Requerimiento, ejecutivo: string): string {
  const to = "Luis.Cucho@quasar-btl.pe";
  const cc = "Ivan.Castro@quasar-btl.pe;Paul.Najarro@quasar-btl.pe";
  const asunto = `SOLICITUD DE MOVILIDAD - ${r.ID_REQ} - ${r.CODIGO || ''} - ${r.CLIENTE}`;

  const cuerpo = [
    `Se ha registrado un nuevo requerimiento de movilidad:`,
    ``,
    `N° REQ   : ${r.ID_REQ}`,
    `Cliente  : ${r.CLIENTE}`,
    r.CODIGO ? `Código   : ${r.CODIGO}` : "",
    `Fecha    : ${formatFecha(r.FECHA)}`,
    `Servicio : ${r.SERVICIO}`,
    `Entrega  : ${r["ENTREGA EN"]}`,
    ``,
    `Saludos,`,
    ejecutivo,
  ].filter(l => l !== "").join("\n");

  return `mailto:${to}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

function armarMailtoMasivo(ids: string[], filas: Record<string, string>[], ejecutivo: string): string {
  const to = "Luis.Cucho@quasar-btl.pe";
  const cc = "Ivan.Castro@quasar-btl.pe;Paul.Najarro@quasar-btl.pe";
  const primero = filas[0] || {};
  const codigo = primero.CODIGO || "";
  const asunto = `SOLICITUD DE MOVILIDAD - CARGA MASIVA - ${filas.length} tiendas - ${codigo}`;

  const items = filas.map((f, i) => {
    const id = ids[i] || "";
    return `${i + 1}. N° REQ : ${id} | Entrega: ${f["ENTREGA EN"]} | Hora: ${f["HORARIO ENTREGA"] || "—"}`;
  }).join("\n");

  const cuerpo = [
    `Se han registrado las siguientes solicitudes de movilidad:`,
    ``,
    `Cliente : ${primero.CLIENTE || primero.MARCA || ""}`,
    codigo ? `Código  : ${codigo}` : "",
    `Fecha   : ${formatFecha(primero.FECHA)}`,
    `Servicio: ${primero.SERVICIO}`,
    ``,
    items,
    ``,
    `Saludos,`,
    ejecutivo,
  ].filter(l => l !== "").join("\n");

  return `mailto:${to}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

// ── Normalización de fecha/hora desde celdas de Excel ──────────
// Usamos cell.w (texto ya formateado por SheetJS según el number_format
// de la celda) en lugar de cell.v (valor crudo), porque .w siempre viene
// como string legible y evita lidiar con seriales, Date con año 1899, etc.

function normalizarFechaCelda(cell: any): string {
  if (!cell) return "";
  const texto = cell.w !== undefined ? String(cell.w).trim() : String(cell.v ?? "").trim();
  if (!texto) return "";

  // cell.w para fechas suele venir como "06/03/26" o "03/06/2026" según el formato.
  // Probamos varios patrones comunes.
  let m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = "20" + y;
    // Si el cell.v es un objeto Date, usamos eso directamente (más confiable que adivinar el orden).
    if (cell.v instanceof Date && !isNaN(cell.v.getTime())) {
      const d = String(cell.v.getDate()).padStart(2, "0");
      const mo = String(cell.v.getMonth() + 1).padStart(2, "0");
      const yr = cell.v.getFullYear();
      return `${d}/${mo}/${yr}`;
    }
    return `${a.padStart(2, "0")}/${b.padStart(2, "0")}/${y}`;
  }

  if (cell.v instanceof Date && !isNaN(cell.v.getTime())) {
    const d = String(cell.v.getDate()).padStart(2, "0");
    const mo = String(cell.v.getMonth() + 1).padStart(2, "0");
    const yr = cell.v.getFullYear();
    return `${d}/${mo}/${yr}`;
  }

  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  return texto;
}

function normalizarHoraCelda(cell: any): string {
  if (!cell) return "";
  // cell.w para horas viene formateado según number_format, ej. "13:00" o "1:00 PM".
  const texto = cell.w !== undefined ? String(cell.w).trim() : "";
  if (texto) {
    const m24 = texto.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return `${m24[1].padStart(2, "0")}:${m24[2]}`;

    const m12 = texto.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (m12) {
      let h = parseInt(m12[1], 10);
      const min = m12[2];
      const ampm = m12[3].toLowerCase();
      if (ampm === "pm" && h !== 12) h += 12;
      if (ampm === "am" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${min}`;
    }
  }

  // Fallback: calcular desde el valor crudo si .w no ayudó.
  const v = cell.v;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const h = String(v.getUTCHours()).padStart(2, "0");
    const min = String(v.getUTCMinutes()).padStart(2, "0");
    return `${h}:${min}`;
  }
  if (typeof v === "number") {
    const fraccionDia = v % 1;
    const totalMin = Math.round(fraccionDia * 24 * 60);
    const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
    const min = String(totalMin % 60).padStart(2, "0");
    return `${h}:${min}`;
  }
  return texto;
}

function textoCelda(cell: any): string {
  if (!cell) return "";
  if (cell.w !== undefined) return String(cell.w).trim();
  if (cell.v !== undefined) return String(cell.v).trim();
  return "";
}

export default function EjecutivoPage({ params }: { params: { ticket: string } }) {
  const { ticket } = params;
  const [ejecutivo, setEjecutivo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reqs, setReqs] = useState<Requerimiento[]>([]);
  const [vista, setVista] = useState<"lista" | "nuevo" | "editar" | "masivo" | "confirmacion" | "confirmacionMasivo">("lista");
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);
  const [elementos, setElementos] = useState<Elemento[]>([{ ...EMPTY_EL }]);
  const [editId, setEditId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [filasMasivo, setFilasMasivo] = useState<Record<string, string>[]>([]);
  const [cargandoExcel, setCargandoExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creado, setCreado] = useState<Requerimiento | null>(null);
  const [creadosMasivo, setCreadosMasivo] = useState<{ ids: string[]; filas: Record<string, string>[] } | null>(null);

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
      if (vista === "nuevo") {
        setCreado({ ...data, ID_REQ: r.id, SOLICITANTE: ejecutivo || "", STATUS: "PENDIENTE" } as Requerimiento);
        setVista("confirmacion");
      } else {
        setMsg("Solicitud actualizada.");
        setVista("lista");
        setTimeout(() => setMsg(""), 4000);
      }
      cargarReqs();
    } else {
      setMsg("Error al guardar. Intenta nuevamente.");
    }
  }

  function abrirEditar(req: Requerimiento) {
    setForm({
      FECHA: req.FECHA, AREA: req.AREA, CLIENTE: req.CLIENTE, CODIGO: req.CODIGO,
      PERSONAS: req.PERSONAS, MARCA: req.MARCA, "RECOJO EN": req["RECOJO EN"], "ENTREGA EN": req["ENTREGA EN"],
      SERVICIO: req.SERVICIO, "RAZON SOCIAL": req["RAZON SOCIAL"],
    });
    setElementos(strToEl(req.ELEMENTOS));
    setEditId(req.ID_REQ);
    setVista("editar");
  }

  async function manejarArchivoExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargandoExcel(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true, cellText: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const range = XLSX.utils.decode_range(sheet["!ref"] as string);

      // Encabezados de la fila 1
      const headers: string[] = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
        headers.push(cell ? textoCelda(cell) : "");
      }

      const filas: Record<string, string>[] = [];
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const porHeader: Record<string, any> = {};
        let filaVacia = true;
        for (let col = range.s.c; col <= range.e.c; col++) {
          const header = headers[col - range.s.c];
          if (!header) continue;
          const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
          porHeader[header] = cell;
          if (cell && cell.v !== undefined && cell.v !== "") filaVacia = false;
        }
        if (filaVacia) continue;

        filas.push({
          FECHA: normalizarFechaCelda(porHeader["FECHA"]),
          CODIGO: textoCelda(porHeader["CODIGO"]),
          MARCA: textoCelda(porHeader["MARCA"]),
          PERSONAS: textoCelda(porHeader["PERSONAS"]),
          ELEMENTOS: textoCelda(porHeader["ELEMENTOS"]),
          SERVICIO: textoCelda(porHeader["SERVICIO"]).toUpperCase() || "IDA",
          "ENTREGA EN": textoCelda(porHeader["ENTREGA EN"]),
          "HORARIO DE DESPACHO": normalizarHoraCelda(porHeader["HORARIO SALIDA"] ?? porHeader["HORARIO DE DESPACHO"]),
          "HORARIO ENTREGA": normalizarHoraCelda(porHeader["HORARIO LLEGADA"] ?? porHeader["HORARIO ENTREGA"]),
          "HORARIO RECOJO": normalizarHoraCelda(porHeader["HORARIO RECOJO"]),
          "RAZON SOCIAL": textoCelda(porHeader["RAZON SOCIAL"]),
          AREA: "People",
          "RECOJO EN": "Almacén Surco",
          CLIENTE: textoCelda(porHeader["MARCA"]),
        });
      }

      setFilasMasivo(filas);
      setVista("masivo");
    } catch (err) {
      console.error(err);
      setMsg("Error al leer el archivo. Verifica el formato.");
    }
    setCargandoExcel(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function confirmarMasivo() {
    setLoading(true);
    const r = await api.crearMasivo(ticket, filasMasivo);
    setLoading(false);
    if (r.ok) {
      setCreadosMasivo({ ids: r.ids, filas: filasMasivo });
      setVista("confirmacionMasivo");
      setFilasMasivo([]);
      cargarReqs();
    } else {
      setMsg("Error al crear las solicitudes: " + r.error);
    }
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
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={manejarArchivoExcel} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={cargandoExcel}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
            >
              {cargandoExcel ? "Leyendo..." : "📥 Cargar Excel"}
            </button>
            <button
              onClick={() => { setForm(EMPTY_FORM); setElementos([{ ...EMPTY_EL }]); setVista("nuevo"); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
            >
              + Nueva solicitud
            </button>
          </div>
        ) : (
          <button onClick={() => { setVista("lista"); setFilasMasivo([]); }} className="text-sm text-gray-400 hover:text-gray-700 transition">
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
              <Campo label="Marca / Campaña" value={form.MARCA} onChange={(v) => setF("MARCA", v)} />
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

        {vista === "masivo" && (
          <div className="bg-white border rounded-2xl p-7 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Confirmar carga masiva</h2>
            <p className="text-sm text-gray-400 mb-6">{filasMasivo.length} solicitudes serán creadas con estos datos.</p>

            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Fecha", "Código", "Marca", "Personas", "Elementos", "Servicio", "Entrega en", "Despacho", "Llegada", "Recojo"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasMasivo.map((f, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{f.FECHA}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{f.CODIGO}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">{f.MARCA}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{f.PERSONAS}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{f.ELEMENTOS}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{f.SERVICIO}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{f["ENTREGA EN"]}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">{f["HORARIO DE DESPACHO"]}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">{f["HORARIO ENTREGA"]}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">{f["HORARIO RECOJO"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={confirmarMasivo}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? "Creando..." : `Confirmar y crear ${filasMasivo.length} solicitudes`}
              </button>
              <button onClick={() => { setVista("lista"); setFilasMasivo([]); }} className="text-sm text-gray-400 hover:text-gray-600 px-3 transition">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {vista === "confirmacion" && creado && (
          <div className="bg-white border rounded-2xl p-8 shadow-sm text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Solicitud creada correctamente</h2>
            <p className="text-sm text-gray-400 mb-6">{creado.ID_REQ} · {creado.CLIENTE}</p>

            <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1 mb-6">
              <p><span className="text-gray-400">N° REQ:</span> <span className="font-medium text-gray-800">{creado.ID_REQ}</span></p>
              {creado.CODIGO && <p><span className="text-gray-400">Código:</span> <span className="font-medium text-gray-800">{creado.CODIGO}</span></p>}
              <p><span className="text-gray-400">Fecha:</span> <span className="font-medium text-gray-800">{formatFecha(creado.FECHA)}</span></p>
              <p><span className="text-gray-400">Servicio:</span> <span className="font-medium text-gray-800">{creado.SERVICIO}</span></p>
              <p><span className="text-gray-400">Entrega:</span> <span className="font-medium text-gray-800">{creado["ENTREGA EN"]}</span></p>
            </div>

            <div className="flex gap-3 justify-center">
              <a
                href={armarMailto(creado, ejecutivo || "")}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
              >
                ✉️ Enviar correo de confirmación
              </a>
              <button
                onClick={() => { setVista("lista"); setCreado(null); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3"
              >
                Ir a mis solicitudes
              </button>
            </div>
          </div>
        )}

        {vista === "confirmacionMasivo" && creadosMasivo && (
          <div className="bg-white border rounded-2xl p-8 shadow-sm text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {creadosMasivo.ids.length} solicitudes creadas correctamente
            </h2>
            <p className="text-sm text-gray-400 mb-6">Carga masiva completada</p>

            <div className="bg-gray-50 rounded-xl p-4 text-left text-sm mb-6 max-h-64 overflow-y-auto">
              {creadosMasivo.filas.map((f, i) => (
                <p key={i} className="py-1 border-b border-gray-100 last:border-0">
                  <span className="font-mono text-xs text-gray-400">{creadosMasivo.ids[i]}</span>
                  {" · "}
                  <span className="text-gray-700">{f["ENTREGA EN"]}</span>
                </p>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <a
                href={armarMailtoMasivo(creadosMasivo.ids, creadosMasivo.filas, ejecutivo || "")}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
              >
                ✉️ Enviar correo de confirmación
              </a>
              <button
                onClick={() => { setVista("lista"); setCreadosMasivo(null); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3"
              >
                Ir a mis solicitudes
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
