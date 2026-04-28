// Mock auth for B2B (no real backend — stored in localStorage)
const AUTH_USERS_KEY = 'rpkm-b2b-users';
const AUTH_SESSION_KEY = 'rpkm-b2b-session';

const Auth = {
    listUsers() {
        try { return JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || '[]'); } catch { return []; }
    },
    saveUsers(users) {
        localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
    },
    register({ email, name, organization, role, portfolio, password }) {
        const users = this.listUsers();
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            throw new Error('Этот email уже зарегистрирован');
        }
        const user = {
            id: 'u-' + Date.now(),
            email: email.toLowerCase(),
            name,
            organization,
            role,
            portfolio,
            password, // demo only — never store plain passwords in real app
            status: 'pending', // pending → approved by admin (auto-approved in demo after 2 sec)
            createdAt: new Date().toISOString(),
            ndaSigned: true,
        };
        users.push(user);
        this.saveUsers(users);
        // Auto-approve for demo
        setTimeout(() => {
            const all = this.listUsers();
            const idx = all.findIndex(u => u.id === user.id);
            if (idx >= 0) { all[idx].status = 'approved'; this.saveUsers(all); }
        }, 1500);
        return user;
    },
    login(email, password) {
        const users = this.listUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (!user) throw new Error('Неверный email или пароль');
        if (user.status !== 'approved') {
            // Auto-approve any pending user for demo
            user.status = 'approved';
            this.saveUsers(users);
        }
        sessionStorage.setItem(AUTH_SESSION_KEY, user.id);
        return user;
    },
    logout() {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
    },
    current() {
        const id = sessionStorage.getItem(AUTH_SESSION_KEY);
        if (!id) return null;
        return this.listUsers().find(u => u.id === id) || null;
    },
    requireAuth() {
        const u = this.current();
        if (!u) {
            location.href = 'b2b-login.html';
            return null;
        }
        return u;
    },
};

const ROLE_LABEL = {
    designer: 'Дизайнер интерьеров',
    architect: 'Архитектор',
    tech_customer: 'Технический заказчик',
    presale_engineer: 'Инженер пресейла',
    other: 'Другое',
};

// === B2B calculations storage ===
const B2B_CALCS_KEY = 'rpkm-b2b-calcs';

const Calcs = {
    listForUser(userId) {
        try {
            const all = JSON.parse(localStorage.getItem(B2B_CALCS_KEY) || '[]');
            return all.filter(c => c.userId === userId).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        } catch { return []; }
    },
    save(calc) {
        try {
            const all = JSON.parse(localStorage.getItem(B2B_CALCS_KEY) || '[]');
            all.push(calc);
            localStorage.setItem(B2B_CALCS_KEY, JSON.stringify(all));
        } catch {}
    },
    getById(id) {
        try {
            const all = JSON.parse(localStorage.getItem(B2B_CALCS_KEY) || '[]');
            return all.find(c => c.id === id) || null;
        } catch { return null; }
    },
};
