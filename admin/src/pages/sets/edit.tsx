import React, { useState, useEffect, useRef } from 'react';
import { Edit, useForm, useSelect } from "@refinedev/antd";
import { useGetIdentity, useInvalidate } from "@refinedev/core";
import { useParams, useNavigate } from "react-router-dom";
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
    Image,
    Checkbox,
    Tooltip,
    Modal,
    Radio
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
import { slugify, uploadToR2 } from "../../utility/uploadToR2";
import { deleteR2Folder } from "../../utility/storageOperations";
import { parseGLB, MaterialInfo } from "../../utility/glbParser";
import { CustomAttributesManager, CustomAttribute } from "../../components/products/CustomAttributesManager";
import { ThreeModelViewer } from "../../components/products/ThreeModelViewer";
import { supabaseClient } from "../../utility/supabaseClient";

import { FileManager } from "../../components/file-manager/FileManager";
import { R2File } from "../../utility/storageOperations";
import { downloadR2FileAsBlob } from "../../utility/r2Download";

const { TextArea } = Input;
const { Panel } = Collapse;

// ─── Types ───────────────────────────────────────────────────────────────────

interface VariantData {
    variantName: string;
    isOriginal: boolean;
    swatchFile: File | null;
    swatchPreview: string | null;
    baseColorFile: File | null;
    baseColorPreview: string | null;
    normalFile: File | null;
    normalPreview: string | null;
    ormFile: File | null;
    ormPreview: string | null;
}

interface MaterialWithVariants {
    material: MaterialInfo;
    displayName: string;
    isManaged: boolean;
    variants: VariantData[];
}

