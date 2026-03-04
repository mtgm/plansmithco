import React, { useState, useEffect } from 'react';
import { Create, useForm, useSelect } from "@refinedev/antd";
import { useGetIdentity, useGo, useInvalidate } from "@refinedev/core";
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
    Modal
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
import { slugify, uploadToR2 } from "../../utility/uploadToR2"; // Added slugify
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
    isOriginal: boolean;             // true = GLB'den gelen orijinal (read-only textures)
    swatchFile: File | null;
    swatchPreview: string | null;
    baseColorFile: File | null;
    baseColorPreview: string | null;   // data URL or blob URL for preview
    normalFile: File | null;
    normalPreview: string | null;
    ormFile: File | null;
    ormPreview: string | null;
}

interface MaterialWithVariants {
    material: MaterialInfo;
    displayName: string;             // editable name
    isManaged: boolean;              // true = moved to variant management panel
    variants: VariantData[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ProductCreate = () => {
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

            // Fetch company storage config for company admin
            supabaseClient
                .from('companies')
                .select('storage_bucket, storage_domain')
                .eq('id', userCompanyId)
                .single()
                .then(({ data }) => {
                    if (data) {
                        setSelectedCompanyBucket(data.storage_bucket);
                        setSelectedCompanyDomain(data.storage_domain);
                        console.log('Loaded company storage config:', data);
                    }
                });
        }
    }, [identity, isSuperAdmin, userCompanyId, companyName]);

    const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : userCompanyId;
    const effectiveCompanyName = isSuperAdmin ? selectedCompanyName : companyName;

    const go = useGo();
    const invalidate = useInvalidate();

    // ── Form ──
    const { formProps, saveButtonProps, onFinish } = useForm({
        resource: "products",
        redirect: false,
    });
    // ── Selects ──
    const { selectProps: companySelectProps, queryResult: companiesQuery } = useSelect({
        resource: "companies",
        optionLabel: "company_name",
        optionValue: "id",
        queryOptions: { enabled: isSuperAdmin },
    });

    const { selectProps: categorySelectProps } = useSelect({
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

    // ── Steps ──
    const [currentStep, setCurrentStep] = useState(0);

    // ── File states ──
    const [selectedThumbnailFile, setSelectedThumbnailFile] = useState<File | null>(null);
    const [selectedModelFile, setSelectedModelFile] = useState<File | null>(null);
    const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(null);
    const [previewModelUrl, setPreviewModelUrl] = useState<string | null>(null);

    // ── Media Picker State ──
    const [mediaModalVisible, setMediaModalVisible] = useState(false);
    const [mediaModalTarget, setMediaModalTarget] = useState<'thumbnail' | 'model' | null>(null);
    const [selectedR2Thumbnail, setSelectedR2Thumbnail] = useState<string | null>(null); // URL
    const [selectedR2Model, setSelectedR2Model] = useState<string | null>(null); // URL

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

    // ── Saving state ──
    const [saving, setSaving] = useState(false);

    // ── Handlers ──

    const handleCompanyChange = async (value: string) => {
        setSelectedCompanyId(value);
        const company = companiesQuery.data?.data.find((c: any) => c.id === value);
        setSelectedCompanyName(company?.company_name || '');
        formProps.form?.setFieldValue('product_category_id', undefined);

        // Fetch storage config for selected company
        const { data } = await supabaseClient
            .from('companies')
            .select('storage_bucket, storage_domain')
            .eq('id', value)
            .single();

        if (data) {
            setSelectedCompanyBucket(data.storage_bucket);
            setSelectedCompanyDomain(data.storage_domain);
            console.log('Selected company storage config:', data);
        } else {
            setSelectedCompanyBucket(undefined);
            setSelectedCompanyDomain(undefined);
        }
    };

    const handleThumbnailSelect = (file: File) => {
        setSelectedThumbnailFile(file);
        setPreviewThumbnail(URL.createObjectURL(file));
        return false;
    };

    const handleModelSelect = async (file: File) => {
        try {
            setParsingGLB(true);
            setSelectedModelFile(file);
            setPreviewModelUrl(URL.createObjectURL(file));

            const parsed = await parseGLB(file);
            setParsedMaterials(parsed.materials);

            // Initialize each material with a default "Orijinal" variant
            // populated with textures extracted from the GLB (read-only)
            const initialized: MaterialWithVariants[] = parsed.materials.map(mat => ({
                material: mat,
                displayName: mat.name,
                isManaged: false, // Default: not in variant management panel
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

        // Don't allow changing original variant textures
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
            // Download via S3 SDK to get a local blob URL for preview
            const blobUrl = await downloadR2FileAsBlob(
                file.url,
                selectedCompanyBucket || import.meta.env.VITE_R2_BUCKET_NAME,
                selectedCompanyDomain || import.meta.env.VITE_R2_PUBLIC_URL
            );

            // Fetch as blob so we also have a File object for later upload
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
            setSelectedThumbnailFile(null); // Clear local file
            setPreviewThumbnail(file.url);
            message.success('Thumbnail seçildi');
        } else if (target === 'model') {
            const url = file.url;
            setSelectedR2Model(url); // Keep the original R2 URL for saving
            setSelectedModelFile(null); // Clear local file

            // Fetch and parse remote GLB via S3 SDK (bypasses CORS)
            try {
                setParsingGLB(true);
                message.loading({ content: 'Model indiriliyor...', key: 'model-download' });

                // Download via S3 SDK to get a local blob URL
                const blobUrl = await downloadR2FileAsBlob(
                    url,
                    selectedCompanyBucket || import.meta.env.VITE_R2_BUCKET_NAME,
                    selectedCompanyDomain || import.meta.env.VITE_R2_PUBLIC_URL
                );

                // Use the blob URL for preview (this works with useGLTF since it's same-origin)
                setPreviewModelUrl(blobUrl);

                // Also parse materials from the blob
                const response = await fetch(blobUrl);
                const blob = await response.blob();
                const fileObj = new File([blob], file.name, { type: 'model/gltf-binary' });

                const parsed = await parseGLB(fileObj);
                setParsedMaterials(parsed.materials);

                // Initialize each material with a default "Orijinal" variant
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

            setSaving(true);

            // 1. Save product to Supabase FIRST to get the ID
            // We save with null URLs initially
            const initialProductData = {
                ...values,
                company_id: effectiveCompanyId,
                thumbnail_url: null,
                model_url: null,
                custom_attributes: customAttributes.length > 0
                    ? JSON.stringify(customAttributes)
                    : null,
            };

            const result = await onFinish(initialProductData);
            const productId = (result as any)?.data?.id;

            if (!productId) {
                throw new Error('Ürün ID alınamadı');
            }

            // 2. Upload thumbnail and model to R2 using the STABLE ID
            let thumbnailUrl: string | null = null;
            let modelUrl: string | null = null;
            const productFolder = `products/${productId}`;

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
                thumbnailUrl = selectedR2Thumbnail;
            }

            if (selectedModelFile) {
                uploadTasks.push(uploadToR2(
                    selectedModelFile,
                    productFolder,
                    effectiveCompanyName,
                    selectedCompanyBucket,
                    selectedCompanyDomain
                ).then(url => modelUrl = url));
            } else if (selectedR2Model) {
                modelUrl = selectedR2Model;
            }

            await Promise.all(uploadTasks);

            // 3. Update the product record with actual URLs
            const { error: patchError } = await supabaseClient
                .from('products')
                .update({
                    thumbnail_url: thumbnailUrl,
                    model_url: modelUrl
                })
                .eq('id', productId);

            if (patchError) {
                console.error("Error updating product URLs:", patchError);
                // We don't throw here to allow material saving to continue, 
                // but it's a critical state.
            }

            // 4. Save materials, variants, textures
            await saveMaterialsAndVariants(productId);

            // 🔥 Make sure next screens never see stale data
            await invalidate({ resource: "products", invalidates: ["list", "many", "detail"] });
            await invalidate({ resource: "product_materials", invalidates: ["list", "many", "detail"] });
            await invalidate({ resource: "product_variants", invalidates: ["list", "many", "detail"] });

            message.success('Ürün başarıyla oluşturuldu!');

            // ✅ Go to edit AFTER everything (uploads + DB inserts) is finished
            go({ to: { resource: "products", action: "list", id: productId } });
        } catch (error: any) {
            console.error(error);
            message.error('Hata: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    async function saveMaterialsAndVariants(productId: string) {
        let successCount = 0;
        let failCount = 0;
        const baseProductFolder = `products/${productId}`;

        console.log("Starting Robust Save Process (Create) for Product:", productId);

        // Parallel Material Processing
        await Promise.all(materialsWithVariants.map(async ({ material, displayName, variants, isManaged }) => {
            if (!isManaged) return;

            console.log(`Processing Material: ${material.id} (${displayName})`);
            const sanitizedMatId = slugify(material.id);

            // Upsert Material
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
                message.error(`Materyal kaydedilemedi (${displayName}): ${matErr.message}`);
                failCount++;
                return;
            }

            // Parallel Variant Processing
            await Promise.all(variants.map(async (variant) => {
                console.log(`  - Processing Variant: ${variant.variantName}`);
                const sanitizedVariantName = slugify(variant.variantName);
                const variantFolder = `${baseProductFolder}/materials/${sanitizedMatId}/${sanitizedVariantName}`;

                try {
                    // Refined uploadOrKeep for Upsert
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

                        // If it's already an HTTP URL or a simple path, keep it
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

                    if (varErr) throw varErr;

                    // Upsert Textures
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
        console.log("Robust Save Process Completed successfully.");
    };

    // ── Navigation ──

    const goToStep2 = () => {
        formProps.form?.validateFields().then(() => {
            if (parsedMaterials.length === 0) {
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
        <Create
            saveButtonProps={{ style: { display: 'none' } }}
            title="Ürün Oluştur"
            headerButtons={() => null}
        >
            {/* Steps indicator */}
            <Steps
                current={currentStep}
                style={{ marginBottom: 24 }}
                items={[
                    { title: 'Temel Bilgiler' },
                    { title: 'Model & Varyasyon' },
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

                                {/* Ürün Adı */}
                                <Form.Item
                                    label="Ürün Adı"
                                    name="name"
                                    rules={[{ required: true, message: 'Ürün adı giriniz' }]}
                                >
                                    <Input placeholder="Örn: Modern Yemek Masası" />
                                </Form.Item>

                                {/* Kategori */}
                                <Form.Item
                                    label="Kategori"
                                    name="product_category_id"
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
                                            <Input placeholder="Örn: PRD-001" />
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
                                    <TextArea rows={3} placeholder="Ürün açıklaması" />
                                </Form.Item>

                                {/* Thumbnail */}

                                <Form.Item label="Ürün Görseli">
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

                                {/* Etsy Link */}
                                <Form.Item label="Etsy Linki" name="etsy_link">
                                    <Input placeholder="https://etsy.com/..." />
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
                            disabled={parsedMaterials.length === 0}
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
                                    // Only show managed items
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
                                                            backgroundColor: variant.isOriginal ? '#fbfbfb' : '#fff', // Slightly different bg for original
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
                            icon={<SaveOutlined />}
                            htmlType="submit"
                            size="large"
                            loading={saving}
                        >
                            Ürünü Kaydet
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

        </Create>
    );
};
