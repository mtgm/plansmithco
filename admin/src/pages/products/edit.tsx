import React, { useState, useEffect } from 'react';
import { Edit, useForm, useSelect } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import {
    Form,
    Input,
    InputNumber,
    Select,
    Upload,
    Button,
    message,
    Tabs,
    Row,
    Col,
    Card,
    Switch,
    List,
    Typography,
    Spin
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { uploadToR2 } from "../../utility/uploadToR2";
import { parseGLB, MaterialInfo } from "../../utility/glbParser";
import { MaterialVariantManager, MaterialVariant } from "../../components/products/MaterialVariantManager";
import { CustomAttributesManager, CustomAttribute } from "../../components/products/CustomAttributesManager";
import { ThreeModelViewer } from "../../components/products/ThreeModelViewer";
import { supabaseClient } from "../../utility/supabaseClient";

const { TextArea } = Input;
const { TabPane } = Tabs;

interface MaterialWithVariants {
    dbId?: string; // Database ID for product_materials
    material: MaterialInfo;
    variants: MaterialVariant[];
}

export const ProductEdit = () => {
    const { formProps, saveButtonProps, queryResult, onFinish } = useForm();
    const productData = queryResult?.data?.data;

    // Get user identity
    const { data: identity } = useGetIdentity<{
        id: string;
        role: string;
        company_id: string;
        company?: { company_name: string };
    }>();

    const companyName = identity?.company?.company_name || '';

    // Category Select
    const { selectProps: categorySelectProps } = useSelect({
        resource: "product_categories",
        optionLabel: "name",
        optionValue: "id",
        defaultValue: productData?.category_id,
    });

    // File upload states
    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
    const [uploadingModel, setUploadingModel] = useState(false);
    const [selectedThumbnailFile, setSelectedThumbnailFile] = useState<File | null>(null);
    const [selectedModelFile, setSelectedModelFile] = useState<File | null>(null);
    const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(null);
    const [previewModelUrl, setPreviewModelUrl] = useState<string | null>(null);

    // Company storage config
    const [companyBucket, setCompanyBucket] = useState<string | undefined>();
    const [companyDomain, setCompanyDomain] = useState<string | undefined>();

    // GLB parsed materials
    const [parsedMaterials, setParsedMaterials] = useState<MaterialInfo[]>([]);
    const [materialsWithVariants, setMaterialsWithVariants] = useState<MaterialWithVariants[]>([]);
    const [selectedMaterialIndex, setSelectedMaterialIndex] = useState<number | null>(null);
    const [loadingMaterials, setLoadingMaterials] = useState(false);

    // Custom attributes
    const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>([]);

    // Load existing materials and variants
    useEffect(() => {
        if (productData?.id) {
            loadExistingMaterials(productData.id.toString());

            // Parse custom attributes if they exist
            if (productData.custom_attributes) {
                try {
                    const attrs = JSON.parse(productData.custom_attributes);
                    setCustomAttributes(attrs);
                } catch (e) {
                    console.error('Error parsing custom attributes:', e);
                }
            }

            // Set preview URLs
            if (productData.thumbnail_url) {
                setPreviewThumbnail(productData.thumbnail_url);
            }
            if (productData.model_url) {
                setPreviewModelUrl(productData.model_url);
            }

            // Fetch company storage config
            if (productData.company_id) {
                supabaseClient
                    .from('companies')
                    .select('storage_bucket, storage_domain')
                    .eq('id', productData.company_id)
                    .single()
                    .then(({ data }) => {
                        if (data) {
                            setCompanyBucket(data.storage_bucket);
                            setCompanyDomain(data.storage_domain);
                        }
                    });
            }
        }
    }, [productData]);

    const loadExistingMaterials = async (productId: string) => {
        try {
            setLoadingMaterials(true);

            // Fetch materials, variants, and textures
            const { data: materialsData, error: materialsError } = await supabaseClient
                .from('product_materials')
                .select(`
                    id,
                    material_id,
                    name,
                    product_variants (
                        id,
                        variant_name,
                        swatch_url,
                        variant_textures (
                            base_color_url,
                            normal_url,
                            orm_url
                        )
                    )
                `)
                .eq('product_id', productId);

            if (materialsError) throw materialsError;

            if (materialsData && materialsData.length > 0) {
                const loaded: MaterialWithVariants[] = materialsData.map((mat: any) => ({
                    dbId: mat.id,
                    material: {
                        id: mat.material_id,
                        name: mat.name,
                        index: 0,
                        baseColorTexture: null,
                        normalTexture: null,
                        ormTexture: null,
                    },
                    variants: mat.product_variants.map((variant: any) => ({
                        id: variant.id,
                        variantName: variant.variant_name,
                        swatchUrl: variant.swatch_url,
                        baseColorUrl: variant.variant_textures[0]?.base_color_url || null,
                        normalUrl: variant.variant_textures[0]?.normal_url || null,
                        ormUrl: variant.variant_textures[0]?.orm_url || null
                    }))
                }));

                setMaterialsWithVariants(loaded);
                setParsedMaterials(loaded.map(m => m.material));
            }
        } catch (error: any) {
            console.error('Error loading materials:', error);
            message.error('Material yükleme hatası: ' + error.message);
        } finally {
            setLoadingMaterials(false);
        }
    };

    // Handle Thumbnail Selection
    const handleThumbnailSelect = (file: File) => {
        setSelectedThumbnailFile(file);
        const blobUrl = URL.createObjectURL(file);
        setPreviewThumbnail(blobUrl);
        return false;
    };

    // Handle GLB Selection (replacing model)
    const handleModelSelect = async (file: File) => {
        try {
            setSelectedModelFile(file);
            const blobUrl = URL.createObjectURL(file);
            setPreviewModelUrl(blobUrl);

            // Parse GLB to extract materials
            const parsed = await parseGLB(file);
            setParsedMaterials(parsed.materials);

            // Re-initialize materials with default variants (will replace existing)
            const initialized: MaterialWithVariants[] = parsed.materials.map(mat => ({
                material: mat,
                variants: [{
                    variantName: 'Orijinal',
                    swatchUrl: null,
                    baseColorUrl: null,
                    normalUrl: null,
                    ormUrl: null
                }]
            }));
            setMaterialsWithVariants(initialized);

            message.success(`GLB yüklendi: ${parsed.materials.length} material bulundu`);
            message.warning('Not: Yeni GLB yüklediğiniz için mevcut material/varyasyon verileri sıfırlandı.');
        } catch (error: any) {
            message.error('GLB parse hatası: ' + error.message);
        }
        return false;
    };

    // Handle material variant change
    const handleVariantChange = (materialIndex: number, variants: MaterialVariant[]) => {
        const updated = [...materialsWithVariants];
        updated[materialIndex].variants = variants;
        setMaterialsWithVariants(updated);
    };

    // Form submission
    const handleFormSubmit = async (values: any) => {
        try {
            // Upload new files if selected
            let thumbnailUrl = productData?.thumbnail_url;
            let modelUrl = productData?.model_url;

            if (selectedThumbnailFile) {
                setUploadingThumbnail(true);
                thumbnailUrl = await uploadToR2(
                    selectedThumbnailFile,
                    `products/${productData?.id}`,
                    companyName,
                    companyBucket,
                    companyDomain
                );
            }

            if (selectedModelFile) {
                setUploadingModel(true);
                modelUrl = await uploadToR2(
                    selectedModelFile,
                    `products/${productData?.id}`,
                    companyName,
                    companyBucket,
                    companyDomain
                );
            }

            // Prepare product data
            const updatedData = {
                ...values,
                thumbnail_url: thumbnailUrl,
                model_url: modelUrl,
                custom_attributes: customAttributes.length > 0
                    ? JSON.stringify(customAttributes)
                    : null
            };

            // Call the default mutation
            await onFinish(updatedData);

            // Update materials and variants
            await updateMaterialsAndVariants(productData?.id?.toString() || '');

            message.success('Ürün başarıyla güncellendi!');
        } catch (error: any) {
            message.error('Hata: ' + error.message);
        } finally {
            setUploadingThumbnail(false);
            setUploadingModel(false);
        }
    };

    // Update materials and variants in database
    const updateMaterialsAndVariants = async (productId: string) => {
        try {
            // Delete existing materials (cascade will handle variants and textures)
            await supabaseClient
                .from('product_materials')
                .delete()
                .eq('product_id', productId);

            // Re-insert all materials and variants
            for (const { material, variants } of materialsWithVariants) {
                const { data: materialData, error: materialError } = await supabaseClient
                    .from('product_materials')
                    .insert({
                        product_id: productId,
                        material_id: material.id,
                        name: material.name
                    })
                    .select()
                    .single();

                if (materialError) throw materialError;

                for (const variant of variants) {
                    const { data: variantData, error: variantError } = await supabaseClient
                        .from('product_variants')
                        .insert({
                            material_id: materialData.id,
                            variant_name: variant.variantName,
                            swatch_url: variant.swatchUrl
                        })
                        .select()
                        .single();

                    if (variantError) throw variantError;

                    await supabaseClient
                        .from('variant_textures')
                        .insert({
                            variant_id: variantData.id,
                            base_color_url: variant.baseColorUrl,
                            normal_url: variant.normalUrl,
                            orm_url: variant.ormUrl
                        });
                }
            }

            console.log('Materials and variants updated successfully');
        } catch (error: any) {
            console.error('Error updating materials:', error);
            message.error('Material güncelleme hatası: ' + error.message);
        }
    };

    if (queryResult?.isLoading || loadingMaterials) {
        return <Spin size="large" />;
    }

    return (
        <Edit
            saveButtonProps={{
                ...saveButtonProps,
                loading: uploadingThumbnail || uploadingModel
            }}
        >
            <Form {...formProps} layout="vertical" onFinish={handleFormSubmit}>
                <Row gutter={24}>
                    {/* Left Column: Form */}
                    <Col xs={24} lg={12}>
                        <Card title="Genel Bilgiler">
                            {/* Product Name */}
                            <Form.Item
                                label="Ürün Adı"
                                name="name"
                                rules={[{ required: true, message: 'Ürün adı giriniz' }]}
                            >
                                <Input placeholder="Örn: Modern Yemek Masası" />
                            </Form.Item>

                            {/* Category */}
                            <Form.Item
                                label="Kategori"
                                name="category_id"
                                rules={[{ required: true, message: 'Kategori seçiniz' }]}
                            >
                                <Select {...categorySelectProps} placeholder="Kategori seçiniz" />
                            </Form.Item>

                            {/* SKU */}
                            <Form.Item label="SKU" name="sku">
                                <Input placeholder="Örn: PRD-001" />
                            </Form.Item>

                            {/* Description */}
                            <Form.Item label="Açıklama" name="description">
                                <TextArea rows={4} placeholder="Ürün açıklaması" />
                            </Form.Item>

                            {/* Thumbnail */}
                            <Form.Item label="Ürün Görseli">
                                <Upload
                                    accept="image/*"
                                    showUploadList={false}
                                    beforeUpload={handleThumbnailSelect}
                                >
                                    <Button icon={<UploadOutlined />}>
                                        Görseli Değiştir
                                    </Button>
                                </Upload>
                                {previewThumbnail && (
                                    <img
                                        src={previewThumbnail}
                                        alt="Thumbnail"
                                        style={{ width: '100%', maxWidth: 200, marginTop: 8 }}
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
                                    <Button icon={<UploadOutlined />}>
                                        GLB Değiştir
                                    </Button>
                                </Upload>
                                {selectedModelFile && (
                                    <Typography.Text type="secondary">
                                        Yeni dosya: {selectedModelFile.name}
                                    </Typography.Text>
                                )}
                            </Form.Item>

                            {/* Etsy Link */}
                            <Form.Item label="Etsy Linki" name="etsy_link">
                                <Input placeholder="https://etsy.com/..." />
                            </Form.Item>

                            {/* Price */}
                            <Form.Item label="Fiyat ($)" name="price">
                                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>

                            {/* Active Status */}
                            <Form.Item label="Aktif" name="is_active" valuePropName="checked">
                                <Switch />
                            </Form.Item>

                            {/* Custom Attributes */}
                            <CustomAttributesManager
                                initialAttributes={customAttributes}
                                onChange={setCustomAttributes}
                            />
                        </Card>
                    </Col>

                    {/* Right Column: Preview & Materials */}
                    <Col xs={24} lg={12}>
                        <Card title="Önizleme" style={{ marginBottom: 16 }}>
                            {previewModelUrl ? (
                                <ThreeModelViewer
                                    modelUrl={previewModelUrl}
                                    imageUrl={null}
                                    width="100%"
                                    height="400px"
                                />
                            ) : (
                                <div
                                    style={{
                                        height: 400,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: '#f0f0f0',
                                        border: '1px dashed #ccc'
                                    }}
                                >
                                    <Typography.Text type="secondary">
                                        3D Model önizlemesi
                                    </Typography.Text>
                                </div>
                            )}
                        </Card>

                        {/* Materials List */}
                        {parsedMaterials.length > 0 && (
                            <Card title="MODEL MATERYALLERİ">
                                <List
                                    size="small"
                                    dataSource={materialsWithVariants}
                                    renderItem={(item, index) => (
                                        <List.Item
                                            onClick={() => setSelectedMaterialIndex(index)}
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: selectedMaterialIndex === index ? '#e6f7ff' : 'transparent'
                                            }}
                                        >
                                            <Typography.Text>
                                                {item.material.name}
                                            </Typography.Text>
                                        </List.Item>
                                    )}
                                />
                            </Card>
                        )}
                    </Col>
                </Row>

                {/* Material Variants Tab (Full Width) */}
                {selectedMaterialIndex !== null && materialsWithVariants[selectedMaterialIndex] && (
                    <Card style={{ marginTop: 16 }}>
                        <Tabs defaultActiveKey="1">
                            <TabPane tab="Genel Bilgiler" key="1">
                                <Typography.Text>
                                    Bu bölümde genel ürün bilgileri düzenlenebilir.
                                </Typography.Text>
                            </TabPane>
                            <TabPane tab="Varyasyonlar" key="2">
                                <MaterialVariantManager
                                    materialId={materialsWithVariants[selectedMaterialIndex].material.id}
                                    materialName={materialsWithVariants[selectedMaterialIndex].material.name}
                                    companyName={companyName}
                                    productId={productData?.id?.toString() || ''}
                                    initialVariants={materialsWithVariants[selectedMaterialIndex].variants}
                                    onChange={(variants) => handleVariantChange(selectedMaterialIndex, variants)}
                                    bucketName={companyBucket}
                                    customDomain={companyDomain}
                                />
                            </TabPane>
                        </Tabs>
                    </Card>
                )}
            </Form>
        </Edit>
    );
};
