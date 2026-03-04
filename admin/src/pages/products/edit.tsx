import React, { useState, useEffect, useRef } from 'react';
import { Edit, useForm, useSelect } from "@refinedev/antd";
import { useGetIdentity, useInvalidate } from "@refinedev/core";
import {
    Form,
    Input,
    InputNumber,
    Select,
    Upload,
    Button,
    message,
    Steps,
    Row,
    Col,
    Card,
    Switch,
    List,
    Typography,
    Collapse,
    Space,
    Popconfirm,
    Spin,
    Divider,
    Checkbox,
    Modal,
    Tooltip
} from "antd";
import {
    UploadOutlined,
    PlusOutlined,
    DeleteOutlined,
    ArrowRightOutlined,
    ArrowLeftOutlined,
    SaveOutlined,
    EditOutlined,
    CheckCircleOutlined,
    FolderOpenOutlined
} from "@ant-design/icons";
import { slugify, uploadToR2, renameR2Folder } from "../../utility/uploadToR2";
import { parseGLB, MaterialInfo } from "../../utility/glbParser";
import { CustomAttributesManager, CustomAttribute } from "../../components/products/CustomAttributesManager";
import { ThreeModelViewer } from "../../components/products/ThreeModelViewer";
import { supabaseClient } from "../../utility/supabaseClient";

import { FileManager } from "../../components/file-manager/FileManager";
import { R2File, deleteR2Folder } from "../../utility/storageOperations";
import { downloadR2FileAsBlob } from "../../utility/r2Download";

const { TextArea } = Input;
const { Panel } = Collapse;

// ─── Types ───────────────────────────────────────────────────────────────────

interface VariantData {
    dbId?: string;                   // Database ID for existing variants
    variantName: string;
    isOriginal: boolean;             // true = derived from GLB (read-only textures)

    swatchFile: File | null;
    swatchPreview: string | null;    // URL for UI display

    baseColorFile: File | null;
    baseColorPreview: string | null;

    normalFile: File | null;
    normalPreview: string | null;

    ormFile: File | null;
    ormPreview: string | null;
}

interface MaterialWithVariants {
    dbId?: string;                   // Database ID for existing material
    material: MaterialInfo;          // GLB material info
    displayName: string;             // Editable name
    isManaged: boolean;              // True if added to variant management
    variants: VariantData[];
}

