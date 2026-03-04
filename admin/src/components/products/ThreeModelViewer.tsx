import React, { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Stage, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface ThreeModelViewerProps {
    modelUrl: string | null;
    imageUrl: string | null;
    onLoaded?: (scene: any) => void;
    highlightMaterial?: string | null;
    width?: string;
    height?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, ErrorBoundaryState> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("ThreeModelViewer Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

const Model = ({ url, onLoaded, highlightMaterial }: { url: string, onLoaded?: (scene: any) => void, highlightMaterial?: string | null }) => {
    // ... same content ...
    const { scene } = useGLTF(url);

    useEffect(() => {
        if (scene) {
            if (onLoaded) onLoaded(scene);
        }
    }, [scene, onLoaded]);

    // Highlight material effect
    useEffect(() => {
        if (scene) {
            scene.traverse((child: any) => {
                if (child.isMesh) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((mat: any) => {
                        if (highlightMaterial && mat.name === highlightMaterial) {
                            mat.emissive = new THREE.Color(0xffaa00);
                            mat.emissiveIntensity = 0.5;
                        } else {
                            mat.emissive = new THREE.Color(0x000000);
                            mat.emissiveIntensity = 0;
                        }
                    });
                }
            });
        }
    }, [scene, highlightMaterial]);

    return <primitive object={scene} />;
};

export const ThreeModelViewer: React.FC<ThreeModelViewerProps> = ({ modelUrl, imageUrl, onLoaded, highlightMaterial, width = "100%", height = "250px" }) => {
    // 1. If we have a Model URL, show the 3D Canvas
    if (modelUrl) {
        return (
            <div style={{ width, height, borderRadius: "8px", overflow: "hidden", backgroundColor: "#222", position: 'relative' }}>
                <ErrorBoundary fallback={
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#ff4d4f', flexDirection: 'column' }}>
                        <span style={{ fontSize: 24, marginBottom: 8 }}>⚠️</span>
                        <div style={{ textAlign: 'center' }}>Model Görüntülenemedi<br />(CORS/Ağ Hatası)</div>
                    </div>
                }>
                    <Canvas shadows dpr={[1, 2]} camera={{ fov: 50 }}>
                        <Suspense fallback={null}>
                            <Stage environment="city" intensity={0.6}>
                                <Model url={modelUrl} onLoaded={onLoaded} highlightMaterial={highlightMaterial} />
                            </Stage>
                        </Suspense>
                        <OrbitControls makeDefault />
                    </Canvas>
                </ErrorBoundary>
            </div>
        );
    }

    // 2. If we only have an Image, show the image
    if (imageUrl) {
        return (
            <div style={{
                width, height, display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: "#222", borderRadius: "8px", overflow: "hidden"
            }}>
                <img src={imageUrl} alt="Product Preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            </div>
        );
    }

    // 3. Fallback state
    return (
        <div style={{
            width, height, display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: "#222", borderRadius: "8px", color: "#666"
        }}>
            3D Model or Image Preview
        </div>
    );
};
