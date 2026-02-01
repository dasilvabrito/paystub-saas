"use client";

import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

// We need to set the worker source. 
// For a Next.js static export, the best way is to use the CDN or a local file.
// Using CDN is easiest for now.
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

export async function extractTextFromPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();

    try {
        const pdf = await getDocument(arrayBuffer).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // NEW LOGIC: Reconstruct lines based on Y-coordinate
            const items = textContent.items.map((item: any) => ({
                str: item.str,
                x: item.transform[4], // x coordinate
                y: item.transform[5], // y coordinate (0,0 is bottom-left usually)
                w: item.width,
                h: item.height
            }));

            // 1. Sort by Y descending (top to bottom) to roughly group lines
            // Note: We'll refine this grouping below because sort isn't enough for fuzzy Y
            items.sort((a, b) => b.y - a.y);

            const lines: typeof items[] = [];
            let currentLine: typeof items = [];
            let currentLineY = -1;

            // 2. Group items into lines with tolerance
            for (const item of items) {
                if (currentLine.length === 0) {
                    currentLine.push(item);
                    currentLineY = item.y;
                    continue;
                }

                // Tolerance of 5 units for "same line"
                if (Math.abs(item.y - currentLineY) < 5) {
                    currentLine.push(item);
                } else {
                    // New line detected
                    lines.push(currentLine);
                    currentLine = [item];
                    currentLineY = item.y;
                }
            }
            if (currentLine.length > 0) lines.push(currentLine);

            // 3. Sort each line by X ascending (left to right) and join
            let pageText = "";
            for (const line of lines) {
                line.sort((a, b) => a.x - b.x);
                const lineStr = line.map(i => i.str).join(' ');
                pageText += lineStr + "\n";
            }

            fullText += pageText + "\n";
        }

        return fullText;
    } catch (error) {
        console.error("Error extracting PDF text client-side:", error);
        throw new Error("Failed to parse PDF file.");
    }
}