interface SetProductItem {
    isExisting: boolean;
    existingProductId?: string;
    categoryId?: string;
    name: string;
    sku: string;
    description: string;
    modelFile: File | null;
    modelPreview: string | null;
    thumbnailFile: File | null;
    thumbnailPreview: string | null;
    parsedMaterials: MaterialInfo[];
    parsingGLB: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SetEdit = () => {
    // ── Navigation ──
    const navigate = useNavigate();

    // ── Identity ──
    const { data: identity } = useGetIdentity<{
        id: string;
        role: string;
        company_id: string;
        company?: { company_name: string };
    }>();

    const isSuperAdmin = identity?.role === "super_admin";
    const userCompanyId = identity?.company_id;
    const companyName = identity?.company?.company_name || '';

    // ── Company state ──
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>();
    const [selectedCompanyName, setSelectedCompanyName] = useState<string>('');
    const [selectedCompanyBucket, setSelectedCompanyBucket] = useState<string | undefined>();
    const [selectedCompanyDomain, setSelectedCompanyDomain] = useState<string | undefined>();

    useEffect(() => {
        if (!isSuperAdmin && userCompanyId) {
            setSelectedCompanyId(userCompanyId);
            setSelectedCompanyName(companyName || '');

            supabaseClient
                .from('companies')
                .select('storage_bucket, storage_domain')
                .eq('id', userCompanyId)
                .single()
                .then(({ data }) => {
                    if (data) {
                        setSelectedCompanyBucket(data.storage_bucket);
                        setSelectedCompanyDomain(data.storage_domain);
                    }
                });
        }
    }, [identity, isSuperAdmin, userCompanyId, companyName]);

    const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : userCompanyId;
    const effectiveCompanyName = isSuperAdmin ? selectedCompanyName : companyName;

    const invalidate = useInvalidate();
    const { id: setId } = useParams<{ id: string }>();

    // ── Form ── (sadece form binding ve onFinish için; veri yükleme initializeSet ile yapılır)
    const { formProps, onFinish } = useForm({
        resource: "sets",
        action: "edit",
        id: setId,
        redirect: false,
        queryOptions: {
            //enabled: false, // Refine'ın otomatik fetch'ini devre dışı bırak — initializeSet direkt Supabase'den çeker
            staleTime: 0,             // Verinin anında "bayat" kabul edilmesini sağlar
            refetchOnMount: "always", // Bileşen her mount edildiğinde veriyi yeniden çeker
        },
    });

    // ── Selects ──
    const { selectProps: companySelectProps, queryResult: companiesQuery } = useSelect({
        resource: "companies",
        optionLabel: "company_name",
        optionValue: "id",
        queryOptions: { enabled: isSuperAdmin },
    });

    const { selectProps: categorySelectProps } = useSelect({
        resource: "set_categories",
        optionLabel: "name",
        optionValue: "id",
        filters: effectiveCompanyId ? [{
            field: "company_id",
            operator: "eq",
            value: effectiveCompanyId,
        }] : [],
        queryOptions: { enabled: !!effectiveCompanyId },
    });

    const { selectProps: productCategorySelectProps } = useSelect({
        resource: "product_categories",
        optionLabel: "name",
        optionValue: "id",
        filters: effectiveCompanyId ? [{
            field: "company_id",
            operator: "eq",
            value: effectiveCompanyId,
        }] : [],
        queryOptions: { enabled: !!effectiveCompanyId },
    });

    const { selectProps: existingProductSelectProps, queryResult: existingProductsQuery } = useSelect({
        resource: "products",
        optionLabel: "name",
        optionValue: "id",
        filters: effectiveCompanyId ? [
            { field: "company_id", operator: "eq", value: effectiveCompanyId },
            { field: "set_id", operator: "null", value: null } // Optional: only show products not in a set, but user might want to move it. Let's just fetch all company products for now.
        ] : [],
        queryOptions: { enabled: !!effectiveCompanyId },
    });

    // ── Steps ──
    const [currentStep, setCurrentStep] = useState(0);

    // ── File states ──
    const [selectedThumbnailFile, setSelectedThumbnailFile] = useState<File | null>(null);
    const [selectedModelFile, setSelectedModelFile] = useState<File | null>(null);
    const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(null);
    const [previewModelUrl, setPreviewModelUrl] = useState<string | null>(null);
    // Orijinal R2 URL'leri — blob preview'dan ayrı tutulur, kayıt sırasında kullanılır
    const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | null>(null);
    const [existingModelUrl, setExistingModelUrl] = useState<string | null>(null);

    // ── Media Picker State ──
    const [mediaModalVisible, setMediaModalVisible] = useState(false);
    const [mediaModalTarget, setMediaModalTarget] = useState<'thumbnail' | 'model' | null>(null);
    const [selectedR2Thumbnail, setSelectedR2Thumbnail] = useState<string | null>(null);
    const [selectedR2Model, setSelectedR2Model] = useState<string | null>(null);

    // ── Variant R2 Picker State ──
    const [variantR2PickerVisible, setVariantR2PickerVisible] = useState(false);
    const [variantR2PickerTarget, setVariantR2PickerTarget] = useState<{
        matIdx: number;
        varIdx: number;
        field: 'swatch' | 'baseColor' | 'normal' | 'orm';
    } | null>(null);

    // ── GLB Materials ──
    const [parsedMaterials, setParsedMaterials] = useState<MaterialInfo[]>([]);
    const [materialsWithVariants, setMaterialsWithVariants] = useState<MaterialWithVariants[]>([]);
    const [highlightMaterial, setHighlightMaterial] = useState<string | null>(null);
    const [parsingGLB, setParsingGLB] = useState(false);

    // ── Custom attributes ──
    const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>([]);

    // ── Set Products (inline product creation) ──
    const [setProducts, setSetProducts] = useState<SetProductItem[]>([]);
    const [includeProducts, setIncludeProducts] = useState(false);

    // ── Loading ──
    const [loading, setLoading] = useState(true);
    const [deletedVariantsInfo, setDeletedVariantsInfo] = useState<{ dbId: string; r2Path: string }[]>([]);
    const initializingRef = useRef(false);
    const lastInitSetId = useRef<string | null>(null);

    const addSetProduct = () => {
        setSetProducts(prev => [...prev, {
            isExisting: false,
            categoryId: undefined,
            existingProductId: undefined,
            name: '',
            sku: '',
            description: '',
            modelFile: null,
            modelPreview: null,
            thumbnailFile: null,
            thumbnailPreview: null,
            parsedMaterials: [],
            parsingGLB: false,
        }]);
    };

    const removeSetProduct = (index: number) => {
        setSetProducts(prev => prev.filter((_, i) => i !== index));
    };

    const updateSetProduct = (index: number, field: keyof SetProductItem, value: any) => {
        setSetProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    };

    const handleSetProductModel = async (index: number, file: File) => {
        const previewUrl = URL.createObjectURL(file);
        setSetProducts(prev => prev.map((p, i) => i === index ? {
            ...p, modelFile: file, modelPreview: previewUrl, parsingGLB: true,
        } : p));
        try {
            const result = await parseGLB(file);
            setSetProducts(prev => prev.map((p, i) => i === index ? {
                ...p, parsedMaterials: result.materials, parsingGLB: false,
            } : p));
        } catch (e) {
            console.error('GLB parse error for set product:', e);
            setSetProducts(prev => prev.map((p, i) => i === index ? { ...p, parsingGLB: false } : p));
            message.error('GLB dosyası ayrıştırılamadı');
        }
    };

    const handleSetProductThumbnail = (index: number, file: File) => {
        updateSetProduct(index, 'thumbnailFile', file);
        updateSetProduct(index, 'thumbnailPreview', URL.createObjectURL(file));
    };

    // ── Saving state ──
    const [saving, setSaving] = useState(false);

    // ── Load existing data ──
    // Direkt Supabase'den çek - Refine cache/identity bekleme
    useEffect(() => {
        if (!setId) return;
        if (initializingRef.current && lastInitSetId.current === setId) return;
        initializingRef.current = true;
        lastInitSetId.current = setId;
        initializeSet(setId);
    }, [setId]);

    const initializeSet = async (currentSetId: string) => {
        if (!currentSetId) return;

        setLoading(true);
        try {
            // 0. Set verisini Supabase'den direkt çek
            const { data: record, error: setError } = await supabaseClient
                .from('sets')
                .select('*')
                .eq('id', currentSetId)
                .single();

            if (setError || !record) {
                throw new Error('Set verisi alınamadı: ' + (setError?.message || 'bulunamadı'));
            }

            formProps.form?.setFieldsValue({
                name: record.name,
                sku: record.sku,
                description: record.description,
                price: record.price,
                set_category_id: record.set_category_id,
                company_id: record.company_id,
                custom_attributes: record.custom_attributes,
            });

            // 1. Company bilgilerini çek
            const companyId = record.company_id;
            const companyRes = companyId
                ? await supabaseClient.from('companies').select('storage_bucket, storage_domain, company_name').eq('id', companyId).single()
                : { data: null, error: null };

            let activeBucket = import.meta.env.VITE_R2_BUCKET_NAME;
            let activeDomain = import.meta.env.VITE_R2_PUBLIC_URL;

            if (companyRes.data) {
                const data = companyRes.data as any;
                setSelectedCompanyId(companyId || undefined);
                setSelectedCompanyName(data.company_name);
                activeBucket = data.storage_bucket || activeBucket;
                activeDomain = data.storage_domain || activeDomain;
                setSelectedCompanyBucket(activeBucket);
                setSelectedCompanyDomain(activeDomain);
            } else {
                setSelectedCompanyId(companyId || undefined);
                setSelectedCompanyBucket(activeBucket);
                setSelectedCompanyDomain(activeDomain);
            }

            const activeDomainFetch = (activeDomain || import.meta.env.VITE_R2_PUBLIC_URL || '').trim();

            const ensureFullUrl = (url: any): string | null => {
                if (!url || typeof url !== 'string') return null;
                const trimmed = url.trim();
                if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '{}') return null;
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
                const domain = activeDomainFetch.endsWith('/') ? activeDomainFetch.slice(0, -1) : activeDomainFetch;
                const cleanDomain = domain.startsWith('http') ? domain : `https://${domain}`;
                const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
                return `${cleanDomain}${path}`.replace(/([^:]\/)\/+/g, '$1');
            };

            // R2 SDK ile blob URL oluşturur — CORS bypass. Hata olursa orijinal URL döner.
            const safeToBlob = async (url: string | null): Promise<string | null> => {
                if (!url) return null;
                if (url.startsWith('blob:') || url.startsWith('data:')) return url;
                try {
                    return await downloadR2FileAsBlob(url, activeBucket, activeDomain);
                } catch (e) {
                    console.warn('R2 blob indirme başarısız:', url);
                    return url;
                }
            };

            // 2. Custom attributes
            if (record.custom_attributes) {
                try {
                    const parsed = typeof record.custom_attributes === 'string'
                        ? JSON.parse(record.custom_attributes)
                        : record.custom_attributes;
                    setCustomAttributes(parsed);
                } catch (e) { console.error('Error parsing attributes', e); }
            }

            // 3. Thumbnail
            if (record.thumbnail_url) {
                let thumbSrc = record.thumbnail_url;
                try {
                    if (typeof thumbSrc === 'string' && thumbSrc.startsWith('{')) {
                        thumbSrc = JSON.parse(thumbSrc).url || thumbSrc;
                    } else if (typeof thumbSrc === 'object' && thumbSrc !== null) {
                        thumbSrc = (thumbSrc as any).url || thumbSrc;
                    }
                } catch (e) { /* ignore */ }
                const thumbFull = ensureFullUrl(thumbSrc);
                if (thumbFull) {
                    setExistingThumbnailUrl(thumbFull);
                    setPreviewThumbnail(thumbFull);
                    safeToBlob(thumbFull).then(b => { if (b) setPreviewThumbnail(b); }).catch(() => { });
                }
            }

            // 4. Model URL sakla
            if (record.model_url) {
                const modelFull = ensureFullUrl(record.model_url);
                if (modelFull) setExistingModelUrl(modelFull);
            }

            // 5. Bağlı ürünleri çek
            const { data: setProductLinks } = await supabaseClient
                .from('set_products')
                .select('product_id, display_order')
                .eq('set_id', record.id)
                .order('display_order');

            const linkedProductIds = (setProductLinks || []).map((sp: any) => sp.product_id);
            const firstProductId = linkedProductIds[0] || null;

            // 6. Varyasyon verisini çek:
            //    - Bağlı ürün varsa → product_materials/product_variants/variant_textures (güncel)
            //    - Bağlı ürün yoksa → set_materials/set_variants/set_variant_textures
            let dbMappedRaw: any[] = [];

            if (firstProductId) {
                // ── Ürün tablolarından çek (her zaman güncel) ──
                console.log('Varyasyonlar ürün tablosundan çekiliyor, productId:', firstProductId);
                const { data: prodMaterials, error: prodMatErr } = await supabaseClient
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
                    .eq('product_id', firstProductId);

                if (prodMatErr) console.error('Product materials fetch error:', prodMatErr);

                dbMappedRaw = (prodMaterials || []).map((mat: any) => ({
                    dbId: mat.id,
                    material: { id: mat.material_id, name: mat.name, index: 0, baseColorTexture: null, normalTexture: null, ormTexture: null },
                    displayName: mat.name,
                    isManaged: true,
                    variants: (mat.product_variants || []).map((v: any) => {
                        const tex = Array.isArray(v.variant_textures)
                            ? v.variant_textures[0] || {}
                            : v.variant_textures || {};
                        const isOriginal = v.is_original === true || v.variant_name === 'Orijinal' || v.variant_name === 'Original';
                        const baseColor = ensureFullUrl(tex.base_color_url);
                        const normal = ensureFullUrl(tex.normal_url);
                        const orm = ensureFullUrl(tex.orm_url);
                        const swatch = ensureFullUrl(v.swatch_url) || baseColor;
                        return {
                            dbId: v.id,
                            variantName: v.variant_name,
                            isOriginal,
                            swatchFile: null, swatchPreview: swatch,
                            baseColorFile: null, baseColorPreview: baseColor,
                            normalFile: null, normalPreview: normal,
                            ormFile: null, ormPreview: orm,
                        };
                    }),
                }));

                // Ürün tablosunda veri yoksa set tablolarına fallback
                if (dbMappedRaw.length === 0) {
                    console.log('Ürün tablosunda varyasyon yok, set tablosuna fallback');
                    const { data: setMats } = await supabaseClient
                        .from('set_materials')
                        .select(`id, material_id, name, set_variants (id, variant_name, is_original, swatch_url, set_variant_textures (base_color_url, normal_url, orm_url))`)
                        .eq('set_id', record.id);
                    dbMappedRaw = (setMats || []).map((mat: any) => ({
                        dbId: mat.id,
                        material: { id: mat.material_id, name: mat.name, index: 0, baseColorTexture: null, normalTexture: null, ormTexture: null },
                        displayName: mat.name,
                        isManaged: true,
                        variants: (mat.set_variants || []).map((v: any) => {
                            const tex = Array.isArray(v.set_variant_textures) ? v.set_variant_textures[0] || {} : v.set_variant_textures || {};
                            const isOriginal = v.is_original === true || v.variant_name === 'Orijinal' || v.variant_name === 'Original';
                            const baseColor = ensureFullUrl(tex.base_color_url);
                            const normal = ensureFullUrl(tex.normal_url);
                            const orm = ensureFullUrl(tex.orm_url);
                            const swatch = ensureFullUrl(v.swatch_url) || baseColor;
                            return { dbId: v.id, variantName: v.variant_name, isOriginal, swatchFile: null, swatchPreview: swatch, baseColorFile: null, baseColorPreview: baseColor, normalFile: null, normalPreview: normal, ormFile: null, ormPreview: orm };
                        }),
                    }));
                }
            } else {
                // ── Ürün yok → set tablolarından çek ──
                console.log('Bağlı ürün yok, varyasyonlar set tablosundan çekiliyor');
                const { data: setMats, error: setMatErr } = await supabaseClient
                    .from('set_materials')
                    .select(`
                        id,
                        material_id,
                        name,
                        set_variants (
                            id,
                            variant_name,
                            is_original,
                            swatch_url,
                            set_variant_textures (
                                base_color_url,
                                normal_url,
                                orm_url
                            )
                        )
                    `)
                    .eq('set_id', record.id);

                if (setMatErr) console.error('Set materials fetch error:', setMatErr);

                dbMappedRaw = (setMats || []).map((mat: any) => ({
                    dbId: mat.id,
                    material: { id: mat.material_id, name: mat.name, index: 0, baseColorTexture: null, normalTexture: null, ormTexture: null },
                    displayName: mat.name,
                    isManaged: true,
                    variants: (mat.set_variants || []).map((v: any) => {
                        const tex = Array.isArray(v.set_variant_textures) ? v.set_variant_textures[0] || {} : v.set_variant_textures || {};
                        const isOriginal = v.is_original === true || v.variant_name === 'Orijinal' || v.variant_name === 'Original';
                        const baseColor = ensureFullUrl(tex.base_color_url);
                        const normal = ensureFullUrl(tex.normal_url);
                        const orm = ensureFullUrl(tex.orm_url);
                        const swatch = ensureFullUrl(v.swatch_url) || baseColor;
                        return { dbId: v.id, variantName: v.variant_name, isOriginal, swatchFile: null, swatchPreview: swatch, baseColorFile: null, baseColorPreview: baseColor, normalFile: null, normalPreview: normal, ormFile: null, ormPreview: orm };
                    }),
                }));
            }

            // 7. Tüm variant görsellerini SDK üzerinden blob'a çevir (await — race condition yok)
            const dbMapped: MaterialWithVariants[] = await Promise.all(
                dbMappedRaw.map(async (mat: any) => ({
                    ...mat,
                    variants: await Promise.all(
                        mat.variants.map(async (v: any) => ({
                            ...v,
                            swatchPreview: await safeToBlob(v.swatchPreview),
                            baseColorPreview: await safeToBlob(v.baseColorPreview),
                            normalPreview: await safeToBlob(v.normalPreview),
                            ormPreview: await safeToBlob(v.ormPreview),
                        }))
                    ),
                }))
            );

            if (dbMapped.length > 0) {
                setMaterialsWithVariants(dbMapped);
            }

            // 8. Model preview + GLB parse
            if (record.model_url) {
                setPreviewModelUrl(record.model_url);
                try {
                    setParsingGLB(true);
                    const modelBlobUrl = await downloadR2FileAsBlob(record.model_url, activeBucket, activeDomain);
                    setPreviewModelUrl(modelBlobUrl);

                    const response = await fetch(modelBlobUrl);
                    const blob = await response.blob();
                    const fileObj = new File([blob], 'model.glb', { type: 'model/gltf-binary' });
                    const parsed = await parseGLB(fileObj);
                    setParsedMaterials(parsed.materials);

                    // Merge: mevcut blob URL'leri koru, GLB bilgileriyle zenginleştir
                    const finalMaterials: MaterialWithVariants[] = parsed.materials.map(glbMat => {
                        const match = dbMapped.find(m => {
                            const dbId = String(m.material.id || '').trim().toLowerCase();
                            const dbName = String(m.material.name || m.displayName || '').trim().toLowerCase();
                            const glbId = String(glbMat.id || '').trim().toLowerCase();
                            const glbName = String(glbMat.name || '').trim().toLowerCase();
                            return dbId === glbId || dbName === glbName || dbId === glbName || dbName === glbId;
                        });

                        const glbFallback = {
                            baseColor: glbMat.baseColorTexture?.url || null,
                            normal: glbMat.normalTexture?.url || null,
                            orm: glbMat.ormTexture?.url || null,
                        };

                        if (match) {
                            return {
                                ...match,
                                material: glbMat,
                                variants: match.variants.map(v => v.isOriginal ? {
                                    ...v,
                                    baseColorPreview: v.baseColorPreview || glbFallback.baseColor,
                                    normalPreview: v.normalPreview || glbFallback.normal,
                                    ormPreview: v.ormPreview || glbFallback.orm,
                                    swatchPreview: v.swatchPreview || glbFallback.baseColor,
                                } : v),
                            };
                        }

                        return {
                            material: glbMat,
                            displayName: glbMat.name,
                            isManaged: false,
                            variants: [{
                                variantName: 'Orijinal',
                                isOriginal: true,
                                swatchFile: null,
                                swatchPreview: glbFallback.baseColor,
                                baseColorFile: null,
                                baseColorPreview: glbFallback.baseColor,
                                normalFile: null,
                                normalPreview: glbFallback.normal,
                                ormFile: null,
                                ormPreview: glbFallback.orm,
                            }],
                        };
                    });

                    setMaterialsWithVariants(finalMaterials);
                } catch (e: any) {
                    console.error('GLB parse error:', e);
                    if (dbMapped.length > 0) setMaterialsWithVariants(dbMapped);
                } finally {
                    setParsingGLB(false);
                }
            } else {
                setMaterialsWithVariants(dbMapped);
            }

            // 9. Bağlı ürünleri yükle (UI için)
            if (setProductLinks && setProductLinks.length > 0) {
                setIncludeProducts(true);
                const productIds = setProductLinks.map((sp: any) => sp.product_id);
                const { data: productsData } = await supabaseClient
                    .from('products')
                    .select('id, name, sku, description, model_url, thumbnail_url')
                    .in('id', productIds);

                if (productsData) {
                    const loaded: SetProductItem[] = [];
                    for (const sp of setProductLinks) {
                        const prod = productsData.find((p: any) => p.id === sp.product_id);
                        if (prod) {
                            loaded.push({
                                isExisting: true,
                                existingProductId: prod.id,
                                name: prod.name || '',
                                sku: prod.sku || '',
                                description: prod.description || '',
                                modelFile: null,
                                modelPreview: prod.thumbnail_url,
                                thumbnailFile: null,
                                thumbnailPreview: prod.thumbnail_url,
                                parsedMaterials: [],
                                parsingGLB: false,
                            });
                        }
                    }
                    setSetProducts(loaded);
                }
            } else {
                setIncludeProducts(false);
            }

        } catch (e: any) {
            console.error('Set initialization error:', e);
            message.error('Veriler yüklenirken hata oluştu: ' + e.message);
        } finally {
            setLoading(false);
            initializingRef.current = false;
        }
    };

