import React, { useState, useEffect } from 'react';
import { Row, Col, Typography, Select, Space, Card } from 'antd';
import { useGetIdentity } from '@refinedev/core';
import { useSelect, List } from '@refinedev/antd';
import { SetCategoryPanel } from '../../components/categories/SetCategoryPanel';
import { ProductCategoryPanel } from '../../components/categories/ProductCategoryPanel';

interface UserIdentity {
    id: string;
    role: string;
    company_id: string;
    company?: {
        id: string;
        company_name: string;
    };
}

export const CategoryManager: React.FC = () => {
    const { data: identity, isLoading: identityLoading } = useGetIdentity<UserIdentity>();

    const isSuperAdmin = identity?.role === 'super_admin';
    const userCompanyId = identity?.company_id;
    const userCompanyName = identity?.company?.company_name || '';

    // State for selected company (only used by super admin)
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>();
    const [selectedCompanyName, setSelectedCompanyName] = useState<string>('');

    // Company select for super admin
    const { selectProps: companySelectProps, queryResult: companiesQuery } = useSelect({
        resource: 'companies',
        optionLabel: 'company_name',
        optionValue: 'id',
        queryOptions: {
            enabled: isSuperAdmin,
        },
    });

    // Set initial company for company admin
    useEffect(() => {
        if (identity && !isSuperAdmin && userCompanyId) {
            setSelectedCompanyId(userCompanyId);
            setSelectedCompanyName(userCompanyName);
        }
    }, [identity, isSuperAdmin, userCompanyId, userCompanyName]);

    // Handle company selection change (super admin only)
    const handleCompanyChange = (value: string) => {
        setSelectedCompanyId(value);
        // Find company name from the companies list
        const company = companiesQuery.data?.data.find((c: any) => c.id === value);
        setSelectedCompanyName(company?.company_name || '');
    };

    // Get effective company ID and name
    const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : userCompanyId;
    const effectiveCompanyName = isSuperAdmin ? selectedCompanyName : userCompanyName;
    const canChangeCompany = isSuperAdmin;

    if (identityLoading) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <Typography.Text>Yükleniyor...</Typography.Text>
            </div>
        );
    }

    return (
        <List
            title={
                <Space>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                        📂 Kategori Yönetimi
                    </Typography.Title>
                </Space>
            }
            headerButtons={() => null}
        >
            {/* Super Admin: Company Selector */}
            {isSuperAdmin && (
                <Card
                    size="small"
                    style={{ marginBottom: 16 }}
                    bodyStyle={{ padding: '12px 16px' }}
                >
                    <Space>
                        <Typography.Text strong>Şirket Seçin:</Typography.Text>
                        <Select
                            options={companySelectProps.options}
                            loading={companySelectProps.loading}
                            style={{ width: 300 }}
                            placeholder="Kategorilerini görmek istediğiniz şirketi seçin"
                            value={selectedCompanyId}
                            onChange={handleCompanyChange}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </Space>
                </Card>
            )}

            {/* Two Column Layout */}
            <Row gutter={24}>
                {/* Left Column: Set Categories */}
                <Col xs={24} lg={12}>
                    <SetCategoryPanel
                        companyId={effectiveCompanyId}
                        companyName={effectiveCompanyName}
                        canChangeCompany={canChangeCompany}
                    />
                </Col>

                {/* Right Column: Product Categories */}
                <Col xs={24} lg={12}>
                    <ProductCategoryPanel
                        companyId={effectiveCompanyId}
                        companyName={effectiveCompanyName}
                        canChangeCompany={canChangeCompany}
                    />
                </Col>
            </Row>
        </List>
    );
};
