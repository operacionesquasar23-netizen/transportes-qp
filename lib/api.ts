const API_URL = "/api/proxy";

async function get(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}?${qs}`, { cache: "no-store" });
  return res.json();
}

async function post(action: string, body: object) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  return res.json();
}

export const api = {
  validarTicket: (ticket: string) =>
    get({ action: "validarTicket", ticket }),

  getRequerimientos: (ticket: string) =>
    get({ action: "getRequerimientos", ticket }),

  getAllRequerimientos: () =>
    get({ action: "getAllRequerimientos" }),

  crearRequerimiento: (ticket: string, data: Record<string, string>) =>
    post("crearRequerimiento", { ticket, ...data }),

  crearMasivo: (ticket: string, filas: Record<string, string>[]) =>
    post("crearMasivo", { ticket, filas }),

  editarRequerimiento: (id: string, rol: string, data: Record<string, string>, ticket?: string) =>
    post("editarRequerimiento", { "ID_REQ": id, rol, ticket, ...data }),

  cambiarStatus: (id: string, status: string) =>
    post("cambiarStatus", { "ID_REQ": id, status }),

  getTransportistas: () =>
    get({ action: "getTransportistas" }),

  agregarTransportista: (nombre: string) =>
    post("agregarTransportista", { nombre }),

  getLogCambios: (id: string) =>
    get({ action: "getLogCambios", id }),
};
