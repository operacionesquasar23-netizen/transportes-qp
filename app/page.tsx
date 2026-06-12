export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header azul */}
      <header className="bg-[#1e2d5a] px-8 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-white/40 flex items-center justify-center text-white font-bold text-sm">QP</div>
        <div>
          <p className="text-white font-semibold text-base leading-tight">Transportes QP</p>
          <p className="text-white/60 text-xs">Sistema de Gestión de Transportes</p>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[#1e2d5a] px-8 py-16 text-center">
        <h1 className="text-4xl font-bold text-white mb-3">Transportes QP</h1>
        <p className="text-white/70 text-lg">Gestión de solicitudes de transporte y personal de impulso</p>
      </div>

      {/* Tarjetas */}
      <div className="max-w-4xl mx-auto px-8 -mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Ejecutivo */}
          <div className="bg-white rounded-2xl border p-7 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl mb-4">📋</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Nueva Solicitud</h2>
            <p className="text-sm text-gray-500 mb-5">Registra un nuevo requerimiento de transporte o personal de impulso.</p>
            <div>
              <p className="text-xs text-gray-400 mb-2">Ingresa tu código de acceso</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.currentTarget.elements.namedItem("ticket") as HTMLInputElement).value.trim();
                  if (input) window.location.href = `/e/${input}`;
                }}
                className="flex gap-2"
              >
                <input
                  name="ticket"
                  type="text"
                  placeholder="Ej: EJ001"
                  className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition">
                  Ingresar
                </button>
              </form>
            </div>
          </div>

          {/* Analista */}
          <div className="bg-white rounded-2xl border p-7 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-2xl mb-4">⚙️</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Panel de Operaciones</h2>
            <p className="text-sm text-gray-500 mb-5">Gestiona todas las solicitudes, asigna transportistas y actualiza estados.</p>
            <a
              href="/analista"
              className="inline-block text-purple-600 text-sm font-medium hover:underline"
            >
              Acceder al panel →
            </a>
          </div>
        </div>

        {/* Flujo */}
        <div className="mt-10 mb-12 flex items-center justify-center gap-4 text-center">
          {[
            { icon: "📋", label: "Solicitud", desc: "El ejecutivo registra el requerimiento" },
            { icon: "→", label: "", desc: "" },
            { icon: "💰", label: "Cotización", desc: "El analista coordina y cotiza" },
            { icon: "→", label: "", desc: "" },
            { icon: "🚛", label: "Ejecución", desc: "El transportista realiza el servicio" },
          ].map((item, i) =>
            item.label === "" ? (
              <span key={i} className="text-gray-300 text-2xl">→</span>
            ) : (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-white border rounded-xl flex items-center justify-center text-xl mx-auto mb-2 shadow-sm">{item.icon}</div>
                <p className="text-sm font-medium text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-400 max-w-24">{item.desc}</p>
              </div>
            )
          )}
        </div>
      </div>

      <footer className="text-center text-xs text-gray-400 pb-8">
        © 2026 Transportes QP
      </footer>
    </div>
  );
}
