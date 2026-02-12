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
 * @returns The public URL of the uploaded file
 */
export const uploadToR2 = async (
    file: File,
    folder: string = "uploads",
    companyName?: string
): Promise<string> => {
    if (!R2_BUCKET_NAME) {
        throw new Error("❌ VITE_R2_BUCKET_NAME is not defined in .env");
    }

    // Create a clean, unique file name
    // Remove special characters from original name, keep extension
    const fileExt = file.name.split(".").pop();
    const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, "").replace(fileExt || "", "");

    // Build company-specific folder path if companyName is provided
    // Example: company-plan-smith-co/categories/sets/
    console.log('Upload params:', { folder, companyName });

    // Check if companyName is valid string before slugifying
    const sanitizedCompanyName = companyName ? slugify(companyName) : '';
    console.log('Sanitized company name:', sanitizedCompanyName);

    const basePath = companyName
        ? `company-${sanitizedCompanyName}/${folder}`
        : folder;

    const fileName = `${basePath}/${Date.now()}_${cleanName}.${fileExt}`;
    console.log('Generated fileName:', fileName);

    // Convert File to ArrayBuffer to avoid "readableStream.getReader" error
    const arrayBuffer = await file.arrayBuffer();

    try {
        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileName,
            Body: new Uint8Array(arrayBuffer), // Send as Uint8Array
            ContentType: file.type,
            // Note: R2 buckets are private by default. 
            // Ensure you have a Public Access URL or Worker set up to view files.
        });

        await r2Client.send(command);

        // Return the public URL
        // If PUBLIC_DOMAIN is not set, we can't generate a viewable link
        if (!R2_PUBLIC_DOMAIN) {
            console.warn("⚠️ VITE_R2_PUBLIC_DOMAIN is not set. Returning raw key path.");
            return fileName;
        }

        // Ensure no double slash issues
        const domain = R2_PUBLIC_DOMAIN.endsWith("/") ? R2_PUBLIC_DOMAIN.slice(0, -1) : R2_PUBLIC_DOMAIN;
        return `${domain}/${fileName}`;
    } catch (error) {
        console.error("❌ Error uploading to R2:", error);
        throw error;
    }
};
