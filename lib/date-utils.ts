export function isBusinessDay(date: Date): boolean {
    const day = date.getDay();
    // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) return false;

    // Very simple holiday check for fixed national holidays could be added here
    // For now, focusing on weekends is the standard "lite" approach
    return true;
}

export function getNextMonthDate(date: Date, day: number): Date {
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, day);
    return nextMonth;
}

export function getFifthDayNextMonth(date: Date): Date {
    return getNextMonthDate(date, 5);
}

export function getEighthDayNextMonth(date: Date): Date {
    return getNextMonthDate(date, 8);
}

export function getTenthBusinessDayNextMonth(date: Date): Date {
    let current = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    let businessDaysCount = 0;

    while (businessDaysCount < 10) {
        if (isBusinessDay(current)) {
            businessDaysCount++;
        }
        if (businessDaysCount < 10) {
            current.setDate(current.getDate() + 1);
        }
    }
    return current;
}