    // ── Handlers ──

    const handleCompanyChange = async (value: string) => {
        setSelectedCompanyId(value);
        const company = companiesQuery.data?.data.find((c: any) => c.id === value);
        setSelectedCompanyName(company?.company_name || '');
        formProps.form?.setFieldValue('set_category_id', undefined);

        const { data } = await supabaseClient
            .from('companies')
            .select('storage_bucket, storage_domain')
            .eq('id', value)
            .single();

        if (data) {
            setSelectedCompanyBucket(data.storage_bucket);
            setSelectedCompanyDomain(data.storage_domain);
        } else {
            setSelectedCompanyBucket(undefined);
            setSelectedCompanyDomain(undefined);
        }
    };

    const handleThumbnailSelect = (file: File) => {
        setSelectedThumbnailFile(file);
        setPreviewThumbnail(URL.createObjectURL(file));
        setExistingThumbnailUrl(null); // yeni dosya yüklenecek
        return false;
    };

    const handleModelSelect = async (file: File) => {
        try {
            setParsingGLB(true);
            setSelectedModelFile(file);
            setExistingModelUrl(null); // yeni dosya yüklenecek
            setPreviewModelUrl(URL.createObjectURL(file));

            const parsed = await parseGLB(file);
            setParsedMaterials(parsed.materials);

            const initialized: MaterialWithVariants[] = parsed.materials.map(mat => ({
                material: mat,
                displayName: mat.name,
                isManaged: false,
                variants: [{
                    variantName: 'Orijinal',
                    isOriginal: true,
                    swatchFile: null,
                    swatchPreview: mat.baseColorTexture?.url || null,
                    baseColorFile: null,
                    baseColorPreview: mat.baseColorTexture?.url || null,
                    normalFile: null,
                    normalPreview: mat.normalTexture?.url || null,
                    ormFile: null,
                    ormPreview: mat.ormTexture?.url || null,
                }]
            }));
            setMaterialsWithVariants(initialized);

            message.success(`GLB yüklendi: ${parsed.materials.length} material bulundu`);
        } catch (error: any) {
            message.error('GLB parse hatası: ' + error.message);
            setParsedMaterials([]);
            setMaterialsWithVariants([]);
        } finally {
            setParsingGLB(false);
        }
        return false;
    };

    // ── Material management ──
    const toggleMaterialManaged = (index: number) => {
        const updated = [...materialsWithVariants];
        updated[index].isManaged = !updated[index].isManaged;
        setMaterialsWithVariants(updated);
    };

    const updateMaterialDisplayName = (matIdx: number, name: string) => {
        const updated = [...materialsWithVariants];
        updated[matIdx].displayName = name;
        setMaterialsWithVariants(updated);
    };

    // ── Variant handlers ──
    const addVariant = (materialIndex: number) => {
        setMaterialsWithVariants(prev => {
            const updated = [...prev];
            const mat = { ...updated[materialIndex] };
            mat.variants = [...mat.variants, {
                variantName: `Varyasyon ${mat.variants.length + 1}`,
                isOriginal: false,
                swatchFile: null,
                swatchPreview: null,
                baseColorFile: null,
                baseColorPreview: null,
                normalFile: null,
                normalPreview: null,
                ormFile: null,
                ormPreview: null,
            }];
            updated[materialIndex] = mat;
            return updated;
        });
    };

    const removeVariant = (materialIndex: number, variantIndex: number) => {
        const updated = [...materialsWithVariants];
        const variant = updated[materialIndex].variants[variantIndex];
        if (variant.isOriginal) {
            message.warning('Orijinal varyasyon silinemez');
            return;
        }
        updated[materialIndex].variants.splice(variantIndex, 1);
        setMaterialsWithVariants(updated);
    };

    const updateVariantName = (materialIndex: number, variantIndex: number, name: string) => {
        const updated = [...materialsWithVariants];
        updated[materialIndex].variants[variantIndex].variantName = name;
        setMaterialsWithVariants(updated);
    };

    const handleVariantFile = (
        materialIndex: number,
        variantIndex: number,
        field: 'swatch' | 'baseColor' | 'normal' | 'orm',
        file: File
    ) => {
        const updated = [...materialsWithVariants];
        const variant = updated[materialIndex].variants[variantIndex];

        if (variant.isOriginal && field !== 'swatch') {
            message.warning('Orijinal varyasyonun texture dosyaları değiştirilemez');
            return false;
        }

        const preview = URL.createObjectURL(file);

        switch (field) {
            case 'swatch':
                variant.swatchFile = file;
                variant.swatchPreview = preview;
                break;
            case 'baseColor':
                variant.baseColorFile = file;
                variant.baseColorPreview = preview;
                break;
            case 'normal':
                variant.normalFile = file;
                variant.normalPreview = preview;
                break;
            case 'orm':
                variant.ormFile = file;
                variant.ormPreview = preview;
                break;
        }

        setMaterialsWithVariants(updated);
        return false;
    };

