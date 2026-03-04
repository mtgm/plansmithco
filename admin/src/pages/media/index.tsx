import React, { useState, useEffect } from 'react';
import { useGetIdentity } from "@refinedev/core";
import { supabaseClient } from "../../utility/supabaseClient";
import { FileManager } from "../../components/file-manager/FileManager";
import { Spin, Alert } from "antd";

export const MediaPage: React.FC = () => {
    const { data: identity } = useGetIdentity<{ id: string }>();
    const [companyBucket, setCompanyBucket] = useState<string | undefined>();
    const [companyDomain, setCompanyDomain] = useState<string | undefined>();
    const [companyName, setCompanyName] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (identity?.id) {
            fetchCompanyConfig(identity.id);
        }
    }, [identity]);

    const fetchCompanyConfig = async (userId: string) => {
        try {
            setLoading(true);
            // 1. Get company_id for the user
            const { data: userData, error: userError } = await supabaseClient
                .from('users')
                .select('company_id')
                .eq('id', userId)
                .single();

            if (userError) throw userError;
            if (!userData?.company_id) {
                // If no company, maybe Super Admin? 
                // For MVP, if no company, we might show default bucket or error.
                // Let's assume default bucket from ENV if no company.
                // But generally users should have a company.
                console.warn("User has no company_id");
                setLoading(false);
                return;
            }

            // 2. Get company storage config
            const { data: companyData, error: companyError } = await supabaseClient
                .from('companies')
                .select('company_name, storage_bucket, storage_domain')
                .eq('id', userData.company_id)
                .single();

            if (companyError) throw companyError;

            if (companyData) {
                setCompanyName(companyData.company_name);
                setCompanyBucket(companyData.storage_bucket || import.meta.env.VITE_R2_BUCKET_NAME);
                setCompanyDomain(companyData.storage_domain || import.meta.env.VITE_R2_PUBLIC_DOMAIN);
            }

        } catch (err: any) {
            console.error("Error fetching company config:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;
    }

    if (error) {
        return <Alert message="Hata" description={error} type="error" showIcon />;
    }

    return (
        <div style={{ padding: 24 }}>
            <FileManager
                bucketName={companyBucket}
                customDomain={companyDomain}
                companyName={companyName}
                mode="manage"
                height="80vh"
            />
        </div>
    );
};
