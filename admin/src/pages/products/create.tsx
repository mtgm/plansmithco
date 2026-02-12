import React, { useState, useEffect } from 'react';
import { Create, useForm, useSelect } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
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
    Image
} from "antd";
import {
    UploadOutlined,
    PlusOutlined,
    DeleteOutlined,
    ArrowRightOutlined,
    ArrowLeftOutlined,
    SaveOutlined,
    EditOutlined
} from "@ant-design/icons";
import { uploadToR2 } from "../../utility/uploadToR2";
import { parseGLB, MaterialInfo } from "../../utility/glbParser";
import { CustomAttributesManager, CustomAttribute } from "../../components/products/CustomAttributesManager";
import { ThreeModelViewer } from "../../components/products/ThreeModelViewer";
import { supabaseClient } from "../../utility/supabaseClient";

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

    useEffect(() => {
        if (identity && !isSuperAdmin && userCompanyId) {
            setSelectedCompanyId(userCompanyId);
            setSelectedCompanyName(companyName);
        }
    }, [identity, isSuperAdmin, userCompanyId, companyName]);

    const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : userCompanyId;
    const effectiveCompanyName = isSuperAdmin ? selectedCompanyName : companyName;

    // ── Form ──
    const { formProps, saveButtonProps, onFinish } = useForm({
        resource: "products",
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

    const handleCompanyChange = (value: string) => {
        setSelectedCompanyId(value);
        const company = companiesQuery.data?.data.find((c: any) => c.id === value);
        setSelectedCompanyName(company?.company_name || '');
        formProps.form?.setFieldValue('product_category_id', undefined);
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

    // ── Material name editing ──
    const updateMaterialDisplayName = (matIdx: number, name: string) => {
        const updated = [...materialsWithVariants];
        updated[matIdx].displayName = name;
        setMaterialsWithVariants(updated);
    };

    // ── Variant handlers ──
    const addVariant = (materialIndex: number) => {
        const updated = [...materialsWithVariants];
        updated[materialIndex].variants.push({
            variantName: `Varyasyon ${updated[materialIndex].variants.length + 1}`,
            isOriginal: false,
            swatchFile: null,
            swatchPreview: null,
            baseColorFile: null,
            baseColorPreview: null,
            normalFile: null,
            normalPreview: null,
            ormFile: null,
            ormPreview: null,
        });
        setMaterialsWithVariants(updated);
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

    // ── Submit ──

    const handleSubmit = async (values: any) => {
        try {
            if (!effectiveCompanyId || !effectiveCompanyName) {
                message.error('Lütfen şirket seçiniz');
                return;
            }

            setSaving(true);

            // 1. Upload thumbnail and model to R2
            let thumbnailUrl: string | null = null;
            let modelUrl: string | null = null;

            if (selectedThumbnailFile) {
                thumbnailUrl = await uploadToR2(
                    selectedThumbnailFile,
                    'products/thumbnails',
                    effectiveCompanyName
                );
            }

            if (selectedModelFile) {
                modelUrl = await uploadToR2(
                    selectedModelFile,
                    'products/models',
                    effectiveCompanyName
                );
            }

            // 2. Save product to Supabase
            const productData = {
                ...values,
                company_id: effectiveCompanyId,
                thumbnail_url: thumbnailUrl,
                model_url: modelUrl,
                custom_attributes: customAttributes.length > 0
                    ? JSON.stringify(customAttributes)
                    : null,
            };

            const result = await onFinish(productData);
            const productId = (result as any)?.data?.id;

            if (!productId) {
                message.warning('Ürün kaydedildi fakat material/varyasyon kaydı yapılamadı (ID bulunamadı)');
                return;
            }

            // 3. Save materials, variants, textures
            await saveMaterialsAndVariants(productId);

            message.success('Ürün başarıyla oluşturuldu!');
        } catch (error: any) {
            message.error('Hata: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const saveMaterialsAndVariants = async (productId: string) => {
        for (const { material, displayName, variants } of materialsWithVariants) {
            // Insert product_materials
            const { data: matData, error: matErr } = await supabaseClient
                .from('product_materials')
                .insert({
                    product_id: productId,
                    material_id: material.id,
                    name: displayName,
                })
                .select()
                .single();

            if (matErr) {
                console.error('Material insert error:', matErr);
                continue;
            }

            for (const variant of variants) {
                // Upload variant files to R2
                let swatchUrl: string | null = null;
                let baseColorUrl: string | null = null;
                let normalUrl: string | null = null;
                let ormUrl: string | null = null;

                const folder = `products/${productId}/materials/${material.id}`;

                if (variant.swatchFile) {
                    swatchUrl = await uploadToR2(variant.swatchFile, `${folder}/swatch`, effectiveCompanyName);
                }

                // For original variant, textures come from GLB (stored as data URLs)
                // For new variants, upload files to R2
                if (!variant.isOriginal) {
                    if (variant.baseColorFile) {
                        baseColorUrl = await uploadToR2(variant.baseColorFile, `${folder}/basecolor`, effectiveCompanyName);
                    }
                    if (variant.normalFile) {
                        normalUrl = await uploadToR2(variant.normalFile, `${folder}/normal`, effectiveCompanyName);
                    }
                    if (variant.ormFile) {
                        ormUrl = await uploadToR2(variant.ormFile, `${folder}/orm`, effectiveCompanyName);
                    }
                } else {
                    // Original textures: store the preview data URLs
                    baseColorUrl = variant.baseColorPreview;
                    normalUrl = variant.normalPreview;
                    ormUrl = variant.ormPreview;
                }

                // Insert product_variants
                const { data: varData, error: varErr } = await supabaseClient
                    .from('product_variants')
                    .insert({
                        material_id: matData.id,
                        variant_name: variant.variantName,
                        swatch_url: swatchUrl,
                    })
                    .select()
                    .single();

                if (varErr) {
                    console.error('Variant insert error:', varErr);
                    continue;
                }

                // Insert variant_textures
                await supabaseClient.from('variant_textures').insert({
                    variant_id: varData.id,
                    base_color_url: baseColorUrl,
                    normal_url: normalUrl,
                    orm_url: ormUrl,
                });
            }
        }
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

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════════════

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
                    { title: 'Varyasyonlar' },
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
                                    <Upload
                                        accept="image/*"
                                        showUploadList={false}
                                        beforeUpload={handleThumbnailSelect}
                                    >
                                        <Button icon={<UploadOutlined />}>
                                            {previewThumbnail ? 'Görseli Değiştir' : 'Görsel Yükle'}
                                        </Button>
                                    </Upload>
                                    {previewThumbnail && (
                                        <img
                                            src={previewThumbnail}
                                            alt="Thumbnail"
                                            style={{ width: '100%', maxWidth: 200, marginTop: 8, borderRadius: 4 }}
                                        />
                                    )}
                                </Form.Item>

                                {/* GLB Model */}
                                <Form.Item label="3D Model (GLB)">
                                    <Upload
                                        accept=".glb"
                                        showUploadList={false}
                                        beforeUpload={handleModelSelect}
                                    >
                                        <Button icon={<UploadOutlined />} loading={parsingGLB}>
                                            {selectedModelFile ? selectedModelFile.name : 'GLB Yükle'}
                                        </Button>
                                    </Upload>
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

                            {/* Materials List */}
                            {parsedMaterials.length > 0 && (
                                <Card title="MODEL MATERYALLERİ (SEÇMEK İÇİN TIKLAYIN)">
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
                {/* STEP 2: VARYASYONLAR                                      */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
                    <Card title="Varyasyon Yönetimi">
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                            Her material için "Orijinal" varyasyon GLB dosyasından gelen texture'ları içerir (değiştirilemez).
                            Yeni varyasyonlar ekleyerek masaüstünden farklı texture dosyaları yükleyebilirsiniz.
                        </Typography.Paragraph>

                        <Collapse
                            defaultActiveKey={materialsWithVariants.map((_, i) => i.toString())}
                            accordion={false}
                        >
                            {materialsWithVariants.map((matItem, matIdx) => (
                                <Panel
                                    header={
                                        <Space onClick={(e) => e.stopPropagation()}>
                                            <EditOutlined style={{ color: '#1890ff', fontSize: 12 }} />
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
                                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                                ({matItem.variants.length} varyasyon)
                                            </Typography.Text>
                                        </Space>
                                    }
                                    key={matIdx.toString()}
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
                                                    backgroundColor: variant.isOriginal ? '#f6ffed' : '#fff',
                                                    border: variant.isOriginal ? '1px solid #b7eb8f' : '1px solid #f0f0f0'
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
                            ))}
                        </Collapse>
                    </Card>

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
        </Create>
    );
};
