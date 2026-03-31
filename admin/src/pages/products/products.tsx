import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { supabaseClient } from "../../providers/supabase-client";
import { useGetIdentity } from "@refinedev/core";
import { useSearchParams } from "react-router";
import { deleteFromR2 } from "../../services/upload";

type Identity = { id: string };

type Category = { id: string; name: string };

type Product = {
    id: string;
    name: string;
    sku: string | null;
    price: number | null;
    thumbnail_url: string | null;
    model_url: string | null;
    is_active: boolean;
    product_category_id: string | null;
    category?: Category | null;
    created_at: string;
};

export const ProductsPage = () => {
    const navigate = useNavigate();
    const { data: identity } = useGetIdentity<Identity>();

    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [searchParams] = useSearchParams();
    const categoryFromUrl = searchParams.get("category");

    useEffect(() => {
        if (!identity?.id) return;
        loadData();
    }, [identity]);

    useEffect(() => {
        if (categoryFromUrl) {
            setFilterCategory(categoryFromUrl);
        }
    }, [categoryFromUrl]);

    const loadData = async () => {
        const { data: adminUser } = await supabaseClient
            .from("admin_users").select("company_id").eq("id", identity!.id).single();
        const cid = adminUser?.company_id;

        const { data: cats } = await supabaseClient
            .from("product_categories")
            .select("id, name")
            .eq("company_id", cid)
            .eq("is_active", true);
        setCategories(cats ?? []);

        const { data: prods } = await supabaseClient
            .from("products")
            .select("*, product_categories(id, name)")
            .eq("company_id", cid)
            .order("created_at", { ascending: false });

        if (prods) {
            setProducts(prods.map((p: any) => ({
                ...p,
                category: p.product_categories,
            })));
        }

        setLoading(false);
    };

    const toggleActive = async (product: Product) => {
        await supabaseClient.from("products")
            .update({ is_active: !product.is_active }).eq("id", product.id);
        await loadData();
    };

    const handleDelete = async (productId: string) => {
        if (!confirm("Bu ürünü silmek istediğinizden emin misiniz?")) return;

        const { data: adminUser } = await supabaseClient
            .from("admin_users")
            .select("company_id")
            .eq("id", identity!.id)
            .single();

        const cid = adminUser?.company_id;
        if (!cid) {
            alert("Şirket bilgisi bulunamadı.");
            return;
        }

        const { data: variants } = await supabaseClient
            .from("product_variants")
            .select("id, web_image_url")
            .eq("product_id", productId);

        const variantIds = variants?.map(v => v.id) ?? [];

        const product = products.find(p => p.id === productId);

        let textures: any[] = [];
        if (variantIds.length > 0) {
            const { data } = await supabaseClient
                .from("variant_textures")
                .select("*")
                .in("variant_id", variantIds);

            textures = data ?? [];
        }

        const deletePromises: Promise<any>[] = [
            ...(textures ?? []).flatMap(tex => [
                tex.base_color_url
                    ? deleteFromR2(tex.base_color_url, cid).catch((err) => {
                        console.error("Base color silinemedi:", tex.base_color_url, err);
                    })
                    : null,
                tex.normal_url
                    ? deleteFromR2(tex.normal_url, cid).catch((err) => {
                        console.error("Normal map silinemedi:", tex.normal_url, err);
                    })
                    : null,
                tex.orm_url
                    ? deleteFromR2(tex.orm_url, cid).catch((err) => {
                        console.error("ORM map silinemedi:", tex.orm_url, err);
                    })
                    : null,
            ]),
            ...(variants ?? []).map(v =>
                v.web_image_url
                    ? deleteFromR2(v.web_image_url, cid).catch((err) => {
                        console.error("Variant web görseli silinemedi:", v.web_image_url, err);
                    })
                    : null
            ),
            product?.thumbnail_url
                ? deleteFromR2(product.thumbnail_url, cid).catch((err) => {
                    console.error("Thumbnail silinemedi:", product.thumbnail_url, err);
                })
                : null,
            product?.model_url
                ? deleteFromR2(product.model_url, cid).catch((err) => {
                    console.error("Model silinemedi:", product.model_url, err);
                })
                : null,
        ].filter(Boolean) as Promise<any>[];

        // R2 silmeleri paralel çalışsın
        await Promise.allSettled(deletePromises);

        // Supabase kayıtlarını sil
        if (variantIds.length > 0) {
            await supabaseClient
                .from("variant_textures")
                .delete()
                .in("variant_id", variantIds);
        }

        await supabaseClient.from("product_variants").delete().eq("product_id", productId);
        await supabaseClient.from("product_materials").delete().eq("product_id", productId);
        await supabaseClient.from("products").delete().eq("id", productId);

        await loadData();
    };

    const filtered = products.filter((p) => {
        if (filterCategory !== "all" && p.product_category_id !== filterCategory) return false;
        if (filterStatus === "active" && !p.is_active) return false;
        if (filterStatus === "passive" && p.is_active) return false;
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

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
                    <h1 style={s.title}>Ürünler</h1>
                    <p style={s.subtitle}>{filtered.length} ürün listeleniyor</p>
                </div>
                <button style={s.addBtn} onClick={() => navigate("/products/create")}>
                    ＋ Yeni Ürün
                </button>
            </div>

            {/* Filtreler */}
            <div style={s.filters}>
                <input
                    style={s.searchInput}
                    placeholder="🔍 Ürün ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    style={s.select}
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                >
                    <option value="all">Tüm Kategoriler</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
                <select
                    style={s.select}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="all">Tüm Durumlar</option>
                    <option value="active">Aktif</option>
                    <option value="passive">Pasif</option>
                </select>
            </div>

            {/* Ürün Tablosu */}
            {filtered.length === 0 ? (
                <div style={s.empty}>
                    <span style={{ fontSize: 40 }}>📦</span>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 12 }}>
                        Ürün bulunamadı.
                    </p>
                    <button style={s.addBtn} onClick={() => navigate("/products/create")}>
                        Ürün Ekle
                    </button>
                </div>
            ) : (
                <div style={s.tableCard}>
                    <table style={s.table}>
                        <thead>
                            <tr>
                                <th style={s.th}>Ürün</th>
                                <th style={s.th}>Kategori</th>
                                <th style={s.th}>SKU</th>
                                <th style={s.th}>Fiyat</th>
                                <th style={s.th}>Durum</th>
                                <th style={s.th}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((product) => (
                                <tr key={product.id} style={s.tr}>
                                    {/* Ürün */}
                                    <td style={s.td}>
                                        <div style={s.productCell}>
                                            <div style={s.thumb}>
                                                {product.thumbnail_url ? (
                                                    <img
                                                        src={product.thumbnail_url}
                                                        alt={product.name}
                                                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }}
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = "none";
                                                        }}
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: 20 }}>📦</span>
                                                )}
                                            </div>
                                            <span style={s.productName}>{product.name}</span>
                                        </div>
                                    </td>

                                    {/* Kategori */}
                                    <td style={s.td}>
                                        {product.category ? (
                                            <span style={s.catBadge}>{product.category.name}</span>
                                        ) : (
                                            <span style={{ fontSize: 12, color: "var(--text-muted)", opacity: 0.6 }}>—</span>
                                        )}
                                    </td>

                                    {/* SKU */}
                                    <td style={s.td}>
                                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                            {product.sku ?? "—"}
                                        </span>
                                    </td>

                                    {/* Fiyat */}
                                    <td style={s.td}>
                                        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>
                                            {product.price ? `₺${product.price.toLocaleString("tr-TR")}` : "—"}
                                        </span>
                                    </td>

                                    {/* Durum Toggle */}
                                    <td style={s.td}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <div
                                                style={{
                                                    ...s.toggle,
                                                    background: product.is_active ? "#10B981" : "var(--border-color)",
                                                }}
                                                onClick={() => toggleActive(product)}
                                            >
                                                <div style={{
                                                    ...s.toggleThumb,
                                                    transform: product.is_active ? "translateX(20px)" : "translateX(2px)",
                                                    background: "var(--bg-app)"
                                                }} />
                                            </div>
                                            <span style={{
                                                fontSize: 11, fontWeight: 600,
                                                color: product.is_active ? "#059669" : "var(--text-muted)",
                                            }}>
                                                {product.is_active ? "Aktif" : "Pasif"}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Aksiyonlar */}
                                    <td style={s.td}>
                                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                            <button
                                                style={s.actionBtn}
                                                onClick={() => window.open(`/products/${product.id}/preview`, "_blank")}
                                                title="Ön İzleme"
                                            >
                                                👁️
                                            </button>
                                            <button
                                                style={s.actionBtn}
                                                onClick={() => navigate(`/products/${product.id}/customize`)}
                                                title="Özelleştir"
                                            >
                                                🎨
                                            </button>
                                            <button
                                                style={s.actionBtn}
                                                onClick={() => navigate(`/products/${product.id}/edit`)}
                                                title="Düzenle"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                style={{ ...s.actionBtn, color: "var(--accent-dark)" }}
                                                onClick={() => handleDelete(product.id)}
                                                title="Sil"
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const s: Record<string, React.CSSProperties> = {
    wrapper: { maxWidth: 1100, margin: "0 auto" },
    header: {
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 24,
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
    filters: {
        display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap",
    },
    searchInput: {
        flex: 1, minWidth: 200, padding: "10px 14px",
        background: "var(--bg-input)",
        border: "1px solid var(--input-border)",
        borderRadius: 12, fontFamily: "'DM Sans', sans-serif",
        fontSize: 13, color: "var(--text-main)", outline: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    },
    select: {
        padding: "10px 14px",
        background: "var(--bg-input)",
        border: "1px solid var(--input-border)",
        borderRadius: 12, fontFamily: "'DM Sans', sans-serif",
        fontSize: 13, color: "var(--text-main)", outline: "none",
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    },
    tableCard: {
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "var(--glass-border)",
        borderRadius: 20,
        boxShadow: "var(--glass-shadow)",
        overflow: "hidden",
    },
    table: {
        width: "100%", borderCollapse: "collapse",
    },
    th: {
        padding: "14px 16px",
        fontSize: 11, fontWeight: 700,
        letterSpacing: 0.8, textTransform: "uppercase",
        color: "var(--text-muted)", textAlign: "left" as const,
        borderBottom: "1px solid var(--border-color)",
    },
    tr: {
        borderBottom: "1px solid var(--border-light)",
        transition: "background 0.15s",
    },
    td: {
        padding: "14px 16px",
        fontSize: 13, color: "var(--text-main)",
        verticalAlign: "middle" as const,
    },
    productCell: {
        display: "flex", alignItems: "center", gap: 12,
    },
    thumb: {
        width: 44, height: 44,
        borderRadius: 10,
        background: "var(--accent-bg)",
        border: "1px solid var(--accent-border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", flexShrink: 0,
    },
    productName: {
        fontWeight: 600, fontSize: 13, color: "var(--text-main)",
    },
    catBadge: {
        fontSize: 11, fontWeight: 600,
        background: "var(--accent-bg)",
        color: "var(--accent-dark)",
        padding: "3px 8px", borderRadius: 100,
    },
    toggle: {
        width: 42, height: 24, borderRadius: 100,
        cursor: "pointer", position: "relative" as const,
        transition: "background 0.2s", flexShrink: 0,
    },
    toggleThumb: {
        position: "absolute" as const, top: 2,
        width: 20, height: 20, borderRadius: "50%",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        transition: "transform 0.2s",
    },
    actionBtn: {
        padding: "6px 10px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
        color: "var(--text-main)",
        borderRadius: 8, cursor: "pointer",
        fontSize: 14,
    },
    empty: {
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 12, padding: "80px 0",
    },
};