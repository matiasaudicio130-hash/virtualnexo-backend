/**
 * Normaliza cualquier error de axios/FastAPI a un string seguro de renderizar.
 * FastAPI devuelve `detail` como string (HTTPException) o array de objetos (422).
 * También maneja {message, ...} de errores enriquecidos.
 */
export function toErrorMessage(err: any, fallback = "Ocurrió un error."): string {
  if (!err) return fallback;
  const detail = err?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    // FastAPI 422 — array de { loc, msg, type }
    const msgs = detail
      .map((d: any) => (typeof d === "string" ? d : d?.msg ?? ""))
      .filter(Boolean);
    if (msgs.length) return msgs.join("; ");
  }

  if (detail && typeof detail === "object") {
    if (typeof detail.message === "string") return detail.message;
  }

  if (typeof err?.message === "string") return err.message;
  return fallback;
}
