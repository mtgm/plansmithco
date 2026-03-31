import { useGetIdentity, useLogout } from "@refinedev/core";
import { Outlet, NavLink } from "react-router";
import { useTheme } from "../../providers/ThemeProvider";
import "../../styles/theme.css";

type Identity = {
    name: string;
    email: string;
    role: string;
};

export const AdminLayout = () => {
    const { data: identity } = useGetIdentity<Identity>();
    const { mutate: logout } = useLogout();
    const { theme, toggleTheme } = useTheme();

    return (
        <div style={styles.wrapper}>
            {/* SIDEBAR */}
            <aside style={styles.sidebar}>
                <div style={styles.brand}>
                    <span style={{ fontSize: 20 }}>🌅</span>
                    <span style={styles.brandName}>Plansmith.</span>
                    <span style={styles.brandBadge}>Admin</span>
                </div>

                <nav style={styles.nav}>
                    <div style={styles.navLabel}>Genel</div>
                    <NavLink to="/dashboard" style={navStyle} end>
                        <span>📊</span> Dashboard
                    </NavLink>
                    <NavLink to="/products" style={navStyle}>
                        <span>📦</span> Ürünler
                    </NavLink>
                    <NavLink to="/categories" style={navStyle}>
                        <span>🗂️</span> Kategoriler
                    </NavLink>
                    <NavLink to="/variants" style={navStyle}>
                        <span>🏷️</span> Varyantlar
                    </NavLink>

                    <div style={{ ...styles.navLabel, marginTop: 16 }}>Medya</div>
                    <NavLink to="/textures" style={navStyle}>
                        <span>🎨</span> Dokular
                    </NavLink>
                    <NavLink to="/models" style={navStyle}>
                        <span>📐</span> 3D Modeller
                    </NavLink>

                    <div style={{ ...styles.navLabel, marginTop: 16 }}>Sistem</div>
                    <NavLink to="/qr-codes" style={navStyle}>
                        <span>🔗</span> QR Kodlar
                    </NavLink>
                </nav>

                {/* Footer */}
                <div style={styles.sidebarFooter}>
                    <button 
                        onClick={toggleTheme}
                        style={{
                            background: "var(--bg-elevated)",
                            border: "none",
                            borderRadius: 12,
                            padding: "8px 12px",
                            marginBottom: 16,
                            cursor: "pointer",
                            color: "var(--text-main)",
                            fontSize: 13,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            width: "100%",
                            transition: "all 0.2s",
                        }}
                    >
                        {theme === "light" ? "🌙 Karanlık Tema" : "☀️ Işık Teması"}
                    </button>

                    <div style={styles.userPill}>
                        <div style={styles.avatar}>
                            {identity?.name?.[0]?.toUpperCase() ?? "A"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.userName}>{identity?.name ?? identity?.email ?? "Admin"}</div>
                            <div style={styles.userRole}>{identity?.role ?? ""}</div>
                        </div>
                        <span
                            style={{ fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}
                            onClick={() => logout()}
                            title="Çıkış Yap"
                        >
                            ↩
                        </span>
                    </div>
                </div>
            </aside>

            {/* MAIN */}
            <main style={styles.main}>
                <Outlet />
            </main>
        </div>
    );
};

const navStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: isActive ? 600 : 500,
    color: isActive ? "var(--text-main)" : "var(--text-muted)",
    background: isActive ? "var(--accent-bg)" : "transparent",
    textDecoration: "none",
    marginBottom: 2,
    transition: "all 0.18s",
});

const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        display: "flex",
        minHeight: "100vh",
    },
    sidebar: {
        width: "var(--sidebar-w)",
        minHeight: "100vh",
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        borderRight: "var(--glass-border)",
        padding: "28px 16px",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        boxShadow: "var(--glass-shadow)",
    },
    brand: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "4px 8px 24px",
        borderBottom: "1px solid var(--border-color)",
        marginBottom: 20,
    },
    brandName: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: -0.4,
        color: "var(--text-main)",
    },
    brandBadge: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        background: "var(--accent-bg)",
        color: "var(--accent-dark)",
        padding: "2px 7px",
        borderRadius: 100,
        border: "1px solid var(--accent-border)",
    },
    nav: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
    },
    navLabel: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: "var(--text-muted)",
        padding: "8px 12px 4px",
        opacity: 0.7,
    },
    sidebarFooter: {
        paddingTop: 16,
        borderTop: "1px solid var(--border-color)",
    },
    userPill: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
    },
    avatar: {
        width: 32,
        height: 32,
        background: "linear-gradient(135deg, var(--accent), var(--accent-dark))",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontSize: 13,
        fontWeight: 700,
        color: "white",
        fontFamily: "'Outfit', sans-serif",
        flexShrink: 0,
    },
    userName: {
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-main)",
    },
    userRole: {
        fontSize: 11,
        color: "var(--text-muted)",
    },
    main: {
        marginLeft: "var(--sidebar-w)",
        flex: 1,
        padding: 32,
        minHeight: "100vh",
    },
};