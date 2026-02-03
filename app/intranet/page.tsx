"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut, Calculator, Archive, Settings, ArrowRight, User } from "lucide-react";
import Link from "next/link";

export default function IntranetHub() {
    const { user, isLoading, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/login");
        }
    }, [isLoading, user, router]);

    if (isLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
                <div className="animate-pulse">Carregando...</div>
            </div>
        );
    }

    const cards = [
        {
            title: "Cálculos Trabalhistas",
            description: "Análise de contracheques, rescisões e auditoria completa.",
            icon: Calculator,
            href: "/intranet/ferramenta",
            color: "text-blue-400",
            bg: "bg-blue-400/10",
        },
        {
            title: "Arquivos Jurídicos",
            description: "Repositório de modelos e documentos do escritório.",
            icon: Archive,
            href: "#",
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
            disabled: true,
            status: "Em Breve"
        },
        {
            title: "Configurações",
            description: "Gerenciar usuários e preferências do sistema.",
            icon: Settings,
            href: "#",
            color: "text-zinc-400",
            bg: "bg-zinc-400/10",
            disabled: true,
        },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground relative">
            {/* Navbar */}
            <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-[#D4AF37] font-serif font-bold">
                            B
                        </div>
                        <h1 className="font-serif font-bold text-lg text-primary tracking-tight">
                            Brito & Santos <span className="text-accent font-sans text-xs uppercase tracking-widest ml-1">Intranet</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full bg-secondary/10 border border-secondary/20">
                            <User className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium text-primary">{user.name}</span>
                        </div>

                        <button
                            onClick={logout}
                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                            title="Sair"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 py-12">
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-primary mb-2">Bem-vindo(a), {user.name.split(' ')[0]}</h2>
                    <p className="text-muted-foreground">Selecione uma ferramenta. O que vamos fazer hoje?</p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card, index) => (
                        <div key={index} className="relative group">
                            <Link
                                href={card.href}
                                className={`block h-full p-6 rounded-xl border border-border bg-card hover:border-accent/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 ${card.disabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                            >
                                <div className={`w-12 h-12 rounded-lg ${card.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                    <card.icon className={`h-6 w-6 ${card.color}`} />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-lg text-primary group-hover:text-accent transition-colors">
                                            {card.title}
                                        </h3>
                                        {card.status && (
                                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                                {card.status}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {card.description}
                                    </p>
                                </div>

                                {!card.disabled && (
                                    <div className="absolute bottom-6 right-6 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                        <ArrowRight className="h-5 w-5 text-accent" />
                                    </div>
                                )}
                            </Link>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
