import { useGetIdentity } from "@refinedev/core";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { supabaseClient } from "../../providers/supabase-client";
import { uploadToR2 } from "../../services/upload";

type Identity = { id: string };
type Category = { id: string; name: string };

export const ProductEditPage = () => {
    const { data: identity } = useGetIdentity<Identity>();
    const navigate = useNavigate();
    const { id } = useParams();

    const [form, setForm] = useState({
        name: "",
        sku: "",
        description: "",
        etsy_link: "",
        price: "",
        product_category_id: "",
        is_active: true,
    });

    const [categories, setCategories] = useState<Category[]>([]);
    const [thumbnail, setThumbnail] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
    const [currentThumbnail, setCurrentThumbnail] = useState<string>("");
    const [glbFile, setGlbFile] = useState<File | null>(null);
    const [currentGlb, setCurrentGlb] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [companyId, setCompanyId] = useState<string>("");
    const [successMsg, setSuccessMsg] = useState("");
    const [initialForm, setInitialForm] = useState<any>(null);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);

    useEffect(() => {
        if (!identity?.id || !id) return;
        loadData();
    }, [identity, id]);

    const loadData = async () => {
        const { data: adminUser } = await supabaseClient
            .from("admin_users").select("company_id").eq("id", identity!.id).single();
        const cid = adminUser?.company_id;
        setCompanyId(cid);

        const { data: cats } = await supabaseClient
            .from("product_categories")
            .select("id, name")
            .eq("company_id", cid)
            .eq("is_active", true)
            .order("name");
        setCategories(cats ?? []);

        const { data: product } = await supabaseClient
            .from("products").select("*").eq("id", id).single();

        if (product) {
            const loadedForm = {
                name: product.name ?? "",
                sku: product.sku ?? "",
                description: product.description ?? "",
                etsy_link: product.etsy_link ?? "",
                price: product.price?.toString() ?? "",
                product_category_id: product.product_category_id ?? "",
                is_active: product.is_active ?? true,
            };

            setForm(loadedForm);
            setInitialForm(loadedForm);
            setCurrentThumbnail(product.thumbnail_url ?? "");
            setCurrentGlb(product.model_url ?? "");
        }

        setLoading(false);
    };

    const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setThumbnail(file);
            setThumbnailPreview(URL.createObjectURL(file));
        }
    };

    const handleGlbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setGlbFile(file);
    };

    const handleSubmit = async (afterSave?: "products" | "customize") => {
        if (!form.name) { setError("Ürün adı zorunludur."); return; }
        setError("");
        setIsSubmitting(true);

        try {
            let thumbnail_url = currentThumbnail;
            let model_url = currentGlb;

            if (thumbnail) {
                const result = await uploadToR2(thumbnail, `products/${id}`, companyId);
                thumbnail_url = result.url;
            }
            if (glbFile) {
                const result = await uploadToR2(glbFile, `products/${id}`, companyId);
                model_url = result.url;
            }

            await supabaseClient.from("products").update({
                name: form.name,
                sku: form.sku || null,
                description: form.description || null,
                etsy_link: form.etsy_link || null,
                price: form.price ? parseFloat(form.price) : null,
                product_category_id: form.product_category_id || null,
                is_active: form.is_active,
                thumbnail_url,
                model_url,
                updated_at: new Date().toISOString(),
            }).eq("id", id);

            setSuccessMsg("Kaydedildi ✅");

            if (afterSave === "customize") {
                navigate(`/products/${id}/customize`);
            } else {
                setTimeout(() => navigate("/products"), 1200);
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Yükleniyor...</span>
        </div>
    );

    const hasUnsavedChanges =
        !!initialForm &&
        (
            JSON.stringify(form) !== JSON.stringify(initialForm) ||
            !!thumbnail ||
            !!glbFile
        );

    const previewSrc = thumbnailPreview || currentThumbnail;

    return (
        <div style={s.wrapper}>
            <div style={s.header}>
                <div>
                    <button style={s.backBtn} onClick={() => navigate("/products")}>← Geri</button>
                    <h1 style={s.title}>Ürün Düzenle</h1>
                    <p style={s.subtitle}>{form.name}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {successMsg && (
                        <div style={s.successMsg}>{successMsg}</div>
                    )}
                    <button
                        style={{ ...s.submitBtn, opacity: isSubmitting ? 0.7 : 1 }}
                        onClick={() => handleSubmit("products")}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Kaydediliyor..." : "💾 Kaydet"}
                    </button>
                </div>
            </div>

            {error && <div style={s.errorMsg}>{error}</div>}

            <div style={s.grid}>
                {/* Sol — Form */}
                <div style={s.card}>
                    <div style={s.cardTitle}>Temel Bilgiler</div>

                    <div style={s.field}>
                        <label style={s.label}>Ürün Adı *</label>
                        <input style={s.input} value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>

                    <div style={s.row}>
                        <div style={{ ...s.field, flex: 1 }}>
                            <label style={s.label}>SKU</label>
                            <input style={s.input} value={form.sku}
                                onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                        </div>
                        <div style={{ ...s.field, flex: 1 }}>
                            <label style={s.label}>Fiyat (₺)</label>
                            <input style={s.input} type="number" value={form.price}
                                onChange={(e) => setForm({ ...form, price: e.target.value })} />
                        </div>
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Kategori</label>
                        <select style={s.select} value={form.product_category_id}
                            onChange={(e) => setForm({ ...form, product_category_id: e.target.value })}>
                            <option value="">Kategori seçin (opsiyonel)</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Açıklama</label>
                        <textarea style={s.textarea} rows={4} value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Etsy Linki</label>
                        <input style={s.input} value={form.etsy_link}
                            onChange={(e) => setForm({ ...form, etsy_link: e.target.value })} />
                    </div>

                    {/* Aktif toggle */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <label style={s.label}>Durum</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                            <span style={{ fontSize: 13, fontWeight: 600, color: form.is_active ? "#10B981" : "var(--text-muted)" }}>
                                {form.is_active ? "Aktif" : "Pasif"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Sağ — Dosyalar */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Thumbnail */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>Ürün Görseli</div>
                        <label style={s.uploadZone}>
                            {previewSrc ? (
                                <img src={previewSrc} alt="thumbnail"
                                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                            ) : (
                                <div style={s.uploadPlaceholder}>
                                    <span style={{ fontSize: 32 }}>🖼️</span>
                                    <span style={s.uploadText}>Görsel değiştir</span>
                                    <span style={s.uploadSub}>PNG, JPG, WEBP</span>
                                </div>
                            )}
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleThumbnailChange} />
                        </label>
                        {previewSrc && (
                            <div style={s.changeNote}>Değiştirmek için görsele tıkla</div>
                        )}
                    </div>

                    {/* GLB */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>3D Model</div>
                        {currentGlb && !glbFile && (
                            <div style={s.currentGlb}>
                                <span>📐 Mevcut model yüklü</span>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    Değiştirmek için yeni dosya seç
                                </span>
                            </div>
                        )}
                        <label style={{ ...s.uploadZone, height: 100, marginTop: currentGlb ? 10 : 0 }}>
                            <div style={s.uploadPlaceholder}>
                                <span style={{ fontSize: 28 }}>{glbFile ? "✅" : "📐"}</span>
                                <span style={s.uploadText}>{glbFile ? glbFile.name : "Yeni GLB yükle"}</span>
                                <span style={s.uploadSub}>{glbFile ? `${(glbFile.size / 1024 / 1024).toFixed(1)} MB` : ".glb / .gltf"}</span>
                            </div>
                            <input type="file" accept=".glb,.gltf" style={{ display: "none" }} onChange={handleGlbChange} />
                        </label>
                        {glbFile && (
                            <div style={s.glbInfo}>
                                <span>📦 {glbFile.name}</span>
                                <button style={s.removeBtn} onClick={() => setGlbFile(null)}>✕</button>
                            </div>
                        )}
                    </div>

                    {/* Özelleştir butonu */}
                    <button
                        style={s.customizeBtn}
                        onClick={() => {
                            if (hasUnsavedChanges) {
                                setShowUnsavedModal(true);
                            } else {
                                navigate(`/products/${id}/customize`);
                            }
                        }}
                    >
                        🎨 Ürünü Özelleştir
                    </button>
                </div>
            </div>
            {showUnsavedModal && (
                <div style={s.modalOverlay}>
                    <div style={s.modalCard}>
                        <h3 style={s.modalTitle}>Kaydedilmemiş değişiklikler var</h3>
                        <p style={s.modalText}>
                            Özelleştirme sayfasına geçmeden önce değişiklikleri kaydetmek ister misiniz?
                        </p>

                        <div style={s.modalActions}>
                            <button
                                style={s.modalSecondaryBtn}
                                onClick={() => setShowUnsavedModal(false)}
                            >
                                İptal
                            </button>

                            <button
                                style={s.modalGhostBtn}
                                onClick={() => {
                                    setShowUnsavedModal(false);
                                    navigate(`/products/${id}/customize`);
                                }}
                            >
                                Kaydetmeden devam et
                            </button>

                            <button
                                style={s.modalPrimaryBtn}
                                onClick={async () => {
                                    setShowUnsavedModal(false);
                                    await handleSubmit("customize");
                                }}
                            >
                                Kaydet ve devam et
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};

const s: Record<string, React.CSSProperties> = {
    wrapper: { maxWidth: 1000, margin: "0 auto" },
    header: {
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 28,
    },
    backBtn: {
        background: "none", border: "none", color: "var(--text-muted)",
        fontSize: 13, cursor: "pointer", padding: "0 0 8px",
        fontFamily: "'DM Sans', sans-serif",
    },
    title: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: "var(--text-main)",
    },
    subtitle: { fontSize: 14, color: "var(--text-muted)", marginTop: 4 },
    submitBtn: {
        padding: "12px 24px", background: "var(--accent)", color: "#0F0F0F",
        fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700,
        border: "none", borderRadius: 12, cursor: "pointer",
        boxShadow: "0 4px 14px rgba(245,158,11,0.3)", whiteSpace: "nowrap",
    },
    successMsg: {
        background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
        color: "#10B981", fontSize: 13, fontWeight: 600,
        padding: "8px 14px", borderRadius: 10,
    },
    errorMsg: {
        background: "rgba(192,86,33,0.08)", border: "1px solid rgba(192,86,33,0.2)",
        color: "var(--accent-dark)", fontSize: 13, padding: "10px 14px",
        borderRadius: 10, marginBottom: 20,
    },
    grid: { display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 },
    card: {
        background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)",
        border: "var(--glass-border)", borderRadius: 20,
        padding: 24, boxShadow: "var(--glass-shadow)",
    },
    cardTitle: {
        fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700,
        color: "var(--text-main)", marginBottom: 20, letterSpacing: -0.3,
    },
    field: { marginBottom: 18 },
    row: { display: "flex", gap: 14 },
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
    select: {
        width: "100%", padding: "11px 14px",
        background: "var(--bg-input)",
        border: "1px solid var(--input-border)",
        borderRadius: 10, fontFamily: "'DM Sans', sans-serif",
        fontSize: 14, color: "var(--text-main)", outline: "none", cursor: "pointer",
    },
    textarea: {
        width: "100%", padding: "11px 14px",
        background: "var(--bg-input)",
        border: "1px solid var(--input-border)",
        borderRadius: 10, fontFamily: "'DM Sans', sans-serif",
        fontSize: 14, color: "var(--text-main)", outline: "none", resize: "vertical",
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
    uploadZone: {
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%", height: 200,
        background: "var(--bg-elevated)",
        border: "2px dashed var(--accent-border)",
        borderRadius: 14, cursor: "pointer", overflow: "hidden",
    },
    uploadPlaceholder: {
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    },
    uploadText: { fontSize: 14, fontWeight: 600, color: "var(--text-main)" },
    uploadSub: { fontSize: 12, color: "var(--text-muted)" },
    changeNote: {
        fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8,
    },
    currentGlb: {
        display: "flex", flexDirection: "column", gap: 3,
        padding: "10px 14px",
        background: "var(--accent-bg)",
        border: "1px solid var(--accent-border)",
        borderRadius: 10, fontSize: 13, fontWeight: 600, color: "var(--accent-dark)",
    },
    glbInfo: {
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 10, padding: "8px 12px",
        background: "var(--accent-bg)", borderRadius: 8,
        fontSize: 12, color: "var(--text-muted)",
    },
    removeBtn: {
        background: "none", border: "none", cursor: "pointer",
        color: "var(--accent-dark)", fontSize: 14,
    },
    customizeBtn: {
        width: "100%", padding: "14px",
        background: "var(--accent-bg)",
        border: "2px solid var(--accent-border)",
        borderRadius: 14, cursor: "pointer",
        fontFamily: "'Outfit', sans-serif",
        fontSize: 14, fontWeight: 700, color: "var(--accent-dark)",
    },
    modalOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
    },
    modalCard: {
        width: "100%",
        maxWidth: 440,
        background: "var(--bg-card)",
        border: "var(--glass-border)",
        backdropFilter: "var(--glass-blur)",
        borderRadius: 18,
        padding: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    },
    modalTitle: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 20,
        fontWeight: 700,
        color: "var(--text-main)",
        marginBottom: 10,
    },
    modalText: {
        fontSize: 14,
        lineHeight: 1.5,
        color: "var(--text-muted)",
        marginBottom: 20,
    },
    modalActions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        flexWrap: "wrap",
    },
    modalSecondaryBtn: {
        padding: "10px 16px",
        background: "var(--bg-input)",
        border: "1px solid var(--input-border)",
        borderRadius: 10,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-main)",
    },
    modalGhostBtn: {
        padding: "10px 16px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
        borderRadius: 10,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--accent-dark)",
    },
    modalPrimaryBtn: {
        padding: "10px 16px",
        background: "var(--accent)",
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 700,
        color: "#0F0F0F",
    },
};