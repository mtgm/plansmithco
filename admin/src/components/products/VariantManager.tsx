import React, { useState } from "react";
import { Button, Card, Input, Upload, Space, Row, Col, Typography, Empty, Tooltip } from "antd";
import { PlusOutlined, DeleteOutlined, FileImageOutlined, UploadOutlined } from "@ant-design/icons";
import { uploadToR2 } from "../../utility/uploadToR2";

interface VariantOption {
    name: string;
    texture_url?: string; // Swatch Image
    texture_file?: string; // Actual Texture File
    display_order: number;
    glb_mat_id?: string;
    is_default?: boolean;
}

interface VariantGroup {
    id: string; // Temp ID for UI
    name: string; // User editable display name (e.g. "Raylar")
    original_material_id: string; // Fixed GLB Material Name (e.g. "polished brass.001")
    display_order: number;
    options: VariantOption[];
}

interface VariantManagerProps {
    groups: VariantGroup[];
    setGroups: (groups: VariantGroup[]) => void;
}

export const VariantManager: React.FC<VariantManagerProps> = ({ groups, setGroups }) => {
    const [uploadingTexture, setUploadingTexture] = useState<string | null>(null);
    const [uploadingMap, setUploadingMap] = useState<string | null>(null);

    // Add a new option to a group
    const addOption = (groupId: string) => {
        setGroups(groups.map(group => {
            if (group.id === groupId) {
                const maxOrder = group.options.length > 0 ? Math.max(...group.options.map(o => o.display_order)) : 0;

                return {
                    ...group,
                    options: [
                        ...group.options,
                        {
                            name: "Yeni Seçenek",
                            display_order: maxOrder + 1,
                            glb_mat_id: group.original_material_id, // COPY FROM PARENT
                            texture_url: "",
                            texture_file: "", // Initialize empty
                            is_default: false
                        }
                    ]
                };
            }
            return group;
        }));
    };

    // Remove an option
    const removeOption = (groupId: string, optionIndex: number) => {
        setGroups(groups.map(group => {
            if (group.id === groupId) {
                const newOptions = [...group.options];
                newOptions.splice(optionIndex, 1);
                return { ...group, options: newOptions };
            }
            return group;
        }));
    };

    // Update option field
    const updateOption = (groupId: string, optionIndex: number, field: keyof VariantOption, value: any) => {
        setGroups(groups.map(group => {
            if (group.id === groupId) {
                const newOptions = [...group.options];
                newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value };
                return { ...group, options: newOptions };
            }
            return group;
        }));
    };

    // Handle Image Swatch Upload
    const handleTextureUpload = async (file: File, groupId: string, optionIndex: number) => {
        try {
            setUploadingTexture(`${groupId}-${optionIndex}`);
            const url = await uploadToR2(file, "textures");
            updateOption(groupId, optionIndex, "texture_url", url);
        } catch (error) {
            console.error("Upload failed", error);
        } finally {
            setUploadingTexture(null);
        }
        return false; // Prevent auto upload
    };

    // Handle Texture File Upload (The actual material texture)
    const handleFileUpload = async (file: File, groupId: string, optionIndex: number) => {
        try {
            setUploadingMap(`${groupId}-${optionIndex}`);
            const url = await uploadToR2(file, "textures");
            updateOption(groupId, optionIndex, "texture_file", url);
        } catch (error) {
            console.error("Upload failed", error);
        } finally {
            setUploadingMap(null);
        }
        return false; // Prevent auto upload
    };

    const deleteGroup = (id: string) => {
        setGroups(groups.filter(g => g.id !== id));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {groups.length === 0 && (
                <Empty description="Henüz model yüklenmedi veya varyasyon grubu yok." />
            )}

            {groups.map((group) => (
                <Card
                    key={group.id}
                    size="small"
                    title={
                        <Space>
                            <span style={{ fontWeight: 'normal', color: '#666' }}>Varyasyon:</span>
                            <Input
                                value={group.name}
                                onChange={(e) => setGroups(groups.map(g => g.id === group.id ? { ...g, name: e.target.value } : g))}
                                style={{ fontWeight: 'bold', width: 250, border: '1px solid #ddd' }}
                                size="small"
                            />
                        </Space>
                    }
                    extra={<Button type="text" danger size="small" onClick={() => deleteGroup(group.id)}>Sil</Button>}
                    style={{ background: '#fff', border: '1px solid #f0f0f0' }}
                    bodyStyle={{ padding: '12px' }}
                >
                    <Row gutter={8} style={{ marginBottom: 8, fontSize: 11, color: '#999', fontWeight: 500 }}>
                        <Col span={6}>VARYASYON ADI</Col>
                        <Col span={4}>RESİM (SWATCH)</Col>
                        <Col span={4}>DOKU DOSYASI</Col>
                        <Col span={8}>GLB MAT ID</Col>
                        <Col span={2}></Col>
                    </Row>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {group.options.map((item, index) => {
                            return (
                                <Row key={index} gutter={8} align="middle" style={{ background: '#fafafa', padding: '6px', borderRadius: 4, border: '1px solid #eee' }}>
                                    {/* NAME */}
                                    <Col span={6}>
                                        <Input
                                            size="small"
                                            value={item.name}
                                            onChange={(e) => updateOption(group.id, index, "name", e.target.value)}
                                        />
                                    </Col>

                                    {/* IMAGE / UI SWATCH */}
                                    <Col span={4}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {item.texture_url ? (
                                                <div style={{ position: 'relative', width: 40, height: 40, border: '1px solid #ddd', borderRadius: 4, overflow: 'hidden' }}>
                                                    <img src={item.texture_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                </div>
                                            ) : (
                                                <div style={{ width: 40, height: 40, background: '#eee', borderRadius: 4 }}></div>
                                            )}
                                            <Upload
                                                showUploadList={false}
                                                beforeUpload={(file) => handleTextureUpload(file, group.id, index)}
                                            >
                                                <Tooltip title="Görünür Resim (Swatch)">
                                                    <Button
                                                        size="small"
                                                        icon={<FileImageOutlined />}
                                                        loading={uploadingTexture === `${group.id}-${index}`}
                                                    />
                                                </Tooltip>
                                            </Upload>
                                        </div>
                                    </Col>

                                    {/* TEXTURE FILE */}
                                    <Col span={4}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Input
                                                size="small"
                                                value={item.texture_file || ""}
                                                placeholder="Dosya yok"
                                                disabled
                                                style={{ fontSize: 10 }}
                                            />
                                            <Upload
                                                showUploadList={false}
                                                beforeUpload={(file) => handleFileUpload(file, group.id, index)}
                                            >
                                                <Tooltip title="Doku Dosyası Yükle">
                                                    <Button
                                                        size="small"
                                                        icon={<UploadOutlined />}
                                                        loading={uploadingMap === `${group.id}-${index}`}
                                                    />
                                                </Tooltip>
                                            </Upload>
                                        </div>
                                    </Col>

                                    {/* GLB MAT ID (Read-only) */}
                                    <Col span={8}>
                                        <Input
                                            size="small"
                                            disabled
                                            value={item.glb_mat_id}
                                            style={{ fontSize: 11, cursor: 'default', color: '#666', fontWeight: 500, background: '#f5f5f5' }}
                                        />
                                    </Col>

                                    {/* ACTION */}
                                    <Col span={2} style={{ textAlign: 'right' }}>
                                        <Button
                                            type="text"
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            onClick={() => removeOption(group.id, index)}
                                        />
                                    </Col>
                                </Row>
                            );
                        })}
                    </div>

                    <Button
                        type="dashed"
                        size="small"
                        style={{ marginTop: 12 }}
                        onClick={() => addOption(group.id)}
                        icon={<PlusOutlined />}
                    >
                        Ekle
                    </Button>
                </Card>
            ))}

            <Button
                onClick={() => setGroups([...groups, { id: Date.now().toString(), name: "Yeni Varyasyon Grubu", original_material_id: "", display_order: groups.length, options: [] }])}
            >
                + Manuel Grup Ekle
            </Button>
        </div >
    );
};
