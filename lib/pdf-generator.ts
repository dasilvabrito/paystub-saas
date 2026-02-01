
import jsPDF from "jspdf";
import "jspdf-autotable"; // Side effect import to attach to jsPDF prototype
import { ExtractedData } from "./extractors";
import { formatCurrency, parseCurrency, parseInfo } from "./math-utils";
import { LaborCalculationResult } from "./labor-calculations";

// Helper to safely call autoTable
const safeAutoTable = (doc: jsPDF, options: any) => {
    try {
        if ((doc as any).autoTable) {
            (doc as any).autoTable(options);
        } else {
            console.warn("AutoTable plugin not found on jsPDF instance");
        }
    } catch (e) {
        console.error("AutoTable generation failed:", e);
        throw e; // Re-throw to alert user
    }
};

interface ReportTotals {
    totalDevidas: number;
    totalRecebido: number;
    totalDiferenca: number;
}

// Helper to increment MM/YYYY
const incrementMonth = (mesAno: string): string => {
    try {
        const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        // Check if numeric 00/0000
        if (/^\d{1,2}\/\d{4}$/.test(mesAno)) {
            const parts = mesAno.split('/');
            let month = parseInt(parts[0]);
            let year = parseInt(parts[1]);
            month++;
            if (month > 12) {
                month = 1;
                year++;
            }
            return `${month.toString().padStart(2, '0')}/${year}`;
        }

        // Check for textual part
        const parts = mesAno.split('/');
        if (parts.length === 2) {
            let monthStr = parts[0];
            let year = parseInt(parts[1]);

            // Normalize for matching
            const monthIdx = monthsShort.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());

            if (monthIdx !== -1) {
                let nextIdx = monthIdx + 1;
                if (nextIdx > 11) {
                    nextIdx = 0;
                    year++;
                }
                const nextMonth = monthsShort[nextIdx];
                // Try to preserve casing used in input if possible, essentially "Jan" or "JAN"
                // But generally "Jan" Title case is fine.
                return `${nextMonth}/${year}`;
            }
        }

        return mesAno;
    } catch {
        return mesAno;
    }
};

// Brand Colors
const COLOR_PRIMARY = [39, 49, 89] as [number, number, number]; // Dark Blue
const COLOR_SECONDARY = [52, 74, 130] as [number, number, number];
const COLOR_ACCENT = [154, 122, 79] as [number, number, number]; // Gold
const COLOR_LIGHT = [245, 245, 245] as [number, number, number];

