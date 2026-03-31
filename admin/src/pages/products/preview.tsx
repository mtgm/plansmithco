import { useParams, useNavigate } from "react-router";
import { useEffect, useState, useRef } from "react";
import { supabaseClient } from "../../providers/supabase-client";

type Product = {
    id: string;
    name: string;
    price: number | null;
    description: string | null;
    etsy_link: string | null;
    model_url: string | null;
    thumbnail_url: string | null;
};

type Variant = {
    id: string;
    variant_name: string;
    web_image_url: string | null;
    is_original: boolean;
    base_color_url: string | null;
    normal_url: string | null;
    orm_url: string | null;
};

type Material = {
    material_id: string;
    name: string;
    displayName: string;
    variants: Variant[];
    isExpanded: boolean;
    selectedVariantId: string | null;
};

export const ProductPreviewPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const modelViewerRef = useRef<any>(null);

    const [product, setProduct] = useState<Product | null>(null);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [modelRetry, setModelRetry] = useState(0);
    const [isDark, setIsDark] = useState(true);

    const s = getStyles(isDark);

    useEffect(() => {
        if (!id) return;
        loadData();
    }, [id]);

    const loadData = async () => {
        const { data: productData } = await supabaseClient
            .from("products").select("*").eq("id", id).single();
        setProduct(productData);

        const { data: mats } = await supabaseClient
            .from("product_materials").select("*").eq("product_id", id);

        const { data: variants } = await supabaseClient
            .from("product_variants")
            .select("*, variant_textures(*)")
            .eq("product_id", id);

        if (mats && variants) {
            const materialList: Material[] = mats.map((mat, idx) => {
                const matVariants = variants
                    .filter(v => v.material_id === mat.material_id)
                    .map(v => ({
                        id: v.id,
                        variant_name: v.variant_name,
                        web_image_url: v.web_image_url,
                        is_original: v.is_original,
                        base_color_url: v.variant_textures?.[0]?.base_color_url ?? null,
                        normal_url: v.variant_textures?.[0]?.normal_url ?? null,
                        orm_url: v.variant_textures?.[0]?.orm_url ?? null,
                    }));

                const originalVariant = matVariants.find(v => v.is_original);

                return {
                    material_id: mat.material_id,
                    name: mat.material_id,
                    displayName: mat.name,
                    variants: matVariants,
                    isExpanded: idx === 0,
                    selectedVariantId: originalVariant?.id ?? matVariants[0]?.id ?? null,
                };
            });
            setMaterials(materialList);
        }

        setLoading(false);
    };

    const applyTexture = async (variant: Variant, matName: string) => {
        const mv = modelViewerRef.current;
        if (!mv) return;
        try {
            await mv.updateComplete;
            const model = mv.model;
            if (!model) return;
            const mat = model.getMaterialByName(matName);
            if (!mat) return;

            const toBlob = async (url: string) => {
                if (url.startsWith("data:") || url.startsWith("blob:")) return url;
                try {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    return URL.createObjectURL(blob);
                } catch { return url; }
            };

            if (variant.base_color_url) {
                const tex = await mv.createTexture(await toBlob(variant.base_color_url));
                mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
            }
            if (variant.normal_url) {
                const tex = await mv.createTexture(await toBlob(variant.normal_url));
                mat.normalTexture.setTexture(tex);
            }
            if (variant.orm_url) {
                const tex = await mv.createTexture(await toBlob(variant.orm_url));
                mat.occlusionTexture.setTexture(tex);
            }
        } catch (e) {
            console.warn("Texture uygulama hatası:", e);
        }
    };

    const handleVariantSelect = (matId: string, variant: Variant, matName: string) => {
        setMaterials(prev => prev.map(m =>
            m.material_id === matId
                ? { ...m, selectedVariantId: variant.id }
                : m
        ));
        applyTexture(variant, matName);
    };

    const toggleExpand = (matId: string) => {
        setMaterials(prev => prev.map(m =>
            m.material_id === matId ? { ...m, isExpanded: !m.isExpanded } : m
        ));
    };

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: isDark ? "#0F0F0F" : "#FAF8F5" }}>
            <span style={{ color: isDark ? "#888" : "#6B6259", fontSize: 14 }}>Yükleniyor...</span>
        </div>
    );

    const modelSrc = product?.model_url
        ? `${product.model_url}${modelRetry > 0 ? `?retry=${modelRetry}` : ""}`
        : "";

    return (
        <div style={s.wrapper}>
            {/* Header */}
            <div style={s.header}>
                <button style={s.backBtn} onClick={() => navigate("/products")}>
                    ← Ürünlere Dön
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <button
                        onClick={() => setIsDark(!isDark)}
                        style={{
                            background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                            border: "none",
                            borderRadius: 20,
                            padding: "6px 14px",
                            cursor: "pointer",
                            color: isDark ? "#ECECEC" : "#2C2520",
                            fontSize: 13,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            transition: "all 0.2s",
                        }}
                    >
                        {isDark ? "☀️ Işık" : "🌙 Karanlık"}
                    </button>
                    <div style={s.headerBrand}>
                        <span style={{ fontSize: 18 }}>🌅</span>
                        <span style={s.brandName}>Plansmith.</span>
                    </div>
                </div>
            </div>

            <div style={s.mainGrid}>
                {/* Sol — 3D Viewer */}
                <div style={s.viewerSection}>
                    <div style={s.viewerCard}>
                        {/* @ts-ignore */}
                        <model-viewer
                            ref={modelViewerRef}
                            src={modelSrc}
                            camera-controls
                            auto-rotate
                            camera-orbit="auto auto 150%"
                            max-camera-orbit="auto auto 200%"
                            ar
                            shadow-intensity="1"
                            exposure="1.2"
                            tone-mapping="neutral"
                            style={{ width: "100%", height: "100%", borderRadius: 14 }}
                            onError={() => {
                                if (modelRetry < 3) setTimeout(() => setModelRetry(r => r + 1), 2000);
                            }}
                        />
                    </div>
                </div>

                {/* Sağ — Ürün Bilgileri */}
                <div style={s.infoSection}>
                    <div style={s.infoCard}>
                        {/* Badge */}
                        <span style={s.badge}>Ön İzleme</span>

                        {/* Başlık & Fiyat */}
                        <h1 style={s.productName}>{product?.name}</h1>
                        {product?.price && (
                            <div style={s.price}>
                                ₺{product.price.toLocaleString("tr-TR")}
                            </div>
                        )}

                        {/* Açıklama */}
                        {product?.description && (
                            <div style={s.descSection}>
                                <div style={s.sectionLabel}>Açıklama</div>
                                <p style={s.description}>{product.description}</p>
                            </div>
                        )}

                        {/* Varyasyonlar */}
                        {materials.length > 0 && (
                            <div style={s.variantsSection}>
                                {materials.map((mat) => (
                                    <div key={mat.material_id} style={s.materialBlock}>
                                        {/* Material Header */}
                                        <div
                                            style={s.materialHeader}
                                            onClick={() => toggleExpand(mat.material_id)}
                                        >
                                            <div style={s.sectionLabel}>{mat.displayName}</div>
                                            <div style={{
                                                ...s.chevron,
                                                transform: mat.isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                            }}>
                                                ▾
                                            </div>
                                        </div>

                                        {/* Varyasyon Seçenekleri */}
                                        {mat.isExpanded && (
                                            <div style={s.variantGrid}>
                                                {mat.variants.map((variant) => {
                                                    const isSelected = mat.selectedVariantId === variant.id;
                                                    return (
                                                        <div
                                                            key={variant.id}
                                                            style={{
                                                                ...s.variantItem,
                                                                borderColor: isSelected
                                                                    ? "#F59E0B"
                                                                    : (isDark ? "rgba(255,255,255,0.08)" : "rgba(44,37,32,0.1)"),
                                                                background: isSelected
                                                                    ? (isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.06)")
                                                                    : (isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.6)"),
                                                            }}
                                                            onClick={() => handleVariantSelect(mat.material_id, variant, mat.material_id)}
                                                        >
                                                            {/* Swatch */}
                                                            <div style={s.swatchBox}>
                                                                {variant.web_image_url ? (
                                                                    <img
                                                                        src={variant.web_image_url}
                                                                        alt={variant.variant_name}
                                                                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).style.display = "none";
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div style={{
                                                                        width: "100%", height: "100%",
                                                                        background: "rgba(245,158,11,0.1)",
                                                                        borderRadius: 8,
                                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                                        fontSize: 18,
                                                                    }}>
                                                                        🎨
                                                                    </div>
                                                                )}
                                                                {isSelected && (
                                                                    <div style={s.selectedTick}>✓</div>
                                                                )}
                                                            </div>
                                                            <div style={s.variantName}>
                                                                {variant.is_original ? "Orijinal" : variant.variant_name}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Butonlar */}
                        <div style={s.actions}>
                            {product?.etsy_link && (
                                <a
                                    href={product.etsy_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={s.etsyBtn}
                                >
                                    Etsy'de Gör →
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getStyles = (isDark: boolean): Record<string, React.CSSProperties> => ({
    wrapper: {
        minHeight: "100vh",
        background: isDark ? "#0F0F0F" : "#FAF8F5",
        backgroundImage: isDark
            ? "none"
            : `radial-gradient(at 10% 0%, hsla(35, 100%, 96%, 1) 0, transparent 50%), radial-gradient(at 90% 0%, hsla(50, 100%, 94%, 1) 0, transparent 50%), radial-gradient(at 50% 100%, hsla(20, 100%, 96%, 1) 0, transparent 50%)`,
        backgroundAttachment: "fixed",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 28px",
        position: "sticky" as const,
        top: 0,
        zIndex: 10,
        background: isDark ? "rgba(15,15,15,0.9)" : "rgba(250,248,245,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)"}`,
    },
    backBtn: {
        background: "none", border: "none",
        color: isDark ? "#888" : "#6B6259", fontSize: 13,
        cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
    },
    headerBrand: {
        display: "flex", alignItems: "center", gap: 8,
    },
    brandName: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 18, fontWeight: 800,
        letterSpacing: -0.5, color: isDark ? "#ECECEC" : "#2C2520",
    },
    mainGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 600px",
        gap: 0,
        minHeight: "calc(100vh - 57px)",
    },
    viewerSection: {
        padding: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    viewerCard: {
        width: "100%",
        maxWidth: 900,
        aspectRatio: "4 / 3",
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,252,248,0.5)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)"}`,
        borderRadius: 16,
        boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.3)" : "0 4px 24px rgba(44,37,32,0.06)",
        overflow: "hidden",
    },
    infoSection: {
        borderLeft: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(44,37,32,0.06)"}`,
        overflowY: "auto" as const,
        maxHeight: "calc(100vh - 57px)",
        background: isDark ? "rgba(255,255,255,0.02)" : "transparent",
    },
    infoCard: {
        padding: "28px 24px",
    },
    badge: {
        display: "inline-block",
        background: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.1)",
        color: isDark ? "#F59E0B" : "#C05621",
        fontSize: 10, fontWeight: 600,
        letterSpacing: 0.8,
        textTransform: "uppercase" as const,
        padding: "3px 8px",
        borderRadius: 100,
        border: `1px solid ${isDark ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.2)"}`,
        marginBottom: 12,
    },
    productName: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 22, fontWeight: 700,
        letterSpacing: -0.5, color: isDark ? "#ECECEC" : "#2C2520",
        lineHeight: 1.2, marginBottom: 6,
    },
    price: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 18, fontWeight: 600,
        color: isDark ? "#CFCFCF" : "#2C2520", marginBottom: 20,
        letterSpacing: -0.3,
    },
    descSection: {
        marginBottom: 20,
        paddingBottom: 20,
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(44,37,32,0.06)"}`,
    },
    sectionLabel: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 10, fontWeight: 600,
        letterSpacing: 1,
        textTransform: "uppercase" as const,
        color: isDark ? "#777" : "#8A8078", marginBottom: 8,
    },
    description: {
        fontSize: 13, color: isDark ? "#999" : "#6B6259",
        lineHeight: 1.6,
    },
    variantsSection: {
        marginBottom: 20,
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
    },
    materialBlock: {
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(44,37,32,0.05)"}`,
        paddingBottom: 12,
    },
    materialHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        paddingBottom: 8,
    },
    chevron: {
        fontSize: 14, color: isDark ? "#666" : "#8A8078",
        transition: "transform 0.2s",
    },
    variantGrid: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: 8,
    },
    variantItem: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        padding: 6,
        borderRadius: 10,
        border: "1.5px solid",
        transition: "all 0.15s",
        width: 64,
    },
    swatchBox: {
        width: 44, height: 44,
        borderRadius: 8,
        overflow: "hidden",
        position: "relative" as const,
        flexShrink: 0,
    },
    selectedTick: {
        position: "absolute" as const,
        top: -4, right: -4,
        width: 14, height: 14,
        borderRadius: "50%",
        background: "#F59E0B",
        color: "white",
        fontSize: 8, fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    variantName: {
        fontSize: 9, fontWeight: 500,
        color: isDark ? "#999" : "#6B6259",
        textAlign: "center" as const,
        maxWidth: 58,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
    },
    actions: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 8,
        marginTop: 6,
    },
    etsyBtn: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "12px 20px",
        background: "#F59E0B",
        color: isDark ? "#0F0F0F" : "white",
        fontFamily: "'Outfit', sans-serif",
        fontSize: 13, fontWeight: 600,
        borderRadius: 10,
        textDecoration: "none",
        boxShadow: isDark ? "0 2px 12px rgba(245,158,11,0.3)" : "0 2px 10px rgba(245,158,11,0.25)",
        transition: "all 0.2s",
    },
});