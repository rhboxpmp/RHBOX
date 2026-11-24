import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7FC] p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center space-y-4">
        <div className="text-4xl font-extrabold text-[#041A47]">404</div>
        <h1 className="text-lg font-bold text-[#041A47]">
          Página não encontrada
        </h1>
        <p className="text-xs text-slate-600">
          O endereço acessado não existe no RHBOX.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-[#041A47] text-white text-xs font-semibold hover:bg-[#003A94]"
          >
            Ir para o Dashboard
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg border border-slate-300 text-[#041A47] text-xs font-semibold hover:bg-slate-50"
          >
            Ir para Login
          </Link>
        </div>
      </div>
    </div>
  );
}
