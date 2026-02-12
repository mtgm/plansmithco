import {
    List,
    useTable,
    EditButton,
    ShowButton,
    DeleteButton,
    DateField,
} from "@refinedev/antd";
import { Table, Space, Avatar, Typography } from "antd";

export const ProductList = () => {
    const { tableProps } = useTable({
        syncWithLocation: true,
        meta: {
            select: "*, categories(title)", // Category title join
        },
    });

    return (
        <List>
            <Table {...tableProps} rowKey="id">
                {/* Image / Thumbnail */}
                <Table.Column
                    dataIndex="thumbnail_url"
                    title="Image"
                    render={(value) => (
                        <Avatar
                            src={value}
                            shape="square"
                            size={64}
                            alt="Product"
                        />
                    )}
                />

                {/* Name */}
                <Table.Column
                    dataIndex="name"
                    title="Name"
                    render={(value, record: any) => (
                        <Space direction="vertical" size={0}>
                            <Typography.Text strong>{value}</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                SKU: {record.sku || "-"}
                            </Typography.Text>
                        </Space>
                    )}
                />

                {/* Category */}
                <Table.Column
                    dataIndex={["categories", "title"]}
                    title="Category"
                />

                {/* Price */}
                <Table.Column
                    dataIndex="price"
                    title="Price"
                    render={(value) => value ? `$${value}` : "-"}
                />

                {/* Created At */}
                <Table.Column
                    dataIndex="created_at"
                    title="Created At"
                    render={(value) => <DateField value={value} />}
                />

                {/* Actions */}
                <Table.Column
                    title="Actions"
                    dataIndex="actions"
                    render={(_, record: any) => (
                        <Space>
                            <EditButton hideText size="small" recordItemId={record.id} />
                            <ShowButton hideText size="small" recordItemId={record.id} />
                            <DeleteButton hideText size="small" recordItemId={record.id} />
                        </Space>
                    )}
                />
            </Table>
        </List>
    );
};
