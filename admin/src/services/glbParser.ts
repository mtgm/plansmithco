import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export type MaterialTextures = {
    baseColorUrl: string | null;
    normalUrl: string | null;
    ormUrl: string | null;
};

export type ParsedMaterial = {
    material_id: string;
    name: string;
    textures: MaterialTextures;
};

function extractTextureAsDataUrl(texture: THREE.Texture | null): string | null {
    if (!texture || !texture.image) return null;
    const img = texture.image as any;
    const canvas = document.createElement("canvas");
    canvas.width = img.width || 256;
    canvas.height = img.height || 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    try {
        ctx.drawImage(img as CanvasImageSource, 0, 0);
        return canvas.toDataURL("image/png");
    } catch {
        return null;
    }
}

export async function parseMaterialsFromGlb(
    modelUrl: string
): Promise<ParsedMaterial[]> {
    return new Promise((resolve, reject) => {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(
            "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
        );

        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);

        loader.load(
            modelUrl,
            (gltf) => {
                const materials: ParsedMaterial[] = [];
                const seen = new Set<string>();

                gltf.scene.traverse((node) => {
                    if ((node as THREE.Mesh).isMesh) {
                        const mesh = node as THREE.Mesh;
                        const mats = Array.isArray(mesh.material)
                            ? mesh.material
                            : [mesh.material];

                        mats.forEach((mat) => {
                            if (!mat || seen.has(mat.uuid)) return;
                            seen.add(mat.uuid);

                            const pbr = mat as THREE.MeshStandardMaterial;
                            const matName = mat.name || "material_" + materials.length;
                            materials.push({
                                material_id: matName,  // name'i ID olarak kullan
                                name: matName,
                                textures: {
                                    baseColorUrl: extractTextureAsDataUrl(pbr.map ?? null),
                                    normalUrl: extractTextureAsDataUrl(pbr.normalMap ?? null),
                                    ormUrl: extractTextureAsDataUrl(pbr.aoMap ?? pbr.roughnessMap ?? null),
                                },
                            });
                        });
                    }
                });

                dracoLoader.dispose();
                resolve(materials);
            },
            undefined,
            (err) => {
                dracoLoader.dispose();
                reject(err);
            }
        );
    });
}