export const generateAuditReport = (
    data: ExtractedData[],
    correctionParams?: {
        enabled: boolean;
        index: string;
        interest: string;
        data?: any[];
    },
    logoBase64?: string
) => {
    // 0. PRE-CALCULATION (Must happen before PDF generation to have correct totals for the text)
    const tableHead = [
        ["Ref.", "V. Base", "G. Tit.", "G. Mag.", "G. Esc.", "Aulas", "Pago", "Devido", "Diferença"]
    ];

    // Raw rows
    const tableBody = data.map((row) => {
        const vencBase = parseCurrency(row.vencimentoBase?.valor);
        const gratTit = parseCurrency(row.gratTitularidade);
        const gratMag = parseCurrency(row.gratMagisterio);
        const gratEsc = parseCurrency(row.gratEscolaridade);
        const infoAulas = parseInfo(row.aulasSuplementares?.info);
        const valorAulasPago = parseCurrency(row.aulasSuplementares?.valor);
        const infoBase = parseInfo(row.vencimentoBase?.info);

        let devidas = 0;
        if (infoBase > 0) {
            const totalBasis = vencBase + gratTit + gratMag + gratEsc;
            const hourlyRate = totalBasis / infoBase;
            const suplRate = hourlyRate * 1.5;
            devidas = suplRate * infoAulas;
        }
        const diferenca = devidas - valorAulasPago;

        return {
            mesAno: row.mesAno || "-",
            vencBase,
            gratTit,
            gratMag,
            gratEsc,
            infoAulas,
            valorAulasPago,
            devidas,
            diferenca
        };
    });

    const vinculo = data.find(d => d.vinculo)?.vinculo || "Não Identificado";

    // VINCENDAS LOGIC:
    if (vinculo.toUpperCase().includes('EFETIVO') && tableBody.length > 0) {
        const lastRow = tableBody[tableBody.length - 1];
        let currentMesAno = lastRow.mesAno;

        for (let i = 1; i <= 12; i++) {
            currentMesAno = incrementMonth(currentMesAno);
            tableBody.push({
                ...lastRow,
                mesAno: `${currentMesAno} (Vincenda ${i})`,
                valorAulasPago: lastRow.valorAulasPago
            });
        }
    }

    // Recalculate totals
    let grandDevidas = 0;
    let grandRecebido = 0;
    let grandDiferenca = 0;

    const finalRows = tableBody.map(r => {
        // If correction is enabled, we expect 'r' to have correction details mixed in
        // IF we passed them.
        // Actually, let's keep it simple: The logic for calculation should likely happen INSIDE here if we didn't pass pre-calc.
        // But better: Caller passes pre-calculated correction in 'data' prop?
        // No, 'data' is ExtractedData.

        // Let's rely on caller passing a "map" of corrections?
        // Or simplified: We just change the totals if we don't fix row-by-row?
        // User wants "Audit" correction.
        // Audit is about "Diferença". "Diferença" happens at Month X.
        // Due Date = 5th of Month X+1.

        let diff = r.diferenca;
        let correctedDiff = 0;
        let interest = 0;

        if (correctionParams?.enabled && correctionParams.data) {
            const match = correctionParams.data.find(c => c.mesAno === r.mesAno);
            if (match) {
                correctedDiff = match.totalValue; // Principal + Correction + Interest
                diff = correctedDiff;
            }
        } else {
            correctedDiff = diff;
        }

        grandDevidas += r.devidas;
        grandRecebido += r.valorAulasPago;
        grandDiferenca += (correctionParams?.enabled ? correctedDiff : r.diferenca);

        return [
            r.mesAno,
            formatCurrency(r.vencBase),
            formatCurrency(r.gratTit),
            formatCurrency(r.gratMag),
            formatCurrency(r.gratEsc),
            r.infoAulas.toString(),
            formatCurrency(r.valorAulasPago),
            formatCurrency(r.devidas),
            formatCurrency(correctionParams?.enabled ? correctedDiff : r.diferenca)
        ];
    });

    const serverName = data[0]?.nome || "Não Identificado";

    const reportSummary = `O servidor ${serverName} deveria ter recebido do Estado do Pará o valor de R$ ${formatCurrency(grandDevidas)}, no entanto recebeu apenas R$ ${formatCurrency(grandRecebido)}, sendo portanto devida a diferença no valor de R$ ${formatCurrency(grandDiferenca)}.`;


    // 1. PDF GENERATION
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let currentY = 20;

    // Header
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', pageWidth - 50, 10, 35, 20); // Logo Top Right
        } catch (e) {
            console.warn("Failed to add logo:", e);
        }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    doc.text("BRITO & SANTOS ADVOCACIA", margin, currentY);

    currentY += 8;
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text("Relatório de Auditoria - Aulas Suplementares", margin, currentY);

    currentY += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, currentY);

    doc.setTextColor(0); // Reset black

    currentY += 15;

    // Server Info
    const serverId = data[0]?.idFuncional || "N/A";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Dados do Servidor:", margin, currentY);
    currentY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Nome: ${serverName}`, margin, currentY);
    currentY += 5;
    doc.text(`Matrícula/ID: ${serverId}`, margin, currentY);
    currentY += 5;
    doc.text(`Vínculo Identificado: ${vinculo}`, margin, currentY);

    currentY += 12;

    // Executive Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Resumo dos Fatos:", margin, currentY);
    currentY += 6;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    const splitSummary = doc.splitTextToSize(reportSummary, pageWidth - (margin * 2));
    doc.text(splitSummary, margin, currentY);

    const summaryHeight = splitSummary.length * 5;
    currentY += summaryHeight + 10;

    // Detailed Table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Detalhamento Mensal:", margin, currentY);

    currentY += 5;

    // Table Foot (Totals)
    const tableFoot = [
        [
            "TOTAIS GERAIS",
            "-",
            "-",
            "-",
            "-",
            "-",
            formatCurrency(grandRecebido),
            formatCurrency(grandDevidas),
            formatCurrency(grandDiferenca)
        ]
    ];

    safeAutoTable(doc, {
        startY: currentY,
        head: tableHead,
        body: finalRows,
        foot: tableFoot,
        showFoot: 'lastPage',
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 2,
            halign: 'center'
        },
        headStyles: {
            fillColor: COLOR_PRIMARY,
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        footStyles: {
            fillColor: COLOR_LIGHT, // Light Gray
            textColor: COLOR_PRIMARY, // Dark Blue Text
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 35 },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'center', cellWidth: 15 },
            6: { halign: 'right' },
            7: { halign: 'right', fontStyle: 'bold' },
            8: { halign: 'right', fontStyle: 'bold' }
        }
    });

    // Final Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
            `Página ${i} de ${pageCount}`,
            pageWidth - margin,
            pageHeight - 10,
            { align: "right" }
        );
    }

    doc.save(`relatorio_${serverName.replace(/\s+/g, '_')}_audit.pdf`);
};

const formatDatePTBR = (dateStr: string): string => {
    if (!dateStr) return "N/I";
    // Check if running in browser vs node might affect timezone, but simpler is splitting
    // Input YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
};

export const generateSeveranceReport = (
    result: LaborCalculationResult,
    employeeName: string,
    admissionDate: string,
    demissionDate: string,
    salaryBasis: number,
    correctionData?: {
        original: number;
        corrected: number; // Principal + Index
        interest: number;
        total: number;
        indexName: string;
        interestName: string;
    } | null,
    logoBase64?: string
) => {
    const doc = new jsPDF(); // Portrait is fine for this
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let currentY = 20;

    // Header
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', pageWidth - 50, 10, 35, 20);
        } catch (e) {
            console.warn("Failed to add logo:", e);
        }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    doc.text("BRITO & SANTOS ADVOCACIA", margin, currentY);

    currentY += 8;
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text("Termo de Cálculo de Verbas Rescisórias", margin, currentY);

    currentY += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, margin, currentY);
    doc.setTextColor(0); // Reset

    currentY += 20;

    // Employee Data Card
    doc.setDrawColor(200);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, currentY, pageWidth - (margin * 2), 35, 'FD');

    doc.setFont("helvetica", "bold");
    doc.text("Dados Contratuais", margin + 5, currentY + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const formattedAdmissao = formatDatePTBR(admissionDate);
    const formattedDemissao = formatDatePTBR(demissionDate);

    doc.text(`Funcionário: ${employeeName}`, margin + 5, currentY + 18);
    doc.text(`Data de Admissão: ${formattedAdmissao}`, margin + 5, currentY + 25);
    doc.text(`Data de Demissão: ${formattedDemissao}`, margin + 80, currentY + 25);
    doc.text(`Base de Cálculo: ${formatCurrency(salaryBasis)}`, margin + 5, currentY + 32);

    currentY += 45;

    // ... existing table generation ...

    const tableHead = [["Discriminação das Verbas", "Referência / Dias", "Valor Calculado"]];
    const tableBody = [
        [
            "Aviso Prévio Indenizado",
            `${result.avisoPrevio.dias} dias`,
            formatCurrency(result.avisoPrevio.valor)
        ],
        [
            "Férias com 1/3",
            "Base + 30%",
            formatCurrency(result.ferias.valor)
        ],
        [
            "Reflexo FGTS sobre Aviso Prévio",
            "8.00%",
            formatCurrency(result.avisoPrevio.reflexoFgts)
        ]
    ];

    // Total including Reflexo
    let totalRescisao = result.avisoPrevio.valor + result.ferias.valor + result.avisoPrevio.reflexoFgts;

    const tableFoot = [];

    if (correctionData) {
        // Correction Row
        const correctionOnly = correctionData.corrected - correctionData.original;
        const interestOnly = correctionData.interest;

        tableBody.push([
            `Atualização Monetária (${correctionData.indexName})`,
            "-",
            formatCurrency(correctionOnly)
        ]);

        tableBody.push([
            `Juros de Mora (${correctionData.interestName})`,
            "-",
            formatCurrency(interestOnly)
        ]);

        totalRescisao = correctionData.total;

        tableFoot.push(
            ["TOTAL ORIGINAL", "", formatCurrency(correctionData.original)],
            ["TOTAL FINAL (Corrigido + Juros)", "", formatCurrency(totalRescisao)]
        );
    } else {
        tableFoot.push(
            ["TOTAL BRUTO A PAGAR", "", formatCurrency(totalRescisao)]
        );
    }

    safeAutoTable(doc, {
        startY: currentY,
        head: tableHead,
        body: tableBody,
        foot: tableFoot,
        theme: 'grid',
        headStyles: { fillColor: COLOR_PRIMARY },
        footStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_PRIMARY, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
        }
    });

    // Disclaimer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 15;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Este documento é um demonstrativo de cálculo estimado e não possui valor legal de homologação oficial.", margin, currentY);

    doc.save(`rescisao_${employeeName}.pdf`);
}

export const generateFGTSReport = (
    result: LaborCalculationResult,
    employeeName: string,
    idFuncional: string,
    vinculo: string,
    admissao: string,
    demissao: string,
    correctionTotal?: number | null,
    correctedItems?: any[] | null, // Array of corrected row items
    logoBase64?: string
) => {
    const doc = new jsPDF({ orientation: "landscape" }); // Landscape for more columns
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let currentY = 20;

    // Header
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', pageWidth - 50, 10, 35, 20);
        } catch (e) {
            console.warn("Failed to add logo:", e);
        }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    doc.text("BRITO & SANTOS ADVOCACIA", margin, currentY);

    currentY += 8;
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text("Memória de Cálculo - FGTS", margin, currentY);

    currentY += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);

    // Employee Info Header Block
    doc.setFont("helvetica", "bold");
    doc.text(`Funcionário: ${employeeName}`, pageWidth / 2, currentY, { align: "center" });

    currentY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`ID Funcional: ${idFuncional || "N/A"}   |   Vínculo: ${vinculo || "N/A"}`, pageWidth / 2, currentY, { align: "center" });

    currentY += 5;
    const fmtAdmissao = formatDatePTBR(admissao);
    const fmtDemissao = formatDatePTBR(demissao);
    doc.text(`Admissão: ${fmtAdmissao}   |   Desligamento: ${fmtDemissao}`, pageWidth / 2, currentY, { align: "center" });

    currentY += 15;

    // Summary Card
    doc.setDrawColor(200);
    doc.setFillColor(COLOR_LIGHT[0], COLOR_LIGHT[1], COLOR_LIGHT[2]);
    doc.rect(margin, currentY, pageWidth - (margin * 2), 25, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);

    // Check if we have correction
    const displayTotal = correctionTotal
        ? (correctionTotal + (result.fgts.saldoParaFinsRescisorios * 0.4)) // Use original basis for fine
        : (result.fgts.total + result.fgts.multa40);

    doc.text(`Total FGTS Apurado: ${formatCurrency(displayTotal)}`, pageWidth / 2, currentY + 16, { align: "center" });
    doc.setTextColor(0, 0, 0);

    currentY += 35;

    // Table Columns Definition
    let tableHead: string[][] = [];
    let tableBody: any[][] = [];

    if (correctedItems && correctedItems.length > 0) {
        // Detailed Correction Columns
        tableHead = [["Ref.", "FGTS Original", "Correção ($)", "Valor Atualizado", "Juros ($)", "Total"]];

        tableBody = result.fgts.mensal.map((r, i) => {
            const corr = correctedItems[i];
            const hasCorr = corr && corr.correctionInfo;

            return [
                r.competencia,
                formatCurrency(r.valor),
                hasCorr ? formatCurrency(corr.correctionInfo.correctionAmount) : "-",
                hasCorr ? formatCurrency(corr.correctionInfo.correctedValue) : "-",
                hasCorr ? formatCurrency(corr.correctionInfo.interestAmount) : "-",
                hasCorr ? formatCurrency(corr.valorTotal) : formatCurrency(r.valor)
            ];
        });

        // Add Multa Row
        // For strictness: Fine is calculated on sum of ORIGINAL deposits
        const baseFine = result.fgts.saldoParaFinsRescisorios;
        const fineValue = baseFine * 0.4; // 40% on Original

        tableBody.push([
            "Multa 40% (s/ Original)",
            formatCurrency(baseFine), // "Base" effectively
            "-",
            "-",
            "-",
            formatCurrency(fineValue)
        ]);

        // Total Foot
        // Sum of cols
        const sumOriginal = tableBody.reduce((a, b) => {
            const val = typeof b[1] === 'string' ? parseCurrency(b[1]) : 0;
            return b[0].includes("Multa") ? a : a + val;
        }, 0);

        const sumCorrection = correctedItems.reduce((a: number, b: any) => a + (b.correctionInfo?.correctionAmount || 0), 0);
        const sumCorrected = correctedItems.reduce((a: number, b: any) => a + (b.correctionInfo?.correctedValue || 0), 0);
        const sumInterest = correctedItems.reduce((a: number, b: any) => a + (b.correctionInfo?.interestAmount || 0), 0);
        const sumFinal = correctedItems.reduce((a: number, b: any) => a + (b.valorTotal || 0), 0);

        const tableFoot = [
            [
                "TOTAL GERAL",
                formatCurrency(sumOriginal),
                formatCurrency(sumCorrection),
                formatCurrency(sumCorrected),
                formatCurrency(sumInterest),
                formatCurrency(sumFinal + fineValue)
            ]
        ];

        safeAutoTable(doc, {
            startY: currentY,
            head: tableHead,
            body: tableBody,
            foot: tableFoot,
            theme: 'striped',
            headStyles: { fillColor: COLOR_PRIMARY },
            footStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right', fontStyle: 'bold' }
            }
        });

    } else {
        // Original Simple Table
        tableHead = [["Competência", "Base de Cálculo", "Alíquota", "Valor Devido", "Status"]];
        tableBody = result.fgts.mensal.map(r => [
            r.competencia,
            formatCurrency(r.base),
            "8.00%",
            formatCurrency(r.valor),
            r.status
        ]);

        tableBody.push([
            "Multa Rescisória (40%)",
            formatCurrency(result.fgts.saldoParaFinsRescisorios),
            "40.00%",
            formatCurrency(result.fgts.multa40),
            "Multa"
        ]);

        const tableFoot = [
            ["TOTAL A RECEBER", "-", "-", formatCurrency(result.fgts.total + result.fgts.multa40), "-"]
        ];

        safeAutoTable(doc, {
            startY: currentY,
            head: tableHead,
            body: tableBody,
            foot: tableFoot,
            theme: 'striped',
            headStyles: { fillColor: COLOR_PRIMARY },
            footStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'center' },
                3: { halign: 'right', fontStyle: 'bold' },
                4: { halign: 'center' }
            }
        });
    }

    // Disclaimer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 15;

    const disclaimer = "Este é apenas um demonstrativo simples. Na fase de liquidação de sentença ou acordo, após indicação do juízo dos índices oficiais de correção monetária e juros, os mesmos serão atualizados.";

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont("helvetica", "italic");

    const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - (margin * 2));
    doc.text(splitDisclaimer, margin, currentY);

    doc.save(`fgts_memoria_${employeeName}.pdf`);
}
