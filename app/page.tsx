export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between text-sm flex-col flex bg-white/5 p-12 rounded-2xl backdrop-blur-md border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        <h1 className="text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400 mb-6">
          Système Initialisé
        </h1>
        <p className="text-lg text-gray-300 font-light">
          La configuration Next.js 14 est opérationnelle.
        </p>
      </div>
    </main>
  );
}
