"use client";

import { useState, useEffect } from "react";
import { FileUpload } from "@/components/file-upload";
import { EditableTable } from "@/components/editable-table";
import { ExtractedData } from "@/lib/extractors";
import { LaborCalculations } from "@/components/labor-calculations";
import { Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { UserManagement } from "@/components/user-management";
import { useRouter } from "next/navigation";
import { extractTextFromPDF } from "@/lib/pdf-client";
import { extractPaystubData } from "@/lib/extractors";

export default function Home() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<ExtractedData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  const handleFilesSelect = async (files: File[]) => {
    setLoading(true);
    setError(null);
    setData([]);

    try {
      const results: ExtractedData[] = [];

      for (const file of files) {
        try {
          // Client-side extraction
          const text = await extractTextFromPDF(file);
          const extracted = extractPaystubData(text);

          results.push({
            fileName: file.name,
            ...extracted
          });
        } catch (err: any) {
          console.error(`Error processing file ${file.name}:`, err);
          results.push({
            fileName: file.name,
            error: "Falha ao processar arquivo"
          });
        }
      }

      // Sort by date (Oldest -> Newest)
      const sortedData = results.sort((a, b) => {
        if (!a.mesAno) return 1;
        if (!b.mesAno) return -1;
        return parseMesAno(a.mesAno) - parseMesAno(b.mesAno);
      });

      // Deduplicate
      const seenMesAno = new Set<string>();
      let uniqueData = sortedData.filter(item => {
        if (!item.mesAno) return true;
        if (seenMesAno.has(item.mesAno)) return false;
        seenMesAno.add(item.mesAno);
        return true;
      });

      // Auto-Exclude Prescription (> 5 Years)
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const cutoffTime = fiveYearsAgo.getTime();

      uniqueData = uniqueData.filter(item => {
        if (!item.mesAno) return true;
        const itemTime = parseMesAno(item.mesAno);
        if (itemTime > 0 && itemTime < cutoffTime) return false;
        return true;
      });

      setData(uniqueData);

    } catch (err: any) {
      console.error(err);
      setError("Erro ao processar PDF: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  function parseMesAno(mesAno: string): number {
    try {
      const parts = mesAno.split('/');
      if (parts.length !== 2) return 0;
      let month = parseInt(parts[0]);
      const year = parseInt(parts[1]);
      if (isNaN(month)) {
        const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const mStr = parts[0].toLowerCase();
        const idx = months.findIndex(m => mStr.startsWith(m));
        if (idx !== -1) month = idx + 1;
      }
      return new Date(year, month - 1, 1).getTime();
    } catch {
      return 0;
    }
  }

  const handleDelete = (index: number) => {
    const newData = [...data];
    newData.splice(index, 1);
    setData(newData);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-start pt-24 pb-12 px-4 bg-background relative">

      {/* Top Bar */}
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Olá, <span className="text-primary font-medium">{user.name}</span>
        </span>
        <button
          onClick={logout}
          className="p-2 text-muted-foreground hover:text-primary bg-primary/5 hover:bg-primary/10 rounded-full transition-colors"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Admin Tools */}
      <UserManagement />

      {/* Header */}
      <div className="text-center space-y-4 mb-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary mb-4">
          <Sparkles className="mr-1.5 h-3 w-3 text-accent" />
          Sistema de Cálculos Trabalhistas
        </div>
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-primary">
          Brito & Santos <span className="text-accent">Advocacia</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          Auditoria de contracheques e cálculos rescisórios precisos.
        </p>
      </div>

      {/* Upload Section */}
      <div className="w-full mb-12">
        <FileUpload onFilesSelect={handleFilesSelect} isProcessing={loading} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 max-w-xl mx-auto text-center flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4 rotate-180" /> {/* Just an alert icon */}
          {error}
        </div>
      )}

      {/* Results Section */}
      {data.length > 0 && (
        <div className="w-full max-w-6xl animate-in fade-in zoom-in-95 duration-500 space-y-12">
          {/* We might need to style EditableTable if it has hardcoded dark colors */}
          <EditableTable initialData={data} onDelete={handleDelete} />
          <LaborCalculations data={data} />
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-20 text-center text-muted-foreground/60 text-xs uppercase tracking-widest">
        <p>&copy; {new Date().getFullYear()} Brito & Santos Advocacia. Todos os direitos reservados.</p>
      </div>
    </main>
  );
}
