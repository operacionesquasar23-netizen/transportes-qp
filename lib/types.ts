export type Status = "PENDIENTE" | "PROGRAMADO" | "EJECUTADO" | "NO EJECUTADO" | "CANCELADO";

export interface Requerimiento {
  ID_REQ: string;
  SOLICITANTE: string;
  FECHA: string;
  AREA: string;
  CLIENTE: string;
  CODIGO: string;
  PERSONAS: string;
  ELEMENTOS: string;
  MARCA: string;
  CANTIDAD: string;
  "RECOJO EN": string;
  "ENTREGA EN": string;
  "HORARIO DE DESPACHO": string;
  "HORARIO ENTREGA": string;
  "HORARIO RECOJO": string;
  OBSERVACIONES: string;
  SERVICIO: string;
  COTIZACION: string;
  TRANSPORTISTA: string;
  PLACA: string;
  "APROBADO POR": string;
  STATUS: Status;
  "RAZON SOCIAL": string;
}

export const STATUS_COLORS: Record<Status, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  PROGRAMADO: "bg-blue-100 text-blue-800",
  EJECUTADO: "bg-green-100 text-green-800",
  "NO EJECUTADO": "bg-red-100 text-red-800",
  CANCELADO: "bg-gray-100 text-gray-600",
};

export const SERVICIOS = ["IDA", "IDA Y VUELTA", "RETORNO"];
export const STATUSES: Status[] = ["PENDIENTE", "PROGRAMADO", "EJECUTADO", "NO EJECUTADO", "CANCELADO"];