    const openVariantR2Picker = (matIdx: number, varIdx: number, field: 'swatch' | 'baseColor' | 'normal' | 'orm') => {
        setVariantR2PickerTarget({ matIdx, varIdx, field });
        setVariantR2PickerVisible(true);
    };

    const handleVariantR2Select = async (file: R2File) => {
        if (!variantR2PickerTarget) return;
        const { matIdx, varIdx, field } = variantR2PickerTarget;

        setVariantR2PickerVisible(false);
        setVariantR2PickerTarget(null);

        try {
            const blobUrl = await downloadR2FileAsBlob(
                file.url,
                selectedCompanyBucket || import.meta.env.VITE_R2_BUCKET_NAME,
                selectedCompanyDomain || import.meta.env.VITE_R2_PUBLIC_URL
            );

            const resp = await fetch(blobUrl);
            const blob = await resp.blob();
            const fileObj = new File([blob], file.name, { type: blob.type });

            const updated = [...materialsWithVariants];
            const variant = updated[matIdx].variants[varIdx];

            switch (field) {
                case 'swatch':
                    variant.swatchFile = fileObj;
                    variant.swatchPreview = blobUrl;
                    break;
                case 'baseColor':
                    variant.baseColorFile = fileObj;
                    variant.baseColorPreview = blobUrl;
                    break;
                case 'normal':
                    variant.normalFile = fileObj;
                    variant.normalPreview = blobUrl;
                    break;
                case 'orm':
                    variant.ormFile = fileObj;
                    variant.ormPreview = blobUrl;
                    break;
            }

            setMaterialsWithVariants(updated);
            message.success(`R2'den dosya seçildi: ${file.name}`);
        } catch (error: any) {
            console.error('R2 file select error:', error);
            message.error('Dosya seçilemedi: ' + error.message);
        }
    };

    const handleMediaSelect = async (file: R2File) => {
        setMediaModalVisible(false);
        const target = mediaModalTarget;
        setMediaModalTarget(null);

        if (target === 'thumbnail') {
            setSelectedR2Thumbnail(file.url);
            setExistingThumbnailUrl(file.url);
            setSelectedThumbnailFile(null);
            setPreviewThumbnail(file.url);
            message.success('Thumbnail seçildi');
        } else if (target === 'model') {
            const url = file.url;
            setSelectedR2Model(url);
            setExistingModelUrl(url);
            setSelectedModelFile(null);

            try {
                setParsingGLB(true);
                message.loading({ content: 'Model indiriliyor...', key: 'model-download' });

                const blobUrl = await downloadR2FileAsBlob(
                    url,
                    selectedCompanyBucket || import.meta.env.VITE_R2_BUCKET_NAME,
                    selectedCompanyDomain || import.meta.env.VITE_R2_PUBLIC_URL
                );

                setPreviewModelUrl(blobUrl);

                const response = await fetch(blobUrl);
                const blob = await response.blob();
                const fileObj = new File([blob], file.name, { type: 'model/gltf-binary' });

                const parsed = await parseGLB(fileObj);
                setParsedMaterials(parsed.materials);

                const initialized: MaterialWithVariants[] = parsed.materials.map(mat => ({
                    material: mat,
                    displayName: mat.name,
                    isManaged: false,
                    variants: [{
                        variantName: 'Orijinal',
                        isOriginal: true,
                        swatchFile: null,
                        swatchPreview: mat.baseColorTexture?.url || null,
                        baseColorFile: null,
                        baseColorPreview: mat.baseColorTexture?.url || null,
                        normalFile: null,
                        normalPreview: mat.normalTexture?.url || null,
                        ormFile: null,
                        ormPreview: mat.ormTexture?.url || null,
                    }]
                }));
                setMaterialsWithVariants(initialized);

                message.success({ content: `GLB yüklendi: ${parsed.materials.length} material bulundu`, key: 'model-download' });
            } catch (error: any) {
                console.error('Remote GLB download/parse error:', error);
                setParsedMaterials([]);
                setMaterialsWithVariants([]);
                message.error({ content: 'Model indirilemedi: ' + error.message, key: 'model-download' });
            } finally {
                setParsingGLB(false);
            }
        }
    };

    // ── Submit ──

