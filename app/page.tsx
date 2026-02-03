"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Scale, Shield, Users, Phone, Clock, MapPin, ChevronRight, Menu, X } from "lucide-react";
import { useState } from "react";
// Actually, if it's in public, we can just use string "/logo.png" BUT next/image prefers static import for size info.
// However, since we just moved it, let's use the string path for safety or try to import if Nextjs config allows.
// Let's use standard string path for public directory assets to avoid build errors if the file move wasn't perfect yet.
// We will use "/logo.png"

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    message: ""
  });
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setStatus("idle");

    try {
      const emailjs = (await import("@emailjs/browser")).default;

      await emailjs.send(
        "service_pcfa8wn",
        "template_bw6oqds",
        {
          from_name: formData.name,
          from_email: formData.email,
          phone: formData.phone,
          message: formData.message,
          to_email: "dasilvabrito@gmail.com, rosangelalima@hotmail.com"
        },
        "NCsmDEXf7GZyTYJtj"
      );

      setStatus("success");
      setFormData({ name: "", phone: "", email: "", message: "" });
      setTimeout(() => setStatus("idle"), 5000);
    } catch (error) {
      console.error("FAILED...", error);
      setStatus("error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#D4AF37] selection:text-white">

      {/* Navigation */}
      <nav className="fixed w-full bg-white/90 backdrop-blur-md border-b border-slate-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-3">
              <div className="relative h-10 w-10 md:h-12 md:w-12">
                <Image
                  src="/logo.png"
                  alt="Brito & Santos Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl md:text-2xl font-serif font-bold text-[#0F1C3F] leading-none">
                  Brito & Santos
                </span>
                <span className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-[#D4AF37] font-medium">
                  Advocacia
                </span>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#inicio" className="text-sm font-medium text-slate-600 hover:text-[#0F1C3F] transition-colors">Início</a>
              <a href="#atuacao" className="text-sm font-medium text-slate-600 hover:text-[#0F1C3F] transition-colors">Áreas de Atuação</a>
              <a href="#escritorio" className="text-sm font-medium text-slate-600 hover:text-[#0F1C3F] transition-colors">O Escritório</a>
              <a href="#contato" className="text-sm font-medium text-slate-600 hover:text-[#0F1C3F] transition-colors">Contato</a>

              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-2 border border-[#0F1C3F] text-sm font-medium rounded-full text-[#0F1C3F] hover:bg-[#0F1C3F] hover:text-[#D4AF37] transition-all duration-300"
              >
                Área do Cliente
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-slate-600 hover:text-[#0F1C3F] p-2"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 w-full bg-white border-b border-slate-100 shadow-xl py-4 flex flex-col items-center space-y-4 animate-in slide-in-from-top-4">
            <a href="#inicio" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-slate-800">Início</a>
            <a href="#atuacao" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-slate-800">Áreas de Atuação</a>
            <a href="#escritorio" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-slate-800">O Escritório</a>
            <a href="#contato" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-slate-800">Contato</a>
            <Link
              href="/login"
              className="px-8 py-3 bg-[#0F1C3F] text-[#D4AF37] text-sm font-semibold rounded-full"
              onClick={() => setIsMenuOpen(false)}
            >
              Área do Cliente
            </Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="inicio" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-slate-50 rounded-full blur-3xl opacity-60 -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-[#0F1C3F] leading-tight mb-6">
              Excelência Jurídica <br />
              <span className="relative">
                <span className="relative z-10">com Tradição.</span>
                <span className="absolute bottom-2 left-0 w-full h-3 bg-[#D4AF37]/20 -z-0"></span>
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl">
              Defendemos seus interesses com estratégia, ética e comprometimento.
              Especialistas em Direito Trabalhista, Civil e Empresarial.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#contato"
                className="inline-flex items-center justify-center px-8 py-4 bg-[#0F1C3F] text-white font-semibold rounded-full hover:bg-[#1a2b5e] transition-transform hover:scale-105 shadow-lg shadow-[#0F1C3F]/20"
              >
                Agendar Consulta
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a
                href="#atuacao"
                className="inline-flex items-center justify-center px-8 py-4 bg-white border border-slate-200 text-[#0F1C3F] font-semibold rounded-full hover:bg-slate-50 transition-colors"
              >
                Conheça Nossas Áreas
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats / Trust Banner */}
      <div className="border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-serif font-bold text-[#0F1C3F]">+5</p>
              <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mt-1">Anos de Experiência</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-serif font-bold text-[#0F1C3F]">+500</p>
              <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mt-1">Clientes Atendidos</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-serif font-bold text-[#0F1C3F]">98%</p>
              <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mt-1">Clientes Satisfeitos</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-serif font-bold text-[#0F1C3F]">24h</p>
              <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mt-1">Atendimento Urgente</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Section */}
      <section id="atuacao" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#D4AF37] mb-2">Expertise Jurídica</h2>
            <h3 className="text-3xl md:text-4xl font-serif font-bold text-[#0F1C3F]">Áreas de Atuação</h3>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            <div className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-[#D4AF37]/30 hover:shadow-xl hover:shadow-[#0F1C3F]/5 transition-all duration-300">
              <div className="h-12 w-12 bg-[#0F1C3F]/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#0F1C3F] transition-colors duration-300">
                <Users className="h-6 w-6 text-[#0F1C3F] group-hover:text-[#D4AF37] transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-[#0F1C3F] mb-2">Trabalhista</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Defesa dos direitos de trabalhadores e empresas, cálculos rescisórios e consultoria preventiva.
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-[#D4AF37]/30 hover:shadow-xl hover:shadow-[#0F1C3F]/5 transition-all duration-300">
              <div className="h-12 w-12 bg-[#0F1C3F]/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#0F1C3F] transition-colors duration-300">
                <Scale className="h-6 w-6 text-[#0F1C3F] group-hover:text-[#D4AF37] transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-[#0F1C3F] mb-2">Civil</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Atuação em contratos, responsabilidade civil, regularização de imóveis e indenizações.
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-[#D4AF37]/30 hover:shadow-xl hover:shadow-[#0F1C3F]/5 transition-all duration-300">
              <div className="h-12 w-12 bg-[#0F1C3F]/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#0F1C3F] transition-colors duration-300">
                <Shield className="h-6 w-6 text-[#0F1C3F] group-hover:text-[#D4AF37] transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-[#0F1C3F] mb-2">Consumidor</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Defesa contra práticas abusivas, revisão de contratos e problemas com fornecedores.
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-[#D4AF37]/30 hover:shadow-xl hover:shadow-[#0F1C3F]/5 transition-all duration-300">
              <div className="h-12 w-12 bg-[#0F1C3F]/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#0F1C3F] transition-colors duration-300">
                <Scale className="h-6 w-6 text-[#0F1C3F] group-hover:text-[#D4AF37] transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-[#0F1C3F] mb-2">Bancário</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Revisão de juros abusivos, defesa em execuções e negociação de dívidas.
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-[#D4AF37]/30 hover:shadow-xl hover:shadow-[#0F1C3F]/5 transition-all duration-300">
              <div className="h-12 w-12 bg-[#0F1C3F]/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#0F1C3F] transition-colors duration-300">
                <Users className="h-6 w-6 text-[#0F1C3F] group-hover:text-[#D4AF37] transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-[#0F1C3F] mb-2">Previdenciário</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Aposentadorias, benefícios, revisões e planejamento previdenciário.
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-[#D4AF37]/30 hover:shadow-xl hover:shadow-[#0F1C3F]/5 transition-all duration-300">
              <div className="h-12 w-12 bg-[#0F1C3F]/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#0F1C3F] transition-colors duration-300">
                <Shield className="h-6 w-6 text-[#0F1C3F] group-hover:text-[#D4AF37] transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-[#0F1C3F] mb-2">Sucessões</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Inventários, testamentos e planejamento sucessório familiar e empresarial.
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-[#D4AF37]/30 hover:shadow-xl hover:shadow-[#0F1C3F]/5 transition-all duration-300">
              <div className="h-12 w-12 bg-[#0F1C3F]/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#0F1C3F] transition-colors duration-300">
                <Scale className="h-6 w-6 text-[#0F1C3F] group-hover:text-[#D4AF37] transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-[#0F1C3F] mb-2">Criminal</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Atuação em inquéritos e processos criminais, com defesa técnica e especializada.
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-[#D4AF37]/30 hover:shadow-xl hover:shadow-[#0F1C3F]/5 transition-all duration-300">
              <div className="h-12 w-12 bg-[#0F1C3F]/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#0F1C3F] transition-colors duration-300">
                <Shield className="h-6 w-6 text-[#0F1C3F] group-hover:text-[#D4AF37] transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-[#0F1C3F] mb-2">Administrativo</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Defesa de servidores públicos, licitações e contratos com a administração.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="escritorio" className="py-24 bg-[#0F1C3F] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#D4AF37] mb-2">Quem Somos</h2>
              <h3 className="text-3xl md:text-4xl font-serif font-bold mb-6">Compromisso com <br /> a Justiça e a Verdade</h3>
              <p className="text-slate-300 leading-relaxed mb-6 text-lg">
                Fundado com a missão de oferecer advocacia de alta performance, o escritório Brito & Santos se destaca pelo atendimento personalizado e pela busca incessante pela melhor solução jurídica para cada cliente.
              </p>
              <p className="text-slate-300 leading-relaxed mb-8 text-lg">
                Nossa equipe é formada por especialistas dedicados que combinam conhecimento técnico com uma visão humanizada do Direito.
              </p>
              <div className="flex gap-8">
                <div>
                  <span className="block text-3xl font-serif text-[#D4AF37]">100%</span>
                  <span className="text-xs uppercase tracking-wider text-slate-400">Dedicação</span>
                </div>
                <div>
                  <span className="block text-3xl font-serif text-[#D4AF37]">Nacional</span>
                  <span className="text-xs uppercase tracking-wider text-slate-400">Atuação</span>
                </div>
              </div>
            </div>
            <div className="relative">
              {/* Abstract shape representing office/professionalism if no image available */}
              <div className="aspect-[4/5] rounded-lg bg-gradient-to-br from-[#233154] to-[#0A1229] border border-[#D4AF37]/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#D4AF37] via-transparent to-transparent" />
                <Scale className="h-32 w-32 text-[#D4AF37]/20" />
              </div>
              {/* Decorative border */}
              <div className="absolute -bottom-6 -right-6 w-full h-full border-2 border-[#D4AF37]/30 rounded-lg -z-0"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contato" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#D4AF37] mb-2">Fale Conosco</h2>
              <h3 className="text-3xl md:text-4xl font-serif font-bold text-[#0F1C3F] mb-6">Agende uma conversa</h3>
              <p className="text-slate-600 mb-10">
                Estamos prontos para ouvir você. Entre em contato para uma avaliação detalhada do seu caso.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white rounded-lg shadow-sm text-[#D4AF37]">
                    <Phone className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F1C3F]">Telefone / WhatsApp</p>
                    <p className="text-slate-600 block">(94) 99227-6457 <span className="text-xs text-slate-400 font-normal ml-1">(Dr. Willian)</span></p>
                    <p className="text-slate-600 block">(94) 99137-9562 <span className="text-xs text-slate-400 font-normal ml-1">(Dra. Rosângela)</span></p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white rounded-lg shadow-sm text-[#D4AF37]">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F1C3F]">Endereço</p>
                    <p className="text-slate-600 max-w-xs">Av. Intendente Norberto Lima, 509, Centro, Conceição do Araguaia - PA</p>
                    <p className="text-slate-400 text-sm">CEP 68.540-000</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white rounded-lg shadow-sm text-[#D4AF37]">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F1C3F]">Horário de Atendimento</p>
                    <p className="text-slate-600">Segunda a Sexta: 08h às 18h</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg shadow-slate-200/50">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Nome</label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#D4AF37] focus:bg-white transition-colors"
                      placeholder="Seu nome"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Telefone</label>
                    <input
                      type="text"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#D4AF37] focus:bg-white transition-colors"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#D4AF37] focus:bg-white transition-colors"
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Mensagem</label>
                  <textarea
                    rows={4}
                    name="message"
                    required
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#D4AF37] focus:bg-white transition-colors"
                    placeholder="Como podemos ajudar?">
                  </textarea>
                </div>

                {status === "success" && (
                  <div className="p-4 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200 flex items-center">
                    <span className="font-bold mr-2">Sucesso!</span> Sua mensagem foi enviada. Entraremos em contato em breve.
                  </div>
                )}

                {status === "error" && (
                  <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200 flex items-center">
                    <span className="font-bold mr-2">Erro.</span> Não foi possível enviar. Tente novamente ou use o WhatsApp.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full py-4 bg-[#0F1C3F] text-white font-bold rounded-lg hover:bg-[#1a2b5e] transition-colors shadow-lg shadow-[#0F1C3F]/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSending ? (
                    <span className="animate-pulse">Enviando...</span>
                  ) : (
                    "Enviar Mensagem"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center md:text-left">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                <span className="text-xl font-serif font-bold text-white">Brito & Santos</span>
                <span className="text-[10px] uppercase tracking-widest text-[#D4AF37]">Advocacia</span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm mx-auto md:mx-0">
                Excelência jurídica, ética e compromisso com o resultado. Seu parceiro estratégico nas áreas trabalhista, civil e empresarial.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 uppercase text-xs tracking-widest">Links Rápidos</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#inicio" className="hover:text-[#D4AF37] transition-colors">Início</a></li>
                <li><a href="#atuacao" className="hover:text-[#D4AF37] transition-colors">Áreas de Atuação</a></li>
                <li><a href="#escritorio" className="hover:text-[#D4AF37] transition-colors">O Escritório</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 uppercase text-xs tracking-widest">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Política de Privacidade</a></li>
                <li><a href="#" className="hover:text-[#D4AF37] transition-colors">Termos de Uso</a></li>
                <li><Link href="/login" className="text-[#D4AF37] hover:underline">Acesso Administrativo</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-xs text-center">
            &copy; {new Date().getFullYear()} Brito & Santos Advocacia. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
