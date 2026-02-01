"use client";

import { useState, useCallback } from "react";
import { UploadCloud, FileText, Loader2, Files } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
    onFilesSelect: (files: File[]) => void;
    isProcessing: boolean;
}

export function FileUpload({ onFilesSelect, isProcessing }: FileUploadProps) {
    const [dragActive, setDragActive] = useState(false);
    const [fileCount, setFileCount] = useState<number>(0);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const processFiles = (fileList: FileList | null) => {
        if (!fileList) return;
        const validFiles: File[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            if (file.type === "application/pdf") {
                validFiles.push(file);
            }
        }

        if (validFiles.length > 0) {
            setFileCount(validFiles.length);
            onFilesSelect(validFiles);
        } else {
            alert("Por favor, envie apenas arquivos PDF.");
        }
    };

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
            processFiles(e.dataTransfer.files);
        },
        [onFilesSelect]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        processFiles(e.target.files);
    };

    return (
        <div
            className={cn(
                "relative rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 p-8 transition-all hover:bg-zinc-900/80 w-full max-w-xl mx-auto",
                dragActive && "border-primary bg-primary/10",
                isProcessing && "opacity-50 cursor-not-allowed"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <input
                id="file-upload"
                type="file"
                multiple
                className="absolute inset-0 cursor-pointer opacity-0 z-50"
                accept="application/pdf"
                onChange={handleChange}
                disabled={isProcessing}
            />

            <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="rounded-full bg-zinc-800 p-4">
                    {isProcessing ? (
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    ) : fileCount > 0 ? (
                        <Files className="h-8 w-8 text-primary" />
                    ) : (
                        <UploadCloud className="h-8 w-8 text-zinc-400" />
                    )}
                </div>

                <div className="space-y-1">
                    {fileCount > 0 ? (
                        <p className="text-sm font-medium text-zinc-300">
                            <span className="text-white">{fileCount}</span> arquivos selecionados
                        </p>
                    ) : (
                        <>
                            <p className="text-lg font-medium text-white">
                                Arraste seus contracheques aqui
                            </p>
                            <p className="text-sm text-zinc-400">
                                PDFs Individuais ou em Lote
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
