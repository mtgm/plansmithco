import React, { useState, useEffect } from 'react';
import { downloadR2FileAsBlob } from '../../utility/r2Download';
import {
    Card,
    Breadcrumb,
    Button,
    Space,
    Upload,
    List,
    Typography,
    Image,
    Spin,
    message,
    Modal,
    Empty,
    Tooltip,
    Input,
    Segmented,
    Table,
    Checkbox,
    Row,
    Col
} from 'antd';
import {
    FolderOutlined,
    FileOutlined,
    UploadOutlined,
    DeleteOutlined,
    HomeOutlined,
    ReloadOutlined,
    FileImageOutlined,
    CodeSandboxOutlined,
    AppstoreOutlined,
    BarsOutlined,
    FolderAddOutlined,
    SearchOutlined,
    CheckSquareOutlined
} from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import { listR2Files, deleteR2File, createR2Folder, R2File } from '../../utility/storageOperations';
import { uploadToR2 } from '../../utility/uploadToR2';
import { supabaseClient } from '../../utility/supabaseClient';

const { Dragger } = Upload;
const { Text } = Typography;

interface FileManagerProps {
    bucketName?: string;
    customDomain?: string;
    companyName?: string;
    mode?: 'manage' | 'select';
    onSelect?: (file: R2File) => void;
    height?: number | string;
}

