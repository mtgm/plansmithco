export interface Env {
	R2_ACCOUNT_ID: string;
	R2_ACCESS_KEY_ID: string;
	R2_SECRET_ACCESS_KEY: string;
	ALLOWED_ORIGIN: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {

		const corsHeaders = {
			"Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
			"Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};
		// POST'tan önce DELETE handler ekle
		if (request.method === "DELETE") {
			try {
				const { path, bucket } = await request.json() as { path: string; bucket: string };
				if (!path || !bucket) {
					return new Response(
						JSON.stringify({ error: "bucket veya path boş geldi", bucket, path }),
						{
							status: 400,
							headers: { ...corsHeaders, "Content-Type": "application/json" },
						}
					);
				}
				const now = new Date();
				const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
				const amzDate = dateStamp + "T" + now.toISOString().slice(11, 19).replace(/:/g, "") + "Z";
				const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
				const canonicalUri = `/${bucket}/${path}`;

				const signedHeadersList = ["host", "x-amz-content-sha256", "x-amz-date"];
				const headers: Record<string, string> = {
					"host": host,
					"x-amz-content-sha256": "UNSIGNED-PAYLOAD",
					"x-amz-date": amzDate,
				};

				const canonicalHeaders = signedHeadersList.map(h => `${h}:${headers[h]}`).join("\n") + "\n";
				const signedHeaders = signedHeadersList.join(";");
				const canonicalRequest = ["DELETE", canonicalUri, "", canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
				const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
				const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256hex(canonicalRequest)].join("\n");
				const signingKey = await getSigningKey(env.R2_SECRET_ACCESS_KEY, dateStamp, "auto", "s3");
				const signature = await hmacHex(signingKey, stringToSign);
				const authHeader = `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

				const deleteUrl = `https://${host}${canonicalUri}`;
				const r2Response = await fetch(deleteUrl, {
					method: "DELETE",
					headers: { "Host": host, "x-amz-content-sha256": "UNSIGNED-PAYLOAD", "x-amz-date": amzDate, "Authorization": authHeader },
				});

				if (!r2Response.ok) {
					const errText = await r2Response.text();
					return new Response(JSON.stringify({ error: errText }), { status: 500, headers: corsHeaders });
				}

				return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
			} catch (err: any) {
				return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
			}
		}
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		try {
			const formData = await request.formData();
			const file = formData.get("file") as File;
			const bucket = formData.get("bucket") as string;
			const folder = formData.get("folder") as string;
			const domain = formData.get("domain") as string;

			if (!file || !bucket || !domain) {
				return new Response(
					JSON.stringify({ error: "file, bucket ve domain zorunlu" }),
					{ status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
				);
			}

			// --- DOSYA UZANTISI VE CONTENT-TYPE AYARI ---
			const fileNameOriginal = file.name || "upload.glb";
			const ext = fileNameOriginal.split(".").pop()?.toLowerCase();

			let contentType = file.type || "application/octet-stream";
			if (ext === "glb") {
				contentType = "model/gltf-binary";
			} else if (ext === "gltf") {
				contentType = "model/gltf+json";
			}

			const fileName = folder
				? `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
				: `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

			const arrayBuffer = await file.arrayBuffer();
			const now = new Date();
			const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
			const amzDate = dateStamp + "T" + now.toISOString().slice(11, 19).replace(/:/g, "") + "Z";

			const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
			const canonicalUri = `/${bucket}/${fileName}`;

			// --- HEADERLARDA CONTENT-TYPE'I BELİRTİYORUZ ---
			const headers: Record<string, string> = {
				"content-type": contentType,
				"host": host,
				"x-amz-content-sha256": "UNSIGNED-PAYLOAD",
				"x-amz-date": amzDate,
			};

			const signedHeadersList = ["content-type", "host", "x-amz-content-sha256", "x-amz-date"];
			const canonicalHeaders = signedHeadersList
				.map(h => `${h}:${headers[h]}`)
				.join("\n") + "\n";

			const signedHeaders = signedHeadersList.join(";");

			const canonicalRequest = [
				"PUT",
				canonicalUri,
				"",
				canonicalHeaders,
				signedHeaders,
				"UNSIGNED-PAYLOAD",
			].join("\n");

			const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

			const stringToSign = [
				"AWS4-HMAC-SHA256",
				amzDate,
				credentialScope,
				await sha256hex(canonicalRequest),
			].join("\n");

			const signingKey = await getSigningKey(
				env.R2_SECRET_ACCESS_KEY,
				dateStamp,
				"auto",
				"s3"
			);

			const signature = await hmacHex(signingKey, stringToSign);
			const authHeader = `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

			const uploadUrl = `https://${host}${canonicalUri}`;

			// --- R2'YE PUT İŞLEMİ ---
			const r2Response = await fetch(uploadUrl, {
				method: "PUT",
				headers: {
					"Content-Type": contentType,
					"Host": host,
					"x-amz-content-sha256": "UNSIGNED-PAYLOAD",
					"x-amz-date": amzDate,
					"Authorization": authHeader,
					// Tarayıcının dosyayı indirmek yerine görüntülemesini zorlar
					"Content-Disposition": "inline",
				},
				body: arrayBuffer,
			});

			if (!r2Response.ok) {
				const errText = await r2Response.text();
				return new Response(
					JSON.stringify({ error: "R2 yükleme hatası", status: r2Response.status, detail: errText }),
					{ status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
				);
			}

			const publicUrl = `https://plansmith-assets.serhatyildirim123.workers.dev/asset?key=${encodeURIComponent(fileName)}`;

			return new Response(
				JSON.stringify({ url: publicUrl, path: fileName }),
				{ status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
			);

		} catch (err: any) {
			return new Response(
				JSON.stringify({ error: err.message }),
				{ status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
			);
		}
	},
};

// --- YARDIMCI FONKSİYONLAR (DEĞİŞMEDİ) ---

async function sha256hex(message: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(message);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const encoder = new TextEncoder();
	return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

async function hmacHex(key: ArrayBuffer, message: string): Promise<string> {
	const buffer = await hmac(key, message);
	return Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function getSigningKey(
	secretKey: string,
	dateStamp: string,
	region: string,
	service: string
): Promise<ArrayBuffer> {
	const encoder = new TextEncoder();
	const kDate = await hmac(encoder.encode(`AWS4${secretKey}`), dateStamp);
	const kRegion = await hmac(kDate, region);
	const kService = await hmac(kRegion, service);
	return hmac(kService, "aws4_request");
}