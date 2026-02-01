import { useState, useMemo, useEffect } from "react";
import { ExtractedData } from "@/lib/extractors";
import { calculateLaborRights, LaborCalculationResult } from "@/lib/labor-calculations";
import { formatCurrency, parseCurrency, parseMesAno } from "@/lib/math-utils";
import { generateSeveranceReport, generateFGTSReport, generateAuditReport } from "@/lib/pdf-generator";
import { Settings, TrendingUp, Percent, BarChart3, ChevronDown, ChevronUp, AlertCircle, Calendar, DollarSign, Calculator, Table as TableIcon, FileText } from "lucide-react";
import { CorrectionService, CorrectionIndexType, InterestType } from "@/lib/correction-service";
import { getEighthDayNextMonth, getTenthBusinessDayNextMonth, getNextMonthDate } from "@/lib/date-utils";
import { parseInfo } from "@/lib/math-utils";

interface LaborCalculationsProps {
    data: ExtractedData[];
}

export function LaborCalculations({ data }: LaborCalculationsProps) {
    // State for dates
    const [admissao, setAdmissao] = useState<string>("");
    const [demissao, setDemissao] = useState<string>("");
    // Manual salary override
    const [manualSalary, setManualSalary] = useState<string>("");

    // Toggle for details
    const [showDetails, setShowDetails] = useState(false);

    // Correction Settings
    const [correctionIndex, setCorrectionIndex] = useState<CorrectionIndexType>('SELIC');
    const [interestRate, setInterestRate] = useState<InterestType>('1%_SIMPLE');
    const [correctionEnabled, setCorrectionEnabled] = useState(false);

    // Logo State
    const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);

    useEffect(() => {
        // Pre-load logo for PDF
        const loadLogo = async () => {
            try {
                const response = await fetch('/logo.png');
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    setLogoBase64(reader.result as string);
                };
                reader.readAsDataURL(blob);
            } catch (e) {
                console.error("Failed to load logo", e);
            }
        };
        loadLogo();
    }, []);

    // Auto-detect last salary from data
    const lastSalaryDetected = useMemo(() => {
        if (!data || data.length === 0) return 0;

        // Explicitly filter for "NORMAL"
        const normalPaystubs = data.filter(d =>
            d.tipoFolha === 'NORMAL' ||
            (d.tipoFolha === undefined && !d.mesAno?.toLowerCase().includes('13') && !d.mesAno?.toLowerCase().includes('fér'))
        );

        // Fallback to all if no "Normal" found
        const searchPool = normalPaystubs.length > 0 ? normalPaystubs : data;

        // Sort by Date Descending (Newest First)
        // We import parseMesAno logic slightly modified or reuse it if exported
        // Since parseMesAno is in math-utils, we use it.
        const sorted = [...searchPool].sort((a, b) => {
            const timeA = a.mesAno ? parseMesAno(a.mesAno)?.getTime() || 0 : 0;
            const timeB = b.mesAno ? parseMesAno(b.mesAno)?.getTime() || 0 : 0;
            return timeA - timeB;
        });

        // Last element is the newest
        const last = sorted[sorted.length - 1];

        // Preference: Base Previdência (Footer) -> Components Sum
        if (last.basePrevidencia) {
            return parseCurrency(last.basePrevidencia);
        }

        const vBase = parseCurrency(last.vencimentoBase?.valor);
        const aulas = parseCurrency(last.aulasSuplementares?.valor);
        const gTit = parseCurrency(last.gratTitularidade);
        const gMag = parseCurrency(last.gratMagisterio);
        const gEsc = parseCurrency(last.gratEscolaridade);

        return vBase + aulas + gTit + gMag + gEsc;
    }, [data]);

    const displaySalary = manualSalary ? parseCurrency(manualSalary) : lastSalaryDetected;

    const result = useMemo(() => {
        const parseInputDate = (str: string) => {
            if (!str) return null;
            const [y, m, d] = str.split('-').map(Number);
            return new Date(y, m - 1, d);
        }

        return calculateLaborRights(
            data,
            parseInputDate(admissao),
            parseInputDate(demissao),
            displaySalary
        );
    }, [data, admissao, demissao, displaySalary]);

    const vinculoInfo = useMemo(() => {
        if (!data || data.length === 0) return { type: 'DESCONHECIDO', isEfetivo: false };
        const found = data.find(d => d.vinculo && d.vinculo.length > 0);
        const type = found?.vinculo || 'DESCONHECIDO';
        const isEfetivo = type.toUpperCase().includes('EFETIVO');
        return { type, isEfetivo };
    }, [data]);



    // Correction Logic Hook
    const correctedValues = useMemo(() => {
        if (!correctionEnabled || !result) return null;

        // 1. FGTS Correction
        let totalFgtsCorrigido = 0;
        let totalFgtsJuros = 0;

        const fgtsMensalCorrigido = result.fgts.mensal.map(item => {
            if (!item.competencia) return { ...item, valorCorrigido: item.valor, valorTotal: item.valor, correctionInfo: null };

            // Robust parsing using shared utility (handles "Mar/2021" and "03/2021")
            const parsedDate = parseMesAno(item.competencia);
            if (!parsedDate) return { ...item, valorCorrigido: item.valor, valorTotal: item.valor, correctionInfo: null };

            const refDate = parsedDate; // This is the 1st of the month (e.g. 01/03/2021)
            // RULE: Vencimento dia 10 do mês seguinte
            // (10th of MM+1)
            const nextMonth = new Date(refDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            nextMonth.setDate(10);

            const dueDate = nextMonth;

            // Calculate using new Service
            const calc = CorrectionService.calculate(item.valor, dueDate, correctionIndex, interestRate);

            totalFgtsCorrigido += calc.correctedValue;
            totalFgtsJuros += calc.interestAmount;

            return {
                ...item,
                valorCorrigido: calc.correctedValue, // Base + Correction
                valorJuros: calc.interestAmount,
                valorTotal: calc.totalValue, // Base + Correction + Interest
                dueDate: dueDate, // Store for reference
                correctionInfo: calc
            };
        });

        // Multa 40% Calculation Rule
        // User Request: "a multa é calculada somente sobre a soma do valor devido"
        // Interpretation: Multa Base = Sum of ORIGINAL monthly deposits (before correction/interest).

        const sumOriginalDeposits = result.fgts.depositos; // This is the sum of original "valor"
        const multaFinal = sumOriginalDeposits * 0.4;

        // NOTE: We are NOT applying correction/interest to the Multa itself based on this request,
        // unless implies Multa should be corrected from Rescisao?
        // Staying strict to: Multa = Original * 0.4.

        const totalFgtsFinal = fgtsMensalCorrigido.reduce((acc, curr) => acc + curr.valorTotal, 0);

        // Alias for compatibility with return object
        const baseParaMulta = totalFgtsFinal;

        // Total = Sum(Deeply Corrected Monthly Deposits) + Multa(Original * 0.4)
        // (Note: This separates the 'Principal' pot from the 'Fine' pot logic)


        // 2. Severance Correction
        const avisoVal = result.avisoPrevio.valor;
        const feriasVal = result.ferias.valor;
        const reflexoVal = result.avisoPrevio.reflexoFgts;
        const totalRescisaoOriginal = avisoVal + feriasVal + reflexoVal;

        const demissionDateObj = demissao ? new Date(demissao + "T00:00:00") : new Date();
        // RULE: Severance due 10 days after termination
        const rescisaoDueDate = new Date(demissionDateObj);
        rescisaoDueDate.setDate(rescisaoDueDate.getDate() + 10);

        const correctionRescisao = CorrectionService.calculate(
            totalRescisaoOriginal,
            rescisaoDueDate,
            correctionIndex,
            interestRate
        );

        // 3. Audit (Aulas Suplementares) Correction
        // We need to re-calculate the differences first (from generateAuditReport logic or labor-calculations logic?)
        // The differences are not stored in 'result' (Result focuses on Rescisao/FGTS).
        // We need to iterate data again? 
        // Or we can rely on `generateAuditReport` doing the calc?
        // Better: Do it here to pass to PDF.
        const auditCorrections = data.filter(d => d.aulasSuplementares).map(d => {
            // Re-enact logic:
            const base = parseCurrency(d.vencimentoBase?.valor);
            const gTit = parseCurrency(d.gratTitularidade);
            const gMag = parseCurrency(d.gratMagisterio);
            const gEsc = parseCurrency(d.gratEscolaridade);
            const totalBase = base + gTit + gMag + gEsc;

            const horas = parseInfo(d.vencimentoBase?.info);
            const aulas = parseInfo(d.aulasSuplementares?.info);
            const pago = parseCurrency(d.aulasSuplementares?.valor);

            if (horas === 0) return null;

            const hourly = totalBase / horas;
            const devido = hourly * 1.5 * aulas;
            const diferenca = devido - pago;

            if (diferenca <= 0.01) return null;

            // Due Date: 5th of Next Month
            const [mStr, yStr] = (d.mesAno || "").split('/');
            let month = parseInt(mStr);
            let year = parseInt(yStr);
            if (!mStr) return null;

            const refDate = new Date(year, month - 1, 1);
            const dueDate = getNextMonthDate(refDate, 5); // 5th day next month

            const calc = CorrectionService.calculate(diferenca, dueDate, correctionIndex, interestRate);

            return {
                mesAno: d.mesAno,
                original: diferenca,
                corrected: calc.totalValue, // Final value for column
                details: calc
            };
        }).filter(Boolean);

        return {
            fgts: {
                totalCorrigido: baseParaMulta,
                totalJuros: totalFgtsJuros,
                totalFinal: baseParaMulta + totalFgtsJuros,
                multaTotal: multaFinal,
                mensal: fgtsMensalCorrigido
            },
            rescisao: {
                totalFinal: correctionRescisao.totalValue,
                info: correctionRescisao
            },
            audit: auditCorrections
        };
    }, [result, correctionEnabled, demissao, correctionIndex, interestRate, data]); // Added 'data' dependency

    // Helper functions need import?
    // getNextMonthDate was in date-utils but maybe not exported or imported?
    // getNextMonthDate is exported from date-utils.ts.
    // Check imports.

    if (vinculoInfo.isEfetivo) {
        return (
            <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                <div className="flex items-center gap-2 mb-4">
                    <Calculator className="h-6 w-6 text-zinc-600" />
                    <h2 className="text-xl font-semibold text-zinc-500">Cálculo de Verbas Rescisórias & FGTS</h2>
                </div>

                {/* Audit Button */}
                <div className="flex justify-end mb-2">
                    <button
                        onClick={() => {
                            try {
                                if (correctionEnabled && correctedValues?.audit) {
                                    generateAuditReport(data, {
                                        enabled: true,
                                        index: correctionIndex,
                                        interest: interestRate,
                                        data: correctedValues.audit
                                    }, logoBase64);
                                } else {
                                    generateAuditReport(data, undefined, logoBase64);
                                }
                            } catch (error) {
                                console.error("Erro ao gerar PDF Auditoria:", error);
                                alert("Erro ao gerar PDF de Auditoria.");
                            }
                        }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                        <BarChart3 className="h-4 w-4" />
                        {correctionEnabled ? "Baixar Relatório Auditoria (Corrigido)" : "Baixar Relatório Auditoria"}
                    </button>
                </div>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-8 text-center space-y-3">
                    <div className="bg-zinc-800/50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                        <AlertCircle className="h-6 w-6 text-zinc-500" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-300">Cálculo Indisponível para Servidor Efetivo</h3>
                    <p className="text-zinc-500 max-w-md mx-auto text-sm">
                        O cálculo de rescisão e FGTS é exclusivo para servidores contratados temporariamente.
                        O vínculo detectado foi: <span className="font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">{vinculoInfo.type}</span>.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">

            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Calculator className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold text-white">Cálculo de Verbas Rescisórias & FGTS</h2>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => {
                        try {
                            const name = data[0]?.nome || "Servidor";
                            const correctionData = (correctionEnabled && correctedValues?.rescisao.info) ? {
                                original: correctedValues.rescisao.info.originalValue,
                                corrected: correctedValues.rescisao.info.correctedValue,
                                interest: correctedValues.rescisao.info.interestAmount,
                                total: correctedValues.rescisao.info.totalValue,
                                indexName: correctedValues.rescisao.info.details.correctionIndex,
                                interestName: correctedValues.rescisao.info.details.interestType
                            } : null;

                            generateSeveranceReport(result, name, admissao, demissao, displaySalary, correctionData, logoBase64);
                        } catch (error) {
                            console.error("Erro ao gerar PDF:", error);
                            alert("Erro ao gerar PDF de Rescisão. Verifique o console.");
                        }
                    }}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                >
                    <FileText className="h-4 w-4" /> Baixar Termo Rescisão
                </button>
            </div>

            <div className="bg-white border border-accent/20 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-serif font-semibold text-primary flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-accent" />
                            Cálculos Trabalhistas
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Simulação de rescisão e auditoria de FGTS
                        </p>
                    </div>
                </div>

                {/* DATE INPUTS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-primary/70">
                            Data de Admissão
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-accent" />
                            <input
                                type="date"
                                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-input rounded-lg text-foreground focus:ring-1 focus:ring-accent focus:border-accent outline-none transition-all text-sm"
                                value={admissao}
                                onChange={(e) => setAdmissao(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* ... other inputs similar style ... */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-primary/70">
                            Data de Demissão
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-accent" />
                            <input
                                type="date"
                                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-input rounded-lg text-foreground focus:ring-1 focus:ring-accent focus:border-accent outline-none transition-all text-sm"
                                value={demissao}
                                onChange={(e) => setDemissao(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-primary/70 flex items-center justify-between">
                            Última Remuneração
                            <span className="text-[10px] text-accent font-normal bg-accent/10 px-2 py-0.5 rounded-full">
                                {manualSalary ? 'Manual' : 'Automático'}
                            </span>
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-accent" />
                            <input
                                type="text"
                                placeholder={formatCurrency(lastSalaryDetected)}
                                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-input rounded-lg text-foreground focus:ring-1 focus:ring-accent focus:border-accent outline-none transition-all text-sm font-mono"
                                value={manualSalary}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9,.]/g, '');
                                    setManualSalary(val);
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* CORRECTION TOGGLE SECTION */}
                <div className="mt-8 pt-6 border-t border-border">
                    <div className="flex items-center justify-between cursor-pointer group" onClick={() => setCorrectionEnabled(!correctionEnabled)}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg transition-colors ${correctionEnabled ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'}`}>
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className={`font-medium transition-colors ${correctionEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                                    Correção Monetária e Juros
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Aplicar índices oficiais (SELIC, IPCA-E) e juros de mora
                                </p>
                            </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${correctionEnabled ? 'bg-primary' : 'bg-input'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${correctionEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </div>

                    {/* EXPANDABLE SETTINGS */}
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 overflow-hidden transition-all duration-300 ${correctionEnabled ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Índice de Correção</label>
                            <div className="flex gap-2">
                                {(['SELIC', 'IPCA-E', 'INPC'] as CorrectionIndexType[]).map(idx => (
                                    <button
                                        key={idx}
                                        onClick={() => setCorrectionIndex(idx)}
                                        className={`flex-1 py-2 px-3 text-xs rounded-md border transition-all ${correctionIndex === idx
                                            ? 'bg-primary text-white border-primary shadow-sm'
                                            : 'bg-zinc-50 text-muted-foreground border-input hover:border-accent/50'
                                            }`}
                                    >
                                        {idx}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Juros de Mora</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setInterestRate('1%_SIMPLE')}
                                    className={`flex-1 py-2 px-3 text-xs rounded-md border transition-all ${interestRate === '1%_SIMPLE'
                                        ? 'bg-primary text-white border-primary shadow-sm'
                                        : 'bg-zinc-50 text-muted-foreground border-input hover:border-accent/50'
                                        }`}
                                >
                                    1% a.m. Simples
                                </button>
                                <button
                                    onClick={() => setInterestRate('NONE')}
                                    className={`flex-1 py-2 px-3 text-xs rounded-md border transition-all ${interestRate === 'NONE'
                                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                                        : 'bg-zinc-50 text-muted-foreground border-input hover:bg-zinc-100'
                                        }`}
                                >
                                    Sem Juros
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RESULTS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. SEVERANCE CARD */}
                <div className="bg-white border border-border rounded-xl p-6 shadow-sm hover:border-accent/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">Rescisão Estimada</span>
                        <div className="p-2 bg-primary/5 rounded-full text-primary group-hover:bg-primary/10 transition-colors">
                            <FileText className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-foreground font-serif">
                        {formatCurrency(
                            correctionEnabled && correctedValues?.rescisao
                                ? correctedValues.rescisao.totalFinal
                                : (result.avisoPrevio.valor + result.ferias.valor + result.avisoPrevio.reflexoFgts)
                        )}
                    </div>
                    {correctionEnabled && correctedValues?.rescisao && (
                        <div className="mt-2 text-xs text-accent flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            <span>+{formatCurrency(correctedValues.rescisao.totalFinal - (result.avisoPrevio.valor + result.ferias.valor + result.avisoPrevio.reflexoFgts))} de atualização</span>
                        </div>
                    )}
                    <button
                        onClick={() => {
                            try {
                                const corrData = (correctionEnabled && correctedValues?.rescisao) ? {
                                    original: result.avisoPrevio.valor + result.ferias.valor + result.avisoPrevio.reflexoFgts,
                                    corrected: correctedValues.rescisao.info.correctedValue,
                                    interest: correctedValues.rescisao.info.interestAmount,
                                    total: correctedValues.rescisao.totalFinal,
                                    indexName: correctionIndex,
                                    interestName: interestRate === '1%_SIMPLE' ? '1% a.m.' : 'Sem Juros'
                                } : null;

                                const name = data[0]?.nome || "Colaborador";
                                generateSeveranceReport(result, name, admissao, demissao, displaySalary, corrData, logoBase64);
                            } catch (error) {
                                console.error("Erro ao gerar PDF:", error);
                                alert("Erro ao gerar PDF de Termo Rescisão. Verifique o console.");
                            }
                        }}
                        className="mt-6 w-full py-2 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 transition-colors"
                    >
                        Gerar Termo PDF
                    </button>
                </div>

                {/* 2. FGTS CARD */}
                <div className="bg-white border border-border rounded-xl p-6 shadow-sm hover:border-accent/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">Saldo FGTS + 40%</span>
                        <div className="p-2 bg-primary/5 rounded-full text-primary group-hover:bg-primary/10 transition-colors">
                            <Percent className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-foreground font-serif">
                        {formatCurrency(
                            correctionEnabled && correctedValues?.fgts
                                ? correctedValues.fgts.totalFinal + (result.fgts.saldoParaFinsRescisorios * 0.4) // Fine always on original basis usually, refer to logic 
                                // Wait, totalFinal includes deposits updated?
                                // Logic in useMemo: totalFinal = totalFgtsCorrigido + totalFgtsJuros + (baseParaMulta * 0.4)
                                // So yes, it is the Grand Total.
                                : result.fgts.total + result.fgts.multa40
                        )}
                    </div>
                    {correctionEnabled && correctedValues?.fgts && (
                        <div className="mt-2 text-xs text-accent flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            <span>Corrigido ({correctionIndex})</span>
                        </div>
                    )}
                    <button
                        onClick={() => {
                            try {
                                const name = data[0]?.nome || "Colaborador";
                                const idFuncional = data[0]?.idFuncional || "";
                                const vinculoInfo = data.find(d => d.vinculo)?.vinculo || "";
                                const vinculo = typeof vinculoInfo === 'string' ? vinculoInfo : "N/D";

                                const totalCorrigido = (correctionEnabled && correctedValues?.fgts) ? correctedValues.fgts.totalFinal : null;
                                const correctedItems = (correctionEnabled && correctedValues?.fgts) ? correctedValues.fgts.mensal : null;

                                generateFGTSReport(result, name, idFuncional, vinculo, admissao, demissao, totalCorrigido, correctedItems, logoBase64);
                            } catch (error) {
                                console.error("Erro ao gerar PDF FGTS:", error);
                                alert("Erro ao gerar PDF FGTS. Verifique o console.");
                            }
                        }}
                        className="mt-6 w-full py-2 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 transition-colors"
                    >
                        Extrato Analítico PDF
                    </button>
                    <div className="mt-3 flex justify-center">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="text-[10px] text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
                        >
                            {showDetails ? 'Ocultar Detalhes' : 'Ver Memória de Cálculo'}
                            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                    </div>
                </div>

                {/* 3. AUDIT CARD */}
                <div className="bg-white border border-border rounded-xl p-6 shadow-sm hover:border-accent/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">Auditoria Aulas</span>
                        <div className="p-2 bg-primary/5 rounded-full text-primary group-hover:bg-primary/10 transition-colors">
                            <BarChart3 className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-foreground font-serif">
                        {/* Placeholder for Audit Total logic if implemented */}
                        R$ --
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Análise de diferenças de regência
                    </p>
                    <button
                        onClick={() => generateAuditReport(data, undefined, logoBase64)}
                        className="mt-6 w-full py-2 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 transition-colors"
                    >
                        Relatório Auditoria PDF
                    </button>
                </div>
            </div>

            {/* Monthly Breakdown Table */}
            {showDetails && result.fgts.mensal.length > 0 && (
                <div className="bg-white border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 shadow-lg">
                    <div className="bg-primary px-6 py-3 border-b border-primary/20 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase text-white/90 flex items-center gap-2">
                            <TableIcon className="h-4 w-4 text-accent" /> Memória de Cálculo FGTS
                        </h4>
                        <span className="text-xs text-white/60 font-mono">
                            {result.fgts.mensal.length} competências
                        </span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 text-xs uppercase text-muted-foreground font-semibold sticky top-0 backdrop-blur-sm z-10 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3">Ref</th>
                                    <th className="px-4 py-3 text-right">FGTS Original</th>
                                    {correctionEnabled && (
                                        <>
                                            <th className="px-4 py-3 text-right text-accent">Correção ($)</th>
                                            <th className="px-4 py-3 text-right text-foreground">Valor Atualizado</th>
                                            <th className="px-4 py-3 text-right text-primary">Juros ($)</th>
                                        </>
                                    )}
                                    <th className="px-4 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border font-mono text-xs text-foreground bg-white">
                                {result.fgts.mensal.map((row, idx) => {
                                    // Access corresponding corrected row
                                    const correctedRow = correctionEnabled ? correctedValues?.fgts.mensal[idx] : null;

                                    return (
                                        <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                                            <td className="px-4 py-3 text-muted-foreground">{row.competencia}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(row.valor)}</td>

                                            {correctionEnabled && correctedRow?.correctionInfo ? (
                                                <>
                                                    <td className="px-4 py-3 text-right text-accent font-medium">
                                                        +{formatCurrency(correctedRow.correctionInfo.correctionAmount)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-foreground">
                                                        {formatCurrency(correctedRow.correctionInfo.correctedValue)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-primary">
                                                        +{formatCurrency(correctedRow.correctionInfo.interestAmount)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-primary font-bold bg-primary/5">
                                                        {formatCurrency(correctedRow.valorTotal)}
                                                    </td>
                                                </>
                                            ) : correctionEnabled ? (
                                                // Fallback
                                                <>
                                                    <td className="px-4 py-3 text-right">-</td>
                                                    <td className="px-4 py-3 text-right">-</td>
                                                    <td className="px-4 py-3 text-right">-</td>
                                                    <td className="px-4 py-3 text-right text-primary font-bold">
                                                        {formatCurrency(row.valor)}
                                                    </td>
                                                </>
                                            ) : (
                                                // Simple View
                                                <td className="px-4 py-3 text-right text-primary font-medium">
                                                    {formatCurrency(row.valor)}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-zinc-50 font-semibold border-t border-border text-xs">
                                <tr>
                                    <td className="px-4 py-3 text-muted-foreground">TOTAL</td>
                                    <td className="px-4 py-3 text-right text-foreground">{formatCurrency(result.fgts.depositos)}</td>
                                    {correctionEnabled && (
                                        <>
                                            <td className="px-4 py-3 text-right text-accent">
                                                {formatCurrency(correctedValues?.fgts.mensal.reduce((a, b) => a + (b.correctionInfo?.correctionAmount || 0), 0) || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-foreground">
                                                {formatCurrency(correctedValues?.fgts.mensal.reduce((a, b) => a + (b.correctionInfo?.correctedValue || 0), 0) || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-primary">
                                                {formatCurrency(correctedValues?.fgts.totalJuros || 0)}
                                            </td>
                                        </>
                                    )}
                                    <td className="px-4 py-3 text-right text-primary bg-primary/10 border-l border-primary/20">
                                        {correctionEnabled
                                            ? formatCurrency(correctedValues?.fgts.totalFinal || 0)
                                            : formatCurrency(result.fgts.depositos)
                                        }
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div >
            )}

            {/* Grand Total */}
            <div className="bg-primary text-primary-foreground rounded-xl p-6 flex items-center justify-between shadow-lg shadow-primary/20">
                <div className="flex flex-col">
                    <span className="text-sm font-medium uppercase tracking-wider opacity-90">Total Geral Estimado</span>
                    <span className="text-xs opacity-60">Rescisória + Multa + FGTS (Corrigidos se ativo)</span>
                </div>
                <div className="text-3xl font-bold font-serif tracking-tight">
                    {formatCurrency(result.totalGeral)}
                </div>
            </div>

        </div >
    );
}
