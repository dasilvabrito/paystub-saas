import { parseCurrency, formatCurrency } from './math-utils';

export interface ExtractedData {
    fileName?: string;
    error?: string;
    nome?: string;
    idFuncional?: string;
    mesAno?: string;
    vencimentoBase?: { info: string; valor: string };
    aulasSuplementares?: { info: string; valor: string };
    gratTitularidade?: string;
    gratMagisterio?: string;
    gratEscolaridade?: string;
    warnings?: string[];
    uiWarnings?: string[];
    vinculo?: string;
    basePrevidencia?: string;
    tipoFolha?: string;
}

export function extractPaystubData(text: string): ExtractedData {
    const data: ExtractedData = {};
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Default to "NORMAL" usually, unless "13º" or "Férias" is found in header
    // We try to detect it.

    // Sum accumulators
    let sumVencBase = 0;
    let sumAulasSupl = 0;
    let sumGratTit = 0;
    let sumGratMag = 0;
    let sumGratEsc = 0;

    // Counters for warning generation
    let countVencBase = 0;
    let countAulasSupl = 0;
    let countGratTit = 0;
    let countGratMag = 0;
    let countGratEsc = 0;

    // Info keepers (keep first found)
    let infoVencBase = "";
    let infoAulasSupl = "";

    // Regex to match currency (e.g., 2.069,08)
    const currencyRegex = /(\d{1,3}(?:\.\d{3})*,\d{2})/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Mês/Ano (Look for "Referência" or generic MM/YYYY)
        if (!data.mesAno && /Referência/.test(line)) {
            const match = line.match(/\b((?:0[1-9]|1[0-2])\/20\d{2})\b/);
            if (match) data.mesAno = match[1];
        } else if (!data.mesAno && /Folha Normal -/.test(line)) {
            // Fallback for "Folha Normal - Jan/2021"
            const match = line.match(/(?:Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/\d{4}/i);
            // Verify if user wants MonthName/Year or MM/YYYY. Let's keep the raw string for now if MM/YYYY fails.
            if (match) data.mesAno = match[0];
        }

        // Identify TIPO FOLHA
        // "Folha Normal", "13º Salário", "Férias"
        if (!data.tipoFolha) {
            if (line.toUpperCase().includes("FOLHA NORMAL")) data.tipoFolha = "NORMAL";
            else if (line.toUpperCase().includes("13º") || line.toUpperCase().includes("DÉCIMO")) data.tipoFolha = "DECIMO";
            else if (line.toUpperCase().includes("FÉRIAS")) data.tipoFolha = "FERIAS";
        }

        // 2. Nome do Servidor
        // Pattern: Line "Nome" -> Next line is the name
        if (!data.nome && line === 'Nome') {
            if (lines[i + 1]) {
                data.nome = lines[i + 1];
            }
        }

        // 3. ID Funcional
        // Pattern: "57213134/1" appearing near "ID Funcional"
        if (!data.idFuncional && /ID Funcional/.test(line)) {
            // Sometimes it's on the same line or next. 
            // In the raw text: "ID FuncionalMês/Ano" (merged) -> Next line "57213134/1Folha Normal..."
            // Let's look for the ID pattern directly if we see the label nearby.
            // Pattern: Digits/Digit
            const idMatch = lines[i + 1]?.match(/(\d+\/\d)/);
            if (idMatch) data.idFuncional = idMatch[1];
        }

        // 3b. Vínculo / Cargo
        // Often near "Tipo de Vínculo" or "Vínculo"
        if (!data.vinculo && (line.includes("Tipo de Vínculo") || line.includes("Vínculo") || line.includes("Cargo"))) {
            // Check current line and next few lines for keywords
            const context = [line, lines[i + 1], lines[i + 2]].join(" ").toUpperCase();

            if (context.includes("EFETIVO")) {
                data.vinculo = "EFETIVO";
            } else if (context.includes("CONTRATO TEMPORARIO") || context.includes("TEMPORÁRIO")) {
                data.vinculo = "CONTRATO TEMPORÁRIO";
            }
        }
        // global fallback check if we missed the label but the word exists
        if (!data.vinculo) {
            const textUpper = text.toUpperCase();
            if (textUpper.includes("TIPO DE VÍNCULO EFETIVO") || textUpper.includes("VÍNCULO: EFETIVO")) data.vinculo = "EFETIVO";
            else if (textUpper.includes("CONTRATO TEMPORARIO")) data.vinculo = "CONTRATO TEMPORÁRIO";
        }

        // 4. Vencimento Base
        // Line: "1Vencimento Base200.001/2021***********2.069,08"
        // Description: "Vencimento Base", Info: "200.00", Value: "2.069,08"
        if (line.includes('Vencimento Base')) {
            const parts = extractLineParts(line, 'Vencimento Base');
            if (parts) {
                sumVencBase += parseCurrency(parts.valor);
                countVencBase++;
                // Keep the first valid info we find
                if (!infoVencBase && parts.info) infoVencBase = parts.info;
            }
        }

        // 5. Aulas Suplementares
        // Line: "20Aulas Suplementares60.001/2021*************620,72"
        if (line.includes('Aulas Suplementares')) {
            const parts = extractLineParts(line, 'Aulas Suplementares');
            if (parts) {
                sumAulasSupl += parseCurrency(parts.valor);
                countAulasSupl++;
                if (!infoAulasSupl && parts.info) infoAulasSupl = parts.info;
            }
        }

        // 6. Grat. Titularidade
        if (line.includes('Grat Titularidade')) {
            const val = extractLastValue(line);
            if (val) {
                sumGratTit += parseCurrency(val);
                countGratTit++;
            }
        }

        // 7. Grat. Magistério
        if (line.includes('Grat Magistério')) {
            const val = extractLastValue(line);
            if (val) {
                sumGratMag += parseCurrency(val);
                countGratMag++;
            }
        }

        // 8. Grat. Escolaridade
        if (line.includes('Grat Escolaridade')) {
            const val = extractLastValue(line);
            if (val) {
                sumGratEsc += parseCurrency(val);
                countGratEsc++;
            }
        }

        // 9. Base Previdência (Usually at the bottom footer)
        // Pattern: "Base Previd. 2.500,00" or similar
        // We look for "Base Previdência" or "Base Previd"
        if (!data.basePrevidencia && (line.includes('Base Previdência') || line.includes('Base Previd'))) {
            // Try to find on same line first
            let val = extractLastValue(line);

            // If not found, checks the NEXT line (common in some PDFs)
            if (!val && i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                // The value might be the FIRST currency on the next line if the header is first column
                // Example: ************6.186,54...
                const match = nextLine.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
                if (match) {
                    val = match[1];
                }
            }

            if (val) {
                data.basePrevidencia = val;
            }
        }
    }

    // Populate data object with formatted sums if they are > 0
    if (sumVencBase > 0 || infoVencBase) {
        data.vencimentoBase = {
            info: infoVencBase,
            valor: formatCurrency(sumVencBase)
        };
    }

    if (sumAulasSupl > 0 || infoAulasSupl) {
        data.aulasSuplementares = {
            info: infoAulasSupl,
            valor: formatCurrency(sumAulasSupl)
        };
    }

    if (sumGratTit > 0) data.gratTitularidade = formatCurrency(sumGratTit);
    if (sumGratMag > 0) data.gratMagisterio = formatCurrency(sumGratMag);
    if (sumGratEsc > 0) data.gratEscolaridade = formatCurrency(sumGratEsc);

    // Warning Tags for Duplicates
    data.warnings = [];
    if (countVencBase > 1) data.warnings.push("Vencimento Base (Soma)");
    if (countAulasSupl > 1) data.warnings.push("Aulas Supl. (Soma)");
    if (countGratTit > 1) data.warnings.push("Grat. Titularidade (Soma)");
    if (countGratMag > 1) data.warnings.push("Grat. Magistério (Soma)");
    if (countGratEsc > 1) data.warnings.push("Grat. Escolaridade (Soma)");

    return data;
}

