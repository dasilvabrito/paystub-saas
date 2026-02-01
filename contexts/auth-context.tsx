"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, getSession, setSession, getUsers, initStorage } from "@/lib/storage";

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initialize storage and check session on mount
        initStorage();
        const session = getSession();
        if (session) {
            setUser(session);
        }
        setIsLoading(false);
    }, []);

    const login = async (email: string, pass: string) => {
        const users = getUsers();
        const validUser = users.find(u => u.email === email && u.password === pass);

        if (validUser) {
            setUser(validUser);
            setSession(validUser);
            return true;
        }
        return false;
    };

    const logout = () => {
        setUser(null);
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
