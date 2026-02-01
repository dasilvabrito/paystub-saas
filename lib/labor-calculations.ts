
import { ExtractedData } from "./extractors";
import { parseCurrency } from "./math-utils";

export interface LaborCalculationResult {
    avisoPrevio: {
        dias: number;
        valor: number;
        reflexoFgts: number;
    };
    ferias: {
        valor: number; // Férias + 1/3
    };
    fgts: {
        depositos: number;
        total: number;
        multa40: number;
        saldoParaFinsRescisorios: number;
        mensal: {
            competencia: string;
            base: number;
            valor: number;
            status: string;
        }[];
    };
    totalGeral: number;
}

/**
 * Calculates Severance (Verbas Rescisórias) and FGTS.
 * 
 * @param data Filtered list of paystubs (already respecting prescription)
 * @param dataAdmissao Admission Date
 * @param dataDemissao Demission Date
 * @param ultimoSalarioBruto Manual override or auto-detected last gross salary
 */
export function calculateLaborRights(
    data: ExtractedData[],
    dataAdmissao: Date | null,
    dataDemissao: Date | null,
    ultimoSalarioBruto: number
): LaborCalculationResult {

    // 1. Aviso Prévio
    // Rule: 30 days + 3 days per completed year of service
    let diasAviso = 30;
    if (dataAdmissao && dataDemissao) {
        let anosCompletos = dataDemissao.getFullYear() - dataAdmissao.getFullYear();

        // Adjust if month/day hasn't passed yet in the final year
        const m = dataDemissao.getMonth() - dataAdmissao.getMonth();
        if (m < 0 || (m === 0 && dataDemissao.getDate() < dataAdmissao.getDate())) {
            anosCompletos--;
        }

        // Cap at 20 years usually? The law says "up to 60 additional days" -> max 90 days total.
        // 3 * 20 = 60 days extra. So max years to count is 20.
        const anosConsiderados = Math.max(0, Math.min(anosCompletos, 20));
        diasAviso += (3 * anosConsiderados);
    }

    const valorAviso = (ultimoSalarioBruto / 30) * diasAviso;
    const reflexoFgtsAviso = valorAviso * 0.08;

    // 2. Férias + 1/3 (User requested simplified * 1.3 rule)
    // Formula: Base Previdencia * 1.3
    const valorFerias = ultimoSalarioBruto * 1.3;

    // 3. FGTS (8% on monthly gross)
    let totalDepositosFgts = 0;
    const breakdown: { competencia: string; base: number; valor: number; status: string; }[] = [];

    data.forEach(row => {
        const vBase = parseCurrency(row.vencimentoBase?.valor);
        const gTit = parseCurrency(row.gratTitularidade);
        const gMag = parseCurrency(row.gratMagisterio);
        const gEsc = parseCurrency(row.gratEscolaridade);
        const aulas = parseCurrency(row.aulasSuplementares?.valor);

        // User requested: "para 'FGTS Total + Multa 40%' a base de calculo também é a 'Base Previdência'"
        // So for EACH month, we prioritize `basePrevidencia` if available.
        let mensalBruto = 0;
        if (row.basePrevidencia) {
            mensalBruto = parseCurrency(row.basePrevidencia);
        } else {
            // Fallback for older stubs or failures
            mensalBruto = vBase + aulas + gTit + gMag + gEsc;
        }

        const mensalFgts = mensalBruto * 0.08;

        totalDepositosFgts += mensalFgts;

        breakdown.push({
            competencia: row.mesAno || "N/D",
            base: mensalBruto,
            valor: mensalFgts,
            status: "Devido"
        });
    });

    // START CHANGE: User requested removing Reflexo s/ Aviso from FGTS calculation and fine base.
    // It remains in "Verbas Rescisórias" only.

    // FGTS Total = ONLY Deposits now
    const totalFgts = totalDepositosFgts;

    // Calculate Fine 40% on (Deposits ONLY)
    // "do calculo do fgts eu quero que vc tire 'Reflexo s/ Aviso Prévio'"
    const saldoParaFinsRescisorios = totalFgts;
    const multa40 = saldoParaFinsRescisorios * 0.4;

    // Total Geral must include the Fine AND the Reflexo (since we removed it from totalFgts but employee receives it)
    const totalGeral = valorAviso + valorFerias + reflexoFgtsAviso + totalFgts + multa40;

    return {
        avisoPrevio: {
            dias: diasAviso,
            valor: valorAviso,
            reflexoFgts: reflexoFgtsAviso
        },
        ferias: {
            valor: valorFerias
        },
        fgts: {
            depositos: totalDepositosFgts,
            total: totalFgts, // Now equals deposits
            multa40: multa40,
            saldoParaFinsRescisorios: saldoParaFinsRescisorios,
            mensal: breakdown
        },
        totalGeral: totalGeral // Includes Multa + Reflexo explicitly
    };
}
