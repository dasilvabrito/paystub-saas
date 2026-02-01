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

            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');

            fullText += pageText + "\n";
        }

        return fullText;
    } catch (error) {
        console.error("Error extracting PDF text client-side:", error);
        throw new Error("Failed to parse PDF file.");
    }
}
