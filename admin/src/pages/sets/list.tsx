import React, { useEffect } from "react";
import {
    List,
    useTable,
    EditButton,
    ShowButton,
    DeleteButton,
    DateField,
    FilterDropdown,
    useSelect,
    CreateButton,
} from "@refinedev/antd";
import { useGetIdentity, useDelete } from "@refinedev/core";
import { Table, Space, Image, Select, Input, Popconfirm, message, Button } from "antd";
import { SearchOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { deleteR2Folder } from "../../utility/storageOperations";
import { slugify } from "../../utility/uploadToR2";
import { supabaseClient } from "../../utility/supabaseClient";

export const SetList = () => {
    const { data: identity } = useGetIdentity<{
        id: string;
        role: string;
        company_id: string;
    }>();

    const isSuperAdmin = identity?.role === 'super_admin';
    const userCompanyId = identity?.company_id;

    const { tableProps, tableQueryResult, sorters, filters } = useTable({
        syncWithLocation: true,
        meta: {
            select: "*, set_categories(id, name)",
        },
        queryOptions: {
            staleTime: 0,
            refetchOnWindowFocus: true,
        },
        sorters: {
            initial: [{ field: "name", order: "asc" }],
        },
        filters: {
            permanent: isSuperAdmin ? [] : [
                { field: "company_id", operator: "eq", value: userCompanyId },
            ],
        },
    });

    const { selectProps: categorySelectProps } = useSelect({
        resource: "set_categories",
        optionLabel: "name",
        optionValue: "id",
    });

    const getSortOrder = (field: string) => {
        const sorter = sorters?.find((item) => item.field === field);
        if (!sorter) return undefined;
        return sorter.order === "asc" ? "ascend" : "descend";
    };

    const getFilteredValue = (field: string) => {
        const filter = filters?.find((item) => "field" in item && item.field === field);
        return filter?.value as string[] | undefined;
    };

    const { mutate: deleteSet } = useDelete();

    // Supabase Realtime: sets tablosunda INSERT/UPDATE/DELETE olunca otomatik refetch
    const refetchRef = React.useRef(tableQueryResult?.refetch);
    React.useEffect(() => {
        refetchRef.current = tableQueryResult?.refetch;
    }, [tableQueryResult?.refetch]);

    useEffect(() => {
        const channel = supabaseClient
            .channel('sets-list-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sets' },
                () => {
                    refetchRef.current?.();
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, []); // sadece mount'ta bir kere subscribe ol

    const handleDelete = async (record: any) => {
        try {
            const { data: company } = await supabaseClient
                .from('companies')
                .select('storage_bucket, company_name')
                .eq('id', record.company_id)
                .single();

            const bucket = company?.storage_bucket || import.meta.env.VITE_R2_BUCKET_NAME;
            const companyName = company?.company_name || 'default';
            const effectiveCompanyName = slugify(companyName);

            const defaultBucket = import.meta.env.VITE_R2_BUCKET_NAME;
            const isDedicatedBucket = company?.storage_bucket && company.storage_bucket !== defaultBucket;

            let prefix = `sets/${record.id}`;
            if (!isDedicatedBucket) {
                prefix = `${effectiveCompanyName}/${prefix}`;
            }

            console.log(`Physically deleting set folder: [${prefix}] from bucket [${bucket}]`);

            await deleteR2Folder(prefix, bucket);

            deleteSet({
                resource: "sets",
                id: record.id,
                mutationMode: "optimistic",
                invalidates: ["list", "many"]
            });

            message.success("Takım ve ilişkili R2 dosyaları başarıyla silindi");
            tableQueryResult?.refetch();
        } catch (error: any) {
            console.error("Delete error:", error);
            message.error("Silme işlemi sırasında hata oluştu: " + error.message);
        }
    };

    return (
        <List
            title="Takım Listesi"
            headerProps={{
                extra: (
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => tableQueryResult?.refetch()}
                        >
                            Yenile
                        </Button>
                        <CreateButton />
                    </Space>
                )
            }}
        >
            <Table {...tableProps} rowKey="id">
                {/* Image / Thumbnail */}
                <Table.Column
                    dataIndex="thumbnail_url"
                    title="Görsel"
                    render={(value) => {
                        let src = value;
                        try {
                            if (typeof value === 'string' && value.startsWith('{')) {
                                const parsed = JSON.parse(value);
                                src = parsed.url || value;
                            } else if (typeof value === 'object' && value !== null) {
                                src = value.url || src;
                            }
                        } catch (e) { /* ignore */ }

                        return (
                            <Image
                                src={src}
                                width={64}
                                height={64}
                                style={{ objectFit: 'cover', borderRadius: '4px' }}
                                fallback="https://placehold.co/64?text=Yok"
                                preview={{ mask: <SearchOutlined /> }}
                            />
                        );
                    }}
                />

                {/* Name */}
                <Table.Column
                    dataIndex="name"
                    title="Takım Adı"
                    sorter
                    defaultSortOrder={getSortOrder("name")}
                    filterIcon={(filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />}
                    filterDropdown={(props) => (
                        <FilterDropdown {...props}>
                            <Input placeholder="İsim ara..." />
                        </FilterDropdown>
                    )}
                />

                {/* SKU */}
                <Table.Column dataIndex="sku" title="SKU" />

                {/* Category */}
                <Table.Column
                    dataIndex={["set_categories", "name"]}
                    title="Kategori"
                    filterDropdown={(props) => (
                        <FilterDropdown {...props} mapValue={(selectedKeys) => selectedKeys.map(i => i)}>
                            <Select
                                style={{ minWidth: 200 }}
                                mode="multiple"
                                placeholder="Kategori Seç"
                                {...categorySelectProps}
                            />
                        </FilterDropdown>
                    )}
                    defaultFilteredValue={getFilteredValue("set_category_id")}
                />

                {/* Price */}
                <Table.Column
                    dataIndex="price"
                    title="Fiyat"
                    render={(value) => value ? `$${value}` : "-"}
                    sorter
                    defaultSortOrder={getSortOrder("price")}
                />

                {/* Created At */}
                <Table.Column
                    dataIndex="created_at"
                    title="Oluşturulma Tarihi"
                    render={(value) => <DateField value={value} format="DD.MM.YYYY HH:mm" />}
                    sorter
                    defaultSortOrder={getSortOrder("created_at")}
                />

                {/* Updated At */}
                <Table.Column
                    dataIndex="updated_at"
                    title="Güncellenme Tarihi"
                    render={(value) => <DateField value={value} format="DD.MM.YYYY HH:mm" />}
                    sorter
                    defaultSortOrder={getSortOrder("updated_at")}
                />

                {/* Actions */}
                <Table.Column
                    title="İşlemler"
                    dataIndex="actions"
                    render={(_, record: any) => (
                        <Space>
                            <EditButton hideText size="small" recordItemId={record.id} />
                            <ShowButton hideText size="small" recordItemId={record.id} />
                            <Popconfirm
                                title="Takımı silmek istediğinize emin misiniz?"
                                description="Bu işlem R2 üzerindeki tüm dosyaları (model, resim, materyaller) da silecektir."
                                onConfirm={() => handleDelete(record)}
                                okText="Evet"
                                cancelText="Hayır"
                                okButtonProps={{ danger: true }}
                            >
                                <Button danger size="small" icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </Space>
                    )}
                />
            </Table>
        </List>
    );
};