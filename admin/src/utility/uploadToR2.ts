import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "./r2Client";

const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
const R2_PUBLIC_DOMAIN = import.meta.env.VITE_R2_PUBLIC_DOMAIN || import.meta.env.VITE_R2_PUBLIC_URL;

/**
 * Helper to slugify text for URL safety
 */
const slugify = (text: string) => {
    return text.toString().toLowerCase()
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
    // Remove special characters from original name, keep extension
    const fileExt = file.name.split(".").pop();
    const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, "").replace(fileExt || "", "");

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
    let basePath = folder;

    if (!bucketName && companyName) {
        // Shared bucket scenario: Use company prefix to avoid collisions
        basePath = `company-${sanitizedCompanyName}/${folder}`;
    } else {
        // Dedicated bucket scenario: No need for company prefix, just folder
        basePath = folder;
    }

    const fileName = `${basePath}/${Date.now()}_${cleanName}.${fileExt}`;
    console.log('generated fileName:', fileName);

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

        // Ensure no double slash issues
        const domain = targetDomain.endsWith("/") ? targetDomain.slice(0, -1) : targetDomain;
        return `${domain}/${fileName}`;
    } catch (error) {
        console.error("❌ Error uploading to R2:", error);
        throw error;
    }
};
