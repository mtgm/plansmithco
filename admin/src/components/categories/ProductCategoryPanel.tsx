import React, { useState } from 'react';
import {
    Card,
    Table,
    Button,
    Space,
    Modal,
    Form,
    Input,
    Upload,
    message,
    Popconfirm,
    Avatar,
    Typography,
    Switch,
    Pagination,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    UploadOutlined,
    PictureOutlined,
} from '@ant-design/icons';
import { useTable } from '@refinedev/antd';
import { useCreate, useUpdate, useDelete } from '@refinedev/core';
import { uploadToR2 } from '../../utility/uploadToR2';
import { deleteFromR2 } from '../../utility/deleteFromR2';
import { supabaseClient } from '../../utility/supabaseClient';

interface ProductCategory {
    id: string;
    company_id: string;
    name: string;
    description?: string;
    thumbnail_url?: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

interface ProductCategoryPanelProps {
    companyId: string | undefined;
    companyName: string;
    canChangeCompany: boolean;
}

// Increased height for better view
const PANEL_HEIGHT = 650;

export const ProductCategoryPanel: React.FC<ProductCategoryPanelProps> = ({
    companyId,
    companyName,
    canChangeCompany,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
    const [form] = Form.useForm();
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Company storage config
    const [companyBucket, setCompanyBucket] = useState<string | undefined>();
    const [companyDomain, setCompanyDomain] = useState<string | undefined>();

    React.useEffect(() => {
        if (companyId) {
            supabaseClient
                .from('companies')
                .select('storage_bucket, storage_domain')
                .eq('id', companyId)
                .single()
                .then(({ data }) => {
                    if (data) {
                        setCompanyBucket(data.storage_bucket);
                        setCompanyDomain(data.storage_domain);
                    }
                });
        }
    }, [companyId]);

    // Table with filters
    const { tableProps, tableQueryResult, current, setCurrent, pageSize } = useTable<ProductCategory>({
        resource: 'product_categories',
        syncWithLocation: false, // Disable URL sync for independent pagination
        filters: {
            permanent: companyId
                ? [{ field: 'company_id', operator: 'eq', value: companyId }]
                : [],
        },
        sorters: {
            initial: [{ field: 'name', order: 'asc' }], // Alphabetical sort
        },
        queryOptions: {
            enabled: !!companyId,
        },
        pagination: {
            pageSize: 10, // Increased page size to 10
        }
    });

    const { mutate: createCategory, isLoading: creating } = useCreate();
    const { mutate: updateCategory, isLoading: updating } = useUpdate();
    const { mutate: deleteCategory } = useDelete();

    const openCreateModal = () => {
        setEditingCategory(null);
        setPreviewImage(null);
        setSelectedFile(null);
        form.resetFields();
        form.setFieldsValue({ is_active: true });
        setIsModalOpen(true);
    };

    const openEditModal = (record: ProductCategory) => {
        setEditingCategory(record);
        setSelectedFile(null);
        // Set preview image from existing thumbnail_url
        const url = record.thumbnail_url ? record.thumbnail_url.trim() : null;
        setPreviewImage(url);

        form.setFieldsValue({
            name: record.name,
            description: record.description,
            thumbnail_url: record.thumbnail_url,
            is_active: record.is_active,
        });
        setIsModalOpen(true);
    };

    const handleFileSelect = (file: File) => {
        // Store file in state to upload later on submit
        setSelectedFile(file);
        // Create local preview URL
        setPreviewImage(URL.createObjectURL(file));
        return false; // Prevent auto upload
    };

    const handleSubmit = async () => {
        console.log('Submitting Product Category form for company:', companyName);
        try {
            setUploading(true);
            const values = await form.validateFields();

            let finalThumbnailUrl = values.thumbnail_url;

            // Retrieve thumbnail_url if it's editing existing category and no new file selected
            if (editingCategory && !selectedFile) {
                finalThumbnailUrl = editingCategory.thumbnail_url;
            }

            // Upload file if selected
            if (selectedFile) {
                try {
                    console.log('Uploading file...', selectedFile.name);
                    // Ensure companyName is passed correctly
                    if (!companyName) {
                        console.warn('⚠️ No companyName provided to ProductCategoryPanel');
                    }
                    finalThumbnailUrl = await uploadToR2(
                        selectedFile,
                        'categories/products',
                        companyName,
                        companyBucket,
                        companyDomain
                    );
                    console.log('Upload success, url:', finalThumbnailUrl);
                } catch (error: any) {
                    console.error('Product Category Upload Error:', error);
                    message.error('Görsel yüklenemedi: ' + error.message);
                    setUploading(false);
                    return;
                }
            }

            const payload = {
                ...values,
                thumbnail_url: finalThumbnailUrl,
            };

            if (editingCategory) {
                updateCategory(
                    {
                        resource: 'product_categories',
                        id: editingCategory.id,
                        values: payload,
                    },
                    {
                        onSuccess: () => {
                            message.success('Kategori güncellendi!');
                            setIsModalOpen(false);
                            tableQueryResult.refetch();
                        },
                        onError: (error: any) => {
                            message.error('Güncelleme başarısız: ' + error.message);
                        },
                    }
                );
            } else {
                createCategory(
                    {
                        resource: 'product_categories',
                        values: {
                            ...payload,
                            company_id: companyId,
                        },
                    },
                    {
                        onSuccess: () => {
                            message.success('Kategori oluşturuldu!');
                            setIsModalOpen(false);
                            tableQueryResult.refetch();
                        },
                        onError: (error: any) => {
                            message.error('Oluşturma başarısız: ' + error.message);
                        },
                    }
                );
            }
        } catch (error) {
            console.error('Form validation failed:', error);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (record: ProductCategory) => {
        if (record.thumbnail_url) {
            const deleted = await deleteFromR2(record.thumbnail_url);
            if (!deleted) {
                console.warn('⚠️ Could not delete image from R2, proceeding with category deletion');
            }
        }

        deleteCategory(
            {
                resource: 'product_categories',
                id: record.id,
            },
            {
                onSuccess: () => {
                    message.success('Kategori ve görseli silindi!');
                    tableQueryResult.refetch();
                },
                onError: (error: any) => {
                    message.error('Silme başarısız: ' + error.message);
                },
            }
        );
    };

    return (
        <Card
            title={
                <Space>
                    <span style={{ color: '#52c41a', fontSize: 18 }}>📦</span>
                    <span>Ürün Kategorileri</span>
                </Space>
            }
            extra={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openCreateModal}
                    disabled={!companyId}
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                    Yeni Ekle
                </Button>
            }
            headStyle={{
                background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
                borderBottom: '2px solid #52c41a'
            }}
            bodyStyle={{ padding: 0, height: PANEL_HEIGHT, display: 'flex', flexDirection: 'column' }}
        >
            {/* Company Info */}
            <div style={{
                padding: '12px 16px',
                background: '#fafafa',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0
            }}>
                <Typography.Text type="secondary">Şirket:</Typography.Text>
                <Typography.Text strong>{companyName || 'Şirket seçilmedi'}</Typography.Text>
                {!canChangeCompany && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        (Sabit)
                    </Typography.Text>
                )}
            </div>

            {/* Table Container */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <Table
                    {...tableProps}
                    pagination={false}
                    rowKey="id"
                    size="small"
                    locale={{ emptyText: companyId ? 'Kategori bulunamadı' : 'Önce şirket seçin' }}
                    scroll={{ y: PANEL_HEIGHT - 130 }}
                >
                    <Table.Column
                        dataIndex="thumbnail_url"
                        title=""
                        width={50}
                        render={(value) => (
                            <Avatar
                                src={value}
                                shape="square"
                                size={40}
                                style={{ background: '#f0f0f0' }}
                            >
                                📦
                            </Avatar>
                        )}
                    />
                    <Table.Column
                        dataIndex="name"
                        title="Kategori Adı"
                        render={(value, record: ProductCategory) => (
                            <Space direction="vertical" size={0}>
                                <Typography.Text strong>{value}</Typography.Text>
                                {record.description && (
                                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                        {record.description.substring(0, 30)}...
                                    </Typography.Text>
                                )}
                            </Space>
                        )}
                    />
                    <Table.Column
                        dataIndex="is_active"
                        title="Durum"
                        width={70}
                        render={(value) => (
                            <Typography.Text type={value ? 'success' : 'secondary'}>
                                {value ? '✓ Aktif' : '✗ Pasif'}
                            </Typography.Text>
                        )}
                    />
                    <Table.Column
                        title="İşlem"
                        width={80}
                        render={(_, record: ProductCategory) => (
                            <Space size={4}>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => openEditModal(record)}
                                />
                                <Popconfirm
                                    title="Bu kategoriyi silmek istediğinize emin misiniz?"
                                    description="Kategori ve görseli kalıcı olarak silinecek."
                                    onConfirm={() => handleDelete(record)}
                                    okText="Evet"
                                    cancelText="Hayır"
                                >
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                    />
                                </Popconfirm>
                            </Space>
                        )}
                    />
                </Table>
            </div>

            {/* Fixed Pagination Footer */}
            <div style={{
                padding: '12px 16px',
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#fff',
                marginTop: 'auto'
            }}>
                <Pagination
                    current={current}
                    pageSize={pageSize}
                    total={tableQueryResult.data?.total || 0}
                    onChange={(page) => setCurrent(page)}
                    size="small"
                    showSizeChanger={false}
                    showTotal={(total) => `Toplam ${total} kategori`}
                />
            </div>

            {/* Create/Edit Modal */}
            <Modal
                title={editingCategory ? 'Kategori Düzenle' : 'Yeni Ürün Kategorisi'}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={handleSubmit}
                okText={editingCategory ? 'Güncelle' : 'Oluştur'}
                cancelText="İptal"
                confirmLoading={creating || updating}
                destroyOnClose={true}
                afterClose={() => {
                    setPreviewImage(null);
                    setEditingCategory(null);
                    form.resetFields();
                }}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="name"
                        label="Kategori Adı"
                        rules={[{ required: true, message: 'Kategori adı zorunludur' }]}
                    >
                        <Input placeholder="Örn: Sandalyeler" />
                    </Form.Item>

                    <Form.Item name="description" label="Açıklama">
                        <Input.TextArea rows={2} placeholder="Kategori açıklaması..." />
                    </Form.Item>

                    <Form.Item name="thumbnail_url" label="Görsel">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {previewImage ? (
                                <div style={{
                                    width: 120,
                                    height: 120,
                                    border: '1px solid #d9d9d9',
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    background: '#fafafa'
                                }}>
                                    <img
                                        src={previewImage}
                                        alt="Kategori Görseli"
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            message.error('Görsel yüklenemedi');
                                        }}
                                    />
                                </div>
                            ) : (
                                <div style={{
                                    width: 120,
                                    height: 120,
                                    background: '#f5f5f5',
                                    borderRadius: 8,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px dashed #d9d9d9',
                                    color: '#999'
                                }}>
                                    <PictureOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                                    <span style={{ fontSize: 12 }}>Görsel Yok</span>
                                </div>
                            )}

                            <Upload
                                beforeUpload={handleFileSelect}
                                showUploadList={false}
                                accept="image/*"
                            >
                                <Button icon={<UploadOutlined />}>
                                    {previewImage ? 'Görseli Değiştir' : 'Görsel Yükle'}
                                </Button>
                            </Upload>
                        </Space>
                    </Form.Item>

                    <Space style={{ width: '100%' }} size={16}>
                        <Form.Item name="is_active" label="Aktif" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </Space>
                </Form>
            </Modal>
        </Card>
    );
};