export const FileManager: React.FC<FileManagerProps> = ({
    bucketName,
    customDomain,
    companyName,
    mode = 'manage',
    onSelect,
    height = '70vh'
}) => {
    // Navigation & Data
    const [currentPath, setCurrentPath] = useState('');
    const [files, setFiles] = useState<R2File[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [folderNameMap, setFolderNameMap] = useState<Record<string, string>>({});

    // View & Selection
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [selectedFolders, setSelectedFolders] = useState<string[]>([]);

    // Modals
    const [uploadModalVisible, setUploadModalVisible] = useState(false);
    const [createFolderModalVisible, setCreateFolderModalVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Upload State
    const [uploading, setUploading] = useState(false);
    const [fileList, setFileList] = useState<UploadFile[]>([]);

    useEffect(() => {
        if (bucketName) {
            fetchFiles();
        }
    }, [bucketName, currentPath, refreshKey]);

    useEffect(() => {
        // Fetch product ID -> Name mappings for aliasing
        const fetchNameMappings = async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('products')
                    .select('id, name');

                if (data) {
                    const map: Record<string, string> = {};
                    data.forEach((p: any) => {
                        map[p.id] = p.name;
                    });
                    setFolderNameMap(map);
                }
            } catch (err) {
                console.error("Error fetching name mappings:", err);
            }
        };
        fetchNameMappings();
    }, []);

    // Helper to check if string is a valid UUID (to know if it's a product folder)
    const isUUID = (str: string) => {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(str);
    };

    const getDisplayName = (name: string) => {
        if (isUUID(name) && folderNameMap[name]) {
            return folderNameMap[name];
        }
        return name;
    };

    const fetchFiles = async () => {
        if (!bucketName) return;
        try {
            setLoading(true);
            const data = await listR2Files(bucketName, currentPath, customDomain);
            setFiles(data.files);
            setFolders(data.folders);
            // Clear selection on folder change/refresh
            setSelectedFiles([]);
            setSelectedFolders([]);
        } catch (error: any) {
            message.error('Dosyalar yüklenemedi: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---

    const handleNavigate = (folder: string) => {
        setCurrentPath(prev => prev + folder + '/');
        setSearchTerm(''); // Clear search on navigation
    };

    const handleBreadcrumbClick = (index: number, parts: string[]) => {
        if (index === -1) {
            setCurrentPath(''); // Home
        } else {
            const newPath = parts.slice(0, index + 1).join('/') + '/';
            setCurrentPath(newPath);
        }
        setSearchTerm('');
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        if (!bucketName) return;

        try {
            const folderPath = currentPath + newFolderName.trim();
            await createR2Folder(bucketName, folderPath);
            message.success('Klasör oluşturuldu');
            setCreateFolderModalVisible(false);
            setNewFolderName('');
            setRefreshKey(prev => prev + 1);
        } catch (error: any) {
            message.error('Klasör oluşturma hatası: ' + error.message);
        }
    };

    const handleDelete = async (fileKey: string, isFolder: boolean = false) => {
        if (!bucketName) return;
        try {
            // Note: Deleting a "folder" in S3/R2 usually means deleting the prefix object.
            // If the folder has contents, S3 doesn't support recursive delete easily without listing all.
            // For now, we only delete the specific object key.
            // If it's a folder, users might expect recursive delete. 
            // Simplified for now: just delete the key.
            await deleteR2File(bucketName, fileKey);
            message.success(isFolder ? 'Klasör silindi' : 'Dosya silindi');
            setRefreshKey(prev => prev + 1);
        } catch (error: any) {
            message.error('Silme hatası: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedFiles.length === 0 && selectedFolders.length === 0) return;
        if (!bucketName) return;

        Modal.confirm({
            title: 'Seçili öğeleri sil',
            content: `Seçili ${selectedFiles.length} dosya ve ${selectedFolders.length} klasörü silmek istediğinize emin misiniz?`,
            okText: 'Evet, Sil',
            okType: 'danger',
            cancelText: 'İptal',
            onOk: async () => {
                try {
                    setLoading(true);
                    // Delete files
                    const filePromises = selectedFiles.map(key => deleteR2File(bucketName, key));
                    // Delete folders (prefix objects) - Note: this won't delete contents! 
                    // Implementing recursive delete is complex here, so we assume empty folders or just delete prefix marker.
                    const folderPromises = selectedFolders.map(name => {
                        const key = currentPath + name + '/';
                        return deleteR2File(bucketName, key);
                    });

                    await Promise.all([...filePromises, ...folderPromises]);
                    message.success('Seçili öğeler silindi');
                    setRefreshKey(prev => prev + 1);
                } catch (error: any) {
                    message.error('Toplu silme hatası: ' + error.message);
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleUpload = async () => {
        if (fileList.length === 0) return;
        if (!bucketName) return;

        setUploading(true);
        try {
            const uploadPromises = fileList.map(item => {
                if (!item.originFileObj) return Promise.resolve(null);
                // Remove trailing / for folder path, default to 'uploads' only if truly empty root
                let targetFolder = currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath;
                if (!targetFolder) targetFolder = 'uploads'; // Root uploads go to 'uploads' folder
                return uploadToR2(
                    item.originFileObj,
                    targetFolder,
                    companyName,
                    bucketName,
                    customDomain
                );
            });

            await Promise.all(uploadPromises);
            message.success(`${fileList.length} dosya yüklendi`);
            setUploadModalVisible(false);
            setFileList([]);
            setRefreshKey(prev => prev + 1);
        } catch (error: any) {
            message.error('Yükleme hatası: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    // --- Preview ---
    const [previewImage, setPreviewImage] = useState<string | undefined>(undefined);
    const [previewTitle, setPreviewTitle] = useState('');
    const [previewVisible, setPreviewVisible] = useState(false);

    const handlePreview = async (file: R2File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
            try {
                // Download via S3 SDK to bypass CORS on r2.dev URLs
                const blobUrl = await downloadR2FileAsBlob(
                    file.url,
                    bucketName || import.meta.env.VITE_R2_BUCKET_NAME,
                    customDomain || import.meta.env.VITE_R2_PUBLIC_URL
                );
                setPreviewImage(blobUrl);
                setPreviewTitle(file.name);
                setPreviewVisible(true);
            } catch (err) {
                console.error('Preview download error:', err);
                // Fallback: try direct URL anyway
                setPreviewImage(file.url);
                setPreviewTitle(file.name);
                setPreviewVisible(true);
            }
        } else {
            message.info('Bu dosya türü için önizleme yapılamıyor.');
        }
    };

    // --- Filtering ---

    const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredFolders = folders.filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()));

    // --- Render Helpers ---

    const renderBreadcrumbs = () => {
        const parts = currentPath.split('/').filter(p => p);
        return (
            <Breadcrumb style={{ margin: '16px 0' }}>
                <Breadcrumb.Item>
                    <span onClick={() => handleBreadcrumbClick(-1, parts)} style={{ cursor: 'pointer' }}>
                        <HomeOutlined />
                    </span>
                </Breadcrumb.Item>
                {parts.map((part, index) => (
                    <Breadcrumb.Item key={index}>
                        <span onClick={() => handleBreadcrumbClick(index, parts)} style={{ cursor: 'pointer' }}>
                            {getDisplayName(part)}
                        </span>
                    </Breadcrumb.Item>
                ))}
            </Breadcrumb>
        );
    };

    const renderFileIcon = (fileName: string, isFolder: boolean) => {
        if (isFolder) return <FolderOutlined style={{ fontSize: 24, color: '#faad14' }} />;

        const ext = fileName.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
            return <FileImageOutlined style={{ fontSize: 24, color: '#52c41a' }} />;
        }
        if (['glb', 'gltf'].includes(ext || '')) {
            return <CodeSandboxOutlined style={{ fontSize: 24, color: '#1890ff' }} />;
        }
        return <FileOutlined style={{ fontSize: 24, color: '#999' }} />;
    };

    // --- Table Configuration ---

    const columns = [
        {
            title: 'Ad',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: any) => (
                <Space style={{ cursor: 'pointer' }}>
                    {renderFileIcon(text, record.type === 'folder')}
                    <Tooltip title={isUUID(text) ? `ID: ${text}` : undefined}>
                        <Text>{record.type === 'folder' ? getDisplayName(text) : text}</Text>
                    </Tooltip>
                </Space>
            ),
            sorter: (a: any, b: any) => a.name.localeCompare(b.name)
        },
        {
            title: 'Boyut',
            dataIndex: 'size',
            key: 'size',
            render: (size: number, record: any) => record.type === 'folder' ? '-' : (size / 1024).toFixed(1) + ' KB',
            sorter: (a: any, b: any) => (a.size || 0) - (b.size || 0)
        },
        {
            title: 'Tarih',
            dataIndex: 'lastModified',
            key: 'lastModified',
            render: (date: Date, record: any) => record.type === 'folder' ? '-' : new Date(date).toLocaleString(),
            sorter: (a: any, b: any) => new Date(a.lastModified || 0).getTime() - new Date(b.lastModified || 0).getTime()
        },
        {
            title: 'İşlemler',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    {mode === 'manage' && (
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => { e.stopPropagation(); handleDelete(record.type === 'folder' ? currentPath + record.name + '/' : record.key, record.type === 'folder'); }}
                        />
                    )}
                    {mode === 'select' && record.type !== 'folder' && (
                        <Button type="link" size="small" onClick={() => onSelect?.(record)}>Seç</Button>
                    )}
                </Space>
            )
        }
    ];

    const dataSource = [
        ...filteredFolders.map(f => ({ key: 'folder-' + f, name: f, type: 'folder', size: 0, lastModified: null })),
        ...filteredFiles.map(f => ({ ...f, key: f.key, type: 'file' }))
    ];

    const rowSelection = {
        selectedRowKeys: [...selectedFolders.map(f => 'folder-' + f), ...selectedFiles],
        onChange: (_selectedRowKeys: React.Key[], selectedRows: any[]) => {
            const files = selectedRows.filter(r => r.type === 'file').map(r => r.key);
            const folders = selectedRows.filter(r => r.type === 'folder').map(r => r.name);
            setSelectedFiles(files);
            setSelectedFolders(folders);
        }
    };

    if (!bucketName) {
        return <Empty description="Bucket bilgisi bulunamadı. Lütfen şirket ayarlarını kontrol edin." />;
    }

    return (
        <Card
            bodyStyle={{ height, overflow: 'auto', padding: '0 24px 24px' }}
            title={
                <Row align="middle" justify="space-between" style={{ width: '100%' }}>
                    <Col>
                        <Space size="large">
                            <Space>
                                <Button
                                    type="primary"
                                    style={{ backgroundColor: '#faad14', borderColor: '#faad14', color: 'black' }}
                                    icon={<UploadOutlined />}
                                    onClick={() => setUploadModalVisible(true)}
                                >
                                    Yükle
                                </Button>
                                <Button
                                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}
                                    icon={<FolderAddOutlined />}
                                    onClick={() => setCreateFolderModalVisible(true)}
                                >
                                    Yeni Klasör
                                </Button>
                                {(selectedFiles.length > 0 || selectedFolders.length > 0) && (
                                    <Button
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={handleBulkDelete}
                                    >
                                        Sil ({selectedFiles.length + selectedFolders.length})
                                    </Button>
                                )}
                            </Space>
                        </Space>
                    </Col>
                    <Col>
                        <Space>
                            <Input
                                placeholder="Ara..."
                                prefix={<SearchOutlined />}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ width: 200 }}
                            />
                            <Segmented
                                options={[
                                    { value: 'list', icon: <BarsOutlined /> },
                                    { value: 'grid', icon: <AppstoreOutlined /> },
                                ]}
                                value={viewMode}
                                onChange={v => setViewMode(v as 'list' | 'grid')}
                            />
                            <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey(prev => prev + 1)} />
                        </Space>
                    </Col>
                </Row>
            }
        >
            {renderBreadcrumbs()}

            {loading ? (
                <div style={{ textAlign: 'center', padding: 50 }}>
                    <Spin size="large" />
                </div>
            ) : (
                <>
                    {viewMode === 'list' ? (
                        <Table
                            rowSelection={mode === 'manage' ? rowSelection : undefined}
                            columns={columns}
                            dataSource={dataSource}
                            pagination={false}
                            size="small"
                            onRow={(record) => ({
                                onClick: () => {
                                    if (record.type === 'folder') {
                                        handleNavigate(record.name);
                                    } else if (mode === 'select') {
                                        onSelect?.(record as R2File);
                                    } else {
                                        handlePreview(record as R2File);
                                    }
                                }
                            })}
                        />
                    ) : (
                        <List
                            grid={{ gutter: 16, xs: 2, sm: 3, md: 4, lg: 5, xl: 6 }}
                            dataSource={dataSource}
                            renderItem={(item: any) => (
                                <List.Item>
                                    {/* Simple Grid Item - Reusing logic or simpler card */}
                                    <Card
                                        hoverable
                                        size="small"
                                        style={{ textAlign: 'center', background: item.type === 'folder' ? '#fffbe6' : undefined }}
                                        onClick={() => {
                                            if (item.type === 'folder') {
                                                handleNavigate(item.name);
                                            } else if (mode === 'select') {
                                                onSelect?.(item as R2File);
                                            } else {
                                                handlePreview(item as R2File);
                                            }
                                        }}
                                        cover={
                                            <div style={{ marginTop: 16 }}>
                                                {renderFileIcon(item.name, item.type === 'folder')}
                                            </div>
                                        }
                                        actions={mode === 'manage' ? [
                                            <DeleteOutlined key="delete" onClick={(e) => { e.stopPropagation(); handleDelete(item.type === 'folder' ? currentPath + item.name + '/' : item.key, item.type === 'folder'); }} style={{ color: 'red' }} />
                                        ] : undefined}
                                    >
                                        <Card.Meta
                                            title={
                                                <Tooltip title={isUUID(item.name) ? `ID: ${item.name}` : undefined}>
                                                    <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {item.type === 'folder' ? getDisplayName(item.name) : item.name}
                                                    </div>
                                                </Tooltip>
                                            }
                                        />
                                    </Card>
                                </List.Item>
                            )}
                        />
                    )}
                </>
            )}

            {/* Upload Modal */}
            <Modal
                title="Dosya Yükle"
                open={uploadModalVisible}
                onCancel={() => setUploadModalVisible(false)}
                onOk={handleUpload}
                confirmLoading={uploading}
                width={600}
                okText="Yükle"
                cancelText="İptal"
            >
                <div style={{ marginBottom: 16 }}>
                    <Text strong>Hedef Klasör: </Text>
                    <Text code>/{currentPath}</Text>
                </div>
                <Dragger
                    multiple
                    fileList={fileList}
                    beforeUpload={(file) => {
                        const uploadFile: UploadFile = {
                            uid: file.uid || `upload-${Date.now()}-${Math.random()}`,
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            originFileObj: file as any,
                        };
                        setFileList(prev => [...prev, uploadFile]);
                        return false;
                    }}
                    onRemove={(file) => {
                        setFileList(prev => prev.filter(f => f.uid !== file.uid));
                    }}
                >
                    <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                    <p className="ant-upload-text">Dosyaları buraya sürükle veya seç</p>
                </Dragger>
            </Modal>

            {/* Create Folder Modal */}
            <Modal
                title="Yeni Klasör Oluştur"
                open={createFolderModalVisible}
                onCancel={() => setCreateFolderModalVisible(false)}
                onOk={handleCreateFolder}
                okText="Oluştur"
                cancelText="İptal"
            >
                <Input
                    placeholder="Klasör Adı"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onPressEnter={handleCreateFolder}
                />
            </Modal>

            {/* Image Preview Modal */}
            <Modal
                open={previewVisible}
                title={previewTitle}
                footer={null}
                onCancel={() => setPreviewVisible(false)}
                width={800}
            >
                <img alt="example" style={{ width: '100%' }} src={previewImage} />
            </Modal>
        </Card>
    );
};
