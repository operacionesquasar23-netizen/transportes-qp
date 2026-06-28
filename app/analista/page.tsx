"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Requerimiento, STATUSES, Status } from "@/lib/types";

const PIN_CORRECTO = "op01";

const STATUS_PILL: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  PROGRAMADO: "bg-blue-100 text-blue-700",
  EJECUTADO: "bg-green-100 text-green-700",
  "NO EJECUTADO": "bg-red-100 text-red-700",
  CANCELADO: "bg-gray-100 text-gray-500",
};

interface Elemento { elemento: string; marca: string; cantidad: string; }
const EMPTY_EL: Elemento = { elemento: "", marca: "", cantidad: "" };

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

// Convierte una fecha DD/MM/YYYY a "viernes 19/06" para el resumen de movilidad.
function fechaConDia(valor: string): string {
  if (!valor) return "—";
  const dmy = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dmy) return formatFecha(valor);
  const [, d, m, y] = dmy;
  const fecha = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  if (isNaN(fecha.getTime())) return formatFecha(valor);
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const nombreDia = dias[fecha.getDay()];
  return `${nombreDia} ${d.padStart(2, "0")}/${m.padStart(2, "0")}`;
}

// Convierte "13:00" a "1:00pm" para que el resumen se lea como en el ejemplo.
function horaAmPm(valor: string): string {
  if (!valor) return "";
  const m = valor.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return valor;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "pm" : "am";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${min}${ampm}`;
}

// Convierte el texto de elementos "elem-marca-cant | elem-marca-cant" en una
// lista de líneas "01 elem marca" lista para el detalle de la movilidad.
// Detalle con cada elemento en su propia línea, alineado bajo "Detalle: ".
// La sangría usa espacios para que coincida visualmente con el inicio del texto tras "Detalle: ".
function elementosParaDetalle(elementosStr: string): string[] {
  if (!elementosStr) return ["—"];
  return elementosStr.split(" | ").map((item) => {
    const [elem = "", marca = "", cant = ""] = item.split("-");
    const cantNum = cant.replace(/\D/g, "");
    const cantTxt = cantNum ? cantNum.padStart(2, "0") : "";
    return [cantTxt, elem, marca].filter(Boolean).join(" ");
  });
}

function armarResumenMovilidad(reqs: Requerimiento[]): string {
  const lineas: string[] = ["MOVILIDAD 1:"];
  const multiplesPuntos = reqs.length > 1;

  reqs.forEach((r, i) => {
    if (multiplesPuntos) lineas.push(`PUNTO ${i + 1}`);
    lineas.push(`- Punto de recojo: ${r["RECOJO EN"] || "—"}`);
    lineas.push(`- Punto de llegada: ${r["ENTREGA EN"] || "—"}`);
    lineas.push(`- Día: ${fechaConDia(r.FECHA)}`);
    if (r["HORARIO DE DESPACHO"]) lineas.push(`- Hora de despacho: ${horaAmPm(r["HORARIO DE DESPACHO"])}`);
    if (r["HORARIO ENTREGA"]) lineas.push(`- Hora de entrega: ${horaAmPm(r["HORARIO ENTREGA"])}`);
    if (r["HORARIO RECOJO"]) lineas.push(`- Hora de recojo: ${horaAmPm(r["HORARIO RECOJO"])}`);
    if (r["PERSONA DE CONTACTO"]) lineas.push(`- Persona de contacto: ${r["PERSONA DE CONTACTO"]}`);
    if (r["TELEFONO DE CONTACTO"]) lineas.push(`- Teléfono de contacto: ${r["TELEFONO DE CONTACTO"]}`);
    lineas.push(`- Detalle:`);
    elementosParaDetalle(r.ELEMENTOS).forEach((item) => lineas.push(`   • ${item}`));
    if (i < reqs.length - 1) lineas.push(""); // línea en blanco entre puntos
  });

  return lineas.join("\n");
}

const OTRO = "__otro__";

export default function AnalistaPage() {
  const [autenticado, setAutenticado] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const [reqs, setReqs] = useState<Requerimiento[]>([]);
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState<Requerimiento | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [textoResumen, setTextoResumen] = useState("");
  const [logCambios, setLogCambios] = useState<any[]>([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [elementos, setElementos] = useState<Elemento[]>([{ ...EMPTY_EL }]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [cargando, setCargando] = useState(true);

  const [transportistas, setTransportistas] = useState<string[]>([]);
  const [transportistaSel, setTransportistaSel] = useState("");
  const [nuevoTransportista, setNuevoTransportista] = useState("");

  useEffect(() => { if (autenticado) { cargar(); cargarTransportistas(); } }, [autenticado]);

  async function cargar() {
    setCargando(true);
    const r = await api.getAllRequerimientos();
    if (r.ok) setReqs(r.data);
    setCargando(false);
  }

  async function cargarTransportistas() {
    const r = await api.getTransportistas();
    if (r.ok) setTransportistas(r.data);
  }

  function verificarPin() {
    if (pin === PIN_CORRECTO) { setAutenticado(true); setPinError(false); }
    else { setPinError(true); setPin(""); }
  }

  function toggleSeleccion(id: string) {
    setSeleccionados(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function generarResumen() {
    const reqsSel = reqs.filter(r => seleccionados.has(r.ID_REQ));
    if (reqsSel.length === 0) return;
    setTextoResumen(armarResumenMovilidad(reqsSel));
    setMostrarResumen(true);
  }

  async function copiarResumen() {
    try {
      await navigator.clipboard.writeText(textoResumen);
      setMsg("Resumen copiado al portapapeles.");
      setTimeout(() => setMsg(""), 3000);
    } catch {
      // Si el navegador bloquea el clipboard, el textarea ya permite seleccionar y copiar manualmente.
    }
  }

  function abrirDetalle(req: Requerimiento) {
    setSelected(req);
    setForm({
      COTIZACION: req.COTIZACION,
      TRANSPORTISTA: req.TRANSPORTISTA,
      PLACA: req.PLACA,
      "APROBADO POR": req["APROBADO POR"],
      OBSERVACIONES: req.OBSERVACIONES || "",
      STATUS: req.STATUS,
    });
    setElementos(strToEl(req.ELEMENTOS));
    // Si el transportista actual ya está en la lista, lo preseleccionamos.
    // Si no está (dato antiguo o eliminado de la lista), lo dejamos en "Otro" con su nombre visible.
    if (req.TRANSPORTISTA && transportistas.includes(req.TRANSPORTISTA)) {
      setTransportistaSel(req.TRANSPORTISTA);
      setNuevoTransportista("");
    } else if (req.TRANSPORTISTA) {
      setTransportistaSel(OTRO);
      setNuevoTransportista(req.TRANSPORTISTA);
    } else {
      setTransportistaSel("");
      setNuevoTransportista("");
    }
    setMsg("");
    setMostrarHistorial(false);
    setLogCambios([]);
    api.getLogCambios(req.ID_REQ).then((r) => {
      if (r.ok) setLogCambios(r.data);
    });
    // Si el requerimiento tenía una alerta de cambio del ejecutivo, la limpiamos
    // al abrir el detalle (se considera "visto" por el analista).
    if (req.NOTIFICAR === "SI") {
      api.marcarVisto(req.ID_REQ).then(() => {
        setReqs(prev => prev.map(r => r.ID_REQ === req.ID_REQ ? { ...r, NOTIFICAR: "" } : r));
      });
    }
  }

  function setF(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function setEl(idx: number, campo: keyof Elemento, val: string) {
    setElementos(prev => prev.map((e, i) => i === idx ? { ...e, [campo]: val } : e));
  }

  function manejarCambioTransportista(valor: string) {
    setTransportistaSel(valor);
    if (valor === OTRO) {
      setF("TRANSPORTISTA", "");
    } else {
      setF("TRANSPORTISTA", valor);
      setNuevoTransportista("");
    }
  }

  async function guardar() {
    if (!selected) return;
    setLoading(true);

    // Si eligió "Otro" y escribió un nombre nuevo, lo registramos en la lista
    // antes de guardar el requerimiento, para que quede disponible la próxima vez.
    let transportistaFinal = form.TRANSPORTISTA;
    if (transportistaSel === OTRO && nuevoTransportista.trim()) {
      transportistaFinal = nuevoTransportista.trim();
      await api.agregarTransportista(transportistaFinal);
      setTransportistas(prev => prev.includes(transportistaFinal) ? prev : [...prev, transportistaFinal]);
    }

    const { STATUS: newStatus, ...resto } = form;
    const [r1, r2] = await Promise.all([
      api.editarRequerimiento(selected.ID_REQ, "analista", {
        ...resto,
        TRANSPORTISTA: transportistaFinal,
        ELEMENTOS: elToStr(elementos),
      }),
      api.cambiarStatus(selected.ID_REQ, newStatus, "analista"),
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
    const matchStatus =
      filtroStatus === "TODOS" ? true :
      filtroStatus === "CAMBIOS" ? r.NOTIFICAR === "SI" :
      r.STATUS === filtroStatus;
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
    cambios: reqs.filter(r => r.NOTIFICAR === "SI").length,
  };

  if (!autenticado) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border shadow-sm p-10 w-full max-w-sm text-center">
        <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center text-3xl mx-auto mb-5">🔐</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Panel de Operaciones</h2>
        <p className="text-sm text-gray-400 mb-6">Ingresa el PIN para acceder</p>
        <input type="password" placeholder="PIN" value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verificarPin()}
          className={`w-full border rounded-xl px-4 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3 ${pinError ? "border-red-400" : ""}`}
        />
        {pinError && <p className="text-red-500 text-xs mb-3">PIN incorrecto. Intenta nuevamente.</p>}
        <button onClick={verificarPin}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition mb-4">
          Entrar
        </button>
        <a href="/" className="text-sm text-gray-400 hover:text-gray-600">← Volver al inicio</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-700 transition shrink-0">← Inicio</a>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Transportes QP</h1>
            <p className="text-sm text-gray-400 mt-0.5">Panel de operaciones</p>
          </div>
        </div>
        <button onClick={cargar} className="text-sm text-gray-500 border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition shrink-0">
          ↺ Actualizar
        </button>
      </header>

      <main className="px-4 sm:px-8 py-6">
        {msg && <div className="mb-5 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">{msg}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <MetricCard label="Total" value={conteos.total} color="text-blue-600" bg="bg-blue-50" />
          <MetricCard label="Pendientes" value={conteos.pendiente} color="text-amber-600" bg="bg-amber-50" />
          <MetricCard label="Programados" value={conteos.programado} color="text-indigo-600" bg="bg-indigo-50" />
          <MetricCard label="Ejecutados" value={conteos.ejecutado} color="text-green-600" bg="bg-green-50" />
          <MetricCard label="Cambios sin ver" value={conteos.cambios} color="text-red-600" bg="bg-red-50" />
        </div>

        <div className="mb-4">
          <input type="text" placeholder="Buscar por cliente, solicitante, código, ID..."
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            className="w-full max-w-md border rounded-xl px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {["TODOS", ...STATUSES, "CAMBIOS"].map((s) => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition border ${
                filtroStatus === s
                  ? s === "CAMBIOS" ? "bg-red-600 text-white border-red-600" : "bg-blue-600 text-white border-blue-600"
                  : s === "CAMBIOS" ? "bg-red-50 text-red-600 border-red-200 hover:border-red-400" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}>
              {s === "TODOS" ? "Todos" : s === "CAMBIOS" ? `🔴 Cambios sin ver (${conteos.cambios})` : s}
            </button>
          ))}
        </div>

        {seleccionados.size > 0 && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-4">
            <p className="text-sm text-blue-700 font-medium">{seleccionados.size} requerimiento{seleccionados.size > 1 ? "s" : ""} seleccionado{seleccionados.size > 1 ? "s" : ""}</p>
            <div className="flex gap-2">
              <button onClick={generarResumen} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                📋 Generar resumen de movilidad
              </button>
              <button onClick={() => setSeleccionados(new Set())} className="text-sm text-gray-500 hover:text-gray-700 px-2">
                Limpiar
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-5 py-3.5 w-10"></th>
                  {["ID REQ", "CLIENTE", "CÓDIGO", "SOLICITANTE", "FECHA", "RECOJO → ENTREGA", "SERVICIO", "ELEMENTOS", "COTIZACIÓN", "TRANSPORTISTA", "ESTADO", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr><td colSpan={13} className="text-center py-12 text-gray-400 text-sm">Cargando...</td></tr>
                ) : filtrados.length === 0 ? (
                  <tr><td colSpan={13} className="text-center py-12 text-gray-400 text-sm">No hay requerimientos que coincidan.</td></tr>
                ) : filtrados.map((r) => (
                  <tr key={r.ID_REQ} className={`border-b last:border-0 hover:bg-gray-50 transition ${r.NOTIFICAR === "SI" ? "bg-red-50/60" : ""}`}>
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(r.ID_REQ)}
                        onChange={() => toggleSeleccion(r.ID_REQ)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                      />
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">{r.ID_REQ}</td>
                    <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">{r.CLIENTE}</td>
                    <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.CODIGO || "—"}</td>
                    <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.SOLICITANTE}</td>
                    <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{formatFecha(r.FECHA)}</td>
                    <td className="px-5 py-4 text-gray-600 whitespace-nowrap text-sm">{r["RECOJO EN"]} → {r["ENTREGA EN"]}</td>
                    <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.SERVICIO}</td>
                    <td className="px-5 py-4 text-gray-600 max-w-[180px]">
                      {r.ELEMENTOS ? r.ELEMENTOS.split(" | ").map((item, i) => {
                        const [elem, marca, cant] = item.split("-");
                        return <p key={i} className="text-xs text-gray-500 truncate">{elem}{marca ? ` · ${marca}` : ""}{cant ? ` · ${cant}` : ""}</p>;
                      }) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-gray-700 whitespace-nowrap font-medium">
                      {r.COTIZACION ? `S/ ${r.COTIZACION}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.TRANSPORTISTA || "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_PILL[r.STATUS] || "bg-gray-100 text-gray-500"}`}>
                          {r.STATUS}
                        </span>
                        {r.NOTIFICAR === "SI" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium whitespace-nowrap animate-pulse">
                            🔴 Cambio
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => abrirDetalle(r)} className="text-sm text-blue-600 font-medium hover:underline whitespace-nowrap">
                        Ver →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {selected && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">

            {/* Header modal */}
            <div className="px-6 py-5 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-blue-600">{selected.ID_REQ}</span>
                    {selected.CODIGO && (<><span className="text-gray-300">·</span><span className="font-mono text-sm font-bold text-gray-600">{selected.CODIGO}</span></>)}
                    {selected.NOTIFICAR === "SI" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                        🔴 Cambio del ejecutivo
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{selected.CLIENTE}</h2>
                  <p className="text-sm text-gray-400">{selected["RAZON SOCIAL"]}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-2xl leading-none mt-1">×</button>
              </div>
              <button
                onClick={() => setMostrarHistorial(!mostrarHistorial)}
                className="mt-3 text-xs text-blue-600 hover:underline font-medium"
              >
                {mostrarHistorial ? "Ocultar historial" : `Ver historial de cambios (${logCambios.length})`}
              </button>
              {mostrarHistorial && (
                <div className="mt-3 bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto">
                  {logCambios.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Sin cambios registrados aún.</p>
                  ) : (
                    <div className="space-y-2">
                      {logCambios.map((c, i) => (
                        <div key={i} className="text-xs border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                          <div className="flex items-center justify-between text-gray-400 mb-0.5">
                            <span className="font-medium text-gray-600">{c.QUIEN}</span>
                            <span>{c.FECHA_HORA}</span>
                          </div>
                          <p className="text-gray-700">
                            <span className="font-medium">{c.CAMPO}</span>:{" "}
                            <span className="text-red-500 line-through">{c.VALOR_ANTERIOR || "—"}</span>
                            {" → "}
                            <span className="text-green-600">{c.VALOR_NUEVO || "—"}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Info solicitante */}
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Info label="Solicitante" value={selected.SOLICITANTE} />
                <Info label="Fecha" value={formatFecha(selected.FECHA)} />
                <Info label="Servicio" value={selected.SERVICIO} />
                <Info label="Personas" value={selected.PERSONAS} />
                <Info label="Recojo en" value={selected["RECOJO EN"]} />
                <Info label="Entrega en" value={selected["ENTREGA EN"]} />
                <Info label="Persona de contacto" value={selected["PERSONA DE CONTACTO"]} />
                <Info label="Teléfono de contacto" value={selected["TELEFONO DE CONTACTO"]} />
              </div>
              {(selected["HORARIO DE DESPACHO"] || selected["HORARIO ENTREGA"] || selected["HORARIO RECOJO"]) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400 mb-2">Horarios</p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <Info label="Despacho" value={selected["HORARIO DE DESPACHO"]} />
                    <Info label="Llegada" value={selected["HORARIO ENTREGA"]} />
                    <Info label="Recojo" value={selected["HORARIO RECOJO"]} />
                  </div>
                </div>
              )}
            </div>

            {/* Elementos editables */}
            <div className="px-6 py-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Elementos</p>
                <button onClick={() => setElementos(p => [...p, { ...EMPTY_EL }])} className="text-xs text-blue-600 hover:underline font-medium">
                  + Agregar
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 px-1 mb-1">
                <span>Elemento</span><span>Marca</span><span>Cantidad</span>
              </div>
              <div className="space-y-2">
                {elementos.map((el, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                    <input type="text" placeholder="Elemento" value={el.elemento}
                      onChange={(e) => setEl(idx, "elemento", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <input type="text" placeholder="Marca" value={el.marca}
                      onChange={(e) => setEl(idx, "marca", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <div className="flex gap-1">
                      <input type="number" placeholder="0" value={el.cantidad}
                        onChange={(e) => setEl(idx, "cantidad", e.target.value)}
                        className="border rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      {elementos.length > 1 && (
                        <button onClick={() => setElementos(p => p.filter((_, i) => i !== idx))}
                          className="text-gray-300 hover:text-red-400 px-1 text-lg leading-none">×</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gestión analista */}
            <div className="px-6 py-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">Gestión</p>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Cotización (S/)" value={form.COTIZACION} onChange={(v) => setF("COTIZACION", v)} type="number" />
                <Campo label="Aprobado por" value={form["APROBADO POR"]} onChange={(v) => setF("APROBADO POR", v)} />

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Transportista</label>
                  <select value={transportistaSel} onChange={(e) => manejarCambioTransportista(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Seleccionar...</option>
                    {transportistas.map((t) => <option key={t} value={t}>{t}</option>)}
                    <option value={OTRO}>+ Otro...</option>
                  </select>
                  {transportistaSel === OTRO && (
                    <input
                      type="text"
                      placeholder="Nombre del nuevo transportista"
                      value={nuevoTransportista}
                      onChange={(e) => setNuevoTransportista(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  )}
                </div>

                <Campo label="Placa" value={form.PLACA} onChange={(v) => setF("PLACA", v)} />
              </div>
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <select value={form.STATUS} onChange={(e) => setF("STATUS", e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">Observaciones</label>
                <textarea value={form.OBSERVACIONES} onChange={(e) => setF("OBSERVACIONES", e.target.value)}
                  rows={3} placeholder="Notas sobre el servicio, cambios de último momento, incidencias..."
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>
              <div className="mt-5 flex gap-3">
                <button onClick={guardar} disabled={loading}
                  className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                  {loading ? "Guardando..." : "Guardar cambios"}
                </button>
                <button onClick={() => setSelected(null)} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarResumen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setMostrarResumen(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Resumen de movilidad</h2>
                <p className="text-sm text-gray-400">Selecciona el texto o usa el botón para copiarlo.</p>
              </div>
              <button onClick={() => setMostrarResumen(false)} className="text-gray-300 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-5">
              <textarea
                readOnly
                value={textoResumen}
                rows={14}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full border rounded-xl px-3 py-2 text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
              <div className="mt-4 flex gap-3">
                <button onClick={copiarResumen}
                  className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition">
                  📋 Copiar todo
                </button>
                <button onClick={() => setMostrarResumen(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3">
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
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
    </div>
  );
}
