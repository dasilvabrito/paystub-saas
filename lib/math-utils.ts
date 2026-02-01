
export const parseCurrency = (value: string | undefined): number => {
    if (!value) return 0;
    // Remove dots (thousands), replace comma with dot (decimal)
    // "2.069,08" -> "2069.08"
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
};

export const parseInfo = (value: string | undefined): number => {
    if (!value) return 0;
    // Extract first number found: "200.00" -> 200.00, "200.00h" -> 200.00
    const match = value.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
};

export const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const parseMesAno = (mesAno: string): Date | null => {
    try {
        const parts = mesAno.split('/');
        if (parts.length !== 2) return null;

        let month = parseInt(parts[0]);
        const year = parseInt(parts[1]);

        if (isNaN(month)) {
            const monthsShort = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
            const mStr = parts[0].substring(0, 3).toLowerCase();
            const idx = monthsShort.findIndex(m => m === mStr);
            if (idx !== -1) month = idx + 1;
            else return null;
        }

        return new Date(year, month - 1, 1);
    } catch {
        return null;
    }
};

export const detectMissingCompetencies = (mesAnos: string[]): string[] => {
    if (!mesAnos || mesAnos.length < 2) return [];

    // Valid dates only
    const dates = mesAnos
        .map(m => ({ original: m, date: parseMesAno(m) }))
        .filter(d => d.date !== null)
        .sort((a, b) => a.date!.getTime() - b.date!.getTime());

    if (dates.length < 2) return [];

    const missing: string[] = [];
    const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Iterate from first to last
    let current = new Date(dates[0].date!);
    const last = dates[dates.length - 1].date!;

    // Move to next month immediately to start checking gaps
    current.setMonth(current.getMonth() + 1);

    while (current < last) {
        // Check if 'current' exists in 'dates'
        // We compare Month and Year
        const found = dates.some(d =>
            d.date!.getMonth() === current.getMonth() &&
            d.date!.getFullYear() === current.getFullYear()
        );

        if (!found) {
            const mName = monthsShort[current.getMonth()];
            const y = current.getFullYear();
            missing.push(`${mName}/${y}`);
        }

        current.setMonth(current.getMonth() + 1);
    }

    return missing;
};
