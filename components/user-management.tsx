"use client";

import { useEffect, useState } from "react";
import { User, getUsers, saveUser, deleteUser } from "@/lib/storage";
import { useAuth } from "@/contexts/auth-context";
import { Pencil, Trash2, Plus, X } from "lucide-react";

export function UserManagement() {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<'admin' | 'user'>('user');

    useEffect(() => {
        refreshUsers();
    }, [isOpen]);

    const refreshUsers = () => {
        setUsers(getUsers());
    };

    const handleOpen = () => {
        refreshUsers();
        setIsOpen(true);
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setName("");
        setEmail("");
        setPassword("");
        setRole('user');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newUser: User = {
            id: isEditing && editId ? editId : crypto.randomUUID(),
            name,
            email,
            password: password || undefined, // undefined keeps old password if editing
            role,
            createdAt: isEditing ? (users.find(u => u.id === editId)?.createdAt || Date.now()) : Date.now(),
        };

        // If editing and password is empty, retrieve old password
        if (isEditing && !password) {
            const oldUser = users.find(u => u.id === editId);
            if (oldUser) newUser.password = oldUser.password;
        }

        saveUser(newUser);
        refreshUsers();
        resetForm();
    };

    const handleEdit = (u: User) => {
        setIsEditing(true);
        setEditId(u.id);
        setName(u.name);
        setEmail(u.email);
        setRole(u.role);
        setPassword(""); // Don't show password
    };

    const handleDelete = (id: string) => {
        if (confirm("Tem certeza que deseja excluir este usuário?")) {
            deleteUser(id);
            refreshUsers();
        }
    };

    if (!user || user.role !== 'admin') return null;

    return (
        <>
            <button
                onClick={handleOpen}
                className="fixed bottom-4 right-4 z-50 bg-zinc-800 text-zinc-300 hover:text-white px-4 py-2 rounded-full border border-white/10 shadow-lg text-sm font-medium transition-colors"
            >
                Gerenciar Usuários
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Gerenciamento de Usuários</h2>
                            <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-8">

                            {/* List */}
                            <div className="md:col-span-2 space-y-4">
                                <h3 className="text-lg font-medium text-white mb-4">Usuários Cadastrados</h3>
                                <div className="space-y-2">
                                    {users.map((u) => (
                                        <div key={u.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/5">
                                            <div>
                                                <p className="font-medium text-white">{u.name}</p>
                                                <p className="text-sm text-zinc-400">{u.email} • <span className="uppercase text-xs tracking-wider">{u.role}</span></p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(u)}
                                                    className="p-2 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                {u.id !== user.id && ( // Prevent self-delete
                                                    <button
                                                        onClick={() => handleDelete(u.id)}
                                                        className="p-2 hover:bg-red-500/20 rounded-md text-red-500 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Form */}
                            <div className="bg-white/5 p-6 rounded-xl h-fit border border-white/5">
                                <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                                    <Plus className="w-5 h-5" />
                                    {isEditing ? "Editar Usuário" : "Novo Usuário"}
                                </h3>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Nome</label>
                                        <input
                                            required
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Email</label>
                                        <input
                                            required
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                                            {isEditing ? "Nova Senha (opcional)" : "Senha"}
                                        </label>
                                        <input
                                            required={!isEditing}
                                            type="password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Permissão</label>
                                        <select
                                            value={role}
                                            onChange={e => setRole(e.target.value as any)}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                        >
                                            <option value="user">Usuário Comum</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>

                                    <div className="pt-4 flex gap-2">
                                        {isEditing && (
                                            <button
                                                type="button"
                                                onClick={resetForm}
                                                className="flex-1 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors"
                                        >
                                            Salvar
                                        </button>
                                    </div>
                                </form>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
