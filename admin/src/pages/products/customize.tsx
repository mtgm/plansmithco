import { useParams, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { supabaseClient } from "../../providers/supabase-client";
import { useGetIdentity } from "@refinedev/core";

type Identity = {
    id: string;
    company_id: string;
};

type Product = {
    id: string;
    name: string;
    model_url: string;
    thumbnail_url: string;
};

type Module = {
    module_key: string;
    display_name: string;
    description: string;
};

export const ProductCustomizePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: identity } = useGetIdentity<Identity>();

    const [product, setProduct] = useState<Product | null>(null);
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id || !identity?.id) return;
        loadData();
    }, [id, identity]);

    const loadData = async () => {
        try {
            const [{ data: productData }, { data: adminUser }] = await Promise.all([
                supabaseClient
                    .from("products")
                    .select("id, name, model_url, thumbnail_url")
                    .eq("id", id)
                    .single(),
                supabaseClient
                    .from("admin_users")
                    .select("company_id")
                    .eq("id", identity?.id)
                    .single(),
            ]);

            setProduct(productData);

            if (!adminUser?.company_id) {
                setModules([]);
                setLoading(false);
                return;
            }

            const { data: companyModules } = await supabaseClient
                .from("company_modules")
                .select("module_key, modules(module_key, display_name, description)")
                .eq("company_id", adminUser.company_id)
                .eq("is_active", true);

            if (companyModules) {
                setModules(companyModules.map((cm: any) => cm.modules));
            } else {
                setModules([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const moduleIcons: Record<string, string> = {
        "color_texture": "🎨",
        "ar_viewer": "📱",
        "3d_configurator": "📦",
        "qr_manager": "🔗",
    };

    const moduleDescriptions: Record<string, string> = {
        "color_texture": "Renk ve doku varyasyonları ekleyin",
        "ar_viewer": "AR görüntüleme ayarları",
        "3d_configurator": "3D konfigüratör seçenekleri",
        "qr_manager": "QR kod yönetimi",
    };

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div style={s.wrapper}>
            {/* Header */}
            <div style={s.header}>
                <div>
                    <button style={s.backBtn} onClick={() => navigate("/products")}>
                        ← Geri
                    </button>
                    <h1 style={s.title}>{product?.name}</h1>
                    <p style={s.subtitle}>Özelleştirme seçeneği seçin</p>
                </div>
            </div>

            <div style={s.grid}>
                {/* Sol — 3D Model Önizleme */}
                <div style={s.previewCard}>
                    <div style={s.cardTitle}>3D Önizleme</div>
                    {product?.model_url ? (
                        <div style={s.modelViewer}>
                            {/* @ts-ignore */}
                            <model-viewer
                                src={product.model_url}
                                auto-rotate
                                camera-controls
                                style={{ width: "100%", height: "100%", background: "transparent" }}
                            />
                        </div>
                    ) : product?.thumbnail_url ? (
                        <img
                            src={product.thumbnail_url}
                            alt={product.name}
                            style={{ width: "100%", height: 380, objectFit: "contain", borderRadius: 12 }}
                        />
                    ) : (
                        <div style={s.noModel}>
                            <span style={{ fontSize: 48 }}>📦</span>
                            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Model yüklenmemiş</span>
                        </div>
                    )}
                </div>

                {/* Sağ — Modüller */}
                <div style={s.modulesPanel}>
                    <div style={s.cardTitle}>Özelleştirme Seçenekleri</div>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
                        Bir özelleştirme türü seçin
                    </p>

                    {modules.length === 0 ? (
                        <div style={s.emptyModules}>
                            <span style={{ fontSize: 32 }}>📭</span>
                            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                                Aktif modül bulunamadı.
                            </p>
                        </div>
                    ) : (
                        <div style={s.moduleGrid}>
                            {modules.map((mod) => (
                                <div
                                    key={mod.module_key}
                                    style={s.moduleCard}
                                    onClick={() => {
                                        if (mod.module_key === "color_texture") {
                                            navigate(`/products/${id}/customize/color-texture`);
                                        }
                                    }}
                                >
                                    <div style={s.moduleIcon}>
                                        {moduleIcons[mod.module_key] ?? "🧩"}
                                    </div>
                                    <div style={s.moduleName}>{mod.display_name}</div>
                                    <div style={s.moduleDesc}>
                                        {moduleDescriptions[mod.module_key] ?? mod.description}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const s: Record<string, React.CSSProperties> = {
    wrapper: { maxWidth: 1100, margin: "0 auto" },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 28,
    },
    backBtn: {
        background: "none",
        border: "none",
        color: "var(--text-muted)",
        fontSize: 13,
        cursor: "pointer",
        padding: "0 0 8px",
        fontFamily: "'DM Sans', sans-serif",
    },
    title: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: -0.5,
        color: "var(--text-main)",
    },
    subtitle: { fontSize: 14, color: "var(--text-muted)", marginTop: 4 },
    grid: {
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        gap: 20,
        alignItems: "start",
    },
    previewCard: {
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "var(--glass-border)",
        borderRadius: 20,
        padding: 24,
        boxShadow: "var(--glass-shadow)",
    },
    cardTitle: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 15,
        fontWeight: 700,
        color: "var(--text-main)",
        marginBottom: 16,
        letterSpacing: -0.3,
    },
    modelViewer: {
        width: "100%",
        height: 400,
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--bg-elevated)",
    },
    noModel: {
        height: 380,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "var(--bg-elevated)",
        borderRadius: 12,
    },
    modulesPanel: {
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "var(--glass-border)",
        borderRadius: 20,
        padding: 24,
        boxShadow: "var(--glass-shadow)",
    },
    moduleGrid: {
        display: "flex",
        flexDirection: "column",
        gap: 12,
    },
    moduleCard: {
        padding: "18px 20px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
        borderRadius: 16,
        cursor: "pointer",
        transition: "all 0.18s",
        display: "flex",
        flexDirection: "column",
        gap: 6,
    },
    moduleIcon: { fontSize: 28 },
    moduleName: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 15,
        fontWeight: 700,
        color: "var(--text-main)",
    },
    moduleDesc: {
        fontSize: 12,
        color: "var(--text-muted)",
    },
    emptyModules: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 0",
    },
};