function extractLastValue(line: string): string | undefined {
    // Matches the last currency value in the line
    const matches = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/g);
    // CHANGED: We want the FIRST value (Credit) not the last (Discount)
    // Assuming Credit is always the first monetary column.
    return matches ? matches[0] : undefined;
}

function extractLineParts(line: string, keyword: string): { info: string, valor: string } | undefined {
    // Keyword usually defines start. Value is at end.
    // Info is what's in between keyword and value (stripping * and MM/YYYY if needed)

    // 1. Get Value (CHANGED to First)
    const valor = extractLastValue(line);
    if (!valor) return undefined;

    // 2. Remove Value from line
    let temp = line.replace(valor, '');

    // 3. Find keyword index
    const keyIndex = temp.indexOf(keyword);
    if (keyIndex === -1) return undefined;

    // 4. Extract text after keyword
    // "1Vencimento Base200.001/2021***********" -> "200.001/2021***********"
    let infoRaw = temp.substring(keyIndex + keyword.length);

    // 5. Clean up junk (stars, dates)
    // "200.001/2021***********" -> "200.00"
    // Usually "Info" is the first number/text after keyword
    // Let's split by MM/YYYY or just take the first number chunk

    // Remove stars
    infoRaw = infoRaw.replace(/\*/g, '');

    // Remove Date (MM/YYYY)
    infoRaw = infoRaw.replace(/\d{2}\/\d{4}/, '');

    return {
        info: infoRaw.trim(),
        valor: valor
    };
}
