export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-800 text-white px-6 py-3">
        <span className="font-semibold text-lg">Capataz — Panel de administración</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
