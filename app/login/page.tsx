"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { LockKeyhole, Loader2 } from "lucide-react";

import Image from "next/image";

import logo from "./logo.png";

export default function LoginPage() {
    // ... existing state ...
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        // ...
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const success = await login(email, password);
            if (success) {
                router.push("/");
            } else {
                setError("Credenciais inválidas. Tente novamente.");
            }
        } catch (err) {
            console.error(err);
            setError("Erro ao tentar fazer login.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0F1C3F] via-[#233154] to-[#0F1C3F]">
            <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-xl border-t-4 border-t-[#D4AF37] shadow-2xl shadow-black/20">
                <div className="flex flex-col items-center text-center">
                    <div className="relative w-48 h-32 mb-4">
                        <img
                            src={logo.src}
                            alt="Brito & Santos Advocacia"
                            className="w-full h-full object-contain"
                        />
                    </div>

                    <div className="mt-4">
                        <h3 className="text-xl font-semibold text-[#0F1C3F]">Área Restrita</h3>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Acesso exclusivo para colaboradores</p>
                    </div>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-[#0F1C3F]/80 mb-1.5 ml-1">
                                Email Corporativo
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[#0F1C3F] placeholder-slate-400 shadow-sm focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37] transition-all sm:text-sm"
                                placeholder="nome@britoesantos.adv.br"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[#0F1C3F]/80 mb-1.5 ml-1">
                                Senha
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[#0F1C3F] placeholder-slate-400 shadow-sm focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37] transition-all sm:text-sm"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                            <span className="block w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative flex w-full justify-center rounded-lg bg-[#0F1C3F] px-3 py-3 text-sm font-semibold text-white hover:bg-[#233154] hover:shadow-lg hover:shadow-[#0F1C3F]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" />
                        ) : (
                            "ACESSAR SISTEMA"
                        )}
                    </button>

                    <div className="text-center pt-4">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                            &copy; {new Date().getFullYear()} Brito & Santos Advocacia
                        </p>
                    </div>
                </form>
            </div>
        </main>
    );
}
