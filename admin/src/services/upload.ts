import { supabaseClient } from "../providers/supabase-client";

const WORKER_URL = import.meta.env.VITE_UPLOAD_WORKER_URL;

interface UploadResult {
    url: string;
    path: string;
}

// Base64 data URL'yi File'a çevir
export const dataUrlToFile = (dataUrl: string, fileName: string): File => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], fileName, { type: mime });
};

export const uploadToR2 = async (
    file: File,
    folder: string,
    companyId: string
): Promise<UploadResult> => {
    const { data: company, error } = await supabaseClient
        .from("companies")
        .select("storage_bucket, storage_domain, r2_folder_path")
        .eq("id", companyId)
        .single();

    if (error || !company) {
        throw new Error("Şirket depolama bilgisi bulunamadı.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", company.storage_bucket);
    formData.append("domain", company.storage_domain);
    formData.append("folder", `${company.r2_folder_path}/${folder}`);

    const response = await fetch(WORKER_URL, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Yükleme başarısız.");
    }

    return response.json();
};
export const deleteFromR2 = async (
    fileUrl: string,
    companyId: string
): Promise<void> => {
    if (!fileUrl) return;

    // R2'de olmayan geçici/local verileri silmeye çalışma
    if (
        fileUrl.startsWith("data:") ||
        fileUrl.startsWith("blob:")
    ) {
        return;
    }

    const { data: company } = await supabaseClient
        .from("companies")
        .select("storage_bucket, storage_domain")
        .eq("id", companyId)
        .single();

    if (!company) return;

    let path = "";

    try {
        const url = new URL(fileUrl);

        // Yeni worker URL formatı:
        // https://plansmith-assets....workers.dev/asset?key=xxxx
        const keyParam = url.searchParams.get("key");
        if (keyParam) {
            path = decodeURIComponent(keyParam);
        } else {
            // Eski format fallback:
            path = fileUrl.replace(company.storage_domain + "/", "");
        }
    } catch {
        // Geçersiz URL ise eski format gibi davran
        path = fileUrl.replace(company.storage_domain + "/", "");
    }

    if (!path) return;

    const response = await fetch(WORKER_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            bucket: company.storage_bucket,
            path,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`R2 silme hatası: ${errText}`);
    }
};