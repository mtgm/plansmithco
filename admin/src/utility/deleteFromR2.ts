import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "./r2Client";

const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
const R2_PUBLIC_DOMAIN = import.meta.env.VITE_R2_PUBLIC_DOMAIN || import.meta.env.VITE_R2_PUBLIC_URL;

/**
 * Deletes a file from Cloudflare R2.
 * @param fileUrl The full public URL of the file to delete
 * @returns true if deletion was successful, false otherwise
 */
export const deleteFromR2 = async (fileUrl: string): Promise<boolean> => {
    if (!R2_BUCKET_NAME) {
        console.error("❌ VITE_R2_BUCKET_NAME is not defined in .env");
        return false;
    }

    if (!fileUrl) {
        console.warn("⚠️ No file URL provided for deletion");
        return false;
    }

    try {
        // Extract the key from the URL
        // URL format: https://domain.com/folder/timestamp_filename.ext
        let key = "";

        if (R2_PUBLIC_DOMAIN && fileUrl.startsWith(R2_PUBLIC_DOMAIN)) {
            // Remove the domain part to get the key
            const domain = R2_PUBLIC_DOMAIN.endsWith("/")
                ? R2_PUBLIC_DOMAIN.slice(0, -1)
                : R2_PUBLIC_DOMAIN;
            key = fileUrl.replace(domain + "/", "");
        } else if (fileUrl.includes("/")) {
            // Try to extract path directly (might be just the key)
            const urlParts = fileUrl.split("/");
            // Get everything after the domain
            const domainIndex = urlParts.findIndex(part => part.includes("."));
            if (domainIndex >= 0) {
                key = urlParts.slice(domainIndex + 1).join("/");
            } else {
                key = fileUrl;
            }
        } else {
            key = fileUrl;
        }

        if (!key) {
            console.warn("⚠️ Could not extract key from URL:", fileUrl);
            return false;
        }

        console.log("🗑️ Deleting from R2:", key);

        const command = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        });

        await r2Client.send(command);
        console.log("✅ Successfully deleted from R2:", key);
        return true;
    } catch (error) {
        console.error("❌ Error deleting from R2:", error);
        return false;
    }
};