export const ProductEdit = () => {
    // ─── Refine Hooks ───
    const { formProps, saveButtonProps, queryResult, onFinish } = useForm({
        meta: {
            select: "*",
        },
        queryOptions: {
            staleTime: 0,
            refetchOnWindowFocus: true,
        }
    });
    const invalidate = useInvalidate();

    const productData = queryResult?.data?.data;
    const productId = productData?.id;

    // ─── User Identity ───
    const { data: identity } = useGetIdentity<{
        id: string;
        role: string;
        company_id: string;
        company?: { company_name: string };
    }>();

    const isSuperAdmin = identity?.role === 'super_admin';
    const userCompanyId = identity?.company_id;

    console.log("!!! PRODUCT LIST COMPONENT RENDERED !!! (VERSION 2)");
    const userCompanyName = identity?.company?.company_name;

    // ─── State: General ───
    const [loading, setLoading] = useState(false);
    const [parsingGLB, setParsingGLB] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    // ─── State: Company Select (Super Admin) ───
    const { selectProps: companySelectProps } = useSelect({
        resource: "companies",
        optionLabel: "company_name",
        optionValue: "id",
    });

    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [selectedCompanyName, setSelectedCompanyName] = useState<string>('');
    const [selectedCompanyBucket, setSelectedCompanyBucket] = useState<string | undefined>();
    const [selectedCompanyDomain, setSelectedCompanyDomain] = useState<string | undefined>();

    // ─── State: File Uploads & Previews ───
    const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(null);
    const [selectedThumbnailFile, setSelectedThumbnailFile] = useState<File | null>(null);
    const [selectedR2Thumbnail, setSelectedR2Thumbnail] = useState<{ url: string } | null>(null);

    const [previewModelUrl, setPreviewModelUrl] = useState<string | null>(null);
    const [selectedModelFile, setSelectedModelFile] = useState<File | null>(null);
    const [selectedR2Model, setSelectedR2Model] = useState<{ url: string } | null>(null);

    // ─── State: Materials & Variants ───
    const [parsedMaterials, setParsedMaterials] = useState<MaterialInfo[]>([]);
    const [materialsWithVariants, setMaterialsWithVariants] = useState<MaterialWithVariants[]>([]);
    const [highlightMaterial, setHighlightMaterial] = useState<string | null>(null);

    // ─── State: Custom Attributes ───
    const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>([]);

    // ─── State: Modals ───
    const [mediaModalVisible, setMediaModalVisible] = useState(false);
    const [mediaModalTarget, setMediaModalTarget] = useState<'thumbnail' | 'model' | null>(null);

    const [variantR2PickerVisible, setVariantR2PickerVisible] = useState(false);
    const [variantR2PickerTarget, setVariantR2PickerTarget] = useState<{
        matIdx: number;
        varIdx: number;
        type: 'swatch' | 'baseColor' | 'normal' | 'orm';
    } | null>(null);

    // ─── State: Deletion Tracking ───
    const [deletedVariantsInfo, setDeletedVariantsInfo] = useState<{ dbId: string; r2Path: string }[]>([]);

    // ─── Ref: Initialization Guard ───
    const initializingRef = useRef(false);
    const lastInitProductId = useRef<string | null>(null);

    const cacheBust = (url: string | null) => {
        if (!url) return null;
        // avoid double ?v
        const clean = url.replace(/[?&]v=\d+$/, '');
        const sep = clean.includes('?') ? '&' : '?';
        return `${clean}${sep}v=${Date.now()}`;
    };


    // ─── Category Select ───
    const { selectProps: categorySelectProps } = useSelect({
        resource: "product_categories",
        optionLabel: "name",
        optionValue: "id",
        defaultValue: productData?.product_category_id || undefined,
    });

    // ─── Effect: Initialize Product ───
    useEffect(() => {
        if (productData?.id && (isSuperAdmin || userCompanyId)) {
            initializeProduct(productData);
        }
    }, [productData, userCompanyId, isSuperAdmin]);

    // ─── Initialization Logic ────────────────────────────────────────────────────

    const initializeProduct = async (product: any) => {
        if (!product?.id) return;

        // Prevent unnecessary re-initialization if same product
        if (initializingRef.current && lastInitProductId.current === product.id) {
            console.log("Already initializing this product, skipping...");
            return;
        }

        console.log("Initializing Product Data:", product.id);
        initializingRef.current = true;
        lastInitProductId.current = product.id;

        setLoading(true);
        try {
            // 1. Set Basic Info
            if (product.custom_attributes) {
                try {
                    const parsed = typeof product.custom_attributes === 'string'
                        ? JSON.parse(product.custom_attributes)
                        : product.custom_attributes;
                    setCustomAttributes(parsed);
                } catch (e) {
                    console.error("Error parsing attributes", e);
                }
            }

            // 2. Fetch Company Details
            const companyRes = (isSuperAdmin && product.company_id)
                ? await supabaseClient.from('companies').select('storage_bucket, storage_domain, company_name').eq('id', product.company_id).single()
                : (!isSuperAdmin && userCompanyId)
                    ? await supabaseClient.from('companies').select('storage_bucket, storage_domain, company_name').eq('id', userCompanyId).single()
                    : { data: null, error: null };

            // 3. Set Company Info and Local Config
            let activeBucket = import.meta.env.VITE_R2_BUCKET_NAME;
            let activeDomain = import.meta.env.VITE_R2_PUBLIC_URL;

            if (companyRes.data) {
                const data = companyRes.data as any;
                setSelectedCompanyId(product.company_id || userCompanyId);
                setSelectedCompanyName(data.company_name);

                activeBucket = data.storage_bucket || activeBucket;
                activeDomain = data.storage_domain || activeDomain;

                setSelectedCompanyBucket(activeBucket);
                setSelectedCompanyDomain(activeDomain);
            } else if (!isSuperAdmin) {
                setSelectedCompanyId(userCompanyId || null);
                setSelectedCompanyName(userCompanyName || '');
                setSelectedCompanyBucket(activeBucket);
                setSelectedCompanyDomain(activeDomain);
            }

            const activeDomainFetch = activeDomain || import.meta.env.VITE_R2_PUBLIC_URL || '';

            // 4. Fetch Materials from DB
            const { data: dbMaterials, error: matError } = await supabaseClient
                .from('product_materials')
                .select(`
                    id,
                    material_id,
                    name,
                    product_variants (
                        id,
                        variant_name,
                        is_original,
                        swatch_url,
                        variant_textures (
                            base_color_url,
                            normal_url,
                            orm_url
                        )
                    )
                `)
                .eq('product_id', product.id);

            if (matError) throw matError;

            const dbMapped: MaterialWithVariants[] = (dbMaterials || []).map((dbMat: any) => ({
                dbId: dbMat.id,
                material: {
                    id: dbMat.material_id,
                    name: dbMat.name,
                    index: 0,
                    baseColorTexture: null,
                    normalTexture: null,
                    ormTexture: null
                },
                displayName: dbMat.name,
                isManaged: true,
                variants: dbMat.product_variants.map((v: any) => {
                    let textures: any = {};
                    if (v.variant_textures) {
                        textures = Array.isArray(v.variant_textures) ? v.variant_textures[0] || {} : v.variant_textures;
                    }

                    const ensureFullUrlLocal = (url: any) => {
                        if (!url || typeof url !== 'string') return null;
                        const trimmed = url.trim();
                        if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '{}') return null;
                        if (trimmed.length < 5 && !trimmed.startsWith('data:') && !trimmed.startsWith('blob:')) return null;

                        let finalUrl = trimmed;
                        if (product.id && product.name) {
                            const oldSlug = slugify(product.name);
                            const oldPattern = new RegExp(`/products/${oldSlug}/`, 'g');
                            if (oldPattern.test(finalUrl)) {
                                finalUrl = finalUrl.replace(oldPattern, `/products/${product.id}/`);
                            }
                        }

                        if (!finalUrl.startsWith('http') && !finalUrl.startsWith('data:') && !finalUrl.startsWith('blob:')) {
                            const domain = activeDomainFetch.trim().endsWith('/') ? activeDomainFetch.trim().slice(0, -1) : activeDomainFetch.trim();
                            const cleanDomain = domain.startsWith('http') ? domain : `https://${domain}`;
                            const path = finalUrl.trim().startsWith('/') ? finalUrl.trim() : `/${finalUrl.trim()}`;
                            return `${cleanDomain}${path}`.replace(/([^:]\/)\/+/g, "$1");
                        }
                        return finalUrl;
                    };

                    const isOriginal = v.is_original === true || v.variant_name === 'Orijinal' || v.variant_name === 'Original';
                    const baseColor = cacheBust(ensureFullUrlLocal(textures.base_color_url));
                    const normal = cacheBust(ensureFullUrlLocal(textures.normal_url));
                    const orm = cacheBust(ensureFullUrlLocal(textures.orm_url));
                    const swatch = cacheBust(ensureFullUrlLocal(v.swatch_url) || baseColor);

                    return {
                        dbId: v.id,
                        variantName: v.variant_name,
                        isOriginal: isOriginal,
                        swatchFile: null,
                        swatchPreview: swatch,
                        baseColorFile: null,
                        baseColorPreview: baseColor,
                        normalFile: null,
                        normalPreview: normal,
                        ormFile: null,
                        ormPreview: orm
                    };
                })
            }));

            // 5. Previews
            if (product.thumbnail_url) {
                setPreviewThumbnail(product.thumbnail_url);
                if (product.thumbnail_url.includes('r2') || product.thumbnail_url.includes('http')) {
                    setSelectedR2Thumbnail({ url: product.thumbnail_url });
                }
            }

            if (product.model_url) {
                setPreviewModelUrl(product.model_url);
                if (product.model_url.includes('r2') || product.model_url.includes('http')) {
                    setSelectedR2Model({ url: product.model_url });
                }

                // Download & Parse GLB
                try {
                    setParsingGLB(true);
                    const blobUrl = await downloadR2FileAsBlob(
                        product.model_url,
                        activeBucket,
                        activeDomain
                    );

                    setPreviewModelUrl(blobUrl);

                    const response = await fetch(blobUrl);
                    const blob = await response.blob();
                    const file = new File([blob], "model.glb", { type: 'model/gltf-binary' });

                    const info = await parseGLB(file);
                    setParsedMaterials(info.materials);

                    // ATOMIC MERGE
                    const finalMaterials: MaterialWithVariants[] = info.materials.map(glbMat => {
                        const match = dbMapped.find((m) => {
                            const dbMatId = String(m.material.id || '').trim().toLowerCase();
                            const dbName = String(m.material.name || m.displayName || '').trim().toLowerCase();
                            const glbId = String(glbMat.id || '').trim().toLowerCase();
                            const glbName = String(glbMat.name || '').trim().toLowerCase();
                            return dbMatId === glbId || dbName === glbName || dbMatId === glbName || dbName === glbId;
                        });

                        const glbFallback = {
                            baseColor: glbMat.baseColorTexture?.url || null,
                            normal: glbMat.normalTexture?.url || null,
                            orm: glbMat.ormTexture?.url || null
                        };

                        if (match) {
                            return {
                                ...match,
                                material: glbMat,
                                variants: match.variants.map(v => {
                                    if (v.isOriginal) {
                                        return {
                                            ...v,
                                            baseColorPreview: v.baseColorPreview || glbFallback.baseColor,
                                            normalPreview: v.normalPreview || glbFallback.normal,
                                            ormPreview: v.ormPreview || glbFallback.orm,
                                            swatchPreview: v.swatchPreview || glbFallback.baseColor
                                        };
                                    }
                                    return v;
                                })
                            };
                        } else {
                            return {
                                material: glbMat,
                                displayName: glbMat.name,
                                isManaged: false,
                                variants: [{
                                    variantName: 'Orijinal',
                                    isOriginal: true,
                                    swatchFile: null,
                                    swatchPreview: null,
                                    baseColorFile: null,
                                    baseColorPreview: glbFallback.baseColor,
                                    normalFile: null,
                                    normalPreview: glbFallback.normal,
                                    ormFile: null,
                                    ormPreview: glbFallback.orm,
                                }]
                            };
                        }
                    });

                    setMaterialsWithVariants(finalMaterials);

                } catch (e: any) {
                    console.error("GLB Parse Error:", e);
                    message.error("GLB dosyası analiz edilemedi: " + e.message);
                    setMaterialsWithVariants(dbMapped); // Fallback to DB results if parse fails
                } finally {
                    setParsingGLB(false);
                }
            } else {
                // No model, just show DB materials
                setMaterialsWithVariants(dbMapped);
            }

        } catch (error: any) {
            console.error("Initialization error:", error);
            message.error("Ürün bilgileri yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
            initializingRef.current = false;
        }
    };

    // Helper for outer initialization
    const ensureFullUrlLocal = (url: any, domain: string) => {
        if (!url || typeof url !== 'string' || url.length < 5) return url;
        if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;
        const cleanDomain = domain.endsWith('/') ? domain.slice(0, -1) : domain;
        const baseDomain = cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`;
        const path = url.startsWith('/') ? url : `/${url}`;
        return `${baseDomain}${path}`;
    };

    // ─── Handlers: Company ───
    const handleCompanyChange = async (value: any, option: any) => {
        setSelectedCompanyId(value);
        setSelectedCompanyName(option.children as string);

        // Fetch company specific storage config
        const { data } = await supabaseClient
            .from('companies')
            .select('storage_bucket, storage_domain')
            .eq('id', value)
            .single();

        if (data) {
            setSelectedCompanyBucket(data.storage_bucket);
            setSelectedCompanyDomain(data.storage_domain);
        }
    };

    // ─── Handlers: Files (Main) ───
    const handleThumbnailSelect = (file: File) => {
        setSelectedThumbnailFile(file);
        setSelectedR2Thumbnail(null); // Clear R2 selection
        setPreviewThumbnail(URL.createObjectURL(file));
        return false;
    };

    const handleModelSelect = async (file: File) => {
        setSelectedModelFile(file);
        setSelectedR2Model(null);
        setPreviewModelUrl(URL.createObjectURL(file));

        setParsingGLB(true);
        try {
            const info = await parseGLB(file);
            setParsedMaterials(info.materials);

            // Re-init variants
            const initialized: MaterialWithVariants[] = info.materials.map(mat => ({
                material: mat,
                displayName: mat.name,
                isManaged: false,
                variants: [{
                    variantName: 'Orijinal',
                    isOriginal: true,
                    swatchFile: null,
                    swatchPreview: null,
                    baseColorFile: null,
                    baseColorPreview: mat.baseColorTexture?.url || null,
                    normalFile: null,
                    normalPreview: mat.normalTexture?.url || null,
                    ormFile: null,
                    ormPreview: mat.ormTexture?.url || null,
                }]
            }));
            setMaterialsWithVariants(initialized);
            message.success(`Yeni model yüklendi: ${info.materials.length} materyal`);
            message.warning("Model değiştiği için varyasyon ayarları sıfırlandı.");
        } catch (error: any) {
            message.error("GLB parse hatası: " + error.message);
        } finally {
            setParsingGLB(false);
        }
        return false;
    };

    // ─── Handlers: Media Manager ───
    const handleMediaSelect = async (file: R2File) => {
        setMediaModalVisible(false);
        const target = mediaModalTarget;
        setMediaModalTarget(null);

        if (target === 'thumbnail') {
            setSelectedR2Thumbnail({ url: file.url });
            setSelectedThumbnailFile(null);
            setPreviewThumbnail(file.url);
        } else if (target === 'model') {
            setSelectedR2Model({ url: file.url });
            setSelectedModelFile(null);
            setPreviewModelUrl(file.url);

            // Parse remote GLB
            setParsingGLB(true);
            try {
                if (!file.url) throw new Error("Dosya URL'si bulunamadı");
                const bucketName = selectedCompanyBucket || import.meta.env.VITE_R2_BUCKET_NAME || '';
                const domain = selectedCompanyDomain || import.meta.env.VITE_R2_PUBLIC_URL || '';

                const blobUrl = await downloadR2FileAsBlob(file.url as string, bucketName, domain);
                setPreviewModelUrl(blobUrl);

                const response = await fetch(blobUrl);
                const blob = await response.blob();
                const fileObj = new File([blob], "model.glb", { type: 'model/gltf-binary' });

                const info = await parseGLB(fileObj);
                setParsedMaterials(info.materials);

                // Re-init variants
                const initialized: MaterialWithVariants[] = info.materials.map(mat => ({
                    material: mat,
                    displayName: mat.name,
                    isManaged: false,
                    variants: [{
                        variantName: 'Orijinal',
                        isOriginal: true,
                        swatchFile: null,
                        swatchPreview: null,
                        baseColorFile: null,
                        baseColorPreview: mat.baseColorTexture?.url || null,
                        normalFile: null,
                        normalPreview: mat.normalTexture?.url || null,
                        ormFile: null,
                        ormPreview: mat.ormTexture?.url || null,
                    }]
                }));
                setMaterialsWithVariants(initialized);
                message.success("Model güncellendi");
            } catch (e) {
                console.error(e);
                message.error("Remote GLB parse hatası");
            } finally {
                setParsingGLB(false);
            }
        }
    };

    // ─── Handlers: Variant Management ───
    const toggleMaterialManaged = (index: number) => {
        setMaterialsWithVariants(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], isManaged: !updated[index].isManaged };
            return updated;
        });
    };

    const updateMaterialDisplayName = (index: number, val: string) => {
        setMaterialsWithVariants(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], displayName: val };
            return updated;
        });
    };

    const addVariant = (matIdx: number) => {
        setMaterialsWithVariants(prev => {
            const updated = [...prev];
            const mat = { ...updated[matIdx] };

            // Get original's base color as default for new variant's swatch
            const originalMat = mat.variants.find(v => v.isOriginal);
            const defaultSwatch = originalMat?.baseColorPreview || null;

            mat.variants = [...mat.variants, {
                variantName: `Varyasyon ${mat.variants.length + 1}`,
                isOriginal: false,
                swatchFile: null,
                swatchPreview: defaultSwatch,
                baseColorFile: null,
                baseColorPreview: null,
                normalFile: null,
                normalPreview: null,
                ormFile: null,
                ormPreview: null,
            }];
            updated[matIdx] = mat;
            return updated;
        });
    };

    const removeVariant = (matIdx: number, varIdx: number) => {
        setMaterialsWithVariants(prev => {
            const updated = [...prev];
            const mat = updated[matIdx];
            const variant = mat.variants[varIdx];

            // Track for physical deletion if it exists in DB
            if (variant.dbId) {
                const sanitizedMatId = slugify(mat.material.id);
                const sanitizedVariantName = slugify(variant.variantName);

                // Use productId if available, otherwise fallback (safety)
                const folderRef = productId || 'temp';
                const r2Path = `products/${folderRef}/materials/${sanitizedMatId}/${sanitizedVariantName}`;

                setDeletedVariantsInfo(d => [...d, { dbId: variant.dbId!, r2Path }]);
            }

            const newVariants = [...mat.variants];
            newVariants.splice(varIdx, 1);
            updated[matIdx] = { ...mat, variants: newVariants };
            return updated;
        });
    };

    const updateVariantName = (matIdx: number, varIdx: number, val: string) => {
        const updated = [...materialsWithVariants];
        updated[matIdx].variants[varIdx].variantName = val;
        setMaterialsWithVariants(updated);
    };

    // Variant File Handling
    const handleVariantFile = (matIdx: number, varIdx: number, type: 'swatch' | 'baseColor' | 'normal' | 'orm', file: File) => {
        const updated = [...materialsWithVariants];
        const variant = updated[matIdx].variants[varIdx];
        const previewUrl = URL.createObjectURL(file);

        if (type === 'swatch') {
            variant.swatchFile = file;
            variant.swatchPreview = previewUrl;
        } else if (type === 'baseColor') {
            variant.baseColorFile = file;
            variant.baseColorPreview = previewUrl;
        } else if (type === 'normal') {
            variant.normalFile = file;
            variant.normalPreview = previewUrl;
        } else if (type === 'orm') {
            variant.ormFile = file;
            variant.ormPreview = previewUrl;
        }

        setMaterialsWithVariants(updated);
        return false;
    };

    // Variant R2 Picker
    const openVariantR2Picker = (matIdx: number, varIdx: number, type: 'swatch' | 'baseColor' | 'normal' | 'orm') => {
        setVariantR2PickerTarget({ matIdx, varIdx, type });
        setVariantR2PickerVisible(true);
    };

    const handleVariantR2Select = (file: R2File) => {
        if (!variantR2PickerTarget) return;
        const { matIdx, varIdx, type } = variantR2PickerTarget;

        const updated = [...materialsWithVariants];
        const variant = updated[matIdx].variants[varIdx];

        // Ensure full URL with protocol
        let finalUrl = file.url;
        if (finalUrl && !finalUrl.startsWith('http') && !finalUrl.startsWith('data:') && !finalUrl.startsWith('blob:')) {
            const domain = selectedCompanyDomain || import.meta.env.VITE_R2_PUBLIC_URL;
            let cleanDomain = domain ? (domain.trim().endsWith('/') ? domain.trim().slice(0, -1) : domain.trim()) : '';
            if (cleanDomain && !cleanDomain.startsWith('http')) {
                cleanDomain = `https://${cleanDomain}`;
            }

            const path = finalUrl.trim().startsWith('/') ? finalUrl.trim() : `/${finalUrl.trim()}`;
            finalUrl = cleanDomain ? `${cleanDomain}${path}`.replace(/([^:]\/)\/+/g, "$1") : finalUrl;
        }

        console.log(`R2 Selection normalized: ${file.url} -> ${finalUrl}`);

        if (type === 'swatch') {
            variant.swatchFile = null;
            variant.swatchPreview = finalUrl;
        } else if (type === 'baseColor') {
            variant.baseColorFile = null;
            variant.baseColorPreview = finalUrl;
        } else if (type === 'normal') {
            variant.normalFile = null;
            variant.normalPreview = finalUrl;
        } else if (type === 'orm') {
            variant.ormFile = null;
            variant.ormPreview = finalUrl;
        }

        setMaterialsWithVariants(updated);
        setVariantR2PickerVisible(false);
        setVariantR2PickerTarget(null);
    };

    // ─── Navigation & Submit ───
    const goToNextStep = () => {
        formProps.form?.validateFields().then(async () => {
            if (currentStep === 0) {
                if (!previewModelUrl) {
                    message.warning("Lütfen bir model dosyası yükleyin.");
                    return;
                }

                if (materialsWithVariants.length === 0 && !parsingGLB) {
                    // If no DB materials and not parsing, something is wrong
                    message.warning("Model analizi tamamlanmadı veya materyal bulunamadı.");
                    return;
                }
                setCurrentStep(1);
            } else if (currentStep === 1) {
                setCurrentStep(2);
            }
        }).catch((e) => {
            console.error(e);
            message.error("Lütfen zorunlu alanları doldurun.");
        });
    };

    const handleFormSubmit = async (values: any) => {
        setSaving(true);
        try {
            // 1. Upload Main Files
            let thumbnailUrl = productData?.thumbnail_url;
            let modelUrl = productData?.model_url;

            const effectiveCompanyName = selectedCompanyName || userCompanyName || 'default';
            const productName = String(values.name).trim();
            const originalProductName = productData?.name;

            const productFolder = `products/${productId}`;

            // ─── R2 Migration & Cleanup Logic ───
            // 1. Identify if migration is needed (legacy name-based folders)
            const oldSlug = originalProductName ? slugify(originalProductName) : null;

            // Comprehensive check: model, thumbnail, or ANY texture preview
            const checkNeedsMigration = (url: string | null | undefined) => {
                if (!url || typeof url !== 'string' || !oldSlug) return false;
                return url.includes(`/products/${oldSlug}/`);
            };

            let needsMigration = checkNeedsMigration(modelUrl) || checkNeedsMigration(thumbnailUrl);

            // If not found in main files, check all variant textures
            if (!needsMigration) {
                for (const mat of materialsWithVariants) {
                    for (const v of mat.variants) {
                        if (checkNeedsMigration(v.swatchPreview) ||
                            checkNeedsMigration(v.baseColorPreview) ||
                            checkNeedsMigration(v.normalPreview) ||
                            checkNeedsMigration(v.ormPreview)) {
                            needsMigration = true;
                            break;
                        }
                    }
                    if (needsMigration) break;
                }
            }

            if (productId && needsMigration && oldSlug) {
                console.log(`DEEP MIGRATION: Name-based R2 folder detected (${oldSlug}). Moving to ID-based folder (${productId})...`);
                const bucket = selectedCompanyBucket || import.meta.env.VITE_R2_BUCKET_NAME;
                const defaultBucket = import.meta.env.VITE_R2_BUCKET_NAME;
                const isDedicatedBucket = selectedCompanyBucket && selectedCompanyBucket !== defaultBucket;

                let oldR2Prefix = `products/${oldSlug}`;
                let newR2Prefix = `products/${productId}`;

                if (!isDedicatedBucket) {
                    oldR2Prefix = `${effectiveCompanyName}/${oldR2Prefix}`;
                    newR2Prefix = `${effectiveCompanyName}/${newR2Prefix}`;
                }

                try {
                    await renameR2Folder(oldR2Prefix, newR2Prefix, bucket);

                    // Permanent URL Update Helper
                    const migrateToIdUrl = (url: string | null | undefined): string | null => {
                        if (!url || typeof url !== 'string' || !oldSlug) return url ?? null;
                        const oldPattern = new RegExp(`/products/${oldSlug}/`, 'g');
                        if (oldPattern.test(url)) {
                            return url.replace(oldPattern, `/products/${productId}/`);
                        }
                        return url;
                    };

                    thumbnailUrl = migrateToIdUrl(thumbnailUrl);
                    modelUrl = migrateToIdUrl(modelUrl);

                    // Update UI previews and internal state so save uses correct URLs
                    if (previewThumbnail) setPreviewThumbnail(migrateToIdUrl(previewThumbnail));
                    if (previewModelUrl) setPreviewModelUrl(migrateToIdUrl(previewModelUrl));

                    setMaterialsWithVariants(prev => prev.map(mat => ({
                        ...mat,
                        variants: mat.variants.map(v => ({
                            ...v,
                            swatchPreview: migrateToIdUrl(v.swatchPreview),
                            baseColorPreview: migrateToIdUrl(v.baseColorPreview),
                            normalPreview: migrateToIdUrl(v.normalPreview),
                            ormPreview: migrateToIdUrl(v.ormPreview),
                        }))
                    })));

                    setDeletedVariantsInfo(prev => prev.map(info => ({
                        ...info,
                        r2Path: migrateToIdUrl(info.r2Path) || info.r2Path
                    })));

                    console.log("Migration successful. All URLs updated to ID-based paths.");
                } catch (e) {
                    console.error("R2 Migration failed:", e);
                    message.error("Dosyalar taşınırken bir hata oluştu: " + e);
                }
            }

            // Parallel Uploads for Main Files
            const uploadTasks: Promise<any>[] = [];

            if (selectedThumbnailFile) {
                uploadTasks.push(uploadToR2(
                    selectedThumbnailFile,
                    productFolder,
                    effectiveCompanyName,
                    selectedCompanyBucket,
                    selectedCompanyDomain
                ).then(url => thumbnailUrl = url));
            } else if (selectedR2Thumbnail) {
                thumbnailUrl = selectedR2Thumbnail.url;
            }

            if (selectedModelFile) {
                const bucket = selectedCompanyBucket || import.meta.env.VITE_R2_BUCKET_NAME;
                uploadTasks.push(uploadToR2(
                    selectedModelFile,
                    productFolder,
                    effectiveCompanyName,
                    bucket,
                    selectedCompanyDomain
                ).then(url => modelUrl = url));
            } else if (selectedR2Model) {
                modelUrl = selectedR2Model.url;
            }

            await Promise.all(uploadTasks);

            // 2. Prepare Product Data update
            const updatePayload = {
                ...values,
                thumbnail_url: thumbnailUrl,
                model_url: modelUrl,
                company_id: selectedCompanyId, // Ensure company is set
                custom_attributes: customAttributes.length > 0 ? JSON.stringify(customAttributes) : null,
            };

            // 3. Call Refine onFinish (Updates 'products' table)
            await onFinish(updatePayload);

            // 4. Update Materials & Variants (Complex Part)
            if (productData?.id) {
                await saveMaterialsAndVariants(String(productData.id));
            }

            message.success("Ürün başarıyla güncellendi!");
        } catch (error: any) {
            console.error(error);
            message.error("Hata: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    async function saveMaterialsAndVariants(productId: string) {
        let successCount = 0;
        let failCount = 0;
        const baseProductFolder = `products/${productId}`;

        console.log("Starting Robust Save Process (Edit) for Product:", productId);

        const bucketName = selectedCompanyBucket || import.meta.env.VITE_R2_BUCKET_NAME;
        const effectiveCompanyName = selectedCompanyName || userCompanyName || 'default';

        // 0. Physical Deletion from DB and R2
        if (deletedVariantsInfo.length > 0) {
            console.log(`Physically deleting ${deletedVariantsInfo.length} variants...`);
            await Promise.all(deletedVariantsInfo.map(async ({ dbId, r2Path }) => {
                try {
                    // Delete from DB (FKs should handle textures)
                    await supabaseClient.from('product_variants').delete().eq('id', dbId);
                    // Delete from R2
                    await deleteR2Folder(r2Path, bucketName);
                } catch (e) {
                    console.error(`Failed to delete variant ${dbId}:`, e);
                }
            }));
            setDeletedVariantsInfo([]); // Clear after processing
        }

        // 0.5 Handle unmanaged materials (Hata 4)
        // We catch materials that are NOT managed and delete them from DB and R2
        for (const mat of materialsWithVariants) {
            if (!mat.isManaged && mat.dbId) {
                console.log(`Deleting unmanaged material: ${mat.material.id}`);
                const sanitizedMatId = slugify(mat.material.id);
                const matFolder = `${baseProductFolder}/materials/${sanitizedMatId}`;

                try {
                    await supabaseClient.from('product_materials').delete().eq('id', mat.dbId);
                    await deleteR2Folder(matFolder, bucketName);
                    // Update local state to remove dbId so it doesn't try again
                    mat.dbId = undefined;
                } catch (e) {
                    console.error(`Failed to delete unmanaged material ${mat.material.id}:`, e);
                }
            }
        }

        // 1. Parallel Material Processing
        await Promise.all(materialsWithVariants.map(async (mat) => {
            if (!mat.isManaged) return;

            console.log(`Processing Material: ${mat.material.id} (${mat.displayName})`);

            // Upsert Material
            const { data: matData, error: matErr } = await supabaseClient
                .from('product_materials')
                .upsert({
                    product_id: productId,
                    material_id: mat.material.id,
                    name: mat.displayName
                }, { onConflict: 'product_id,material_id' })
                .select()
                .single();

            if (matErr) {
                console.error(`Material Upsert Error (${mat.material.id}):`, matErr);
                throw matErr;
            }

            // Upsert Variants in Parallel
            await Promise.all(mat.variants.map(async (variant) => {
                const sanitizedMatId = slugify(mat.material.id);
                const sanitizedVariantName = slugify(variant.variantName);

                const variantFolder = `${baseProductFolder}/materials/${sanitizedMatId}/${sanitizedVariantName}`;

                // Refined uploadOrKeep for Upsert
                const uploadOrKeep = async (file: File | null | undefined, preview: string | null | undefined, fileName: string) => {
                    if (file) {
                        return await uploadToR2(file, variantFolder, effectiveCompanyName, bucketName, selectedCompanyDomain);
                    }
                    if (preview?.startsWith('data:') || preview?.startsWith('blob:')) {
                        try {
                            const res = await fetch(preview);
                            if (!res.ok) throw new Error("Fetch failed");
                            const blob = await res.blob();
                            const f = new File([blob], fileName, { type: blob.type });
                            return await uploadToR2(f, variantFolder, effectiveCompanyName, bucketName, selectedCompanyDomain);
                        } catch (e) {
                            console.error(`Failed to upload data/blob URL for ${fileName}:`, e);
                            return null;
                        }
                    }

                    if (preview && preview.startsWith('http')) return preview;
                    if (preview && !preview.startsWith('data:') && !preview.startsWith('blob:')) return preview;

                    return null;
                };

                const [swatchUrl, baseColorUrl, normalUrl, ormUrl] = await Promise.all([
                    uploadOrKeep(variant.swatchFile, variant.swatchPreview, 'swatch.png'),
                    uploadOrKeep(variant.baseColorFile, variant.baseColorPreview, 'baseColor.png'),
                    uploadOrKeep(variant.normalFile, variant.normalPreview, 'normal.png'),
                    uploadOrKeep(variant.ormFile, variant.ormPreview, 'orm.png')
                ]);

                // Upsert Variant
                const { data: varData, error: varErr } = await supabaseClient
                    .from('product_variants')
                    .upsert({
                        material_id: matData.id,
                        variant_name: variant.variantName,
                        is_original: variant.isOriginal,
                        swatch_url: swatchUrl
                    }, { onConflict: 'material_id,variant_name' })
                    .select()
                    .single();

                if (varErr) {
                    console.error(`Variant Upsert Error (${variant.variantName}):`, varErr);
                    throw varErr;
                }

                // Upsert Textures
                const { error: texErr } = await supabaseClient
                    .from('variant_textures')
                    .upsert({
                        variant_id: varData.id,
                        base_color_url: baseColorUrl,
                        normal_url: normalUrl,
                        orm_url: ormUrl
                    }, { onConflict: 'variant_id' });

                if (texErr) {
                    console.error(`Texture Upsert Error for variant ${variant.variantName}:`, texErr);
                    throw texErr;
                }
            }));
        }));
        console.log("Robust Save Process Completed Successfully.");
    };


    // ─── Render ──────────────────────────────────────────────────────────────────

    return (
        <Edit
            saveButtonProps={{
                ...saveButtonProps,
                loading: saving,
                onClick: () => handleFormSubmit(formProps.form?.getFieldsValue()),
                children: "Güncelle"
            }}
            deleteButtonProps={{
                onSuccess: () => {
                    const pid = productData?.id;
                    if (pid) {
                        const bucket = selectedCompanyBucket || import.meta.env.VITE_R2_BUCKET_NAME;
                        deleteR2Folder(`products/${pid}`, bucket).catch(e => {
                            console.error("Failed to cleanup R2 folder after product deletion:", e);
                        });
                    }
                }
            }}
            title="Ürün Düzenle"
        >
            <Spin spinning={loading} tip="Yükleniyor...">

                {/* Steps */}
                <Steps
                    current={currentStep}
                    items={[
                        { title: 'Temel Bilgiler' },
                        { title: 'Model & Varyasyon' },
                        { title: 'Ürün Özeti' },
                    ]}
                    style={{ marginBottom: 24 }}
                />

                <Form {...formProps} layout="vertical">

                    {/* STEP 1 */}
                    <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
                        <Row gutter={24}>
                            <Col xs={24} lg={12}>
                                <Card title="Genel Bilgiler" style={{ marginBottom: 16 }}>
                                    {isSuperAdmin && (
                                        <Form.Item label="Firma" name="company_id" rules={[{ required: true }]}>
                                            <Select {...companySelectProps} onChange={handleCompanyChange} />
                                        </Form.Item>
                                    )}
                                    <Form.Item label="Kategori" name="product_category_id" rules={[{ required: true }]}>
                                        <Select {...categorySelectProps} />
                                    </Form.Item>
                                    <Form.Item label="Ürün Adı" name="name" rules={[{ required: true }]}>
                                        <Input />
                                    </Form.Item>
                                    <Row gutter={16}>
                                        <Col span={12}><Form.Item label="SKU" name="sku"><Input /></Form.Item></Col>
                                    </Row>
                                    <Row gutter={16}>
                                        <Col span={12}><Form.Item label="Fiyat" name="price"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                                        <Col span={12}><Form.Item label="Aktif" name="is_active" valuePropName="checked"><Switch /></Form.Item></Col>
                                    </Row>
                                    <Form.Item label="Açıklama" name="description"><TextArea rows={3} /></Form.Item>

                                    <Form.Item label="Thumbnail">
                                        <Space>
                                            <Upload showUploadList={false} beforeUpload={handleThumbnailSelect}>
                                                <Button icon={<UploadOutlined />}>Yükle</Button>
                                            </Upload>
                                            <Button icon={<PlusOutlined />} onClick={() => { setMediaModalTarget('thumbnail'); setMediaModalVisible(true); }}>Medya</Button>
                                        </Space>
                                        {previewThumbnail && <img src={previewThumbnail} style={{ width: 100, marginTop: 8 }} />}
                                    </Form.Item>

                                    <Form.Item label="3D Model (GLB)">
                                        <Space>
                                            <Upload accept=".glb" showUploadList={false} beforeUpload={handleModelSelect}>
                                                <Button icon={<UploadOutlined />} loading={parsingGLB}>{selectedModelFile ? selectedModelFile.name : 'Model Yükle'}</Button>
                                            </Upload>
                                            <Button icon={<PlusOutlined />} onClick={() => { setMediaModalTarget('model'); setMediaModalVisible(true); }}>Medya</Button>
                                        </Space>
                                        {selectedR2Model && <div style={{ color: 'green', fontSize: 12 }}>R2 Modeli Seçili</div>}
                                    </Form.Item>

                                    <Form.Item label="Etsy Link" name="etsy_link"><Input /></Form.Item>

                                    {/* Attributes */}
                                    <CustomAttributesManager initialAttributes={customAttributes} onChange={setCustomAttributes} />
                                </Card>
                            </Col>

                            <Col xs={24} lg={12}>
                                <Card title="Önizleme">
                                    {parsingGLB ? <Spin /> : previewModelUrl ? (
                                        <ThreeModelViewer
                                            modelUrl={previewModelUrl}
                                            imageUrl={null}
                                            width="100%"
                                            height="400px"
                                            highlightMaterial={highlightMaterial}
                                        />
                                    ) : <div style={{ height: 400, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Model yok</div>}
                                </Card>
                            </Col>
                        </Row>

                        <div style={{ textAlign: 'right', marginTop: 16 }}>
                            <Button type="primary" onClick={goToNextStep} disabled={!parsedMaterials.length}>İleri: Varyasyonlar <ArrowRightOutlined /></Button>
                        </div>
                    </div>

                    {/* STEP 2 */}
                    <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
                        <Card title="Materyaller ve Varyasyonlar">
                            <Typography.Paragraph type="secondary">
                                Modeldeki materyalleri yönetmek için seçiniz.
                            </Typography.Paragraph>

                            <List
                                dataSource={materialsWithVariants}
                                renderItem={(item, index) => (
                                    <List.Item
                                        actions={[
                                            <Checkbox checked={item.isManaged} onChange={() => toggleMaterialManaged(index)}>
                                                {item.isManaged ? 'Yönetiliyor' : 'Yönet'}
                                            </Checkbox>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={item.material.name}
                                            description={
                                                <Space>
                                                    {item.variants[0]?.baseColorPreview && <img src={item.variants[0].baseColorPreview} width={24} />}
                                                    {item.isManaged && <CheckCircleOutlined style={{ color: 'green' }} />}
                                                </Space>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        </Card>

                        {materialsWithVariants.some(m => m.isManaged) && (
                            <Card title="Varyasyon Düzenle" style={{ marginTop: 24 }}>
                                <Collapse>
                                    {materialsWithVariants.map((mat, matIdx) => {
                                        if (!mat.isManaged) return null;
                                        return (
                                            <Panel header={`${mat.material.name} (${mat.displayName})`} key={mat.material.id}>
                                                <div style={{ marginBottom: 16 }}>
                                                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Görünen Ad</Typography.Text>
                                                    <Space.Compact style={{ width: '100%' }}>
                                                        <Input
                                                            value={mat.displayName}
                                                            onChange={(e) => updateMaterialDisplayName(matIdx, e.target.value)}
                                                            placeholder="Materyal adını giriniz"
                                                        />
                                                    </Space.Compact>
                                                </div>

                                                {mat.variants.map((v, varIdx) => (
                                                    <Card
                                                        key={varIdx}
                                                        type="inner"
                                                        title={v.variantName}
                                                        extra={!v.isOriginal && <Button danger size="small" icon={<DeleteOutlined />} onClick={() => removeVariant(matIdx, varIdx)} />}
                                                        style={{ marginBottom: 12 }}
                                                    >
                                                        <Row gutter={16}>
                                                            <Col span={6}>
                                                                <Input
                                                                    value={v.variantName}
                                                                    onChange={(e) => updateVariantName(matIdx, varIdx, e.target.value)}
                                                                    disabled={v.isOriginal}
                                                                    placeholder="Varyasyon Adı"
                                                                />
                                                            </Col>
                                                            <Col span={4}>
                                                                <div>Swatch</div>
                                                                <Space>
                                                                    <Upload showUploadList={false} beforeUpload={(f) => handleVariantFile(matIdx, varIdx, 'swatch', f)}>
                                                                        <Button size="small">Yükle</Button>
                                                                    </Upload>
                                                                    <Button size="small" onClick={() => openVariantR2Picker(matIdx, varIdx, 'swatch')}>R2</Button>
                                                                </Space>
                                                                {v.swatchPreview && <img src={v.swatchPreview} width={32} style={{ marginTop: 4, display: 'block' }} />}
                                                            </Col>
                                                            <Col span={4}>
                                                                <div>Base Color</div>
                                                                {!v.isOriginal && (
                                                                    <Space>
                                                                        <Upload showUploadList={false} beforeUpload={(f) => handleVariantFile(matIdx, varIdx, 'baseColor', f)}>
                                                                            <Button size="small">Yükle</Button>
                                                                        </Upload>
                                                                        <Button size="small" onClick={() => openVariantR2Picker(matIdx, varIdx, 'baseColor')}>R2</Button>
                                                                    </Space>
                                                                )}
                                                                {v.baseColorPreview && <img src={v.baseColorPreview} width={32} style={{ marginTop: 4, display: 'block' }} />}
                                                            </Col>
                                                            <Col span={5}>
                                                                <div>Normal Map</div>
                                                                {!v.isOriginal && (
                                                                    <Space>
                                                                        <Upload showUploadList={false} beforeUpload={(f) => handleVariantFile(matIdx, varIdx, 'normal', f)}>
                                                                            <Button size="small">Yükle</Button>
                                                                        </Upload>
                                                                        <Button size="small" onClick={() => openVariantR2Picker(matIdx, varIdx, 'normal')}>R2</Button>
                                                                    </Space>
                                                                )}
                                                                {v.normalPreview && <img src={v.normalPreview} width={32} style={{ marginTop: 4, display: 'block' }} />}
                                                            </Col>
                                                            <Col span={5}>
                                                                <div>ORM Map</div>
                                                                {!v.isOriginal && (
                                                                    <Space>
                                                                        <Upload showUploadList={false} beforeUpload={(f) => handleVariantFile(matIdx, varIdx, 'orm', f)}>
                                                                            <Button size="small">Yükle</Button>
                                                                        </Upload>
                                                                        <Button size="small" onClick={() => openVariantR2Picker(matIdx, varIdx, 'orm')}>R2</Button>
                                                                    </Space>
                                                                )}
                                                                {v.ormPreview && <img src={v.ormPreview} width={32} style={{ marginTop: 4, display: 'block' }} />}
                                                            </Col>
                                                        </Row>
                                                    </Card>
                                                ))}

                                                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => addVariant(matIdx)}>Yeni Varyasyon</Button>
                                            </Panel>
                                        );
                                    })}
                                </Collapse>
                            </Card>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                            <Button icon={<ArrowLeftOutlined />} onClick={() => setCurrentStep(0)}>Geri</Button>
                            <Button type="primary" onClick={goToNextStep}>İleri: Ürün Özeti <ArrowRightOutlined /></Button>
                        </div>
                    </div>

                    {/* STEP 3 - Ürün Özeti */}
                    <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
                        <Card title="Ürün Özeti" style={{ marginBottom: 24 }}>
                            <Row gutter={24}>
                                <Col span={24}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px', marginBottom: 24 }}>
                                        <Typography.Text strong>Ürün Adı:</Typography.Text>
                                        <Typography.Text>{formProps.form?.getFieldValue('name')}</Typography.Text>

                                        <Typography.Text strong>SKU:</Typography.Text>
                                        <Typography.Text>{formProps.form?.getFieldValue('sku') || '-'}</Typography.Text>

                                        <Typography.Text strong>Kategori İsmi:</Typography.Text>
                                        <Typography.Text>
                                            {(categorySelectProps.options as any[])?.find((o: any) => o.value === formProps.form?.getFieldValue('product_category_id'))?.label || '-'}
                                        </Typography.Text>
                                    </div>
                                </Col>
                            </Row>

                            <Typography.Title level={5}>Yönetilen Varyasyonlar ve Texture Önizlemeleri</Typography.Title>
                            <Divider style={{ margin: '12px 0 24px 0' }} />

                            {(() => {
                                // Helper: ensure URL is absolute using company domain
                                const resolveUrl = (url: string | null | undefined): string | null => {
                                    if (!url) return null;
                                    const trimmed = url.trim();
                                    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
                                    if (trimmed.startsWith('http') || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;
                                    // Relative URL → prepend domain
                                    const domain = selectedCompanyDomain || import.meta.env.VITE_R2_PUBLIC_URL || '';
                                    const cleanDomain = domain.trim().endsWith('/') ? domain.trim().slice(0, -1) : domain.trim();
                                    const baseDomain = cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`;
                                    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
                                    const joined = baseDomain + path;
                                    return joined.replace(/([^:])\/\/+/g, '$1/');
                                };

                                const PreviewImg = ({ src, size, round }: { src: string | null | undefined; size: number; round?: boolean }) => {
                                    const resolved = resolveUrl(src);
                                    const boxStyle: React.CSSProperties = {
                                        width: size, height: size, background: '#f5f5f5',
                                        border: '1px solid #ddd', margin: '0 auto',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 10, borderRadius: round ? '50%' : 4,
                                    };
                                    if (!resolved) return <div style={boxStyle}>Yok</div>;
                                    return (
                                        <img
                                            src={resolved}
                                            style={{ width: size, height: size, objectFit: 'cover', border: '1px solid #ddd', borderRadius: round ? '50%' : 4, display: 'block', margin: '0 auto' }}
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    );
                                };

                                return materialsWithVariants.map((mat, mIdx) => {
                                    if (!mat.isManaged) return null;
                                    return (
                                        <div key={mIdx} style={{ marginBottom: 32, padding: '16px', border: '1px solid #f0f0f0', borderRadius: '8px' }}>
                                            <Typography.Title level={5} style={{ color: '#1890ff' }}>
                                                Materyal: {mat.displayName} ({mat.material.name})
                                            </Typography.Title>

                                            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                                                {mat.variants.map((v, vIdx) => (
                                                    <Col key={vIdx} span={24}>
                                                        <Card size="small" title={`Varyasyon: ${v.variantName} ${v.isOriginal ? '(Orijinal)' : ''}`} type="inner">
                                                            <Row gutter={16} align="middle">
                                                                <Col span={6} style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Base Color</div>
                                                                    <PreviewImg src={v.baseColorPreview} size={64} />
                                                                </Col>
                                                                <Col span={6} style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Normal Map</div>
                                                                    <PreviewImg src={v.normalPreview} size={64} />
                                                                </Col>
                                                                <Col span={6} style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>ORM Map</div>
                                                                    <PreviewImg src={v.ormPreview} size={64} />
                                                                </Col>
                                                                <Col span={6} style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Swatch</div>
                                                                    <PreviewImg src={v.swatchPreview} size={48} round />
                                                                </Col>
                                                            </Row>
                                                        </Card>
                                                    </Col>
                                                ))}
                                            </Row>
                                        </div>
                                    );
                                });
                            })()}
                        </Card>

                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 24 }}>
                            <Button icon={<ArrowLeftOutlined />} onClick={() => setCurrentStep(1)}>Geri</Button>
                        </div>
                    </div>

                </Form>

                {/* Modals */}
                <Modal open={mediaModalVisible} onCancel={() => setMediaModalVisible(false)} title="Medya Seç" footer={null} width={800}>
                    <FileManager mode="select" onSelect={handleMediaSelect} bucketName={selectedCompanyBucket} customDomain={selectedCompanyDomain} companyName={selectedCompanyName} height="500px" />
                </Modal>

                <Modal open={variantR2PickerVisible} onCancel={() => setVariantR2PickerVisible(false)} title="Varyasyon Dosyası Seç" footer={null} width={800}>
                    <FileManager mode="select" onSelect={handleVariantR2Select} bucketName={selectedCompanyBucket} customDomain={selectedCompanyDomain} companyName={selectedCompanyName} height="500px" />
                </Modal>

            </Spin>
        </Edit >
    );
};