    const handleSubmit = async (values: any) => {
        try {
            if (!effectiveCompanyId || !effectiveCompanyName) {
                message.error('Lütfen şirket seçiniz');
                return;
            }
            if (!setId) {
                message.error('Takım ID bulunamadı');
                return;
            }

            setSaving(true);

            // 1. Upload Set GLB and thumbnail
            // existingThumbnailUrl/existingModelUrl: mevcut R2 URL (blob: değil)
            // Yeni dosya veya R2 seçimi varsa üzerine yazar
            let thumbnailUrl: string | null = existingThumbnailUrl;
            let modelUrl: string | null = existingModelUrl;
            const setFolder = `sets/${setId}`;

            const uploadTasks: Promise<any>[] = [];

            if (selectedThumbnailFile) {
                uploadTasks.push(uploadToR2(
                    selectedThumbnailFile,
                    setFolder,
                    effectiveCompanyName,
                    selectedCompanyBucket,
                    selectedCompanyDomain
                ).then(url => { thumbnailUrl = url; setExistingThumbnailUrl(url); }));
            }

            if (selectedModelFile) {
                uploadTasks.push(uploadToR2(
                    selectedModelFile,
                    setFolder,
                    effectiveCompanyName,
                    selectedCompanyBucket,
                    selectedCompanyDomain
                ).then(url => { modelUrl = url; setExistingModelUrl(url); }));
            }

            await Promise.all(uploadTasks);

            // 2. Update the Set record
            const updatePayload = {
                ...values,
                thumbnail_url: thumbnailUrl,
                model_url: modelUrl,
                company_id: effectiveCompanyId,
                custom_attributes: customAttributes.length > 0 ? JSON.stringify(customAttributes) : null,
            };
            await onFinish(updatePayload);

            // 3. Varyasyonları set tablolarına kaydet
            await saveMaterialsAndVariantsForSet(setId, setFolder);

            // 3b. Mevcut bağlı ürünlere varyasyonları senkronize et
            //     Böylece ürün ve takım her zaman aynı varyasyon verisine sahip olur
            const existingLinkedProductIds = setProducts
                .filter(sp => sp.isExisting && sp.existingProductId)
                .map(sp => sp.existingProductId!);
            if (existingLinkedProductIds.length > 0) {
                await Promise.all(existingLinkedProductIds.map(async (pid) => {
                    await saveMaterialsAndVariantsForProduct(pid, `products/${pid}`);
                }));
            }

            // 4. Clear existing product links and re-insert
            await supabaseClient.from('set_products').delete().eq('set_id', setId);

            // 5. Process linked products if enabled
            if (includeProducts) {
                for (const sp of setProducts) {
                    let productId: string;
                    let productFolder: string;

                    if (sp.isExisting && sp.existingProductId) {
                        productId = sp.existingProductId;
                        productFolder = `products/${productId}`;

                        // Sync variants to existing product
                        await saveMaterialsAndVariantsForProduct(productId, productFolder);

                        // Link to set
                        await supabaseClient
                            .from('set_products')
                            .insert({
                                set_id: setId,
                                product_id: productId,
                                display_order: setProducts.indexOf(sp),
                            });
                    } else if (!sp.isExisting && sp.name.trim()) {
                        // Insert new product record
                        const { data: productData, error: productError } = await supabaseClient
                            .from('products')
                            .insert({
                                name: sp.name,
                                sku: sp.sku || null,
                                description: sp.description || null,
                                company_id: effectiveCompanyId,
                                set_id: setId, // Keep this for backward compatibility or simple relationships
                                product_category_id: sp.categoryId || null,
                                thumbnail_url: null,
                                model_url: null,
                            })
                            .select()
                            .single();

                        if (productError || !productData) {
                            console.error('Product insert error:', productError);
                            message.error(`Ürün oluşturulamadı: ${sp.name}`);
                            continue;
                        }

                        productId = productData.id;
                        productFolder = `products/${productId}`;

                        // Upload product GLB and thumbnail
                        let productModelUrl: string | null = null;
                        let productThumbUrl: string | null = null;

                        const productUploads: Promise<any>[] = [];
                        if (sp.modelFile) {
                            productUploads.push(uploadToR2(
                                sp.modelFile,
                                productFolder,
                                effectiveCompanyName,
                                selectedCompanyBucket,
                                selectedCompanyDomain
                            ).then(url => productModelUrl = url));
                        }
                        if (sp.thumbnailFile) {
                            productUploads.push(uploadToR2(
                                sp.thumbnailFile,
                                productFolder,
                                effectiveCompanyName,
                                selectedCompanyBucket,
                                selectedCompanyDomain
                            ).then(url => productThumbUrl = url));
                        }
                        await Promise.all(productUploads);

                        if (productModelUrl || productThumbUrl) {
                            await supabaseClient
                                .from('products')
                                .update({
                                    ...(productModelUrl ? { model_url: productModelUrl } : {}),
                                    ...(productThumbUrl ? { thumbnail_url: productThumbUrl } : {}),
                                })
                                .eq('id', productId);
                        }

                        // Save shared variants to product tables
                        await saveMaterialsAndVariantsForProduct(productId, productFolder);

                        // Insert set_products junction
                        await supabaseClient
                            .from('set_products')
                            .insert({
                                set_id: setId,
                                product_id: productId,
                                display_order: setProducts.indexOf(sp),
                            });
                    }
                }
            } // end includeProducts

            await invalidate({ resource: "sets", invalidates: ["list", "many", "detail"] });
            await invalidate({ resource: "products", invalidates: ["list", "many", "detail"] });

            message.success('Takım başarıyla güncellendi!');
            navigate('/sets');
        } catch (error: any) {
            console.error(error);
            message.error('Hata: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Saves the shared materials/variants to product_materials/product_variants/variant_textures
    // for a given productId. Uses the materialsWithVariants state from the set's Step 2.
    async function saveMaterialsAndVariantsForProduct(productId: string, baseFolder: string) {
        let successCount = 0;
        let failCount = 0;

        console.log("Saving shared variants for product:", productId);

        await Promise.all(materialsWithVariants.map(async ({ material, displayName, variants, isManaged }) => {
            if (!isManaged) return;

            const sanitizedMatId = slugify(material.id);

            const { data: matData, error: matErr } = await supabaseClient
                .from('product_materials')
                .upsert({
                    product_id: productId,
                    material_id: material.id,
                    name: displayName,
                }, { onConflict: 'product_id,material_id' })
                .select()
                .single();

            if (matErr) {
                console.error('Material upsert error:', matErr);
                failCount++;
                return;
            }

            await Promise.all(variants.map(async (variant) => {
                const sanitizedVariantName = slugify(variant.variantName);
                const variantFolder = `${baseFolder}/materials/${sanitizedMatId}/${sanitizedVariantName}`;

                try {
                    const uploadOrKeep = async (file: File | null | undefined, preview: string | null | undefined, fileName: string) => {
                        if (file) {
                            return await uploadToR2(file, variantFolder, effectiveCompanyName, selectedCompanyBucket, selectedCompanyDomain);
                        }
                        if (preview?.startsWith('data:') || preview?.startsWith('blob:')) {
                            try {
                                const res = await fetch(preview);
                                if (!res.ok) throw new Error("Fetch failed");
                                const blob = await res.blob();
                                const f = new File([blob], fileName, { type: blob.type });
                                return await uploadToR2(f, variantFolder, effectiveCompanyName, selectedCompanyBucket, selectedCompanyDomain);
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

                    if (varErr) throw varErr;

                    const { error: texErr } = await supabaseClient
                        .from('variant_textures')
                        .upsert({
                            variant_id: varData.id,
                            base_color_url: baseColorUrl,
                            normal_url: normalUrl,
                            orm_url: ormUrl
                        }, { onConflict: 'variant_id' });

                    if (texErr) throw texErr;
                    successCount++;
                } catch (e: any) {
                    console.error(`Variant processing error:`, e);
                    failCount++;
                }
            }));
        }));

        if (failCount > 0) {
            message.warning(`${successCount} işlem başarılı, ${failCount} işlem hatalı.`);
        }
        console.log("Save Process Completed for product:", productId);
    };

    // Saves the variants specifically for the Set itself into set_materials / set_variants / set_variant_textures
    async function saveMaterialsAndVariantsForSet(setId: string, baseFolder: string) {
        let failCount = 0;

        console.log("Saving variants for set:", setId);

        await Promise.all(materialsWithVariants.map(async ({ material, displayName, variants, isManaged }) => {
            if (!isManaged) return;

            const sanitizedMatId = slugify(material.id);

            const { data: matData, error: matErr } = await supabaseClient
                .from('set_materials')
                .upsert({
                    set_id: setId,
                    material_id: material.id,
                    name: displayName,
                }, { onConflict: 'set_id,material_id' })
                .select()
                .single();

            if (matErr) {
                console.error('Set material upsert error:', matErr);
                failCount++;
                return;
            }

            await Promise.all(variants.map(async (variant) => {
                const sanitizedVariantName = slugify(variant.variantName);
                const variantFolder = `${baseFolder}/materials/${sanitizedMatId}/${sanitizedVariantName}`;

                try {
                    const uploadOrKeep = async (file: File | null | undefined, preview: string | null | undefined, fileName: string) => {
                        if (file) {
                            return await uploadToR2(file, variantFolder, effectiveCompanyName, selectedCompanyBucket, selectedCompanyDomain);
                        }
                        if (preview?.startsWith('data:') || preview?.startsWith('blob:')) {
                            try {
                                const res = await fetch(preview);
                                if (!res.ok) throw new Error("Fetch failed");
                                const blob = await res.blob();
                                const f = new File([blob], fileName, { type: blob.type });
                                return await uploadToR2(f, variantFolder, effectiveCompanyName, selectedCompanyBucket, selectedCompanyDomain);
                            } catch (e) {
                                console.error(`Failed to upload data/blob URL for ${fileName}:`, e);
                                return null;
                            }
                        }
                        return preview;
                    };

                    const [swatchUrl, baseColorUrl, normalUrl, ormUrl] = await Promise.all([
                        uploadOrKeep(variant.swatchFile, variant.swatchPreview, 'swatch.png'),
                        uploadOrKeep(variant.baseColorFile, variant.baseColorPreview, 'baseColor.png'),
                        uploadOrKeep(variant.normalFile, variant.normalPreview, 'normal.png'),
                        uploadOrKeep(variant.ormFile, variant.ormPreview, 'orm.png')
                    ]);

                    const { data: varData, error: varErr } = await supabaseClient
                        .from('set_variants')
                        .upsert({
                            material_id: matData.id,
                            variant_name: variant.variantName,
                            is_original: variant.isOriginal,
                            swatch_url: swatchUrl
                        }, { onConflict: 'material_id,variant_name' })
                        .select()
                        .single();

                    if (varErr) throw varErr;

                    const { error: texErr } = await supabaseClient
                        .from('set_variant_textures')
                        .upsert({
                            variant_id: varData.id,
                            base_color_url: baseColorUrl,
                            normal_url: normalUrl,
                            orm_url: ormUrl
                        }, { onConflict: 'variant_id' });

                    if (texErr) throw texErr;
                } catch (e) {
                    console.error("Set variant upload/save error:", e);
                    failCount++;
                }
            }));
        }));
    }

    // ── Navigation ──

    const goToStep2 = () => {
        formProps.form?.validateFields().then(() => {
            // Allow if either GLB parsed OR DB materials already loaded
            if (parsedMaterials.length === 0 && materialsWithVariants.length === 0) {
                message.warning('Lütfen önce bir GLB dosyası yükleyiniz');
                return;
            }
            setCurrentStep(1);
        }).catch(() => {
            message.error('Lütfen zorunlu alanları doldurunuz');
        });
    };

    // ── Thumbnail preview helper ──
    const renderTextureThumb = (url: string | null, label: string) => {
        if (!url) return null;
        return (
            <Image
                src={url}
                alt={label}
                width={48}
                height={48}
                style={{
                    objectFit: 'cover',
                    borderRadius: 4,
                    border: '1px solid #d9d9d9',
                    marginTop: 4
                }}
                preview={{ mask: 'Büyüt' }}
            />
        );
    };

    const renderSmallThumb = (url: string | null, label: string) => {
        if (!url) return <div style={{ width: 24, height: 24, background: '#f0f0f0', borderRadius: 2 }} />;
        return (
            <Tooltip title={label}>
                <img
                    src={url}
                    alt={label}
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: 2,
                        objectFit: 'cover',
                        border: '1px solid #d9d9d9'
                    }}
                />
            </Tooltip>
        );
    };

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════════════

    const managedMaterials = materialsWithVariants.filter(m => m.isManaged);

    return (
        <Edit
            saveButtonProps={{ style: { display: 'none' } }}
            title="Takım Düzenle"
            headerButtons={() => null}
        >
            <Spin spinning={loading} tip="Yükleniyor...">
                {/* Steps indicator */}
                <Steps
                    current={currentStep}
                    style={{ marginBottom: 24 }}
                    items={[
                        { title: 'Temel Bilgiler' },
                        { title: 'Model & Varyasyon' },
                        { title: 'Takıma Ait Ürünler' },
                    ]}
                />

                <Form {...formProps} layout="vertical" onFinish={handleSubmit}>

                    {/* ═══════════════════════════════════════════════════════════ */}
                    {/* STEP 1: TEMEL BİLGİLER                                    */}
                    {/* ═══════════════════════════════════════════════════════════ */}
                    <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
                        <Row gutter={24}>
                            {/* ── Left Column: Form Fields ── */}
                            <Col xs={24} lg={12}>
                                <Card title="Genel Bilgiler">
                                    {/* Company (super admin) */}
                                    {isSuperAdmin && (
                                        <Form.Item
                                            label="Şirket"
                                            name="company_id"
                                            rules={[{ required: true, message: 'Şirket seçiniz' }]}
                                        >
                                            <Select
                                                options={companySelectProps.options}
                                                loading={companySelectProps.loading}
                                                onChange={handleCompanyChange}
                                                placeholder="Şirket seçiniz"
                                                showSearch
                                                filterOption={(input, option) =>
                                                    (option?.label?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                                                }
                                            />
                                        </Form.Item>
                                    )}

                                    {/* Takım Adı */}
                                    <Form.Item
                                        label="Takım Adı"
                                        name="name"
                                        rules={[{ required: true, message: 'Takım adı giriniz' }]}
                                    >
                                        <Input placeholder="Örn: Modern Oturma Grubu" />
                                    </Form.Item>

                                    {/* Kategori */}
                                    <Form.Item
                                        label="Kategori"
                                        name="set_category_id"
                                        rules={[{ required: true, message: 'Kategori seçiniz' }]}
                                    >
                                        <Select
                                            options={categorySelectProps.options}
                                            loading={categorySelectProps.loading}
                                            placeholder="Kategori seçiniz"
                                            disabled={!effectiveCompanyId}
                                            showSearch
                                            filterOption={(input, option) =>
                                                (option?.label?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                                            }
                                        />
                                    </Form.Item>

                                    {/* SKU + Price row */}
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item label="SKU" name="sku">
                                                <Input placeholder="Örn: SET-001" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="Fiyat ($)" name="price">
                                                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    {/* Açıklama */}
                                    <Form.Item label="Açıklama" name="description">
                                        <TextArea rows={3} placeholder="Takım açıklaması" />
                                    </Form.Item>

                                    {/* Thumbnail */}
                                    <Form.Item label="Takım Görseli">
                                        <Space direction="vertical" style={{ width: '100%' }}>
                                            <Space>
                                                <Upload
                                                    accept="image/*"
                                                    showUploadList={false}
                                                    beforeUpload={handleThumbnailSelect}
                                                >
                                                    <Button icon={<UploadOutlined />}>
                                                        {previewThumbnail ? 'Görseli Değiştir' : 'Bilgisayardan Yükle'}
                                                    </Button>
                                                </Upload>
                                                <Button
                                                    icon={<PlusOutlined />}
                                                    onClick={() => {
                                                        setMediaModalTarget('thumbnail');
                                                        setMediaModalVisible(true);
                                                    }}
                                                >
                                                    Kütüphaneden Seç
                                                </Button>
                                            </Space>
                                            {previewThumbnail && (
                                                <div style={{ position: 'relative', maxWidth: 200 }}>
                                                    <img
                                                        src={previewThumbnail}
                                                        alt="Thumbnail"
                                                        style={{ width: '100%', borderRadius: 4 }}
                                                    />
                                                    {selectedR2Thumbnail && <div style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px 5px', borderRadius: 4, fontSize: 10 }}>R2</div>}
                                                </div>
                                            )}
                                        </Space>
                                    </Form.Item>

                                    {/* GLB Model */}
                                    <Form.Item label="3D Model (GLB)">
                                        <Space>
                                            <Upload
                                                accept=".glb"
                                                showUploadList={false}
                                                beforeUpload={handleModelSelect}
                                            >
                                                <Button icon={<UploadOutlined />} loading={parsingGLB}>
                                                    {selectedModelFile ? selectedModelFile.name : 'GLB Yükle'}
                                                </Button>
                                            </Upload>
                                            <Button
                                                icon={<PlusOutlined />}
                                                onClick={() => {
                                                    setMediaModalTarget('model');
                                                    setMediaModalVisible(true);
                                                }}
                                            >
                                                Kütüphaneden Seç
                                            </Button>
                                        </Space>
                                        {selectedR2Model && <div style={{ marginTop: 8, fontSize: 12, color: 'green' }}><CheckCircleOutlined /> R2 Modeli Seçildi</div>}
                                    </Form.Item>

                                    {/* Active */}
                                    <Form.Item label="Aktif" name="is_active" valuePropName="checked" initialValue={true}>
                                        <Switch />
                                    </Form.Item>

                                    {/* Custom Attributes */}
                                    <CustomAttributesManager
                                        initialAttributes={customAttributes}
                                        onChange={setCustomAttributes}
                                    />
                                </Card>
                            </Col>

                            {/* ── Right Column: Preview + Materials ── */}
                            <Col xs={24} lg={12}>
                                <Card title="Önizleme" style={{ marginBottom: 16 }}>
                                    {parsingGLB ? (
                                        <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Spin tip="GLB dosyası işleniyor..." />
                                        </div>
                                    ) : previewModelUrl ? (
                                        <ThreeModelViewer
                                            modelUrl={previewModelUrl}
                                            imageUrl={null}
                                            width="100%"
                                            height="400px"
                                            highlightMaterial={highlightMaterial}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                height: 400,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: '#1a1a1a',
                                                borderRadius: 8,
                                                color: '#666'
                                            }}
                                        >
                                            <Typography.Text type="secondary">
                                                3D Model önizlemesi burada görünecek
                                            </Typography.Text>
                                        </div>
                                    )}
                                </Card>

                                {/* Materials List Preview */}
                                {parsedMaterials.length > 0 && (
                                    <Card title={`${parsedMaterials.length} Materyal Bulundu`}>
                                        <List
                                            size="small"
                                            dataSource={parsedMaterials}
                                            renderItem={(mat) => (
                                                <List.Item
                                                    onClick={() => setHighlightMaterial(
                                                        highlightMaterial === mat.id ? null : mat.id
                                                    )}
                                                    style={{
                                                        cursor: 'pointer',
                                                        backgroundColor: highlightMaterial === mat.id
                                                            ? '#e6f7ff'
                                                            : 'transparent',
                                                        padding: '8px 12px',
                                                        borderRadius: 4,
                                                    }}
                                                >
                                                    <Space>
                                                        <Typography.Text
                                                            strong={highlightMaterial === mat.id}
                                                        >
                                                            {mat.name}
                                                        </Typography.Text>
                                                        {mat.baseColorTexture && (
                                                            <img
                                                                src={mat.baseColorTexture.url}
                                                                alt=""
                                                                style={{
                                                                    width: 24,
                                                                    height: 24,
                                                                    borderRadius: 3,
                                                                    objectFit: 'cover',
                                                                    border: '1px solid #d9d9d9'
                                                                }}
                                                            />
                                                        )}
                                                    </Space>
                                                </List.Item>
                                            )}
                                        />
                                    </Card>
                                )}
                            </Col>
                        </Row>

                        {/* Next button */}
                        <div style={{ marginTop: 24, textAlign: 'right' }}>
                            <Button
                                type="primary"
                                icon={<ArrowRightOutlined />}
                                onClick={goToStep2}
                                size="large"
                                disabled={parsedMaterials.length === 0 && materialsWithVariants.length === 0}
                            >
                                Sonraki: Varyasyonlar
                            </Button>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════ */}
                    {/* STEP 2: MODEL BİLGİLERİ & VARYASYON YÖNETİMİ               */}
                    {/* ═══════════════════════════════════════════════════════════ */}
                    <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>

                        {/* Panel 1: Model Bilgileri (Material Selection) */}
                        <Card title="Model Bilgileri" style={{ marginBottom: 24 }}>
                            <Typography.Paragraph type="secondary">
                                Varyasyon oluşturmak istediğiniz materyalleri aşağıdaki listeden seçerek "Varyasyon Yönetimi" paneline ekleyiniz.
                            </Typography.Paragraph>

                            <List
                                itemLayout="horizontal"
                                dataSource={materialsWithVariants}
                                renderItem={(item, index) => (
                                    <List.Item
                                        actions={[
                                            <Checkbox
                                                checked={item.isManaged}
                                                onChange={() => toggleMaterialManaged(index)}
                                            >
                                                {item.isManaged ? 'Varyasyon Yönetimi Açık' : 'Varyasyon Ekle'}
                                            </Checkbox>
                                        ]}
                                        style={{
                                            backgroundColor: item.isManaged ? '#f6ffed' : 'transparent',
                                            transition: 'background-color 0.3s'
                                        }}
                                    >
                                        <List.Item.Meta
                                            title={<Typography.Text strong>{item.material.name}</Typography.Text>}
                                            description={
                                                <Space size="large">
                                                    <Space>
                                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Base:</Typography.Text>
                                                        {renderSmallThumb(item.variants[0].baseColorPreview, 'BaseColor')}
                                                    </Space>
                                                    <Space>
                                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Normal:</Typography.Text>
                                                        {renderSmallThumb(item.variants[0].normalPreview, 'Normal')}
                                                    </Space>
                                                    <Space>
                                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>ORM:</Typography.Text>
                                                        {renderSmallThumb(item.variants[0].ormPreview, 'ORM')}
                                                    </Space>
                                                    {item.isManaged && <Typography.Text type="success" style={{ fontSize: 12 }}>
                                                        <CheckCircleOutlined /> Panele Eklendi
                                                    </Typography.Text>}
                                                </Space>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        </Card>

                        {/* Panel 2: Varyasyon Yönetimi (Managed Materials) */}
                        {managedMaterials.length > 0 && (
                            <Card title="Varyasyon Yönetimi" style={{ marginBottom: 24, border: '1px solid #1890ff' }}>
                                <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                                    Seçilen materyaller için yeni varyasyonlar tanımlayabilirsiniz.
                                </Typography.Paragraph>

                                <Collapse
                                    defaultActiveKey={managedMaterials.map(m => m.material.id)}
                                >
                                    {materialsWithVariants.map((matItem, matIdx) => {
                                        if (!matItem.isManaged) return null;

                                        return (
                                            <Panel
                                                header={
                                                    <Space onClick={(e) => e.stopPropagation()}>
                                                        <EditOutlined style={{ color: '#1890ff', fontSize: 12 }} />
                                                        <div style={{ marginRight: 8 }}>
                                                            <Typography.Text type="secondary" style={{ marginRight: 8 }}>ID:</Typography.Text>
                                                            <Input
                                                                value={matItem.displayName}
                                                                onChange={(e) => updateMaterialDisplayName(matIdx, e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{
                                                                    fontWeight: 600,
                                                                    border: '1px dashed #d9d9d9',
                                                                    borderRadius: 4,
                                                                    padding: '2px 8px',
                                                                    width: 280
                                                                }}
                                                            />
                                                        </div>
                                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                                            ({matItem.variants.length} varyasyon)
                                                        </Typography.Text>
                                                    </Space>
                                                }
                                                key={matItem.material.id}
                                            >
                                                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                                    {matItem.variants.map((variant, varIdx) => (
                                                        <Card
                                                            key={varIdx}
                                                            size="small"
                                                            title={
                                                                <Space>
                                                                    <Typography.Text>
                                                                        {variant.isOriginal ? '🔒 Orijinal' : `Varyasyon ${varIdx + 1}`}
                                                                    </Typography.Text>
                                                                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                                                        GLB Mat ID: {matItem.material.id}
                                                                    </Typography.Text>
                                                                    {variant.isOriginal && (
                                                                        <Typography.Text type="warning" style={{ fontSize: 11 }}>
                                                                            (GLB texture'ları — salt okunur)
                                                                        </Typography.Text>
                                                                    )}
                                                                </Space>
                                                            }
                                                            extra={
                                                                !variant.isOriginal && (
                                                                    <Popconfirm
                                                                        title="Bu varyasyonu silmek istediğinize emin misiniz?"
                                                                        onConfirm={() => removeVariant(matIdx, varIdx)}
                                                                        okText="Evet"
                                                                        cancelText="İptal"
                                                                    >
                                                                        <Button danger size="small" icon={<DeleteOutlined />} />
                                                                    </Popconfirm>
                                                                )
                                                            }
                                                            style={{
                                                                backgroundColor: variant.isOriginal ? '#fbfbfb' : '#fff',
                                                                border: variant.isOriginal ? '1px dashed #d9d9d9' : '1px solid #f0f0f0'
                                                            }}
                                                        >
                                                            <Row gutter={[12, 12]} align="top">
                                                                {/* Varyasyon Adı */}
                                                                <Col xs={24} sm={6} md={4}>
                                                                    <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 12 }}>
                                                                        Varyasyon Adı
                                                                    </div>
                                                                    <Input
                                                                        value={variant.variantName}
                                                                        onChange={(e) =>
                                                                            updateVariantName(matIdx, varIdx, e.target.value)
                                                                        }
                                                                        placeholder="Örn: Parlak Altın"
                                                                        disabled={variant.isOriginal}
                                                                    />
                                                                </Col>

                                                                {/* Swatch */}
                                                                <Col xs={12} sm={4} md={4}>
                                                                    <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 12 }}>
                                                                        Swatch
                                                                    </div>
                                                                    <Space>
                                                                        <Upload
                                                                            accept="image/*"
                                                                            showUploadList={false}
                                                                            beforeUpload={(f) =>
                                                                                handleVariantFile(matIdx, varIdx, 'swatch', f)
                                                                            }
                                                                        >
                                                                            <Button size="small" icon={<UploadOutlined />}>
                                                                                {variant.swatchPreview ? 'Değiştir' : 'Yükle'}
                                                                            </Button>
                                                                        </Upload>
                                                                        <Button size="small" icon={<FolderOpenOutlined />} onClick={() => openVariantR2Picker(matIdx, varIdx, 'swatch')} title="R2'den seç">R2</Button>
                                                                    </Space>
                                                                    {renderTextureThumb(variant.swatchPreview, 'Swatch')}
                                                                </Col>

                                                                {/* BaseColor */}
                                                                <Col xs={12} sm={5} md={5}>
                                                                    <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 12 }}>
                                                                        BaseColor
                                                                    </div>
                                                                    {variant.isOriginal ? (
                                                                        <div>
                                                                            {variant.baseColorPreview ? (
                                                                                <>
                                                                                    {renderTextureThumb(variant.baseColorPreview, 'BaseColor')}
                                                                                    <div style={{ fontSize: 11, color: '#52c41a', marginTop: 4 }}>
                                                                                        🔒 GLB'den
                                                                                    </div>
                                                                                </>
                                                                            ) : (
                                                                                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                                                                    Texture bulunamadı
                                                                                </Typography.Text>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <Space>
                                                                                <Upload
                                                                                    accept="image/*"
                                                                                    showUploadList={false}
                                                                                    beforeUpload={(f) =>
                                                                                        handleVariantFile(matIdx, varIdx, 'baseColor', f)
                                                                                    }
                                                                                >
                                                                                    <Button size="small" icon={<UploadOutlined />}>
                                                                                        {variant.baseColorPreview ? 'Değiştir' : 'Yükle'}
                                                                                    </Button>
                                                                                </Upload>
                                                                                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => openVariantR2Picker(matIdx, varIdx, 'baseColor')} title="R2'den seç">R2</Button>
                                                                            </Space>
                                                                            {renderTextureThumb(variant.baseColorPreview, 'BaseColor')}
                                                                        </>
                                                                    )}
                                                                </Col>

                                                                {/* Normal */}
                                                                <Col xs={12} sm={5} md={5}>
                                                                    <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 12 }}>
                                                                        Normal Map
                                                                    </div>
                                                                    {variant.isOriginal ? (
                                                                        <div>
                                                                            {variant.normalPreview ? (
                                                                                <>
                                                                                    {renderTextureThumb(variant.normalPreview, 'Normal')}
                                                                                    <div style={{ fontSize: 11, color: '#52c41a', marginTop: 4 }}>
                                                                                        🔒 GLB'den
                                                                                    </div>
                                                                                </>
                                                                            ) : (
                                                                                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                                                                    Texture bulunamadı
                                                                                </Typography.Text>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <Space>
                                                                                <Upload
                                                                                    accept="image/*"
                                                                                    showUploadList={false}
                                                                                    beforeUpload={(f) =>
                                                                                        handleVariantFile(matIdx, varIdx, 'normal', f)
                                                                                    }
                                                                                >
                                                                                    <Button size="small" icon={<UploadOutlined />}>
                                                                                        {variant.normalPreview ? 'Değiştir' : 'Yükle'}
                                                                                    </Button>
                                                                                </Upload>
                                                                                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => openVariantR2Picker(matIdx, varIdx, 'normal')} title="R2'den seç">R2</Button>
                                                                            </Space>
                                                                            {renderTextureThumb(variant.normalPreview, 'Normal')}
                                                                        </>
                                                                    )}
                                                                </Col>

                                                                {/* ORM */}
                                                                <Col xs={12} sm={4} md={5}>
                                                                    <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 12 }}>
                                                                        ORM Map
                                                                    </div>
                                                                    {variant.isOriginal ? (
                                                                        <div>
                                                                            {variant.ormPreview ? (
                                                                                <>
                                                                                    {renderTextureThumb(variant.ormPreview, 'ORM')}
                                                                                    <div style={{ fontSize: 11, color: '#52c41a', marginTop: 4 }}>
                                                                                        🔒 GLB'den
                                                                                    </div>
                                                                                </>
                                                                            ) : (
                                                                                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                                                                    Texture bulunamadı
                                                                                </Typography.Text>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <Space>
                                                                                <Upload
                                                                                    accept="image/*"
                                                                                    showUploadList={false}
                                                                                    beforeUpload={(f) =>
                                                                                        handleVariantFile(matIdx, varIdx, 'orm', f)
                                                                                    }
                                                                                >
                                                                                    <Button size="small" icon={<UploadOutlined />}>
                                                                                        {variant.ormPreview ? 'Değiştir' : 'Yükle'}
                                                                                    </Button>
                                                                                </Upload>
                                                                                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => openVariantR2Picker(matIdx, varIdx, 'orm')} title="R2'den seç">R2</Button>
                                                                            </Space>
                                                                            {renderTextureThumb(variant.ormPreview, 'ORM')}
                                                                        </>
                                                                    )}
                                                                </Col>
                                                            </Row>
                                                        </Card>
                                                    ))}

                                                    {/* Add Variant Button */}
                                                    <Button
                                                        type="dashed"
                                                        onClick={() => addVariant(matIdx)}
                                                        icon={<PlusOutlined />}
                                                        block
                                                    >
                                                        + Varyasyon Ekle
                                                    </Button>
                                                </Space>
                                            </Panel>
                                        );
                                    })}
                                </Collapse>
                            </Card>
                        )}

                        {/* Navigation buttons */}
                        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                            <Button
                                icon={<ArrowLeftOutlined />}
                                onClick={() => setCurrentStep(0)}
                                size="large"
                            >
                                Geri: Temel Bilgiler
                            </Button>

                            <Button
                                type="primary"
                                icon={<ArrowRightOutlined />}
                                onClick={() => setCurrentStep(2)}
                                size="large"
                            >
                                Sonraki: Takıma Ait Ürünler
                            </Button>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════ */}
                    {/* STEP 3: TAKIMA AİT ÜRÜNLER                                */}
                    {/* ═══════════════════════════════════════════════════════════ */}
                    <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
                        {!includeProducts ? (
                            <Card
                                style={{
                                    marginBottom: 24,
                                    border: '2px dashed #d9d9d9',
                                    borderRadius: 12,
                                    background: '#fafafa',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                bodyStyle={{ padding: '40px 32px' }}
                                hoverable
                                onClick={() => setIncludeProducts(true)}
                            >
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #f5f0ff 0%, #fff7e6 100%)',
                                        border: '2px solid #d9d9d9',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 16px',
                                        fontSize: 28,
                                    }}>
                                        📦
                                    </div>
                                    <Typography.Title level={5} style={{ marginBottom: 8, color: '#262626' }}>
                                        Takıma Özel Ürün Ekle
                                    </Typography.Title>
                                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 14 }}>
                                        Bu takıma bağlı özel ürünler ekleyebilirsiniz. Varyasyonlar ürünlere otomatik uygulanır.
                                    </Typography.Text>
                                    <Button type="primary" icon={<PlusOutlined />} size="large">
                                        Evet, Ürün Eklemek İstiyorum
                                    </Button>
                                    <div style={{ marginTop: 12 }}>
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                            İstemiyorsanız bu adımı atlayabilirsiniz — varyasyonlar takım üzerinde kaydedilecektir.
                                        </Typography.Text>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card
                                title={
                                    <Space>
                                        <span>Takıma Ait Ürünler</span>
                                        <Button
                                            size="small"
                                            onClick={() => { setIncludeProducts(false); setSetProducts([]); }}
                                            style={{ fontSize: 12, color: '#8c8c8c', borderColor: '#d9d9d9' }}
                                        >
                                            Ürün Ekleme
                                        </Button>
                                    </Space>
                                }
                                extra={
                                    <Button type="primary" icon={<PlusOutlined />} onClick={addSetProduct}>
                                        Ürün Ekle
                                    </Button>
                                }
                                style={{ marginBottom: 24 }}
                            >
                                <>

                                    {setProducts.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                                            <Typography.Text type="secondary">
                                                Henüz ürün eklenmedi. "Ürün Ekle" butonuna tıklayarak takıma ait ürünleri ekleyin.
                                            </Typography.Text>
                                        </div>
                                    )}

                                    <Collapse accordion>
                                        {setProducts.map((sp, idx) => (
                                            <Panel
                                                key={idx}
                                                header={
                                                    <Space>
                                                        <Typography.Text strong>
                                                            {sp.name || `Ürün ${idx + 1}`}
                                                        </Typography.Text>
                                                        {sp.sku && (
                                                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                                                SKU: {sp.sku}
                                                            </Typography.Text>
                                                        )}
                                                        {sp.parsedMaterials.length > 0 && (
                                                            <Typography.Text type="success" style={{ fontSize: 12 }}>
                                                                ({sp.parsedMaterials.length} materyal)
                                                            </Typography.Text>
                                                        )}
                                                    </Space>
                                                }
                                                extra={
                                                    <Popconfirm
                                                        title="Bu ürünü kaldırmak istediğinize emin misiniz?"
                                                        onConfirm={(e) => { e?.stopPropagation(); removeSetProduct(idx); }}
                                                        onCancel={(e) => e?.stopPropagation()}
                                                    >
                                                        <Button
                                                            type="text"
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            size="small"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </Popconfirm>
                                                }
                                            >
                                                <Radio.Group
                                                    options={[
                                                        { label: 'Yeni Ürün Oluştur', value: false },
                                                        { label: 'Mevcut Ürün Seç', value: true }
                                                    ]}
                                                    value={sp.isExisting}
                                                    onChange={(e: any) => updateSetProduct(idx, 'isExisting', e.target.value)}
                                                    style={{ marginBottom: 16 }}
                                                    optionType="button"
                                                    buttonStyle="solid"
                                                />

                                                {sp.isExisting ? (
                                                    <div style={{ marginBottom: 16 }}>
                                                        <Typography.Text strong>Mevcut Ürün Seç *</Typography.Text>
                                                        <Select
                                                            {...existingProductSelectProps}
                                                            value={sp.existingProductId as any}
                                                            onChange={(val, option: any) => {
                                                                updateSetProduct(idx, 'existingProductId', val);
                                                                updateSetProduct(idx, 'name', option?.label || '');
                                                            }}
                                                            style={{ width: '100%', marginTop: 4, maxWidth: 400, display: 'block' }}
                                                            placeholder="Sistemdeki ürünlerden seçiniz"
                                                            showSearch
                                                            filterOption={(input, option) =>
                                                                (option?.label?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                                                            }
                                                        />
                                                        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
                                                            Not: Seçilen ürünün varyasyonları (eğer takımda tanımlanmışsa) takıma göre yeniden şekillenecektir.
                                                        </Typography.Text>
                                                    </div>
                                                ) : (
                                                    <Row gutter={24}>
                                                        <Col xs={24} md={12}>
                                                            <div style={{ marginBottom: 16 }}>
                                                                <Typography.Text strong>Ürün Adı *</Typography.Text>
                                                                <Input
                                                                    value={sp.name}
                                                                    onChange={(e) => updateSetProduct(idx, 'name', e.target.value)}
                                                                    placeholder="Ürün adı giriniz"
                                                                    style={{ marginTop: 4 }}
                                                                />
                                                            </div>
                                                            <div style={{ marginBottom: 16 }}>
                                                                <Typography.Text strong>SKU</Typography.Text>
                                                                <Input
                                                                    value={sp.sku}
                                                                    onChange={(e) => updateSetProduct(idx, 'sku', e.target.value)}
                                                                    placeholder="Ürün SKU giriniz"
                                                                    style={{ marginTop: 4 }}
                                                                />
                                                            </div>
                                                            <div style={{ marginBottom: 16 }}>
                                                                <Typography.Text strong>Kategori</Typography.Text>
                                                                <Select
                                                                    {...productCategorySelectProps}
                                                                    value={sp.categoryId as any}
                                                                    onChange={(val) => updateSetProduct(idx, 'categoryId', val)}
                                                                    style={{ width: '100%', marginTop: 4 }}
                                                                    placeholder="Kategori seçiniz"
                                                                    showSearch
                                                                    filterOption={(input, option) =>
                                                                        (option?.label?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                                                                    }
                                                                />
                                                            </div>
                                                            <div style={{ marginBottom: 16 }}>
                                                                <Typography.Text strong>Açıklama</Typography.Text>
                                                                <TextArea
                                                                    value={sp.description}
                                                                    onChange={(e) => updateSetProduct(idx, 'description', e.target.value)}
                                                                    placeholder="Ürün açıklaması"
                                                                    rows={3}
                                                                    style={{ marginTop: 4 }}
                                                                />
                                                            </div>
                                                        </Col>
                                                        <Col xs={24} md={12}>
                                                            <div style={{ marginBottom: 16 }}>
                                                                <Typography.Text strong>Ürün GLB Dosyası</Typography.Text>
                                                                <Upload
                                                                    accept=".glb,.gltf"
                                                                    maxCount={1}
                                                                    showUploadList={false}
                                                                    beforeUpload={(file) => {
                                                                        handleSetProductModel(idx, file);
                                                                        return false;
                                                                    }}
                                                                >
                                                                    <Button icon={<UploadOutlined />} style={{ marginTop: 4, width: '100%' }} loading={sp.parsingGLB}>
                                                                        {sp.modelFile ? sp.modelFile.name : 'GLB Dosyası Seç'}
                                                                    </Button>
                                                                </Upload>
                                                                {sp.parsingGLB && (
                                                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                                                        GLB ayrıştırılıyor...
                                                                    </Typography.Text>
                                                                )}
                                                            </div>
                                                            <div style={{ marginBottom: 16 }}>
                                                                <Typography.Text strong>Ürün Görseli</Typography.Text>
                                                                <Upload
                                                                    accept="image/*"
                                                                    maxCount={1}
                                                                    showUploadList={false}
                                                                    beforeUpload={(file) => {
                                                                        handleSetProductThumbnail(idx, file);
                                                                        return false;
                                                                    }}
                                                                >
                                                                    <Button icon={<UploadOutlined />} style={{ marginTop: 4, width: '100%' }}>
                                                                        {sp.thumbnailFile ? sp.thumbnailFile.name : 'Görsel Seç'}
                                                                    </Button>
                                                                </Upload>
                                                                {sp.thumbnailPreview && (
                                                                    <img
                                                                        src={sp.thumbnailPreview}
                                                                        alt="preview"
                                                                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, marginTop: 8, border: '1px solid #d9d9d9' }}
                                                                    />
                                                                )}
                                                            </div>
                                                            {sp.parsedMaterials.length > 0 && (
                                                                <div>
                                                                    <Typography.Text strong>Bulunan Materyaller</Typography.Text>
                                                                    <div style={{ marginTop: 4 }}>
                                                                        {sp.parsedMaterials.map((mat, mIdx) => (
                                                                            <Typography.Text
                                                                                key={mIdx}
                                                                                style={{ display: 'block', fontSize: 12, color: '#595959' }}
                                                                            >
                                                                                • {mat.name} ({mat.id})
                                                                            </Typography.Text>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Col>
                                                    </Row>
                                                )}

                                                {/* Shared variants info */}
                                                {managedMaterials.length > 0 && (
                                                    <Card size="small" style={{ marginTop: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                                                        <Typography.Text type="success">
                                                            <CheckCircleOutlined style={{ marginRight: 8 }} />
                                                            Takımda tanımlanan {managedMaterials.length} materyalin varyasyonları bu ürüne otomatik uygulanacak.
                                                        </Typography.Text>
                                                    </Card>
                                                )}
                                            </Panel>
                                        ))}
                                    </Collapse>
                                </>
                            </Card>
                        )}

                        {/* Navigation buttons */}
                        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                            <Button
                                icon={<ArrowLeftOutlined />}
                                onClick={() => setCurrentStep(1)}
                                size="large"
                            >
                                Geri: Varyasyonlar
                            </Button>

                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                htmlType="submit"
                                size="large"
                                loading={saving}
                            >
                                Takımı ve Ürünleri Kaydet
                            </Button>
                        </div>
                    </div>
                </Form>

                {/* Media Modal */}
                <Modal
                    title="Medyadan Seç"
                    open={mediaModalVisible}
                    onCancel={() => setMediaModalVisible(false)}
                    width={1000}
                    footer={null}
                    destroyOnClose
                >
                    <FileManager
                        bucketName={selectedCompanyBucket}
                        customDomain={selectedCompanyDomain}
                        companyName={effectiveCompanyName}
                        mode='select'
                        onSelect={handleMediaSelect}
                        height="60vh"
                    />
                </Modal>

                {/* Variant R2 Picker Modal */}
                <Modal
                    title="Varyasyon İçin Dosya Seç"
                    open={variantR2PickerVisible}
                    onCancel={() => {
                        setVariantR2PickerVisible(false);
                        setVariantR2PickerTarget(null);
                    }}
                    width={1000}
                    footer={null}
                    destroyOnClose
                >
                    <FileManager
                        bucketName={selectedCompanyBucket}
                        customDomain={selectedCompanyDomain}
                        companyName={effectiveCompanyName}
                        mode='select'
                        onSelect={handleVariantR2Select}
                        height="60vh"
                    />
                </Modal>

            </Spin>
        </Edit>
    );
};