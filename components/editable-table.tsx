"use client";

import { ExtractedData } from "@/lib/extractors";
import { Download, Trash2, FileText, AlertTriangle, ClipboardCopy, FileDown, AlertCircle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { parseCurrency, parseInfo, formatCurrency, detectMissingCompetencies } from "@/lib/math-utils";
import { generateAuditReport } from "@/lib/pdf-generator";

export function EditableTable({
    initialData,
    onDelete
}: {
    initialData: ExtractedData[],
    onDelete: (index: number) => void
}) {
    const [data, setData] = useState(initialData);

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    const handleEdit = (index: number, field: keyof ExtractedData, value: string, subField?: 'info' | 'valor') => {
        const newData = [...data];

        if (subField) {
            // Initialize object if missing (e.g. manually adding Aulas)
            if (!newData[index][field]) {
                (newData[index] as any)[field] = { info: '', valor: '' };
            }

            if (typeof newData[index][field] === 'object') {
                (newData[index][field] as any)[subField] = value;
            }
        } else {
            (newData[index] as any)[field] = value;
        }
        setData(newData);
    };

    const calculateRow = (row: ExtractedData) => {
        const vencBase = parseCurrency(row.vencimentoBase?.valor);
        const gratTit = parseCurrency(row.gratTitularidade);
        const gratMag = parseCurrency(row.gratMagisterio);
        const gratEsc = parseCurrency(row.gratEscolaridade);

        const infoBase = parseInfo(row.vencimentoBase?.info);
        const infoAulas = parseInfo(row.aulasSuplementares?.info);
        const valorAulasPago = parseCurrency(row.aulasSuplementares?.valor);

        // Formula: (((Base + Tit + Mag + Esc) / InfoBase) + 50%) * InfoAulas
        // + 50% means * 1.5
        let devidas = 0;
        if (infoBase > 0) {
            const totalBasis = vencBase + gratTit + gratMag + gratEsc;
            const hourlyRate = totalBasis / infoBase;
            const suplRate = hourlyRate * 1.5;
            devidas = suplRate * infoAulas;
        }

        const diferenca = devidas - valorAulasPago;

        return {
            devidas,
            diferenca
        };
    };

    // Smart Warning Processing
    const processedData = useMemo(() => {
        const processed = data.map(d => ({ ...d, uiWarnings: [...(d.warnings || [])] }));
        const mesAnoCounts: Record<string, number> = {};
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

        // 1. Pass: Count duplicates
        processed.forEach(row => {
            if (row.mesAno) {
                mesAnoCounts[row.mesAno] = (mesAnoCounts[row.mesAno] || 0) + 1;
            }
        });

        // 2. Pass: Apply flags
        processed.forEach(row => {
            // Duplicate Competency
            if (row.mesAno && mesAnoCounts[row.mesAno] > 1) {
                row.uiWarnings.push("Competência Duplicada");
            }

            // Missing Aulas
            if (!row.aulasSuplementares?.valor || parseCurrency(row.aulasSuplementares?.valor) === 0) {
                row.uiWarnings.push("Sem Aulas Suplementares Lançadas");
            }

            // Prescription
            if (row.mesAno) {
                const parts = row.mesAno.split('/');
                if (parts.length === 2) {
                    const month = parseInt(parts[0]) - 1; // JS Month is 0-indexed
                    const year = parseInt(parts[1]);
                    const rowDate = new Date(year, month, 1);

                    if (rowDate < fiveYearsAgo) {
                        row.uiWarnings.push("Prescrição Quinquenal (> 5 Anos)");
                    }
                }
            }
        });

        return processed;
    }, [data]);

    const getTotals = () => {
        let totalDevidas = 0;
        let totalRecebido = 0;
        let totalDiferenca = 0;

        processedData.forEach(row => {
            const { devidas, diferenca } = calculateRow(row);
            const received = parseCurrency(row.aulasSuplementares?.valor);

            totalDevidas += devidas;
            totalRecebido += received;
            totalDiferenca += diferenca;
        });

        return { totalDevidas, totalRecebido, totalDiferenca };
    };

    const totals = getTotals();
    const totalDevidas = totals.totalDevidas;
    const totalRecebido = totals.totalRecebido;
    const totalDiferenca = totals.totalDiferenca;

    // Detect Missing Matches
    const allMesAnos = processedData.map(d => d.mesAno).filter(m => !!m) as string[];
    const missingCompetencies = detectMissingCompetencies(allMesAnos);

    const reportName = data.length > 0 ? (data[0].nome || "[Nome do Servidor]") : "[Nome do Servidor]";

    let reportText = "";
    if (missingCompetencies.length > 0) {
        reportText = `ATENÇÃO: Foram identificadas interrupções na sequência lógica das competências analisadas. As seguintes competências não foram localizadas: ${missingCompetencies.join(", ")}.`;
    } else {
        reportText = `O servidor ${reportName} deveria ter recebido do Estado do Pará o valor de R$ ${formatCurrency(totalDevidas)}, no entanto recebeu apenas R$ ${formatCurrency(totalRecebido)}, sendo portanto devida a diferença no valor de R$ ${formatCurrency(totalDiferenca)}.`;
    }

    const handleDownloadPDF = () => {
        if (!processedData || processedData.length === 0) return;

        const currentTotals = getTotals();

        const rName = processedData[0].nome || "[Nome do Servidor]";

        let rText = "";
        if (missingCompetencies.length > 0) {
            rText = `ATENÇÃO: Foram identificadas interrupções na sequência lógica das competências analisadas. As seguintes competências não foram localizadas: ${missingCompetencies.join(", ")}.`;
        } else {
            rText = `O servidor ${rName} deveria ter recebido do Estado do Pará o valor de R$ ${formatCurrency(currentTotals.totalDevidas)}, no entanto recebeu apenas R$ ${formatCurrency(currentTotals.totalRecebido)}, sendo portanto devida a diferença no valor de R$ ${formatCurrency(currentTotals.totalDiferenca)}.`;
        }

        generateAuditReport(processedData);
    };

    const exportCSV = () => {
        const headers = [
            "Arquivo", "Nome", "Matrícula", "Mês/Ano",
            "Venc. Base (Info)", "Venc. Base (Valor)",
            "Aulas Supl. (Info)", "Aulas Supl. (Valor)",
            "Grat. Titularidade", "Grat. Magistério", "Grat. Escolaridade",
            "Aulas Supl. (Devidas)", "Diferença a Receber"
        ];

        const rows = processedData.map(row => {
            const { devidas, diferenca } = calculateRow(row);
            return [
                row.fileName,
                row.nome,
                row.idFuncional,
                row.mesAno,
                row.vencimentoBase?.info, row.vencimentoBase?.valor,
                row.aulasSuplementares?.info, row.aulasSuplementares?.valor,
                row.gratTitularidade,
                row.gratMagisterio,
                row.gratEscolaridade,
                formatCurrency(devidas),
                formatCurrency(diferenca)
            ].map(v => v || "").map(v => `"${v}"`).join(";");
        });

        const csvContent = [headers.join(";"), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "calculo_auditoria.csv");
        document.body.appendChild(link);
        link.click();
    };

    if (!data || data.length === 0) return null;

    const detectedVinculo = data.find(d => d.vinculo)?.vinculo;

    // Fix for Delete Button: Also update local state
    const handleDeleteLocal = (idx: number) => {
        const newData = [...data];
        newData.splice(idx, 1);
        setData(newData);
        onDelete(idx);
    };

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Professional Report Card MOVED TO TOP */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                    {missingCompetencies.length > 0 ? (
                        <>
                            <AlertTriangle className="mr-2 h-5 w-5 text-red-500" />
                            <span className="text-red-500">EXTRATO DE INCONSISTÊNCIAS</span>
                        </>
                    ) : (
                        <>
                            <FileText className="mr-2 h-5 w-5 text-emerald-500" />
                            Resumo para Relatório
                        </>
                    )}
                </h3>
                <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 font-mono text-sm text-zinc-300 leading-relaxed">
                    {reportText}
                </div>
                <button
                    onClick={() => navigator.clipboard.writeText(reportText)}
                    className="text-xs text-primary hover:text-primary/80 transition-colors font-medium flex items-center"
                >
                    <ClipboardCopy className="mr-1 h-3 w-3" />
                    Copiar Texto
                </button>
            </div>

            {/* Table Section */}
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-semibold text-white flex items-center">
                            <FileText className="mr-2 h-5 w-5 text-primary" />
                            Auditoria ({data.length})
                        </h2>
                        {detectedVinculo && (
                            <span className="text-xs text-zinc-400 ml-7 mt-1 font-mono bg-zinc-800 px-2 py-0.5 rounded w-fit">
                                Vínculo Detectado: <span className="text-emerald-400">{detectedVinculo}</span>
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownloadPDF}
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            <FileDown className="h-4 w-4" />
                            Baixar Relatório (PDF)
                        </button>
                        <button
                            onClick={exportCSV}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Download className="h-4 w-4" />
                            Exportar CSV
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
                    <table className="w-full text-sm text-left text-zinc-300">
                        <thead className="bg-zinc-800 text-xs uppercase text-zinc-400 font-semibold">
                            <tr>
                                <th className="px-4 py-3 min-w-[150px]">Arquivo</th>
                                <th className="px-4 py-3 min-w-[200px]">Nome</th>
                                <th className="px-4 py-3 min-w-[100px]">Ref.</th>
                                <th className="px-4 py-3 text-right">Venc. Base</th>
                                <th className="px-4 py-3 text-right">Aulas Supl.</th>
                                <th className="px-4 py-3 text-right">Titular.</th>
                                <th className="px-4 py-3 text-right">Magist.</th>
                                <th className="px-4 py-3 text-right">Escolar.</th>
                                <th className="px-4 py-3 text-right bg-primary/10 text-primary">Devidas</th>
                                <th className="px-4 py-3 text-right bg-red-500/10 text-red-400">Diferença</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {processedData.map((row, idx) => {
                                const { devidas, diferenca } = calculateRow(row);
                                const hasWarnings = row.uiWarnings && row.uiWarnings.length > 0;

                                const hasCritical = hasWarnings && row.uiWarnings.some(w =>
                                    w.includes('Prescrição') || w.includes('Sem Aulas')
                                );

                                return (
                                    <tr key={idx} className="hover:bg-zinc-800/30 group">

                                        {/* File Name + Warning */}
                                        <td className="px-4 py-3 font-mono text-xs text-zinc-500 truncate max-w-[150px]" title={row.fileName}>
                                            <div className="flex items-center gap-2">
                                                {hasWarnings && (
                                                    <div title={row.uiWarnings?.join('\n')}>
                                                        {hasCritical ? (
                                                            <AlertCircle className="h-4 w-4 text-red-500 cursor-help" />
                                                        ) : (
                                                            <AlertTriangle className="h-4 w-4 text-amber-500 cursor-help" />
                                                        )}
                                                    </div>
                                                )}
                                                {row.fileName}
                                            </div>
                                        </td>

                                        {/* Nome */}
                                        <td className="px-4 py-3">
                                            <input
                                                className="bg-transparent border-none w-full text-white focus:ring-0 p-0"
                                                value={row.nome || ""}
                                                onChange={e => handleEdit(idx, 'nome', e.target.value)}
                                            />
                                        </td>

                                        {/* Mes/Ano */}
                                        <td className="px-4 py-3">
                                            <input
                                                className="bg-transparent border-none w-full text-zinc-300 focus:ring-0 p-0"
                                                value={row.mesAno || ""}
                                                onChange={e => handleEdit(idx, 'mesAno', e.target.value)}
                                            />
                                        </td>

                                        {/* Venc Base Group */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <input
                                                    className="bg-transparent text-emerald-400 font-mono w-full text-right p-0 focus:ring-0 text-xs"
                                                    value={row.vencimentoBase?.valor || ""}
                                                    placeholder="0,00"
                                                    onChange={e => handleEdit(idx, 'vencimentoBase', e.target.value, 'valor')}
                                                />
                                                <input
                                                    className="bg-transparent text-zinc-500 font-mono w-full text-right p-0 focus:ring-0 text-[10px]"
                                                    value={row.vencimentoBase?.info || ""}
                                                    placeholder="Info"
                                                    onChange={e => handleEdit(idx, 'vencimentoBase', e.target.value, 'info')}
                                                />
                                            </div>
                                        </td>

                                        {/* Aulas Group */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <input
                                                    className="bg-transparent text-emerald-400 font-mono w-full text-right p-0 focus:ring-0 text-xs"
                                                    value={row.aulasSuplementares?.valor || ""}
                                                    placeholder="0,00"
                                                    onChange={e => handleEdit(idx, 'aulasSuplementares', e.target.value, 'valor')}
                                                />
                                                <input
                                                    className="bg-transparent text-zinc-500 font-mono w-full text-right p-0 focus:ring-0 text-[10px]"
                                                    value={row.aulasSuplementares?.info || ""}
                                                    placeholder="Info"
                                                    onChange={e => handleEdit(idx, 'aulasSuplementares', e.target.value, 'info')}
                                                />
                                            </div>
                                        </td>

                                        {/* Grat Titularidade */}
                                        <td className="px-4 py-3">
                                            <input
                                                className="bg-transparent text-emerald-400 font-mono w-full text-right p-0 focus:ring-0"
                                                value={row.gratTitularidade || ""}
                                                onChange={e => handleEdit(idx, 'gratTitularidade', e.target.value)}
                                            />
                                        </td>

                                        {/* Grat Magisterio */}
                                        <td className="px-4 py-3">
                                            <input
                                                className="bg-transparent text-emerald-400 font-mono w-full text-right p-0 focus:ring-0"
                                                value={row.gratMagisterio || ""}
                                                onChange={e => handleEdit(idx, 'gratMagisterio', e.target.value)}
                                            />
                                        </td>

                                        {/* Grat Escolaridade (ADDED) */}
                                        <td className="px-4 py-3">
                                            <input
                                                className="bg-transparent text-emerald-400 font-mono w-full text-right p-0 focus:ring-0"
                                                value={row.gratEscolaridade || ""}
                                                onChange={e => handleEdit(idx, 'gratEscolaridade', e.target.value)}
                                            />
                                        </td>

                                        {/* CALCULATED: Devidas */}
                                        <td className="px-4 py-3 bg-primary/5 text-right font-mono text-xs font-bold text-primary">
                                            {formatCurrency(devidas)}
                                        </td>

                                        {/* CALCULATED: Diferença */}
                                        <td className="px-4 py-3 bg-red-500/5 text-right font-mono text-xs font-bold text-red-400">
                                            {formatCurrency(diferenca)}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteLocal(idx)}
                                                className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                                title="Remover linha"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>

                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="text-zinc-500 text-xs text-center pt-2">
                    *Cálculo Automático: Baseado em (Venc+Tit+Mag+Esc)/CH * 1.5 * Aulas
                </p>
            </div>


        </div>
    );
}
