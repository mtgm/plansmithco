import {
    List,
    useTable,
    EditButton,
    DeleteButton,
    DateField,
} from "@refinedev/antd";
import { Table, Space, Typography } from "antd";

export const SetList = () => {
    const { tableProps } = useTable({
        syncWithLocation: true,
    });

    return (
        <List>
            <Table {...tableProps} rowKey="id">
                <Table.Column dataIndex="id" title="ID" />

                <Table.Column
                    dataIndex="name"
                    title="Adı"
                    render={(value) => <Typography.Text>{value}</Typography.Text>}
                />

                <Table.Column
                    dataIndex="created_at"
                    title="Oluşturulma Tarihi"
                    render={(value) => <DateField value={value} format="LLL" />}
                />

                <Table.Column
                    title="Actions"
                    dataIndex="actions"
                    render={(_, record: any) => (
                        <Space>
                            <EditButton hideText size="small" recordItemId={record.id} />
                            <DeleteButton hideText size="small" recordItemId={record.id} />
                        </Space>
                    )}
                />
            </Table>
        </List>
    );
};
