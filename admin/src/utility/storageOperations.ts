import {
    ListObjectsV2Command,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    PutObjectCommand,
    ListObjectsV2CommandOutput
} from "@aws-sdk/client-s3";
import { r2Client } from "./r2Client";

const R2_PUBLIC_DOMAIN = import.meta.env.VITE_R2_PUBLIC_DOMAIN || import.meta.env.VITE_R2_PUBLIC_URL;

export interface R2File {
    key: string;
    url: string;
    lastModified: Date;
    size: number;
    isFolder: boolean;
    name: string;
}

export const listR2Files = async (
    bucketName: string,
    prefix: string = "",
    customDomain?: string,
    continuationToken?: string
): Promise<{ files: R2File[], folders: string[], nextToken?: string }> => {
    try {
        // Ensure prefix ends with / if not empty
        const safePrefix = prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;

        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: safePrefix,
            Delimiter: "/", // Group by folder
            ContinuationToken: continuationToken,
            MaxKeys: 100
        });

        const response: ListObjectsV2CommandOutput = await r2Client.send(command);

        // Process Folders
        const folders = response.CommonPrefixes?.map(p => {
            // "folder/subfolder/" -> "subfolder"
            const parts = p.Prefix?.split('/') || [];
            return parts[parts.length - 2] || p.Prefix || '';
        }) || [];

        // Process Files
        const files: R2File[] = response.Contents?.map(item => {
            const key = item.Key || "";
            const name = key.split('/').pop() || key;

            // Determine public URL
            const targetDomain = customDomain || R2_PUBLIC_DOMAIN;
            let domain = targetDomain?.endsWith('/') ? targetDomain.slice(0, -1) : targetDomain;

            if (domain && !domain.startsWith('http')) {
                domain = `https://${domain}`;
            }

            const url = domain ? `${domain}/${key}` : key;

            return {
                key: key,
                url: url,
                lastModified: item.LastModified || new Date(),
                size: item.Size || 0,
                isFolder: false,
                name: name
            };
        }).filter(f => f.key !== safePrefix) || []; // Filter out the folder itself placeholder

        return {
            files,
            folders,
            nextToken: response.NextContinuationToken
        };
    } catch (error) {
        console.error("Error listing R2 files:", error);
        throw error;
    }
};

export const deleteR2File = async (bucketName: string, key: string): Promise<void> => {
    try {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key
        });
        await r2Client.send(command);
    } catch (error) {
        console.error("Error deleting R2 file:", error);
        throw error;
    }
};

export const createR2Folder = async (bucketName: string, folderPath: string): Promise<void> => {
    try {
        // Folder must end with /
        const safePath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: safePath,
            Body: "" // Empty body
        });
        await r2Client.send(command);
    } catch (error) {
        console.error("Error creating R2 folder:", error);
        throw error;
    }
};

/**
 * Delete all objects under a specific prefix (folder)
 */
export const deleteR2Folder = async (prefix: string, bucketName: string): Promise<void> => {
    try {
        if (!prefix) return;
        const safePath = prefix.endsWith('/') ? prefix : `${prefix}/`;

        // 1. List all objects with this prefix
        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: safePath
        });

        const listResponse = await r2Client.send(listCommand);
        if (!listResponse.Contents || listResponse.Contents.length === 0) return;

        // 2. Prepare deletion array
        const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key! }));

        // 3. Delete in batch
        const deleteCommand = new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
                Objects: objectsToDelete
            }
        });

        await r2Client.send(deleteCommand);

        console.log(`Successfully deleted folder and its contents: ${safePath}`);
    } catch (error) {
        console.error("Error deleting R2 folder:", error);
        throw error;
    }
};
