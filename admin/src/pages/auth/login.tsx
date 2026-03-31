import { useLogin } from "@refinedev/core";
import { useState } from "react";
import "../../styles/theme.css";

export const LoginPage = () => {
    const { mutate: login, isPending: isLoading } = useLogin();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = () => {
        if (!email || !password) {
            setError("Lütfen tüm alanları doldurun.");
            return;
        }
        setError("");
        login(
            { email, password },
            {
                onError: () => setError("E-posta veya şifre hatalı."),
            }
        );
    };

    return (
        <div style={styles.wrapper}>
            <div style={styles.card}>
                {/* Brand */}
                <div style={styles.brand}>
                    <span style={{ fontSize: 22 }}>🌅</span>
                    <span style={styles.brandName}>Plansmith.</span>
                    <span style={styles.brandBadge}>Admin</span>
                </div>

                <h1 style={styles.title}>Hoş Geldiniz</h1>
                <p style={styles.subtitle}>Admin paneline erişmek için giriş yapın.</p>

                {error && <div style={styles.errorMsg}>{error}</div>}

                <div style={styles.field}>
                    <label style={styles.label}>E-posta</label>
                    <input
                        style={styles.input}
                        type="email"
                        placeholder="admin@sirket.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                </div>

                <div style={styles.field}>
                    <label style={styles.label}>Şifre</label>
                    <input
                        style={styles.input}
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                </div>

                <button
                    style={{
                        ...styles.loginBtn,
                        opacity: isLoading ? 0.7 : 1,
                        cursor: isLoading ? "not-allowed" : "pointer",
                    }}
                    onClick={handleLogin}
                    disabled={isLoading}
                >
                    {isLoading ? "Giriş yapılıyor..." : "Giriş Yap →"}
                </button>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    card: {
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "var(--glass-border)",
        borderRadius: 24,
        boxShadow: "var(--glass-shadow)",
        padding: "48px 40px",
        width: "100%",
        maxWidth: 420,
    },
    brand: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        marginBottom: 32,
    },
    brandName: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 20,
        fontWeight: 800,
        letterSpacing: -0.5,
        color: "var(--text-main)",
    },
    brandBadge: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        background: "var(--accent-bg)",
        color: "var(--accent-dark)",
        padding: "3px 8px",
        borderRadius: 100,
        border: "1px solid var(--accent-border)",
    },
    title: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: -0.5,
        color: "var(--text-main)",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: "var(--text-muted)",
        marginBottom: 32,
    },
    errorMsg: {
        background: "rgba(192, 86, 33, 0.08)",
        border: "1px solid rgba(192, 86, 33, 0.2)",
        color: "var(--accent-dark)",
        fontSize: 13,
        padding: "10px 14px",
        borderRadius: 10,
        marginBottom: 16,
    },
    field: {
        marginBottom: 18,
    },
    label: {
        display: "block",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-main)",
        marginBottom: 7,
    },
    input: {
        width: "100%",
        padding: "12px 16px",
        background: "var(--bg-input)",
        border: "1px solid var(--input-border)",
        borderRadius: 12,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 14,
        color: "var(--text-main)",
        outline: "none",
    },
    loginBtn: {
        width: "100%",
        padding: 14,
        background: "var(--accent)",
        color: "#0F0F0F",
        fontFamily: "'Outfit', sans-serif",
        fontSize: 15,
        fontWeight: 700,
        border: "none",
        borderRadius: 12,
        marginTop: 8,
        boxShadow: "0 4px 14px rgba(245, 158, 11, 0.3)",
        transition: "all 0.2s",
    },
};