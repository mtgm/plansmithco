import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as THREE from 'three';

export interface TextureData {
    url: string;      // blob URL for preview
    name: string;     // original texture name
}

export interface MaterialInfo {
    id: string;
    name: string;
    index: number;
    baseColorTexture: TextureData | null;
    normalTexture: TextureData | null;
    ormTexture: TextureData | null;
}

export interface ParsedGLBData {
    materials: MaterialInfo[];
    meshNames: string[];
}

/**
 * Extract image data from a Three.js texture and return as blob URL
 */
function textureToBlob(texture: THREE.Texture | null, label: string): TextureData | null {
    if (!texture || !texture.image) return null;

    try {
        const canvas = document.createElement('canvas');
        const img = texture.image as HTMLImageElement | ImageBitmap | HTMLCanvasElement;

        canvas.width = img.width || 256;
        canvas.height = img.height || 256;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(img as CanvasImageSource, 0, 0);

        const dataUrl = canvas.toDataURL('image/png');
        return {
            url: dataUrl,
            name: texture.name || label,
        };
    } catch (err) {
        console.warn(`Texture extraction failed for ${label}:`, err);
        return null;
    }
}

/**
 * Parse a GLB file and extract materials + their textures using Three.js
 * Uses Google CDN for Draco decoder to avoid local WASM issues
 */
export async function parseGLB(file: File): Promise<ParsedGLBData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            if (!e.target?.result) {
                reject(new Error('Dosya okunamadı'));
                return;
            }

            const loader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();

            // Google CDN for Draco decoder
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
            dracoLoader.setDecoderConfig({ type: 'js' });
            loader.setDRACOLoader(dracoLoader);

            try {
                loader.parse(
                    e.target.result as ArrayBuffer,
                    '',
                    (gltf) => {
                        const materials: MaterialInfo[] = [];
                        const meshNames: string[] = [];
                        const seenMaterials = new Set<string>();

                        gltf.scene.traverse((child) => {
                            if ((child as THREE.Mesh).isMesh) {
                                const mesh = child as THREE.Mesh;
                                meshNames.push(mesh.name || `Mesh_${meshNames.length}`);

                                const meshMaterials = Array.isArray(mesh.material)
                                    ? mesh.material
                                    : [mesh.material];

                                meshMaterials.forEach((mat) => {
                                    if (mat && mat.name && !seenMaterials.has(mat.name)) {
                                        seenMaterials.add(mat.name);

                                        const stdMat = mat as THREE.MeshStandardMaterial;

                                        // Extract textures
                                        const baseColor = textureToBlob(stdMat.map, `${mat.name}_baseColor`);
                                        const normal = textureToBlob(stdMat.normalMap, `${mat.name}_normal`);

                                        // ORM: try aoMap first, then roughnessMap, then metalnessMap
                                        let orm: TextureData | null = null;
                                        if (stdMat.aoMap) {
                                            orm = textureToBlob(stdMat.aoMap, `${mat.name}_orm`);
                                        } else if (stdMat.roughnessMap) {
                                            orm = textureToBlob(stdMat.roughnessMap, `${mat.name}_orm`);
                                        } else if (stdMat.metalnessMap) {
                                            orm = textureToBlob(stdMat.metalnessMap, `${mat.name}_orm`);
                                        }

                                        materials.push({
                                            id: mat.name,
                                            name: mat.name,
                                            index: materials.length,
                                            baseColorTexture: baseColor,
                                            normalTexture: normal,
                                            ormTexture: orm,
                                        });
                                    }
                                });
                            }
                        });

                        console.log('GLB parsed:', {
                            materials: materials.length,
                            meshes: meshNames.length,
                            texturesFound: materials.filter(m =>
                                m.baseColorTexture || m.normalTexture || m.ormTexture
                            ).length
                        });

                        dracoLoader.dispose();
                        resolve({ materials, meshNames });
                    },
                    (error: unknown) => {
                        console.error('GLB parse error:', error);
                        dracoLoader.dispose();
                        const msg = error instanceof Error ? error.message : String(error);
                        reject(new Error('GLB işlenirken hata: ' + msg));
                    }
                );
            } catch (err: any) {
                dracoLoader.dispose();
                reject(new Error('Loader hatası: ' + err.message));
            }
        };

        reader.onerror = () => reject(new Error('Dosya okuma hatası'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Validates if a file is a valid GLB (checks magic number)
 */
export async function isValidGLB(file: File): Promise<boolean> {
    try {
        if (!file.name.toLowerCase().endsWith('.glb')) return false;
        const arrayBuffer = await file.slice(0, 4).arrayBuffer();
        const view = new DataView(arrayBuffer);
        return view.getUint32(0, true) === 0x46546C67; // "glTF"
    } catch {
        return false;
    }
}
