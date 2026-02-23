import { PutObjectCommand, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "./r2Client";

const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
const R2_PUBLIC_DOMAIN = import.meta.env.VITE_R2_PUBLIC_DOMAIN || import.meta.env.VITE_R2_PUBLIC_URL;

/**
 * Helper to slugify text for URL safety
 */
export const slugify = (text: string) => {
    // Turkish character mapping
    const turkishMap: { [key: string]: string } = {
        'ç': 'c', 'Ç': 'C',
        'ğ': 'g', 'Ğ': 'G',
        'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ş': 's', 'Ş': 'S',
        'ü': 'u', 'Ü': 'U'
    };

    let str = text.toString();
    Object.keys(turkishMap).forEach(key => {
        str = str.replace(new RegExp(key, 'g'), turkishMap[key]);
    });

    return str
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
};

/**
 * Uploads a file to Cloudflare R2 and returns the public URL.
 * @param file The file object to upload
 * @param folder The folder path (e.g., 'categories/sets')
 * @param companyName Optional company name for company-specific folder structure (e.g. 'Plan Smith Co')
 * @param bucketName Optional custom bucket name for this company
 * @param customDomain Optional custom domain for this company's assets
 * @returns The public URL of the uploaded file
 */
export const uploadToR2 = async (
    file: File,
    folder: string = "uploads",
    companyName?: string,
    bucketName?: string,
    customDomain?: string
): Promise<string> => {
    // Use custom bucket if provided, otherwise fallback to env
    const targetBucket = bucketName || R2_BUCKET_NAME;

    if (!targetBucket) {
        throw new Error("❌ VITE_R2_BUCKET_NAME is not defined in .env and no custom bucket provided.");
    }

    // Create a clean, unique file name
    const fileExt = file.name.split(".").pop();
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const cleanName = baseName.replace(/[^a-zA-Z0-9]/g, ""); // Strictly alphanumeric only

    // Build company-specific folder path if companyName is provided AND we are using default bucket
    // If using custom bucket, we might not need "company-" prefix as bucket itself is isolated,
    // but folder structure is still good for organization.
    console.log('Upload params:', { folder, companyName, bucketName, customDomain });

    // Check if companyName is valid string before slugifying
    const sanitizedCompanyName = companyName ? slugify(companyName) : '';
    console.log('Sanitized company name:', sanitizedCompanyName);

    // If using a CUSTOM bucket, we might want to skip the "company-slug" prefix in the path
    // because the bucket itself implies the company. However, for consistency, let's keep it OR make it optional.
    // DECISION: If custom bucket, use root folder. If shared bucket, use company sanitized folder.
    const effectiveCompanyName = sanitizedCompanyName || 'default';

    // Logic: If they have a dedicated bucket, we probably DON'T want a company folder inside it.
    // If they share the main bucket, we MUST have a company folder.
    const defaultBucket = import.meta.env.VITE_R2_BUCKET_NAME;
    const isDedicatedBucket = bucketName && bucketName !== defaultBucket;

    let basePath = "";
    if (isDedicatedBucket) {
        basePath = folder || ""; // Use the folder as is
    } else {
        basePath = folder ? `${effectiveCompanyName}/${folder}` : effectiveCompanyName;
    }

    // Sanitize basePath (folder) components aggressively
    const sanitizedBasePath = basePath.split('/').map(part => slugify(part)).filter(p => p).join('/');

    // Build final key - Deterministic name to allow deduplication/overwriting as per user request
    const fileName = sanitizedBasePath
        ? `${sanitizedBasePath}/${cleanName}.${fileExt}`
        : `${cleanName}.${fileExt}`;

    console.log('Target R2 Key:', fileName);

    // --- Deduplication Check ---
    try {
        const headCommand = new HeadObjectCommand({
            Bucket: targetBucket,
            Key: fileName,
        });
        await r2Client.send(headCommand);

        // If we reach here, file exists!
        console.log(`✅ File already exists in R2: ${fileName}. Skipping upload.`);
        const targetDomain = customDomain || R2_PUBLIC_DOMAIN;
        if (targetDomain) {
            let domain = targetDomain.endsWith("/") ? targetDomain.slice(0, -1) : targetDomain;
            if (!domain.startsWith('http')) domain = `https://${domain}`;
            return `${domain}/${fileName}`;
        }
        return fileName;
    } catch (headError: any) {
        // If 404, proceed with upload. Otherwise log and proceed anyway (safer).
        if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
            console.warn("HeadObject check failed, proceeding with upload:", headError);
        }
    }

    // Convert File to ArrayBuffer to avoid "readableStream.getReader" error
    let arrayBuffer: ArrayBuffer;
    try {
        console.log(`Reading file: ${file.name}, size: ${file.size}, type: ${file.type}`);
        if (file.size === 0) {
            throw new Error(`File ${file.name} is empty (0 bytes).`);
        }
        arrayBuffer = await file.arrayBuffer();
        console.log(`File read successfully: ${file.name}`);
    } catch (err: any) {
        console.error(`Error reading file ${file.name}:`, err);
        throw new Error(`Dosya okunamadı (${file.name}): ${err.message}`);
    }

    try {
        const command = new PutObjectCommand({
            Bucket: targetBucket, // Use dynamic bucket
            Key: fileName,
            Body: new Uint8Array(arrayBuffer), // Send as Uint8Array
            ContentType: file.type,
            // Note: R2 buckets are private by default. 
            // Ensure you have a Public Access URL or Worker set up to view files.
        });

        await r2Client.send(command);

        // Return the public URL
        // Priority: Custom Domain > Env Public Domain > Raw Key
        const targetDomain = customDomain || R2_PUBLIC_DOMAIN;

        if (!targetDomain) {
            console.warn("⚠️ VITE_R2_PUBLIC_DOMAIN is not set. Returning raw key path.");
            return fileName;
        }

        // Ensure no double slash issues and has protocol
        let domain = targetDomain.endsWith("/") ? targetDomain.slice(0, -1) : targetDomain;
        if (!domain.startsWith('http')) {
            domain = `https://${domain}`;
        }
        return `${domain}/${fileName}`;
    } catch (error) {
        console.error("❌ Error uploading to R2:", error);
        throw error;
    }
};

