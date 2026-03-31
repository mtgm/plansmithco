import { useGetIdentity } from "@refinedev/core";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { supabaseClient } from "../../providers/supabase-client";
import { uploadToR2 } from "../../services/upload";

type Identity = {
    id: string;
    name: string;
    email: string;
    role: string;
    company_id: string;
};

type Category = {
    id: string;
    name: string;
};

export const ProductCreatePage = () => {
    const { data: identity } = useGetIdentity<Identity>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const presetCategoryId = searchParams.get("category");

    const [form, setForm] = useState({
        name: "",
        sku: "",
        description: "",
        etsy_link: "",
        price: "",
        product_category_id: presetCategoryId ?? "",
    });

    const [categories, setCategories] = useState<Category[]>([]);
    const [presetCategoryName, setPresetCategoryName] = useState<string>("");
    const [thumbnail, setThumbnail] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
    const [glbFile, setGlbFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [companyId, setCompanyId] = useState<string>("");

    useEffect(() => {
        if (!identity?.id) return;
        loadCategories();
    }, [identity]);

    const loadCategories = async () => {
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

        if (presetCategoryId && cats) {
            const found = cats.find(c => c.id === presetCategoryId);
            if (found) setPresetCategoryName(found.name);
        }
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

    const handleSubmit = async () => {
        if (!form.name) {
            setError("Ürün adı zorunludur.");
            return;
        }
        setError("");
        setIsSubmitting(true);

        try {
            const { data: newProduct, error: insertError } = await supabaseClient
                .from("products")
                .insert({
                    company_id: companyId,
                    name: form.name,
                    sku: form.sku || null,
                    description: form.description || null,
                    etsy_link: form.etsy_link || null,
                    price: form.price ? parseFloat(form.price) : null,
                    product_category_id: form.product_category_id || null,
                    is_active: true,
                })
                .select()
                .single();

            if (insertError || !newProduct) {
                throw new Error("Ürün kaydedilemedi: " + insertError?.message);
            }

            const productId = newProduct.id;
            let thumbnail_url = null;
            let model_url = null;

            if (thumbnail) {
                const result = await uploadToR2(thumbnail, `products/${productId}`, companyId);
                thumbnail_url = result.url;
            }

            if (glbFile) {
                const result = await uploadToR2(glbFile, `products/${productId}`, companyId);
                model_url = result.url;
            }

            if (thumbnail_url || model_url) {
                await supabaseClient
                    .from("products")
                    .update({ thumbnail_url, model_url })
                    .eq("id", productId);
            }

            navigate(`/products/${productId}/customize`);

        } catch (err: any) {
            setError(err.message);
            setIsSubmitting(false);
        }
    };

    return (
        <div style={s.wrapper}>
            <div style={s.header}>
                <div>
                    <button style={s.backBtn} onClick={() => navigate("/products")}>← Geri</button>
                    <h1 style={s.title}>Yeni Ürün</h1>
                    <p style={s.subtitle}>Temel bilgileri girin, sonra ürünü özelleştirin.</p>
                </div>
                <button
                    style={{ ...s.submitBtn, opacity: isSubmitting ? 0.7 : 1 }}
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Kaydediliyor..." : "Kaydet & Özelleştir →"}
                </button>
            </div>

            {error && <div style={s.errorMsg}>{error}</div>}

            <div style={s.grid}>
                {/* Sol — Form */}
                <div style={s.card}>
                    <div style={s.cardTitle}>Temel Bilgiler</div>

                    <div style={s.field}>
                        <label style={s.label}>Ürün Adı *</label>
                        <input
                            style={s.input}
                            placeholder="örn: 27-Gal Tote Rack"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                    </div>

                    <div style={s.row}>
                        <div style={{ ...s.field, flex: 1 }}>
                            <label style={s.label}>SKU</label>
                            <input
                                style={s.input}
                                placeholder="örn: PS-TR-27-2B"
                                value={form.sku}
                                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                            />
                        </div>
                        <div style={{ ...s.field, flex: 1 }}>
                            <label style={s.label}>Fiyat (₺)</label>
                            <input
                                style={s.input}
                                type="number"
                                placeholder="0.00"
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Kategori */}
                    <div style={s.field}>
                        <label style={s.label}>Kategori</label>
                        {presetCategoryId ? (
                            // Kategori sayfasından gelince sabit göster
                            <div style={s.presetCategory}>
                                <span style={s.catBadge}>🗂️ {presetCategoryName}</span>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    Kategoriden geldiği için değiştirilemez
                                </span>
                            </div>
                        ) : (
                            <select
                                style={s.select}
                                value={form.product_category_id}
                                onChange={(e) => setForm({ ...form, product_category_id: e.target.value })}
                            >
                                <option value="">Kategori seçin (opsiyonel)</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Açıklama</label>
                        <textarea
                            style={s.textarea}
                            placeholder="Ürün hakkında kısa bir açıklama..."
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={4}
                        />
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Etsy Linki</label>
                        <input
                            style={s.input}
                            placeholder="https://etsy.com/listing/..."
                            value={form.etsy_link}
                            onChange={(e) => setForm({ ...form, etsy_link: e.target.value })}
                        />
                    </div>
                </div>

                {/* Sağ — Dosyalar */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={s.card}>
                        <div style={s.cardTitle}>Ürün Görseli</div>
                        <label style={s.uploadZone}>
                            {thumbnailPreview ? (
                                <img
                                    src={thumbnailPreview}
                                    alt="thumbnail"
                                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }}
                                />
                            ) : (
                                <div style={s.uploadPlaceholder}>
                                    <span style={{ fontSize: 32 }}>🖼️</span>
                                    <span style={s.uploadText}>Görsel yükle</span>
                                    <span style={s.uploadSub}>PNG, JPG, WEBP</span>
                                </div>
                            )}
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleThumbnailChange} />
                        </label>
                    </div>

                    <div style={s.card}>
                        <div style={s.cardTitle}>3D Model</div>
                        <label style={{ ...s.uploadZone, height: 120 }}>
                            <div style={s.uploadPlaceholder}>
                                <span style={{ fontSize: 32 }}>{glbFile ? "✅" : "📐"}</span>
                                <span style={s.uploadText}>{glbFile ? glbFile.name : "GLB dosyası yükle"}</span>
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
                </div>
            </div>
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
    presetCategory: {
        display: "flex", flexDirection: "column", gap: 4,
        padding: "10px 14px",
        background: "var(--accent-bg)",
        border: "1px solid var(--accent-border)",
        borderRadius: 10,
    },
    catBadge: {
        fontSize: 13, fontWeight: 600, color: "var(--accent-dark)",
    },
    textarea: {
        width: "100%", padding: "11px 14px",
        background: "var(--bg-input)",
        border: "1px solid var(--input-border)",
        borderRadius: 10, fontFamily: "'DM Sans', sans-serif",
        fontSize: 14, color: "var(--text-main)", outline: "none", resize: "vertical",
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
};