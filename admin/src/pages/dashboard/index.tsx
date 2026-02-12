import React from "react";
import { Row, Col, Card, Statistic, Table } from "antd";
import { ShoppingOutlined, AppstoreOutlined, QrcodeOutlined, TeamOutlined } from "@ant-design/icons";
import { useList } from "@refinedev/core";

export const DashboardPage: React.FC = () => {
    // Toplam Ürün Sayısı
    const { data: productsData, isLoading: productsLoading } = useList({
        resource: "products",
        pagination: { mode: "off" },
    });

    // Toplam Kategori Sayısı
    const { data: categoriesData, isLoading: categoriesLoading } = useList({
        resource: "categories",
        pagination: { mode: "off" },
    });

    // Toplam QR Kod Sayısı
    const { data: qrCodesData, isLoading: qrCodesLoading } = useList({
        resource: "qr_codes",
        pagination: { mode: "off" },
    });

    const { data: companiesData, isLoading: companiesLoading } = useList({
        resource: "companies",
        pagination: { mode: "off" },
    });

    // Son Eklenen Ürünler (5 adet)
    const { data: latestProductsData, isLoading: latestProductsLoading } = useList({
        resource: "products",
        pagination: {
            pageSize: 5,
            current: 1
        },
        sorters: [
            {
                field: "created_at",
                order: "desc",
            },
        ],
        meta: {
            select: "*, categories(title)" // Join category title
        }
    });

    return (
        <div style={{ padding: 24 }}>
            <h1>📊 Dashboard</h1>

            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                <Col xs={24} sm={12} md={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="Total Products"
                            value={productsData?.total ?? 0}
                            loading={productsLoading}
                            prefix={<ShoppingOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="Total Categories"
                            value={categoriesData?.total ?? 0}
                            loading={categoriesLoading}
                            prefix={<AppstoreOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="Total QR Codes"
                            value={qrCodesData?.total ?? 0}
                            loading={qrCodesLoading}
                            prefix={<QrcodeOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="Companies"
                            value={companiesData?.total ?? 0}
                            loading={companiesLoading}
                            prefix={<TeamOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            <div style={{ marginTop: 32 }}>
                <h3>📦 Recent Products</h3>
                <Table
                    dataSource={latestProductsData?.data}
                    loading={latestProductsLoading}
                    rowKey="id"
                    pagination={false}
                >
                    <Table.Column
                        dataIndex="name"
                        title="Name"
                    />
                    <Table.Column
                        dataIndex="price"
                        title="Price"
                        render={(value) => `$${value}`}
                    />
                    <Table.Column
                        dataIndex={["categories", "title"]}
                        title="Category"
                    />
                    <Table.Column
                        dataIndex="created_at"
                        title="Created At"
                        render={(value) => new Date(value).toLocaleDateString()}
                    />
                </Table>
            </div>
        </div>
    );
};
