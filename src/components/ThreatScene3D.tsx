"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type ThreatScene3DProps = {
  activeRisk: number;
  density: number;
};

export function ThreatScene3D({ activeRisk, density }: ThreatScene3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const riskRef = useRef(activeRisk);
  const densityRef = useRef(density);

  useEffect(() => {
    riskRef.current = activeRisk;
    densityRef.current = density;
  }, [activeRisk, density]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      canvas,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(1.4, window.devicePixelRatio || 1));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    const group = new THREE.Group();
    scene.add(group);

    const globe = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.45, 2),
      new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.1,
        wireframe: true,
      }),
    );
    group.add(globe);

    const ringMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.42,
    });
    const rings = [0, Math.PI / 3, -Math.PI / 3].map((rotation, index) => {
      const points = Array.from({ length: 97 }, (_, pointIndex) => {
        const angle = (pointIndex / 96) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * 2.1, Math.sin(angle) * 2.1, 0);
      });
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMaterial);
      ring.rotation.x = rotation;
      ring.rotation.z = index * 0.7;
      group.add(ring);
      return ring;
    });

    const satelliteMaterial = new THREE.MeshBasicMaterial({ color: 0xff0040 });
    const satellites = Array.from({ length: 6 }, (_, index) => {
      const satellite = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.06), satelliteMaterial);
      satellite.userData.phase = (index / 6) * Math.PI * 2;
      satellite.userData.radius = 2.25 + (index % 3) * 0.18;
      satellite.userData.speed = 0.35 + index * 0.04;
      group.add(satellite);
      return satellite;
    });

    const droneMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8c00,
      transparent: true,
      opacity: 0.78,
      wireframe: true,
    });
    const drones = Array.from({ length: 10 }, (_, index) => {
      const drone = new THREE.Mesh(new THREE.TetrahedronGeometry(0.08, 0), droneMaterial);
      drone.userData.phase = (index / 10) * Math.PI * 2;
      drone.userData.radius = 3.0 + (index % 4) * 0.16;
      group.add(drone);
      return drone;
    });

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    let frame = 0;
    let running = true;
    const started = performance.now();

    const render = (now: number) => {
      if (!running) {
        return;
      }

      const elapsed = (now - started) / 1000;
      const intensity = Math.min(1, riskRef.current / 100);
      const densityBoost = Math.min(1, densityRef.current / 120);
      globe.rotation.y = elapsed * 0.08;
      group.rotation.z = Math.sin(elapsed * 0.2) * 0.06;
      group.position.set(window.innerWidth > 900 ? -3.1 : -1.2, window.innerWidth > 900 ? -1.1 : -1.5, 0);
      group.scale.setScalar(window.innerWidth > 900 ? 1 : 0.76);

      rings.forEach((ring, index) => {
        ring.rotation.z += 0.002 + index * 0.001;
        ring.material.opacity = 0.2 + intensity * 0.28;
      });

      satellites.forEach((satellite) => {
        const phase = satellite.userData.phase as number;
        const radius = satellite.userData.radius as number;
        const speed = satellite.userData.speed as number;
        const angle = phase + elapsed * speed;
        satellite.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.34, Math.sin(angle) * 0.6);
        satellite.rotation.z = angle;
        satellite.scale.setScalar(1 + intensity * 0.8);
      });

      drones.forEach((drone) => {
        const phase = drone.userData.phase as number;
        const angle = phase - elapsed * (0.18 + densityBoost * 0.18);
        const radius = drone.userData.radius as number;
        drone.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.7) * 0.9, -0.2);
        drone.rotation.x = elapsed + phase;
        drone.rotation.y = elapsed * 0.7;
      });

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    frame = window.requestAnimationFrame(render);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      globe.geometry.dispose();
      globe.material.dispose();
      ringMaterial.dispose();
      satelliteMaterial.dispose();
      droneMaterial.dispose();
      satellites.forEach((satellite) => satellite.geometry.dispose());
      drones.forEach((drone) => drone.geometry.dispose());
      rings.forEach((ring) => ring.geometry.dispose());
    };
  }, []);

  return <canvas className="threat-scene-canvas" ref={canvasRef} aria-hidden="true" />;
}
