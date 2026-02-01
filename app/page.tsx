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
    <main className="min-h-screen flex flex-col items-center justify-start pt-24 pb-12 px-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 via-background to-background relative">

      {/* Top Bar */}
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <span className="text-sm text-zinc-400">
          Olá, <span className="text-white font-medium">{user.name}</span>
        </span>
        <button
          onClick={logout}
          className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Admin Tools */}
      <UserManagement />

      {/* Header */}
      <div className="text-center space-y-4 mb-12 max-w-2xl mx-auto">
        <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-4">
          <Sparkles className="mr-1 h-3 w-3" />
          Análise Inteligente v2.0
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
          Extrator de Contracheque
        </h1>
        <p className="text-zinc-400 text-lg">
          Processamento totalmente local e seguro.
        </p>
      </div>

      {/* Upload Section */}
      <div className="w-full mb-12">
        <FileUpload onFilesSelect={handleFilesSelect} isProcessing={loading} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-8 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 max-w-xl mx-auto text-center">
          {error}
        </div>
      )}

      {/* Results Section */}
      {data.length > 0 && (
        <div className="w-full max-w-6xl animate-in fade-in zoom-in-95 duration-500 space-y-12">
          <EditableTable initialData={data} onDelete={handleDelete} />
          <LaborCalculations data={data} />
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-20 text-center text-zinc-600 text-sm">
        <p>&copy; 2026 SaaS Paystub Extractor. Segurança e Rapidez.</p>
      </div>
    </main>
  );
}
