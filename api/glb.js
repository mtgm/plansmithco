export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const key = url.searchParams.get("key") || "SBR-v2.glb";

    // Cloudflare R2 Public URL — seninki:
    const fileUrl = `https://pub-c09e063308e5459cb4c5727415475d43.r2.dev/${key}`;

    const response = await fetch(fileUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: "FetchFailed", status: response.status });
    }

    // Tarayıcıya model akışını gönder
    res.setHeader("Content-Type", "model/gltf-binary");
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
