import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { supabaseClient } from "../../providers/supabase-client";
import { useGetIdentity } from "@refinedev/core";

type Identity = { id: string };

type Category = {
    id: string;
    name: string;
    description: string | null;
    thumbnail_url: string | null;
    is_active: boolean;
    product_count?: number;
};

export const CategoriesPage = () => {
    const navigate = useNavigate();
    const { data: identity } = useGetIdentity<Identity>();

    const [categories, setCategories] = useState<Category[]>([]);
    const [companyId, setCompanyId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [form, setForm] = useState({ name: "", description: "", is_active: true });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!identity?.id) return;
        loadData();
    }, [identity]);

    const loadData = async () => {
        const { data: adminUser } = await supabaseClient
            .from("admin_users").select("company_id").eq("id", identity!.id).single();
        const cid = adminUser?.company_id;
        setCompanyId(cid);

        const { data: cats } = await supabaseClient
            .from("product_categories")
            .select("*")
            .eq("company_id", cid)
            .order("created_at", { ascending: false });

        // Her kategori için ürün sayısını çek
        if (cats) {
            const withCounts = await Promise.all(cats.map(async (cat) => {
                const { count } = await supabaseClient
                    .from("products")
                    .select("*", { count: "exact", head: true })
                    .eq("product_category_id", cat.id);
                return { ...cat, product_count: count ?? 0 };
            }));
            setCategories(withCounts);
        }

        setLoading(false);
    };

    const openAdd = () => {
        setEditingCategory(null);
        setForm({ name: "", description: "", is_active: true });
        setShowForm(true);
    };

    const openEdit = (cat: Category) => {
        setEditingCategory(cat);
        setForm({ name: cat.name, description: cat.description ?? "", is_active: cat.is_active });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            if (editingCategory) {
                await supabaseClient.from("product_categories").update({
                    name: form.name,
                    description: form.description || null,
                    is_active: form.is_active,
                }).eq("id", editingCategory.id);
            } else {
                await supabaseClient.from("product_categories").insert({
                    company_id: companyId,
                    name: form.name,
                    description: form.description || null,
                    is_active: form.is_active,
                });
            }
            setShowForm(false);
            await loadData();
        } catch (e: any) {
            alert("Hata: " + e.message);
        }
        setSaving(false);
    };

    const handleDelete = async (catId: string) => {
        if (!confirm("Bu kategoriyi silmek istediğinizden emin misiniz?")) return;
        await supabaseClient.from("product_categories").delete().eq("id", catId);
        await loadData();
    };

    const toggleActive = async (cat: Category) => {
        await supabaseClient.from("product_categories")
            .update({ is_active: !cat.is_active }).eq("id", cat.id);
        await loadData();
    };

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Yükleniyor...</span>
        </div>
    );

    return (
        <div style={s.wrapper}>
            {/* Header */}
            <div style={s.header}>
                <div>
                    <h1 style={s.title}>Kategoriler</h1>
                    <p style={s.subtitle}>Ürün kategorilerini yönetin</p>
                </div>
                <button style={s.addBtn} onClick={openAdd}>＋ Yeni Kategori</button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div style={s.overlay} onClick={() => setShowForm(false)}>
                    <div style={s.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={s.modalHeader}>
                            <span style={s.modalTitle}>
                                {editingCategory ? "Kategori Düzenle" : "Yeni Kategori"}
                            </span>
                            <button style={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
                        </div>

                        <div style={s.field}>
                            <label style={s.label}>Kategori Adı *</label>
                            <input
                                style={s.input}
                                placeholder="örn: Depolama Sistemleri"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                autoFocus
                            />
                        </div>

                        <div style={s.field}>
                            <label style={s.label}>Açıklama</label>
                            <textarea
                                style={s.textarea}
                                placeholder="Kategori hakkında kısa açıklama..."
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div style={{ ...s.field, display: "flex", alignItems: "center", gap: 10 }}>
                            <label style={s.label}>Aktif</label>
                            <div
                                style={{
                                    ...s.toggle,
                                    background: form.is_active ? "#10B981" : "var(--border-color)",
                                }}
                                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                            >
                                <div style={{
                                    ...s.toggleThumb,
                                    background: "var(--bg-app)",
                                    transform: form.is_active ? "translateX(20px)" : "translateX(2px)",
                                }} />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                            <button style={s.cancelBtn} onClick={() => setShowForm(false)}>İptal</button>
                            <button
                                style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Kategori Listesi */}
            {categories.length === 0 ? (
                <div style={s.empty}>
                    <span style={{ fontSize: 40 }}>🗂️</span>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 12 }}>
                        Henüz kategori eklenmemiş.
                    </p>
                    <button style={s.addBtn} onClick={openAdd}>Kategori Ekle</button>
                </div>
            ) : (
                <div style={s.grid}>
                    {categories.map((cat) => (
                        <div key={cat.id} style={s.card}>
                            {/* Kart Header */}
                            <div style={s.cardHeader}>
                                <div style={s.catIcon}>🗂️</div>
                                <div style={{ flex: 1 }}>
                                    <div style={s.catName}>{cat.name}</div>
                                    {cat.description && (
                                        <div style={s.catDesc}>{cat.description}</div>
                                    )}
                                </div>
                                {/* Active Toggle */}
                                <div
                                    style={{
                                        ...s.toggle,
                                        background: cat.is_active ? "#10B981" : "var(--border-color)",
                                    }}
                                    onClick={() => toggleActive(cat)}
                                    title={cat.is_active ? "Aktif — kapatmak için tıkla" : "Pasif — açmak için tıkla"}
                                >
                                    <div style={{
                                        ...s.toggleThumb,
                                        background: "var(--bg-app)",
                                        transform: cat.is_active ? "translateX(20px)" : "translateX(2px)",
                                    }} />
                                </div>
                            </div>

                            {/* Ürün sayısı */}
                            <div style={s.catMeta}>
                                <span
                                    style={{ ...s.metaBadge, cursor: "pointer", textDecoration: "underline" }}
                                    onClick={() => navigate(`/products?category=${cat.id}`)}
                                >
                                    📦 {cat.product_count} ürün
                                </span>
                                <span style={{
                                    ...s.statusBadge,
                                    background: cat.is_active ? "rgba(16,185,129,0.1)" : "var(--bg-elevated)",
                                    color: cat.is_active ? "#10B981" : "var(--text-muted)",
                                }}>
                                    {cat.is_active ? "Aktif" : "Pasif"}
                                </span>
                            </div>

                            {/* Aksiyonlar */}
                            <div style={s.cardActions}>
                                <button
                                    style={s.actionBtn}
                                    onClick={() => navigate(`/products/create?category=${cat.id}`)}
                                >
                                    ＋ Ürün Ekle
                                </button>
                                <button
                                    style={s.editBtn}
                                    onClick={() => openEdit(cat)}
                                >
                                    ✏️ Düzenle
                                </button>
                                <button
                                    style={s.deleteBtn}
                                    onClick={() => handleDelete(cat.id)}
                                >
                                    🗑
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const s: Record<string, React.CSSProperties> = {
    wrapper: { maxWidth: 1100, margin: "0 auto" },
    header: {
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 28,
    },
    title: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: "var(--text-main)",
    },
    subtitle: { fontSize: 14, color: "var(--text-muted)", marginTop: 4 },
    addBtn: {
        padding: "11px 20px", background: "var(--accent)", color: "#0F0F0F",
        fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700,
        border: "none", borderRadius: 12, cursor: "pointer",
        boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 16,
    },
    card: {
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "var(--glass-border)",
        borderRadius: 20, padding: 20,
        boxShadow: "var(--glass-shadow)",
        display: "flex", flexDirection: "column", gap: 14,
    },
    cardHeader: {
        display: "flex", alignItems: "flex-start", gap: 12,
    },
    catIcon: {
        fontSize: 24, flexShrink: 0,
    },
    catName: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 15, fontWeight: 700, color: "var(--text-main)",
    },
    catDesc: {
        fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.4,
    },
    catMeta: {
        display: "flex", gap: 8, alignItems: "center",
    },
    metaBadge: {
        fontSize: 12, color: "var(--text-muted)",
        background: "var(--bg-elevated)",
        padding: "3px 8px", borderRadius: 100,
    },
    statusBadge: {
        fontSize: 11, fontWeight: 600,
        padding: "3px 8px", borderRadius: 100,
    },
    cardActions: {
        display: "flex", gap: 8, alignItems: "center",
        borderTop: "1px solid var(--border-color)",
        paddingTop: 14,
    },
    actionBtn: {
        flex: 1, padding: "8px 12px",
        background: "var(--accent-bg)",
        border: "1px solid var(--accent-border)",
        borderRadius: 10, cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12, fontWeight: 600, color: "var(--text-main)",
    },
    editBtn: {
        padding: "8px 12px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
        borderRadius: 10, cursor: "pointer",
        fontSize: 12, color: "var(--text-main)",
    },
    deleteBtn: {
        padding: "8px 10px",
        background: "rgba(192,86,33,0.06)",
        border: "1px solid rgba(192,86,33,0.15)",
        borderRadius: 10, cursor: "pointer",
        fontSize: 13, color: "var(--accent-dark)",
    },
    toggle: {
        width: 42, height: 24, borderRadius: 100,
        cursor: "pointer", position: "relative",
        transition: "background 0.2s", flexShrink: 0,
    },
    toggleThumb: {
        position: "absolute", top: 2,
        width: 20, height: 20, borderRadius: "50%",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        transition: "transform 0.2s",
    },
    empty: {
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 12, padding: "80px 0",
    },
    overlay: {
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100,
    },
    modal: {
        background: "var(--bg-card)",
        backdropFilter: "var(--glass-blur)",
        border: "1px solid var(--border-color)",
        borderRadius: 20, padding: 28,
        width: "100%", maxWidth: 440,
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
    },
    modalHeader: {
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 20,
    },
    modalTitle: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 17, fontWeight: 700, color: "var(--text-main)",
    },
    closeBtn: {
        background: "none", border: "none",
        fontSize: 16, cursor: "pointer", color: "var(--text-muted)",
    },
    field: { marginBottom: 16 },
    label: {
        display: "block", fontSize: 13, fontWeight: 600,
        color: "var(--text-main)", marginBottom: 7,
    },
    input: {
        width: "100%", padding: "11px 14px",
        background: "var(--bg-input)",
        border: "1px solid var(--input-border)",
        borderRadius: 10, fontFamily: "'DM Sans', sans-serif",
        fontSize: 14, color: "var(--text-main)", outline: "none",
    },
    textarea: {
        width: "100%", padding: "11px 14px",
        background: "var(--bg-input)",
        border: "1px solid var(--input-border)",
        borderRadius: 10, fontFamily: "'DM Sans', sans-serif",
        fontSize: 14, color: "var(--text-main)", outline: "none", resize: "vertical",
    },
    cancelBtn: {
        padding: "10px 18px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
        borderRadius: 10, cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13, color: "var(--text-muted)",
    },
    saveBtn: {
        padding: "10px 22px", background: "var(--accent)", color: "#0F0F0F",
        fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700,
        border: "none", borderRadius: 10, cursor: "pointer",
    },
};