export interface User {
    id: string;
    name: string;
    email: string;
    password?: string; // In a real app, this should be hashed. Here we store plain for demo/local usage as requested.
    role: 'admin' | 'user';
    createdAt: number;
}

const STORAGE_KEY_USERS = 'app_users_v1';
const STORAGE_KEY_SESSION = 'app_session_v1';

const DEFAULT_ADMIN: User = {
    id: 'admin-01',
    name: 'Administrador',
    email: 'dasilvabrito@gmail.com',
    password: '@Willian10',
    role: 'admin',
    createdAt: Date.now(),
};

/**
 * Initializes the storage with the default admin if no users exist.
 */
export function initStorage() {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(STORAGE_KEY_USERS);
    if (!stored) {
        const users = [DEFAULT_ADMIN];
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    }
}

export function getUsers(): User[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY_USERS);
    return stored ? JSON.parse(stored) : [];
}

export function saveUser(user: User) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === user.id);

    if (index >= 0) {
        // Update
        users[index] = { ...users[index], ...user };
    } else {
        // Create
        users.push(user);
    }

    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
}

export function deleteUser(userId: string) {
    const users = getUsers();
    const newUsers = users.filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(newUsers));
}

export function getSession(): User | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY_SESSION);
    return stored ? JSON.parse(stored) : null;
}

export function setSession(user: User | null) {
    if (!user) {
        localStorage.removeItem(STORAGE_KEY_SESSION);
    } else {
        // Don't store password in session
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...safeUser } = user;
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(safeUser));
    }
}