/**
 * Renames (Moves) a folder in R2 by copying and then deleting items.
 */
export const renameR2Folder = async (
    oldPrefix: string,
    newPrefix: string,
    bucketName: string
) => {
    if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) return;

    try {
        console.log(`Renaming R2 folder from [${oldPrefix}] to [${newPrefix}] in bucket [${bucketName}]`);

        // 1. List all objects with the old prefix
        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: oldPrefix.endsWith('/') ? oldPrefix : `${oldPrefix}/`,
        });

        const listResponse = await r2Client.send(listCommand);
        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            console.log("No objects found to rename.");
            return;
        }

        // 2. Copy each object to the new prefix, then delete the old one in parallel
        await Promise.all(listResponse.Contents.map(async (item) => {
            if (!item.Key) return;

            const oldKey = item.Key;
            const newKey = oldKey.replace(oldPrefix, newPrefix);

            console.log(`Moving: ${oldKey} -> ${newKey}`);

            // Copy
            await r2Client.send(new CopyObjectCommand({
                Bucket: bucketName,
                CopySource: encodeURI(`${bucketName}/${oldKey}`), // Use encodeURI to preserve slashes
                Key: newKey,
            }));

            // Delete old
            await r2Client.send(new DeleteObjectCommand({
                Bucket: bucketName,
                Key: oldKey,
            }));
        }));
        console.log("R2 Folder rename completed successfully.");
    } catch (error) {
        console.error("Error renaming R2 folder:", error);
        throw error;
    }
};

// Note: deleteR2Folder has been moved to storageOperations.ts to consolidate R2 utilities.
