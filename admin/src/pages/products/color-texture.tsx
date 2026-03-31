import { useParams, useNavigate } from "react-router";
import { useEffect, useState, useRef } from "react";
import { supabaseClient } from "../../providers/supabase-client";
import { useGetIdentity } from "@refinedev/core";
import { parseMaterialsFromGlb } from "../../services/glbParser";
import { uploadToR2, dataUrlToFile } from "../../services/upload";

type Identity = { id: string };

type Variant = {
    id?: string;
    variant_name: string;
    web_image_url: string | null;
    base_color_url: string | null;
    normal_url: string | null;
    orm_url: string | null;
    is_original: boolean;
    isNew?: boolean;
    previewWebImage?: string | null;
    previewBaseColor?: string | null;
    previewNormal?: string | null;
    previewOrm?: string | null;
};

type MaterialTab = {
    material_id: string;
    name: string;
    displayName: string;
    variants: Variant[];
    isOpen: boolean;
};

export const ColorTexturePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: identity } = useGetIdentity<Identity>();
    const modelViewerRef = useRef<any>(null);

    const [product, setProduct] = useState<any>(null);
    const [materials, setMaterials] = useState<MaterialTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [activeVariantIdx, setActiveVariantIdx] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [companyId, setCompanyId] = useState<string>("");
    const [editingNameId, setEditingNameId] = useState<string | null>(null);

    useEffect(() => {
        if (!id || !identity?.id) return;
        loadData();
    }, [id, identity]);

    const loadData = async () => {
        try {
            const [{ data: adminUser }, { data: productData }, { data: existingVariants }, { data: existingMaterials }] = await Promise.all([
                supabaseClient
                    .from("admin_users")
                    .select("company_id")
                    .eq("id", identity!.id)
                    .single(),
                supabaseClient
                    .from("products")
                    .select("*")
                    .eq("id", id)
                    .single(),
                supabaseClient
                    .from("product_variants")
                    .select("*, variant_textures(*)")
                    .eq("product_id", id),
                supabaseClient
                    .from("product_materials")
                    .select("*")
                    .eq("product_id", id),
            ]);

            setCompanyId(adminUser?.company_id ?? "");
            setProduct(productData);

            if (productData?.model_url) {
                try {
                    const parsed = await parseMaterialsFromGlb(productData.model_url);


                    const tabs: MaterialTab[] = parsed.map((mat) => {
                        const savedMat = existingMaterials?.find((m) => m.material_id === mat.material_id);
                        const existing = existingVariants?.filter((v) => v.material_id === mat.material_id) ?? [];

                        const variants: Variant[] = existing.length > 0
                            ? existing.map((v) => ({
                                id: v.id,
                                variant_name: v.variant_name,
                                web_image_url: v.web_image_url,
                                base_color_url: v.variant_textures?.[0]?.base_color_url ?? null,
                                normal_url: v.variant_textures?.[0]?.normal_url ?? null,
                                orm_url: v.variant_textures?.[0]?.orm_url ?? null,
                                is_original: v.is_original,
                            }))
                            : [{
                                variant_name: "Orijinal",
                                web_image_url: null,
                                base_color_url: mat.textures.baseColorUrl,
                                normal_url: mat.textures.normalUrl,
                                orm_url: mat.textures.ormUrl,
                                is_original: true,
                                previewBaseColor: mat.textures.baseColorUrl,
                                previewNormal: mat.textures.normalUrl,
                                previewOrm: mat.textures.ormUrl,
                            }];

                        return {
                            material_id: mat.material_id,
                            name: mat.name,
                            displayName: savedMat?.name ?? mat.name,
                            variants,
                            isOpen: existing.length > 1,
                        };
                    });

                    setMaterials(tabs);

                    const firstOpenTab = tabs.find((t) => t.isOpen);
                    if (firstOpenTab) {
                        setActiveTabId(firstOpenTab.material_id);
                        setActiveVariantIdx((prev) => ({
                            ...prev,
                            [firstOpenTab.material_id]: 0,
                        }));
                    }
                } catch (e) {
                    console.error("GLB parse hatası:", e);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    // 2. kısım — texture kutusuna tıklayınca sekme aç
    const handleMaterialClick = (matId: string) => {
        setMaterials(prev => prev.map(m =>
            m.material_id === matId ? { ...m, isOpen: true } : m
        ));
        setActiveTabId(matId);
        if (!activeVariantIdx[matId]) {
            setActiveVariantIdx(prev => ({ ...prev, [matId]: 0 }));
        }
    };

    // 3. kısım — sekmeyi kapat
    const closeTab = (matId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setMaterials(prev => prev.map(m =>
            m.material_id === matId ? { ...m, isOpen: false } : m
        ));
        if (activeTabId === matId) {
            const openTabs = materials.filter(m => m.isOpen && m.material_id !== matId);
            setActiveTabId(openTabs.length > 0 ? openTabs[0].material_id : null);
        }
    };

    const activeMaterial = materials.find(m => m.material_id === activeTabId);
    const currentVariantIdx = activeTabId ? (activeVariantIdx[activeTabId] ?? 0) : 0;

    const updateVariantField = (matId: string, varIdx: number, field: keyof Variant, value: any) => {
        setMaterials(prev => prev.map(m => {
            if (m.material_id !== matId) return m;
            const variants = [...m.variants];
            variants[varIdx] = { ...variants[varIdx], [field]: value };
            return { ...m, variants };
        }));
    };

    const addVariant = (matId: string) => {
        const mat = materials.find(m => m.material_id === matId);
        const original = mat?.variants.find(v => v.is_original);

        setMaterials(prev => prev.map(m => {
            if (m.material_id !== matId) return m;
            return {
                ...m,
                variants: [...m.variants, {
                    variant_name: "Varyasyon " + m.variants.length,
                    web_image_url: null,
                    base_color_url: null,
                    normal_url: original?.normal_url ?? null,      // orijinalden al
                    orm_url: original?.orm_url ?? null,            // orijinalden al
                    is_original: false,
                    isNew: true,
                    previewNormal: original?.previewNormal ?? original?.normal_url ?? null,
                    previewOrm: original?.previewOrm ?? original?.orm_url ?? null,
                }],
            };
        }));
    };

    const removeVariant = async (matId: string, varIdx: number) => {
        const mat = materials.find(m => m.material_id === matId);
        const variant = mat?.variants[varIdx];
        if (!variant || variant.is_original) return;

        if (variant.id) {
            await supabaseClient.from("variant_textures").delete().eq("variant_id", variant.id);
            await supabaseClient.from("product_variants").delete().eq("id", variant.id);
        }

        setMaterials(prev => prev.map(m => {
            if (m.material_id !== matId) return m;
            const variants = m.variants.filter((_, i) => i !== varIdx);
            return { ...m, variants };
        }));

        if (currentVariantIdx >= varIdx) {
            setActiveVariantIdx(prev => ({ ...prev, [matId]: Math.max(0, currentVariantIdx - 1) }));
        }
    };

    const handleFileUpload = async (
        matId: string,
        varIdx: number,
        field: "web_image_url" | "base_color_url" | "normal_url" | "orm_url",
        file: File
    ) => {
        const previewUrl = URL.createObjectURL(file);
        const previewField =
            field === "web_image_url" ? "previewWebImage" :
                field === "base_color_url" ? "previewBaseColor" :
                    field === "normal_url" ? "previewNormal" : "previewOrm";

        updateVariantField(matId, varIdx, previewField as keyof Variant, previewUrl);

        // Klasör yapısı: products/URUN_ID/variants/TEXTURE_ADI/VARYASYON_ADI/
        const mat = materials.find(m => m.material_id === matId);
        const variant = mat?.variants[varIdx];
        const textureName = (mat?.displayName ?? matId.slice(0, 8))
            .replace(/[^a-zA-Z0-9_-]/g, "_");
        const variantName = (variant?.is_original ? "orijinal" : variant?.variant_name ?? "varyasyon")
            .replace(/[^a-zA-Z0-9_-]/g, "_");

        const folder = `products/${id}/variants/${textureName}/${variantName}`;
        const result = await uploadToR2(file, folder, companyId);
        updateVariantField(matId, varIdx, field, result.url);
    };

    const applyTextureToViewer = async (variant: Variant, matName: string) => {
        const mv = modelViewerRef.current;
        if (!mv) return;
        try {
            await mv.updateComplete;
            const model = mv.model;
            if (!model) return;

            const mat = model.getMaterialByName(matName);
            if (!mat) {
                console.warn("Material bulunamadı:", matName);
                return;
            }

            const baseUrl = variant.previewBaseColor ?? variant.base_color_url;
            const normalUrl = variant.previewNormal ?? variant.normal_url;
            const ormUrl = variant.previewOrm ?? variant.orm_url;

            if (baseUrl) {
                const tex = await mv.createTexture(baseUrl);
                mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
            }
            if (normalUrl) {
                const tex = await mv.createTexture(normalUrl);
                mat.normalTexture.setTexture(tex);
            }
            if (ormUrl) {
                const tex = await mv.createTexture(ormUrl);
                mat.occlusionTexture.setTexture(tex);
            }
        } catch (e) {
            console.warn("Texture uygulama hatası:", e);
        }
    };
    const [successMsg, setSuccessMsg] = useState("");
    const handleSave = async () => {
        setSaving(true);
        try {
            for (const mat of materials) {
                // Material kaydet
                await supabaseClient.from("product_materials").upsert({
                    product_id: id,
                    material_id: mat.material_id,
                    name: mat.displayName,
                }, { onConflict: "product_id,material_id" });

                for (let varIdx = 0; varIdx < mat.variants.length; varIdx++) {
                    const variant = mat.variants[varIdx];
                    const textureName = mat.displayName.replace(/[^a-zA-Z0-9_-]/g, "_");
                    const variantName = (variant.is_original ? "orijinal" : variant.variant_name)
                        .replace(/[^a-zA-Z0-9_-]/g, "_");
                    const folder = `products/${id}/variants/${textureName}/${variantName}`;

                    // Base64 olan orijinal texturları R2'ya yükle
                    let base_color_url = variant.base_color_url;
                    let normal_url = variant.normal_url;
                    let orm_url = variant.orm_url;

                    if (variant.is_original) {
                        if (base_color_url?.startsWith("data:")) {
                            const file = dataUrlToFile(base_color_url, "base_color.png");
                            const result = await uploadToR2(file, folder, companyId);
                            base_color_url = result.url;
                        }
                        if (normal_url?.startsWith("data:")) {
                            const file = dataUrlToFile(normal_url, "normal.png");
                            const result = await uploadToR2(file, folder, companyId);
                            normal_url = result.url;
                        }
                        if (orm_url?.startsWith("data:")) {
                            const file = dataUrlToFile(orm_url, "orm.png");
                            const result = await uploadToR2(file, folder, companyId);
                            orm_url = result.url;
                        }
                    }

                    if (variant.id) {
                        await supabaseClient.from("product_variants").update({
                            variant_name: variant.variant_name,
                            web_image_url: variant.web_image_url,
                        }).eq("id", variant.id);

                        await supabaseClient.from("variant_textures").update({
                            base_color_url,
                            normal_url,
                            orm_url,
                        }).eq("variant_id", variant.id);
                    } else {
                        const { data: nv } = await supabaseClient.from("product_variants")
                            .insert({
                                product_id: id,
                                material_id: mat.material_id,
                                variant_name: variant.variant_name,
                                web_image_url: variant.web_image_url,
                                is_original: variant.is_original,
                            }).select().single();

                        if (nv) {
                            await supabaseClient.from("variant_textures").insert({
                                variant_id: nv.id,
                                base_color_url,
                                normal_url,
                                orm_url,
                            });
                            updateVariantField(mat.material_id, varIdx, "id", nv.id);
                        }
                    }
                }
            }
            // alert("Kaydedildi ✅"); yerine:
            setSaving(false);
            // Başarı mesajı state
            setSuccessMsg("Kaydedildi ✅");
            navigate(`/products/${id}/customize`);
        } catch (e: any) {
            alert("Hata: " + e.message);
        }
        setSaving(false);
    };
    const highlightMaterial = async (matName: string) => {
        const mv = modelViewerRef.current;
        if (!mv) return;
        try {
            await mv.updateComplete;
            const model = mv.model;
            if (!model) return;
            // Diğer materialleri soldur
            for (let i = 0; i < model.materials.length; i++) {
                //model.materials[i].pbrMetallicRoughness.setBaseColorFactor([0.35, 0.35, 0.35, 1]);
            }
            // Hover'daki material'i accent rengiyle boyar
            const target = model.getMaterialByName(matName);
            if (target) {
                target.pbrMetallicRoughness.setBaseColorFactor([0.9, 0.05, 0.05, 1]); // #06eecfff accent
            }
        } catch (e) { }
    };

    const resetHighlight = async () => {
        const mv = modelViewerRef.current;
        if (!mv) return;
        try {
            await mv.updateComplete;
            const model = mv.model;
            if (!model) return;
            for (let i = 0; i < model.materials.length; i++) {
                model.materials[i].pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, 1]);
            }
        } catch (e) { }
    };

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 14 }}>GLB okunuyor...</span>
        </div>
    );

    const openTabs = materials.filter(m => m.isOpen);

    return (
        <div style={s.wrapper}>
            {/* Header */}
            <div style={s.header}>
                <div>
                    <button style={s.backBtn} onClick={() => navigate(`/products/${id}/customize`)}>← Geri</button>
                    <h1 style={s.title}>{product?.name} — Renk / Doku</h1>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {successMsg && (
                        <div style={{
                            background: "rgba(16,185,129,0.1)",
                            border: "1px solid rgba(16,185,129,0.3)",
                            color: "#10B981",
                            fontSize: 13, fontWeight: 600,
                            padding: "8px 14px", borderRadius: 10,
                        }}>
                            {successMsg}
                        </div>
                    )}
                    <button style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
                        {saving ? "Kaydediliyor..." : "💾 Kaydet"}
                    </button>
                </div>
            </div>

            <div style={s.mainGrid}>
                {/* Sol — Model Viewer */}
                <div style={s.viewerCard}>
                    <div style={s.cardLabel}>3D Önizleme</div>
                    {/* @ts-ignore */}
                    <model-viewer
                        ref={modelViewerRef}
                        src={product?.model_url}
                        camera-controls
                        auto-rotate
                        style={{ width: "100%", height: 380, borderRadius: 12, background: "transparent" }}
                    />
                </div>

                {/* Sağ Panel */}
                <div style={s.rightPanel}>

                    {/* 2. Kısım — Texture Kutucukları */}
                    <div style={s.panel}>
                        <div style={s.cardLabel}>Ürüne Ait Texturlar</div>
                        <div style={s.materialGrid}>
                            {materials.map((mat) => {
                                const isOpen = mat.isOpen;
                                const hasVariants = mat.variants.length > 1;
                                return (
                                    <div
                                        key={mat.material_id}
                                        style={{
                                            ...s.materialBox,
                                            borderColor: isOpen ? "var(--accent)" : "rgba(107,98,89,0.15)", // text-muted ~%15
                                            background: isOpen ? "var(--accent-bg)" : "var(--bg-elevated)",
                                        }}
                                        onClick={() => handleMaterialClick(mat.material_id)}
                                        onMouseEnter={() => highlightMaterial(mat.name)}
                                        onMouseLeave={() => resetHighlight()}
                                    >
                                        {hasVariants && <div style={s.greenTick}>✓</div>}
                                        <div style={s.matBoxName} title={mat.displayName}>
                                            {mat.displayName.length > 12
                                                ? mat.displayName.slice(0, 12) + "…"
                                                : mat.displayName}
                                        </div>
                                        <div style={s.matBoxId}>{mat.material_id.slice(0, 6)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. Kısım — Sekme Navigasyonu */}
                    {openTabs.length > 0 && (
                        <div style={s.panel}>
                            {/* Tab Bar */}
                            <div style={s.tabBar}>
                                {openTabs.map((mat) => (
                                    <div
                                        key={mat.material_id}
                                        style={{
                                            ...s.tab,
                                            background: activeTabId === mat.material_id ? "var(--accent)" : "var(--bg-input)",
                                            color: activeTabId === mat.material_id ? "#0F0F0F" : "var(--text-main)",
                                        }}
                                        onClick={() => setActiveTabId(mat.material_id)}
                                        onMouseEnter={() => highlightMaterial(mat.name)}
                                        onMouseLeave={() => resetHighlight()}
                                    >
                                        {/* Texture adı düzenlenebilir */}
                                        {editingNameId === mat.material_id ? (
                                            <input
                                                autoFocus
                                                style={{...s.tabNameInput, color: activeTabId === mat.material_id ? "#0F0F0F" : "var(--text-main)"}}
                                                value={mat.displayName}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => setMaterials(prev => prev.map(m =>
                                                    m.material_id === mat.material_id
                                                        ? { ...m, displayName: e.target.value }
                                                        : m
                                                ))}
                                                onBlur={() => setEditingNameId(null)}
                                                onKeyDown={(e) => e.key === "Enter" && setEditingNameId(null)}
                                            />
                                        ) : (
                                            <span
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingNameId(mat.material_id);
                                                }}
                                                title="Adı değiştirmek için çift tıklayın"
                                                style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                            >
                                                {mat.displayName.length > 10
                                                    ? mat.displayName.slice(0, 10) + "…"
                                                    : mat.displayName}
                                            </span>
                                        )}
                                        <span
                                            style={s.tabClose}
                                            onClick={(e) => closeTab(mat.material_id, e)}
                                        >✕</span>
                                    </div>
                                ))}
                            </div>

                            {/* 4. Kısım — Aktif Tab İçeriği */}
                            {activeMaterial && (
                                <div style={s.tabContent}>
                                    {/* Texture adı düzenleme notu */}
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14 }}>
                                        💡 Sekme adını değiştirmek için çift tıklayın — web'de bu isim görünür.
                                    </div>

                                    {/* Varyasyonlar — alt alta kesikli kutular */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                        {activeMaterial.variants.map((variant, varIdx) => {
                                            const isActive = currentVariantIdx === varIdx;
                                            return (
                                                <div
                                                    key={varIdx}
                                                    style={{
                                                        ...s.variantBox,
                                                        borderColor: isActive ? "var(--accent)" : "var(--border-color)",
                                                        background: isActive ? "var(--accent-bg)" : "var(--bg-elevated)",
                                                    }}

                                                >
                                                    {/* Kutu Header */}
                                                    <div style={s.variantBoxHeader}>
                                                        <div style={s.variantBoxTitle}>
                                                            {/* Radio butonu */}
                                                            <div
                                                                style={{
                                                                    width: 18, height: 18,
                                                                    borderRadius: "50%",
                                                                    border: `2px solid ${isActive ? "var(--accent)" : "rgba(107,98,89,0.4)"}`,
                                                                    background: isActive ? "var(--accent)" : "transparent",
                                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                                    flexShrink: 0, cursor: "pointer",
                                                                    transition: "all 0.15s",
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveVariantIdx(prev => ({ ...prev, [activeMaterial.material_id]: varIdx }));
                                                                    applyTextureToViewer(variant, activeMaterial.name);
                                                                }}
                                                            >
                                                                {isActive && (
                                                                    <div style={{
                                                                        width: 8, height: 8,
                                                                        borderRadius: "50%",
                                                                        background: "#0F0F0F",
                                                                    }} />
                                                                )}
                                                            </div>

                                                            {variant.is_original ? (
                                                                <span style={{ fontWeight: 700, color: "var(--text-main)", fontSize: 13 }}>Orijinal</span>
                                                            ) : (
                                                                <input
                                                                    style={s.variantNameInput}
                                                                    value={variant.variant_name}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onChange={(e) => updateVariantField(
                                                                        activeMaterial.material_id, varIdx, "variant_name", e.target.value
                                                                    )}
                                                                />
                                                            )}
                                                        </div>
                                                        {!variant.is_original && (
                                                            <button
                                                                style={s.deleteBtn}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeVariant(activeMaterial.material_id, varIdx);
                                                                }}
                                                            >🗑</button>
                                                        )}
                                                    </div>

                                                    {/* Texture Alanları */}
                                                    <div style={s.textureRow}>
                                                        <TextureBox
                                                            label="Web Görseli"
                                                            preview={variant.previewWebImage ?? variant.web_image_url}
                                                            disabled={false}
                                                            onFile={(f) => handleFileUpload(activeMaterial.material_id, varIdx, "web_image_url", f)}
                                                        />
                                                        <TextureBox
                                                            label="Base Color"
                                                            preview={variant.previewBaseColor ?? variant.base_color_url}
                                                            disabled={variant.is_original}
                                                            onFile={(f) => handleFileUpload(activeMaterial.material_id, varIdx, "base_color_url", f)}
                                                        />
                                                        <TextureBox
                                                            label="Normal Map"
                                                            preview={variant.previewNormal ?? variant.normal_url}
                                                            disabled={variant.is_original}
                                                            onFile={(f) => handleFileUpload(activeMaterial.material_id, varIdx, "normal_url", f)}
                                                        />
                                                        <TextureBox
                                                            label="ORM Map"
                                                            preview={variant.previewOrm ?? variant.orm_url}
                                                            disabled={variant.is_original}
                                                            onFile={(f) => handleFileUpload(activeMaterial.material_id, varIdx, "orm_url", f)}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Varyasyon Ekle Butonu */}
                                    <button
                                        style={s.addVariantBtn}
                                        onClick={() => addVariant(activeMaterial.material_id)}
                                    >
                                        + Yeni Varyasyon
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TextureBox = ({ label, preview, disabled, onFile }: {
    label: string;
    preview: string | null;
    disabled?: boolean;
    onFile: (f: File) => void;
}) => {
    const ref = useRef<HTMLInputElement>(null);
    const [imgError, setImgError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        setImgError(false);
        setRetryCount(0);
    }, [preview]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
            <div
                style={{
                    width: 80, height: 80, borderRadius: 10,
                    border: "2px dashed var(--accent-border)",
                    background: preview ? "transparent" : "var(--bg-app)",
                    overflow: "hidden",
                    cursor: disabled ? "default" : "pointer",
                    position: "relative",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                }}
                onClick={(e) => { e.stopPropagation(); !disabled && ref.current?.click(); }}
            >
                {preview ? (
                    <>
                        {imgError ? (
                            <div
                                style={{
                                    display: "flex", flexDirection: "column",
                                    alignItems: "center", justifyContent: "center",
                                    gap: 4, padding: 4,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setImgError(false);
                                    setRetryCount(r => r + 1);
                                }}
                            >
                                <span style={{ fontSize: 16 }}>🔄</span>
                                <span style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>Yenile</span>
                            </div>
                        ) : (
                            <img
                                src={preview + (retryCount > 0 ? `?r=${retryCount}` : "")}
                                alt={label}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                onError={() => setImgError(true)}
                            />
                        )}
                        {!disabled && !imgError && (
                            <div style={{
                                position: "absolute", bottom: 0, left: 0, right: 0,
                                background: "rgba(0,0,0,0.45)", color: "white",
                                fontSize: 9, textAlign: "center", padding: 2,
                            }}>Değiştir</div>
                        )}
                    </>
                ) : (
                    <span style={{ fontSize: 22, color: "var(--text-muted)", opacity: 0.5 }}>+</span>
                )}
            </div>
            <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </div>
    );
};

const s: Record<string, React.CSSProperties> = {
    wrapper: { maxWidth: 1300, margin: "0 auto" },
    header: {
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 20,
    },
    backBtn: {
        background: "none", border: "none", color: "var(--text-muted)",
        fontSize: 13, cursor: "pointer", padding: "0 0 6px",
        fontFamily: "'DM Sans', sans-serif",
    },
    title: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: "var(--text-main)",
    },
    saveBtn: {
        padding: "11px 22px", background: "var(--accent)", color: "#0F0F0F",
        fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700,
        border: "none", borderRadius: 12, cursor: "pointer",
        boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
    },
    mainGrid: {
        display: "grid",
        gridTemplateColumns: "380px 1fr",
        gap: 16, alignItems: "start",
    },
    viewerCard: {
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "var(--glass-border)",
        borderRadius: 20, padding: 16,
        boxShadow: "var(--glass-shadow)",
        position: "sticky", top: 20,
    },
    cardLabel: {
        fontFamily: "'Outfit', sans-serif",
        fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 10,
    },
    rightPanel: {
        display: "flex", flexDirection: "column", gap: 16,
    },
    panel: {
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "var(--glass-border)",
        borderRadius: 20, padding: 20,
        boxShadow: "var(--glass-shadow)",
    },
    materialGrid: {
        display: "flex", flexWrap: "wrap", gap: 10,
    },
    materialBox: {
        width: 100, height: 80,
        borderRadius: 12, border: "2px solid",
        cursor: "pointer", position: "relative",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 4, padding: 8, transition: "all 0.15s",
        textAlign: "center",
    },
    greenTick: {
        position: "absolute", top: -7, right: -7,
        width: 18, height: 18, borderRadius: "50%",
        background: "#10B981", color: "white",
        fontSize: 10, display: "flex",
        alignItems: "center", justifyContent: "center", fontWeight: 700,
    },
    matBoxName: {
        fontSize: 11, fontWeight: 600, color: "var(--text-main)", lineHeight: 1.3,
    },
    matBoxId: { fontSize: 10, color: "var(--text-muted)" },
    tabBar: {
        display: "flex", gap: 6, flexWrap: "wrap",
        marginBottom: 16,
        borderBottom: "2px solid var(--border-color)",
        paddingBottom: 12,
    },
    tab: {
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 12px", borderRadius: 100,
        fontSize: 12, fontWeight: 600,
        cursor: "pointer",
        border: "1px solid var(--accent-border)",
        transition: "all 0.15s",
    },
    tabNameInput: {
        background: "transparent", border: "none", outline: "none",
        fontSize: 12, fontWeight: 600,
        width: 80, padding: 0,
    },
    tabClose: {
        fontSize: 10, opacity: 0.7, cursor: "pointer",
        marginLeft: 2,
    },
    tabContent: {},
    variantBox: {
        border: "2px dashed",
        borderRadius: 14, padding: 16,
        cursor: "pointer", transition: "all 0.15s",
    },
    variantBoxHeader: {
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 14,
    },
    variantBoxTitle: {
        display: "flex", alignItems: "center", gap: 8,
    },
    activeDot: {
        width: 8, height: 8, borderRadius: "50%",
        background: "var(--accent)", display: "inline-block", flexShrink: 0,
    },
    variantNameInput: {
        background: "var(--bg-input)",
        border: "1px solid var(--input-border)",
        borderRadius: 8, padding: "5px 10px",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13, fontWeight: 600, color: "var(--text-main)",
        outline: "none",
    },
    deleteBtn: {
        background: "rgba(192,86,33,0.08)",
        border: "1px solid rgba(192,86,33,0.2)",
        borderRadius: 8, padding: "4px 8px",
        cursor: "pointer", fontSize: 13, color: "var(--accent-dark)",
    },
    textureRow: {
        display: "flex", gap: 16, flexWrap: "wrap",
    },
    addVariantBtn: {
        width: "100%", padding: "12px",
        background: "transparent",
        border: "2px dashed var(--accent-border)",
        borderRadius: 12, color: "var(--accent-dark)",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13, fontWeight: 600, cursor: "pointer",
        marginTop: 16,
    },
};
