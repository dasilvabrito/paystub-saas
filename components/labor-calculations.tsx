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

    // Auto-detect last salary from data
    const lastSalaryDetected = useMemo(() => {
        if (!data || data.length === 0) return 0;

        // Filter for "Folha Normal" if possible to get the true base
        // If no "Normal" found, iterate backwards on all data.
        // data matches Page.tsx order (Oldest -> Newest).
        // specific logic: Find LAST "Normal" paystub.

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
                            if (correctionEnabled && correctedValues?.audit) {
                                // Pass corrected data
                                // @ts-ignore
                                generateAuditReport(data, {
                                    enabled: true,
                                    index: correctionIndex,
                                    interest: interestRate,
                                    data: correctedValues.audit
                                });
                            } else {
                                generateAuditReport(data);
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
                        const name = data[0]?.nome || "Servidor";
                        const correctionData = (correctionEnabled && correctedValues?.rescisao.info) ? {
                            original: correctedValues.rescisao.info.originalValue,
                            corrected: correctedValues.rescisao.info.correctedValue,
                            // pass total including interest where PDF expects "Corrected" usually? 
                            // Or we need to update PDF to handle Interest Separately.
                            // For now, let's pass the full breakdown if we update PDF generator.
                            // I will update PDF generator next step.
                            interest: correctedValues.rescisao.info.interestAmount,
                            total: correctedValues.rescisao.info.totalValue,
                            indexName: correctedValues.rescisao.info.details.correctionIndex,
                            interestName: correctedValues.rescisao.info.details.interestType
                        } : null;

                        // @ts-ignore - will fix signature 
                        generateSeveranceReport(result, name, admissao, demissao, displaySalary, correctionData);
                    }}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                >
                    <FileText className="h-4 w-4" /> Baixar Termo Rescisão
                </button>
                <button
                    onClick={() => {
                        const name = data[0]?.nome || "Servidor";
                        const idFuncional = data[0]?.idFuncional || "N/D";
                        const vinculo = vinculoInfo.type || "N/D";
                        // Pass total Final (Principal + Corr + Interest)
                        const totalCorrigido = (correctionEnabled && correctedValues?.fgts) ? correctedValues.fgts.totalFinal : null;

                        generateFGTSReport(result, name, idFuncional, vinculo, admissao, demissao, totalCorrigido);
                    }}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                >
                    <FileText className="h-4 w-4" /> Baixar Memória FGTS
                </button>
            </div>

            {/* Input Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Admissão */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Data de Admissão
                    </label>
                    <input
                        type="date"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        value={admissao}
                        onChange={(e) => setAdmissao(e.target.value)}
                    />
                </div>

                {/* Demissão */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Data de Demissão
                    </label>
                    <input
                        type="date"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        value={demissao}
                        onChange={(e) => setDemissao(e.target.value)}
                    />
                </div>

                {/* Último Salário */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Base de Cálculo (Prev.)
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            placeholder={formatCurrency(lastSalaryDetected)}
                            value={manualSalary}
                            onChange={(e) => setManualSalary(e.target.value)}
                        />
                        {!manualSalary && (
                            <span className="absolute right-3 top-2.5 text-xs text-zinc-600 pointer-events-none">
                                Detectado: {formatCurrency(lastSalaryDetected)}
                            </span>
                        )}
                    </div>
                </div>
            </div>



            {/* Correction Settings Panel */}
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                        <Settings className="h-4 w-4" /> Configuração de Liquidação
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 uppercase font-medium">Ativar Cálculos</span>
                        <button
                            onClick={() => setCorrectionEnabled(!correctionEnabled)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${correctionEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                        >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${correctionEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                {correctionEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                        <div className="space-y-1">
                            <label className="text-xs text-zinc-500 font-medium">Índice de Correção</label>
                            <div className="relative">
                                <select
                                    value={correctionIndex}
                                    onChange={(e) => setCorrectionIndex(e.target.value as CorrectionIndexType)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 appearance-none focus:border-amber-500 outline-none"
                                >
                                    <option value="SELIC">SELIC (EC 113/2021) - Padrão</option>
                                    <option value="IPCA-E">IPCA-E</option>
                                    <option value="INPC">INPC</option>
                                </select>
                                <TrendingUp className="absolute right-3 top-2.5 h-4 w-4 text-zinc-600 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-zinc-500 font-medium">Juros de Mora</label>
                            <div className="relative">
                                <select
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(e.target.value as InterestType)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 appearance-none focus:border-amber-500 outline-none"
                                >
                                    <option value="1%_SIMPLE">1% ao mês (Simples)</option>
                                    <option value="0.5%_SIMPLE">0.5% ao mês (Simples)</option>
                                    <option value="NONE">Sem Juros (Apenas Correção)</option>
                                </select>
                                <Percent className="absolute right-3 top-2.5 h-4 w-4 text-zinc-600 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. Verbas Rescisórias */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4 hover:bg-zinc-900/80 transition-colors">
                    <h3 className="text-sm font-semibold text-zinc-200 border-b border-zinc-800 pb-3 mb-2 flex justify-between">
                        <span>Verbas Rescisórias</span>
                        <div className="text-right">
                            <div className={correctionEnabled ? "text-amber-500" : "text-emerald-500"}>
                                {correctionEnabled
                                    ? formatCurrency(correctedValues?.rescisao.totalFinal || 0)
                                    : formatCurrency(result.avisoPrevio.valor + result.avisoPrevio.reflexoFgts + result.ferias.valor)
                                }
                            </div>
                            {correctionEnabled && (
                                <div className="text-[10px] text-zinc-500">
                                    Principal: {formatCurrency(result.avisoPrevio.valor + result.avisoPrevio.reflexoFgts + result.ferias.valor)}
                                </div>
                            )}
                        </div>
                    </h3>

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center text-zinc-400">
                            <span>Aviso Prévio Indenizado ({result.avisoPrevio.dias} dias)</span>
                            <span className="font-mono text-zinc-200">{formatCurrency(result.avisoPrevio.valor)}</span>
                        </div>
                        <div className="flex justify-between items-center text-zinc-400">
                            <span>Férias + 1/3 (Base x 1.3)</span>
                            <span className="font-mono text-zinc-200">{formatCurrency(result.ferias.valor)}</span>
                        </div>
                        <div className="flex justify-between items-center text-zinc-500 text-xs">
                            <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Reflexo FGTS (8% s/ Aviso)</span>
                            <span className="font-mono text-zinc-400">{formatCurrency(result.avisoPrevio.reflexoFgts)}</span>
                        </div>
                        {correctionEnabled && (
                            <div className="mt-2 text-[10px] text-amber-500/80 bg-amber-500/5 p-2 rounded">
                                * Atualizado pela SELIC até hoje
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. FGTS */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4 hover:bg-zinc-900/80 transition-colors">
                    <h3 className="text-sm font-semibold text-zinc-200 border-b border-zinc-800 pb-3 mb-2 flex justify-between">
                        <span>FGTS Total + Multa 40%</span>
                        <div className="text-right">
                            <div className={correctionEnabled ? "text-amber-500" : "text-emerald-500"}>
                                {correctionEnabled
                                    ? formatCurrency((correctedValues?.fgts.totalFinal || 0) + (correctedValues?.fgts.multaTotal || 0))
                                    : formatCurrency(result.fgts.total + result.fgts.multa40)
                                }
                            </div>
                            {correctionEnabled && (
                                <div className="text-[10px] text-zinc-500">
                                    Principal: {formatCurrency(result.fgts.total + result.fgts.multa40)}
                                </div>
                            )}
                        </div>
                    </h3>

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center text-zinc-400">
                            <span>Depósitos {correctionEnabled && "(Corrigidos + Juros)"}</span>
                            <span className="font-mono text-zinc-200">
                                {correctionEnabled
                                    ? formatCurrency(correctedValues?.fgts?.totalFinal || 0)
                                    : formatCurrency(result.fgts.depositos)
                                }
                            </span>
                        </div>

                        <div className="flex justify-between items-center text-emerald-500 font-medium">
                            <span>Multa Rescisória (40%)</span>
                            <span className="font-mono">
                                {correctionEnabled
                                    ? formatCurrency(correctedValues?.fgts?.multaTotal || 0)
                                    : formatCurrency(result.fgts.multa40)
                                }
                            </span>
                        </div>
                    </div>

                    {/* Toggle Details */}
                    <div className="mt-4 pt-3 border-t border-zinc-800/50">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="w-full flex items-center justify-center text-xs text-primary hover:text-primary/80 transition-colors py-2"
                        >
                            {showDetails ? (
                                <>
                                    <ChevronUp className="h-3 w-3 mr-1" /> Ocultar Memória de Cálculo
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="h-3 w-3 mr-1" /> Ver Memória de Cálculo Mensal
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>

            {/* Monthly Breakdown Table */}
            {showDetails && result.fgts.mensal.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-zinc-950/50 px-6 py-3 border-b border-zinc-800 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase text-zinc-400 flex items-center gap-2">
                            <TableIcon className="h-4 w-4" /> Memória de Cálculo FGTS
                        </h4>
                        <span className="text-xs text-zinc-500 font-mono">
                            {result.fgts.mensal.length} competências
                        </span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm text-left text-zinc-300">
                            <thead className="bg-zinc-950/30 text-xs uppercase text-zinc-500 font-semibold sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4 py-3">Ref</th>
                                    <th className="px-4 py-3 text-right">FGTS Original</th>
                                    {correctionEnabled && (
                                        <>
                                            <th className="px-4 py-3 text-right text-amber-500">Correção ($)</th>
                                            <th className="px-4 py-3 text-right text-zinc-300">Valor Atualizado</th>
                                            <th className="px-4 py-3 text-right text-blue-400">Juros ($)</th>
                                        </>
                                    )}
                                    <th className="px-4 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50 font-mono text-xs">
                                {result.fgts.mensal.map((row, idx) => {
                                    // Access corresponding corrected row
                                    const correctedRow = correctionEnabled ? correctedValues?.fgts.mensal[idx] : null;

                                    return (
                                        <tr key={idx} className="hover:bg-zinc-800/20">
                                            <td className="px-4 py-3 text-zinc-400">{row.competencia}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(row.valor)}</td>

                                            {correctionEnabled && correctedRow?.correctionInfo ? (
                                                <>
                                                    <td className="px-4 py-3 text-right text-amber-500/80">
                                                        +{formatCurrency(correctedRow.correctionInfo.correctionAmount)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-zinc-300">
                                                        {formatCurrency(correctedRow.correctionInfo.correctedValue)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-blue-400">
                                                        +{formatCurrency(correctedRow.correctionInfo.interestAmount)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-emerald-500 font-bold">
                                                        {formatCurrency(correctedRow.valorTotal)}
                                                    </td>
                                                </>
                                            ) : correctionEnabled ? (
                                                // Fallback if no specific correction info found for this row
                                                <>
                                                    <td className="px-4 py-3 text-right">-</td>
                                                    <td className="px-4 py-3 text-right">-</td>
                                                    <td className="px-4 py-3 text-right">-</td>
                                                    <td className="px-4 py-3 text-right">-</td>
                                                    <td className="px-4 py-3 text-right text-emerald-500">
                                                        {formatCurrency(row.valor)}
                                                    </td>
                                                </>
                                            ) : (
                                                // Non-Correction Mode (Simple View)
                                                <td className="px-4 py-3 text-right text-emerald-500">
                                                    {formatCurrency(row.valor)}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>

                            <tfoot className="bg-zinc-950/30 font-semibold border-t border-zinc-800">
                                <tr>
                                    <td className="px-4 py-3 text-zinc-400">TOTAL</td>
                                    <td className="px-4 py-3 text-right text-zinc-500">{formatCurrency(result.fgts.depositos)}</td>
                                    {correctionEnabled && (
                                        <>
                                            <td className="px-4 py-3 text-right text-amber-500">
                                                {formatCurrency(correctedValues?.fgts.mensal.reduce((a, b) => a + (b.correctionInfo?.correctionAmount || 0), 0) || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-zinc-300">
                                                {formatCurrency(correctedValues?.fgts.mensal.reduce((a, b) => a + (b.correctionInfo?.correctedValue || 0), 0) || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-zinc-500">-</td>
                                            <td className="px-4 py-3 text-right text-blue-400">
                                                {formatCurrency(correctedValues?.fgts.totalJuros || 0)}
                                            </td>
                                        </>
                                    )}
                                    <td className="px-4 py-3 text-right text-emerald-400">
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
            )
            }

            {/* Grand Total */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-sm text-primary font-medium uppercase tracking-wider">Total Estimado</span>
                    <span className="text-xs text-primary/60">Verbas Rescisórias + FGTS</span>
                </div>
                <div className="text-3xl font-bold text-white font-mono">
                    {formatCurrency(result.totalGeral)}
                </div>
            </div>

        </div >
    );
}
