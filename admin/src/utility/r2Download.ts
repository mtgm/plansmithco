import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "./r2Client";

/**
 * Downloads a file from R2 via the S3 SDK (bypasses CORS restrictions)
 * and returns a local blob URL that can be used by Three.js/useGLTF.
 * 
 * @param publicUrl The public URL of the file (e.g., https://pub-xxx.r2.dev/path/to/file.glb)
 * @param bucketName The R2 bucket name
 * @param publicDomain The public domain prefix to strip from the URL to get the key
 * @returns A blob:// URL that can be used locally
 */
export const downloadR2FileAsBlob = async (
    publicUrl: string,
    bucketName: string,
    publicDomain?: string
): Promise<string> => {
    // Extract the key from the public URL
    // e.g., "https://pub-xxx.r2.dev/Deneme/1x2V3.glb" -> "Deneme/1x2V3.glb"
    let key = publicUrl;

    if (publicDomain) {
        const cleanDomain = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain;
        if (key.startsWith(cleanDomain)) {
            key = key.substring(cleanDomain.length + 1); // +1 for the /
        }
    }

    // Fallback: try to extract key from any known R2 public URL patterns
    const r2DevMatch = publicUrl.match(/https:\/\/pub-[a-f0-9]+\.r2\.dev\/(.+)/);
    if (r2DevMatch) {
        key = r2DevMatch[1];
    }

    // Also handle custom domain patterns
    const urlObj = new URL(publicUrl);
    if (key === publicUrl) {
        // If we haven't extracted a key yet, use pathname
        key = decodeURIComponent(urlObj.pathname.substring(1)); // Remove leading /
    }

    console.log('Downloading R2 file via SDK:', { publicUrl, bucketName, key });

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });

    const response = await r2Client.send(command);

    if (!response.Body) {
        throw new Error('Empty response body from R2');
    }

    // Convert the ReadableStream to a Blob
    const bodyBytes = await response.Body.transformToByteArray();
    const blob = new Blob([bodyBytes as unknown as ArrayBuffer], {
        type: response.ContentType || 'application/octet-stream'
    });

    return URL.createObjectURL(blob);
};
