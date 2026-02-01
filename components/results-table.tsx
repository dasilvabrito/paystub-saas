import { ExtractedData } from "@/lib/extractors";
import { CheckCircle2, DollarSign, Calendar, User, Hash } from "lucide-react";

export function ResultsTable({ data }: { data: ExtractedData }) {
    if (!data) return null;

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header Info Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Nome */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center text-zinc-400 text-sm">
                        <User className="w-4 h-4 mr-2" />
                        Nome
                    </div>
                    <div className="font-semibold text-white truncate" title={data.nome}>
                        {data.nome || "-"}
                    </div>
                </div>

                {/* ID */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center text-zinc-400 text-sm">
                        <Hash className="w-4 h-4 mr-2" />
                        Matrícula/ID
                    </div>
                    <div className="font-mono text-white">
                        {data.idFuncional || "-"}
                    </div>
                </div>

                {/* Mes/Ano */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center text-zinc-400 text-sm">
                        <Calendar className="w-4 h-4 mr-2" />
                        Referência
                    </div>
                    <div className="font-medium text-white">
                        {data.mesAno || "-"}
                    </div>
                </div>
            </div>

            {/* Financial Details */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-800">
                    <h3 className="font-semibold text-white flex items-center">
                        <DollarSign className="w-5 h-5 mr-2 text-primary" />
                        Detalhamento Financeiro
                    </h3>
                </div>

                <div className="divide-y divide-zinc-800">
                    <ResultRow label="Vencimento Base" value={data.vencimentoBase?.valor} info={data.vencimentoBase?.info} />
                    <ResultRow label="Aulas Suplementares" value={data.aulasSuplementares?.valor} info={data.aulasSuplementares?.info} />
                    <ResultRow label="Grat. Titularidade" value={data.gratTitularidade} />
                    <ResultRow label="Grat. Magistério" value={data.gratMagisterio} />
                    <ResultRow label="Grat. Escolaridade" value={data.gratEscolaridade} />
                </div>
            </div>

        </div>
    );
}

function ResultRow({ label, value, info }: { label: string, value?: string, info?: string }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 hover:bg-zinc-800/30 transition-colors">

            {/* Label Column */}
            <div className="flex-1 mb-2 sm:mb-0">
                <span className="text-zinc-300 font-medium block">{label}</span>
            </div>

            {/* Info Column (Hours/Percentage) */}
            <div className="w-32 text-right mr-8 hidden sm:block">
                {info ? (
                    <span className="text-xs font-mono text-zinc-500 bg-zinc-900/50 px-2 py-1 rounded inline-block">
                        {info}
                    </span>
                ) : (
                    <span className="text-zinc-700/50 text-xs">-</span>
                )}
            </div>

            {/* Value Column (Money) */}
            <div className="w-32 text-right font-mono text-white font-semibold">
                {value ? (
                    <span className="text-emerald-400">{value}</span>
                ) : (
                    <span className="text-zinc-600">-</span>
                )}
            </div>

            {/* Mobile Only Info Row */}
            {info && (
                <div className="sm:hidden mt-1 text-right">
                    <span className="text-xs font-mono text-zinc-500 bg-zinc-900/50 px-2 py-1 rounded inline-block">
                        {info}
                    </span>
                </div>
            )}
        </div>
    );
}
