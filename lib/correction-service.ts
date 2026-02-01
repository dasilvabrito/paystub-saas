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

// SELIC (Accumulated Monthly %) - Source: Receita Federal / BCB
// Expanded to cover 5 years (Prescription period)
const SELIC_TABLE: Record<string, number> = {
    // 2025 (Projected/Real)
    "2025-01": 0.90, "2025-02": 0.85,
    // 2024
    "2024-12": 0.88, "2024-11": 0.80, "2024-10": 0.93, "2024-09": 0.84,
    "2024-08": 0.87, "2024-07": 0.91, "2024-06": 0.79, "2024-05": 0.83, "2024-04": 0.89,
    "2024-03": 0.83, "2024-02": 0.80, "2024-01": 0.97,
    // 2023
    "2023-12": 0.89, "2023-11": 0.92, "2023-10": 1.00, "2023-09": 0.97, "2023-08": 1.14,
    "2023-07": 1.07, "2023-06": 1.07, "2023-05": 1.12, "2023-04": 0.92, "2023-03": 1.17,
    "2023-02": 0.92, "2023-01": 1.12,
    // 2022
    "2022-12": 1.12, "2022-11": 1.02, "2022-10": 1.02, "2022-09": 1.07, "2022-08": 1.17,
    "2022-07": 1.03, "2022-06": 1.02, "2022-05": 1.03, "2022-04": 0.83, "2022-03": 0.93,
    "2022-02": 0.76, "2022-01": 0.73,
    // 2021
    "2021-12": 0.77, "2021-11": 0.59, "2021-10": 0.49, "2021-09": 0.44, "2021-08": 0.43,
    "2021-07": 0.36, "2021-06": 0.31, "2021-05": 0.27, "2021-04": 0.21, "2021-03": 0.20,
    "2021-02": 0.13, "2021-01": 0.15,
    // 2020
    "2020-12": 0.16, "2020-11": 0.15, "2020-10": 0.16, "2020-09": 0.16, "2020-08": 0.16,
    "2020-07": 0.19, "2020-06": 0.21, "2020-05": 0.24, "2020-04": 0.28, "2020-03": 0.34,
    "2020-02": 0.29, "2020-01": 0.38
};

// IPCA-E / INPC (Simplified Samples)
const IPCA_TABLE: Record<string, number> = {
    "2024-12": 0.50, "2024-11": 0.30, "2024-10": 0.50, "2024-09": 0.40, "2024-08": 0.20,
    "2024-07": 0.40, "2024-06": 0.21, "2024-05": 0.46, "2024-04": 0.38, "2024-03": 0.16,
    // Fallback for others
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

        // Logic: Start from the month FOLLOWING the due date, OR pro-rata?
        // Standard Simplification: If due date is 10/04/2021, correction starts 01/05/2021 for monthly indices.
        // Some systems use daily pro-rata for SELIC.
        // Here we stick to Monthly Accumulation for stability.

        const currentIter = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
        const endIter = new Date(calcDate.getFullYear(), calcDate.getMonth(), 1);

        // Advance to next month to begin index accumulation
        currentIter.setMonth(currentIter.getMonth() + 1);

        while (currentIter <= endIter) {
            const y = currentIter.getFullYear();
            const m = (currentIter.getMonth() + 1).toString().padStart(2, '0');
            const key = `${y}-${m}`;

            let rate = 0;
            if (correctionType === 'SELIC') {
                rate = SELIC_TABLE[key] || 0.5; // Fallback 0.5%
            } else {
                rate = IPCA_TABLE[key] || 0.3; // Fallback 0.3%
            }

            accumulatedIndex += rate;
            currentIter.setMonth(currentIter.getMonth() + 1);
        }

        const correctionFactor = accumulatedIndex / 100;
        const correctionAmount = originalValue * correctionFactor;
        const correctedPrincipal = originalValue + correctionAmount;

        // 2. Calculate Interest
        // ----------------------------------------------------
        // Rule: Juros acumulados a partir da DATA DE VENCIMENTO acumulativamente (Simple Accumulation)
        // Formula: Days * (Rate / 30)

        let interestAmount = 0;
        let interestTotalRate = 0;
        let diffDays = 0;

        if (interestType !== 'NONE') {
            // Ensure we don't calculate interest for future dates
            if (calcDate > dueDate) {
                const diffTime = Math.abs(calcDate.getTime() - dueDate.getTime());
                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Rate determination
                let annualRate = 0;
                if (interestType === '1%_SIMPLE') annualRate = 12.0; // 1% per month = 12% year
                if (interestType === '0.5%_SIMPLE') annualRate = 6.0;

                // Daily Rate (Simple) = Monthly / 30
                const dailyRate = (annualRate / 12) / 30;

                // Total Rate = Days * DailyRate
                interestTotalRate = (diffDays * dailyRate) / 100;

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
