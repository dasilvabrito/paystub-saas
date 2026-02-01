// lib/correction-service.ts

export type CorrectionIndexType = 'SELIC' | 'IPCA-E' | 'INPC';
export type InterestType = 'NONE' | '1%_SIMPLE' | '0.5%_SIMPLE';

interface IndexData {
    date: string; // YYYY-MM
    value: number; // Percentage (e.g., 1.0 for 1%)
}

// ------------------------------------------------------------------
// DATA TABLES (Simplified for Portability - Real app would allow CSV upload or API)
// ------------------------------------------------------------------

// SELIC (Accumulated Monthly)
const SELIC_TABLE: Record<string, number> = {
    "2025-01": 0.90, "2024-12": 0.88, "2024-11": 0.80, "2024-10": 0.93, "2024-09": 0.84,
    "2024-08": 0.87, "2024-07": 0.91, "2024-06": 0.79, "2024-05": 0.83, "2024-04": 0.89,
    "2024-03": 0.83, "2024-02": 0.80, "2024-01": 0.97, "2023-12": 0.89, "2023-11": 0.92,
    "2023-10": 1.00, "2023-09": 0.97, "2023-08": 1.14, "2023-07": 1.07, "2023-06": 1.07,
    "2023-05": 1.12, "2023-04": 0.92, "2023-03": 1.17, "2023-02": 0.92, "2023-01": 1.12,
    "2022-12": 1.12, "2022-11": 1.02, "2022-10": 1.02, "2022-09": 1.07, "2022-08": 1.17,
    "2022-07": 1.03, "2022-06": 1.02, "2022-05": 1.03, "2022-04": 0.83, "2022-03": 0.93,
    "2022-02": 0.76, "2022-01": 0.73
};

// IPCA-E (Estimates/Samples for fallback)
const IPCA_E_TABLE: Record<string, number> = {
    // 2024
    "2024-12": 0.50, "2024-11": 0.30, "2024-10": 0.50, "2024-09": 0.40,
    "2024-08": 0.20, "2024-07": 0.40, "2024-06": 0.21, "2024-05": 0.46,
    // ... Older values generic fallback
};

// INPC
const INPC_TABLE: Record<string, number> = {
    // 2024
    "2024-12": 0.60, "2024-11": 0.40,
};

export interface CorrectionResult {
    originalValue: number;
    correctedValue: number; // Principal + Correction
    correctionAmount: number; // Only the correction part
    interestAmount: number; // Only the interest part
    totalValue: number; // Principal + Correction + Interest
    correctionFactor: number; // Accumulated %
    interestFactor: number; // Accumulated %
    details: {
        correctionIndex: CorrectionIndexType;
        interestType: InterestType;
        daysElapsed?: number;
    }
}

export class CorrectionService {

    /**
     * Calculates Correction AND Interest
     */
    static calculate(
        originalValue: number,
        dueDate: Date,
        correctionType: CorrectionIndexType,
        interestType: InterestType,
        calcDate: Date = new Date()
    ): CorrectionResult {

        if (!dueDate || !originalValue) {
            return this.emptyResult();
        }

        // 1. Calculate Monetary Correction (Index Adjustment)
        // -------------------------------------------------
        let accumulatedIndex = 0;
        const currentIter = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
        const endIter = new Date(calcDate.getFullYear(), calcDate.getMonth(), 1);

        // Move to NEXT month to start correcting? 
        // Typically correction starts month following due date OR pro-rata?
        // Simpler: Start strictly next month.
        currentIter.setMonth(currentIter.getMonth() + 1);

        while (currentIter <= endIter) {
            const y = currentIter.getFullYear();
            const m = (currentIter.getMonth() + 1).toString().padStart(2, '0');
            const key = `${y}-${m}`;

            let rate = 0;
            if (correctionType === 'SELIC') {
                rate = SELIC_TABLE[key] || 0.8; // Fallback 0.8%
            } else if (correctionType === 'IPCA-E') {
                rate = IPCA_E_TABLE[key] || 0.4; // Fallback 0.4%
            } else if (correctionType === 'INPC') {
                rate = INPC_TABLE[key] || 0.4; // Fallback 0.4%
            }

            accumulatedIndex += rate;
            currentIter.setMonth(currentIter.getMonth() + 1);
        }

        const correctionFactor = accumulatedIndex / 100;
        const correctionAmount = originalValue * correctionFactor;
        const correctedPrincipal = originalValue + correctionAmount;

        // 2. Calculate Interest
        // ----------------------------------------------------
        // Rule: Juros acumulados a partir da DATA DE VENCIMENTO (User Requirement)
        // Note: Standard Labor Law is often "Ajuizamento", but user enforced "Vencimento".

        let interestAmount = 0;
        let interestTotalRate = 0;
        let diffDays = 0;

        if (interestType !== 'NONE') {
            // Ensure we don't calculate interest for future dates
            if (calcDate > dueDate) {
                const diffTime = Math.abs(calcDate.getTime() - dueDate.getTime());
                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const diffMonths = diffDays / 30; // Standard Commercial Month (30 days)

                let interestRatePerMonth = 0.0;
                if (interestType === '1%_SIMPLE') interestRatePerMonth = 1.0;
                if (interestType === '0.5%_SIMPLE') interestRatePerMonth = 0.5;

                // Simple Interest: Principal * Rate * Time
                interestTotalRate = (interestRatePerMonth * diffMonths) / 100;

                // Interest applied on CORRECTED Principal (Súmula 200 TST)
                interestAmount = correctedPrincipal * interestTotalRate;
            }
        }

        return {
            originalValue,
            correctedValue: correctedPrincipal,
            correctionAmount,
            interestAmount,
            totalValue: correctedPrincipal + interestAmount,
            correctionFactor: accumulatedIndex, // Display as %
            interestFactor: interestTotalRate * 100, // Display as %
            details: {
                correctionIndex: correctionType,
                interestType,
                daysElapsed: diffDays
            }
        };
    }

    private static emptyResult(): CorrectionResult {
        return {
            originalValue: 0,
            correctedValue: 0,
            correctionAmount: 0,
            interestAmount: 0,
            totalValue: 0,
            correctionFactor: 0,
            interestFactor: 0,
            details: { correctionIndex: 'SELIC', interestType: 'NONE' }
        };
    }
}
