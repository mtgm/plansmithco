import React, { useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

interface GLBParserProps {
    fileUrl: string | null;
    onMaterialsExtracted: (materials: string[]) => void;
}

export const GLBParser: React.FC<GLBParserProps> = ({ fileUrl, onMaterialsExtracted }) => {
    useEffect(() => {
        if (!fileUrl) return;

        const loader = new GLTFLoader();
        
        loader.load(
            fileUrl,
            (gltf) => {
                const materialsSet = new Set<string>();
                
                gltf.scene.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        if (Array.isArray(mesh.material)) {
                            mesh.material.forEach((m) => materialsSet.add(m.name));
                        } else {
                            materialsSet.add(mesh.material.name);
                        }
                    }
                });

                // Filter out default or empty names if needed
                const uniqueMaterials = Array.from(materialsSet).filter(
                    (name) => name && name !== "default"
                );
                
                console.log("Extracted Materials:", uniqueMaterials);
                onMaterialsExtracted(uniqueMaterials);
            },
            undefined,
            (error) => {
                console.error("Error loading GLB:", error);
            }
        );
    }, [fileUrl, onMaterialsExtracted]);

    return null; // Invisible component
};
