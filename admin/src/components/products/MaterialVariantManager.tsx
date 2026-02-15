import React, { useState } from 'react';
import { Card, Form, Input, Upload, Button, Row, Col, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { uploadToR2 } from '../../utility/uploadToR2';

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
                            <Col span={8}>
                                <Form.Item label="Varyasyon Adı" required>
                                    <Input
                                        value={variant.variantName}
                                        onChange={(e) => handleVariantNameChange(index, e.target.value)}
                                        placeholder="Örn: Parlak Altın"
                                    />
                                </Form.Item>
                            </Col>

                            <Col span={8}>
                                <Form.Item label="Resim (Swatch)">
                                    <Upload
                                        accept="image/*"
                                        showUploadList={false}
                                        beforeUpload={(file) => handleFileUpload(index, file, 'swatch')}
                                    >
                                        <Button
                                            icon={<UploadOutlined />}
                                            loading={uploadingStates[`${index}-swatch`]}
                                        >
                                            {variant.swatchUrl ? 'Değiştir' : 'Yükle'}
                                        </Button>
                                    </Upload>
                                    {variant.swatchUrl && (
                                        <img
                                            src={variant.swatchUrl}
                                            alt="Swatch"
                                            style={{ width: 50, height: 50, marginTop: 8, objectFit: 'cover' }}
                                        />
                                    )}
                                </Form.Item>
                            </Col>

                            <Col span={8}>
                                <Form.Item label="BaseColor">
                                    <Upload
                                        accept="image/*"
                                        showUploadList={false}
                                        beforeUpload={(file) => handleFileUpload(index, file, 'baseColor')}
                                    >
                                        <Button
                                            icon={<UploadOutlined />}
                                            loading={uploadingStates[`${index}-baseColor`]}
                                        >
                                            {variant.baseColorUrl ? 'Değiştir' : 'Yükle'}
                                        </Button>
                                    </Upload>
                                    {variant.baseColorUrl && (
                                        <div style={{ fontSize: '12px', color: 'green', marginTop: 4 }}>✓ Yüklenmiş</div>
                                    )}
                                </Form.Item>
                            </Col>

                            <Col span={8}>
                                <Form.Item label="Normal Map">
                                    <Upload
                                        accept="image/*"
                                        showUploadList={false}
                                        beforeUpload={(file) => handleFileUpload(index, file, 'normal')}
                                    >
                                        <Button
                                            icon={<UploadOutlined />}
                                            loading={uploadingStates[`${index}-normal`]}
                                        >
                                            {variant.normalUrl ? 'Değiştir' : 'Yükle'}
                                        </Button>
                                    </Upload>
                                    {variant.normalUrl && (
                                        <div style={{ fontSize: '12px', color: 'green', marginTop: 4 }}>✓ Yüklenmiş</div>
                                    )}
                                </Form.Item>
                            </Col>

                            <Col span={8}>
                                <Form.Item label="ORM Map">
                                    <Upload
                                        accept="image/*"
                                        showUploadList={false}
                                        beforeUpload={(file) => handleFileUpload(index, file, 'orm')}
                                    >
                                        <Button
                                            icon={<UploadOutlined />}
                                            loading={uploadingStates[`${index}-orm`]}
                                        >
                                            {variant.ormUrl ? 'Değiştir' : 'Yükle'}
                                        </Button>
                                    </Upload>
                                    {variant.ormUrl && (
                                        <div style={{ fontSize: '12px', color: 'green', marginTop: 4 }}>✓ Yüklenmiş</div>
                                    )}
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>
                ))}

                <Button
                    type="dashed"
                    onClick={handleAddVariant}
                    icon={<PlusOutlined />}
                    block
                >
                    Varyasyon Ekle
                </Button>
            </Space>
        </div>
    );
};
