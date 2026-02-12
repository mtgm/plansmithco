import React, { useState } from 'react';
import { Card, Form, Input, Button, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

export interface CustomAttribute {
    key: string;
    value: string;
}

export interface CustomAttributesManagerProps {
    initialAttributes?: CustomAttribute[];
    onChange?: (attributes: CustomAttribute[]) => void;
}

export const CustomAttributesManager: React.FC<CustomAttributesManagerProps> = ({
    initialAttributes = [],
    onChange
}) => {
    const [attributes, setAttributes] = useState<CustomAttribute[]>(initialAttributes);

    const handleAdd = () => {
        const newAttr: CustomAttribute = {
            key: '',
            value: ''
        };
        const updated = [...attributes, newAttr];
        setAttributes(updated);
        onChange?.(updated);
    };

    const handleRemove = (index: number) => {
        const updated = attributes.filter((_, i) => i !== index);
        setAttributes(updated);
        onChange?.(updated);
    };

    const handleChange = (index: number, field: 'key' | 'value', value: string) => {
        const updated = [...attributes];
        updated[index][field] = value;
        setAttributes(updated);
        onChange?.(updated);
    };

    return (
        <Card title="Özel Nitelikler" size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {attributes.map((attr, index) => (
                    <Space key={index} style={{ width: '100%' }}>
                        <Input
                            placeholder="Anahtar (örn: Malzeme)"
                            value={attr.key}
                            onChange={(e) => handleChange(index, 'key', e.target.value)}
                            style={{ width: 200 }}
                        />
                        <Input
                            placeholder="Değer (örn: Ahşap)"
                            value={attr.value}
                            onChange={(e) => handleChange(index, 'value', e.target.value)}
                            style={{ width: 200 }}
                        />
                        <Popconfirm
                            title="Silmek istediğinize emin misiniz?"
                            onConfirm={() => handleRemove(index)}
                            okText="Evet"
                            cancelText="İptal"
                        >
                            <Button danger size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </Space>
                ))}

                <Button
                    type="dashed"
                    onClick={handleAdd}
                    icon={<PlusOutlined />}
                    block
                    size="small"
                >
                    Özel Nitelik Ekle
                </Button>
            </Space>
        </Card>
    );
};
