import React, { useState } from 'react';
import { Card, Form, Input, Upload, Button, Row, Col, Space, message, Popconfirm, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { uploadToR2 } from '../../utility/uploadToR2';
import { FileManager } from '../file-manager/FileManager';
import { R2File } from '../../utility/storageOperations';

export interface MaterialVariant {
    id?: string; // Database ID (if editing existing)
    variantName: string;
    swatchUrl: string | null;
    swatchFile?: File | null;
    baseColorUrl: string | null;
    baseColorFile?: File | null;
    normalUrl: string | null;
    normalFile?: File | null;
    ormUrl: string | null;
    ormFile?: File | null;
}

export interface MaterialVariantManagerProps {
    materialId: string; // GLB material ID
    materialName: string;
    companyName: string;
    productId?: string; // For R2 path structure
    initialVariants?: MaterialVariant[];
    onChange?: (variants: MaterialVariant[]) => void;
    bucketName?: string;
    customDomain?: string;
}

export const MaterialVariantManager: React.FC<MaterialVariantManagerProps> = ({
    materialId,
    materialName,
    companyName,
    productId = 'temp',
    initialVariants = [],
    onChange,
    bucketName,
    customDomain
}) => {
    const [variants, setVariants] = useState<MaterialVariant[]>(
        initialVariants.length > 0
            ? initialVariants
            : [{
                variantName: 'Orijinal',
                swatchUrl: null,
                baseColorUrl: null,
                normalUrl: null,
                ormUrl: null
            }]
    );

    const [uploadingStates, setUploadingStates] = useState<{ [key: string]: boolean }>({});

    // R2 File Picker state
    const [r2PickerVisible, setR2PickerVisible] = useState(false);
    const [r2PickerTarget, setR2PickerTarget] = useState<{
        index: number;
        fieldType: 'swatch' | 'baseColor' | 'normal' | 'orm';
    } | null>(null);

    const handleAddVariant = () => {
        const newVariant: MaterialVariant = {
            variantName: `Varyasyon ${variants.length + 1}`,
            swatchUrl: null,
            baseColorUrl: null,
            normalUrl: null,
            ormUrl: null
        };
        const updated = [...variants, newVariant];
        setVariants(updated);
        onChange?.(updated);
    };

    const handleRemoveVariant = (index: number) => {
        if (variants.length === 1) {
            message.warning('En az bir varyasyon olmalıdır');
            return;
        }
        const updated = variants.filter((_, i) => i !== index);
        setVariants(updated);
        onChange?.(updated);
    };

    const handleVariantNameChange = (index: number, value: string) => {
        const updated = [...variants];
        updated[index].variantName = value;
        setVariants(updated);
        onChange?.(updated);
    };

    const handleFileUpload = async (
        index: number,
        file: File,
        fieldType: 'swatch' | 'baseColor' | 'normal' | 'orm'
    ) => {
        const uploadKey = `${index}-${fieldType}`;

        try {
            setUploadingStates(prev => ({ ...prev, [uploadKey]: true }));

            // R2 path: company-{name}/products/{productId}/materials/{materialId}/variants/{index}/{fieldType}.jpg
            const folder = `products/${productId}/materials/${materialId}/variants/${index}`;
            const url = await uploadToR2(file, folder, companyName, bucketName, customDomain);

            const updated = [...variants];

            switch (fieldType) {
                case 'swatch':
                    updated[index].swatchUrl = url;
                    updated[index].swatchFile = file;
                    break;
                case 'baseColor':
                    updated[index].baseColorUrl = url;
                    updated[index].baseColorFile = file;
                    break;
                case 'normal':
                    updated[index].normalUrl = url;
                    updated[index].normalFile = file;
                    break;
                case 'orm':
                    updated[index].ormUrl = url;
                    updated[index].ormFile = file;
                    break;
            }

            setVariants(updated);
            onChange?.(updated);
            message.success('Dosya yüklendi');
        } catch (error: any) {
            message.error('Yükleme hatası: ' + error.message);
        } finally {
            setUploadingStates(prev => ({ ...prev, [uploadKey]: false }));
        }

        return false; // Prevent default upload behavior
    };

    // Handle R2 file picker selection
    const openR2Picker = (index: number, fieldType: 'swatch' | 'baseColor' | 'normal' | 'orm') => {
        setR2PickerTarget({ index, fieldType });
        setR2PickerVisible(true);
    };

    const handleR2FileSelect = (file: R2File) => {
        if (!r2PickerTarget) return;
        const { index, fieldType } = r2PickerTarget;
        const url = file.url;

        const updated = [...variants];
        switch (fieldType) {
            case 'swatch':
                updated[index].swatchUrl = url;
                break;
            case 'baseColor':
                updated[index].baseColorUrl = url;
                break;
            case 'normal':
                updated[index].normalUrl = url;
                break;
            case 'orm':
                updated[index].ormUrl = url;
                break;
        }

        setVariants(updated);
        onChange?.(updated);
        setR2PickerVisible(false);
        setR2PickerTarget(null);
        message.success('Dosya seçildi');
    };

    const renderTextureField = (
        index: number,
        fieldType: 'swatch' | 'baseColor' | 'normal' | 'orm',
        label: string,
        urlValue: string | null,
        showPreview: boolean = false
    ) => (
        <Col span={4}>
            <Form.Item label={label}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space>
                        <Upload
                            accept="image/*"
                            showUploadList={false}
                            beforeUpload={(file) => handleFileUpload(index, file, fieldType)}
                        >
                            <Button
                                icon={<UploadOutlined />}
                                loading={uploadingStates[`${index}-${fieldType}`]}
                                size="small"
                            >
                                {urlValue ? 'Değiştir' : 'Yükle'}
                            </Button>
                        </Upload>
                        <Button
                            icon={<FolderOpenOutlined />}
                            size="small"
                            onClick={() => openR2Picker(index, fieldType)}
                            title="R2'den seç"
                        >
                            R2
                        </Button>
                    </Space>
                    {urlValue && showPreview && (
                        <img
                            src={urlValue}
                            alt={label}
                            style={{ width: 50, height: 50, marginTop: 4, objectFit: 'cover', borderRadius: 4 }}
                        />
                    )}
                    {urlValue && !showPreview && (
                        <div style={{ fontSize: '12px', color: 'green', marginTop: 4 }}>✓ Yüklenmiş</div>
                    )}
                </Space>
            </Form.Item>
        </Col>
    );

    return (
        <div>
            <h4>Varyasyon: {materialName}</h4>
            <p style={{ color: '#888', fontSize: '12px' }}>GLB Material ID: {materialId}</p>

            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {variants.map((variant, index) => (
                    <Card
                        key={index}
                        size="small"
                        title={`Varyasyon ${index + 1}`}
                        extra={
                            variants.length > 1 && (
                                <Popconfirm
                                    title="Bu varyasyonu silmek istediğinize emin misiniz?"
                                    onConfirm={() => handleRemoveVariant(index)}
                                    okText="Evet"
                                    cancelText="İptal"
                                >
                                    <Button danger size="small" icon={<DeleteOutlined />} />
                                </Popconfirm>
                            )
                        }
                    >
                        <Row gutter={[16, 16]}>
                            <Col span={4}>
                                <Form.Item label="Varyasyon Adı" required>
                                    <Input
                                        value={variant.variantName}
                                        onChange={(e) => handleVariantNameChange(index, e.target.value)}
                                        placeholder="Örn: Parlak Altın"
                                    />
                                </Form.Item>
                            </Col>

                            {renderTextureField(index, 'swatch', 'Swatch', variant.swatchUrl, true)}
                            {renderTextureField(index, 'baseColor', 'BaseColor', variant.baseColorUrl)}
                            {renderTextureField(index, 'normal', 'Normal Map', variant.normalUrl)}
                            {renderTextureField(index, 'orm', 'ORM Map', variant.ormUrl)}
                        </Row>
                    </Card>
                ))}

                <Button
                    type="dashed"
                    onClick={handleAddVariant}
                    icon={<PlusOutlined />}
                    block
                >
                    + Varyasyon Ekle
                </Button>
            </Space>

            {/* R2 File Picker Modal */}
            <Modal
                title="R2 Deposundan Dosya Seç"
                open={r2PickerVisible}
                onCancel={() => {
                    setR2PickerVisible(false);
                    setR2PickerTarget(null);
                }}
                footer={null}
                width={900}
                destroyOnClose
            >
                <FileManager
                    bucketName={bucketName}
                    customDomain={customDomain}
                    companyName={companyName}
                    mode="select"
                    onSelect={handleR2FileSelect}
                    height="60vh"
                />
            </Modal>
        </div>
    );
};
