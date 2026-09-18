import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number; // 0 to 1
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface HeatmapOptions {
  radius?: number;
  blur?: number;
  maxOpacity?: number;
  minOpacity?: number;
  gradient?: Record<number, string>;
}

const DEFAULT_GRADIENT: Record<number, string> = {
  0.15: '#00d4ff', // Cyan / Low probability fringe
  0.35: '#10b981', // Emerald / Guarded
  0.55: '#facc15', // Yellow / Elevated
  0.75: '#f97316', // Orange / High risk
  1.0: '#ef4444',  // Fiery Crimson Red / Critical cash-drain hotspot
};

function createGradientPalette(gradientMap: Record<number, string>): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8ClampedArray(256 * 4);

  const grad = ctx.createLinearGradient(0, 0, 256, 1);
  for (const key in gradientMap) {
    grad.addColorStop(parseFloat(key), gradientMap[key]);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

function createRadialBrush(radius: number, blur: number): HTMLCanvasElement {
  const circle = document.createElement('canvas');
  const r = radius + blur;
  circle.width = r * 2;
  circle.height = r * 2;
  const ctx = circle.getContext('2d');
  if (!ctx) return circle;

  const innerR = Math.max(0, radius - blur);
  const grad = ctx.createRadialGradient(r, r, innerR, r, r, r);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  return circle;
}

interface HeatmapLayerProps {
  points: HeatPoint[];
  radius?: number;
  blur?: number;
  opacity?: number;
  visible?: boolean;
  gradient?: Record<number, string>;
}

export const HeatmapLayer: React.FC<HeatmapLayerProps> = ({
  points,
  radius = 36,
  blur = 22,
  opacity = 0.82,
  visible = true,
  gradient = DEFAULT_GRADIENT,
}) => {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const brushRef = useRef<HTMLCanvasElement | null>(null);
  const paletteRef = useRef<Uint8ClampedArray | null>(null);

  // Pre-generate brush and palette
  useEffect(() => {
    brushRef.current = createRadialBrush(radius, blur);
  }, [radius, blur]);

  useEffect(() => {
    paletteRef.current = createGradientPalette(gradient);
  }, [gradient]);

  // Create & mount canvas layer on Leaflet overlayPane
  useEffect(() => {
    const overlayPane = map.getPanes().overlayPane;
    const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-canvas') as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '350';
    canvas.style.transition = 'opacity 0.3s ease';
    overlayPane.appendChild(canvas);
    canvasRef.current = canvas;

    const render = () => {
      if (!canvasRef.current || !visible || points.length === 0) {
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        return;
      }

      const currentCanvas = canvasRef.current;
      const mapSize = map.getSize();
      const bounds = map.getBounds();
      const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());

      // Size and position canvas relative to Leaflet layer coordinate space
      currentCanvas.width = mapSize.x;
      currentCanvas.height = mapSize.y;
      L.DomUtil.setPosition(currentCanvas, topLeft);

      const ctx = currentCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, mapSize.x, mapSize.y);

      const brush = brushRef.current || createRadialBrush(radius, blur);
      const palette = paletteRef.current || createGradientPalette(gradient);
      const r = radius + blur;

      // Stage 1: Draw intensity stamps onto canvas using alpha channel
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        // Convert latLng to LayerPoint
        const layerPt = map.latLngToLayerPoint([pt.lat, pt.lng]);
        const x = layerPt.x - topLeft.x;
        const y = layerPt.y - topLeft.y;

        // Skip points well outside viewport buffer
        if (x < -r || x > mapSize.x + r || y < -r || y > mapSize.y + r) {
          continue;
        }

        const clampedIntensity = Math.max(0.08, Math.min(1.0, pt.intensity));
        ctx.globalAlpha = clampedIntensity;
        ctx.drawImage(brush, x - r, y - r);
      }

      // Stage 2: Colorize pixel raster using thermal palette
      const imgData = ctx.getImageData(0, 0, mapSize.x, mapSize.y);
      const data = imgData.data;
      const len = data.length;

      for (let i = 3; i < len; i += 4) {
        const alpha = data[i];
        if (alpha > 0) {
          const offset = alpha * 4;
          data[i - 3] = palette[offset];     // Red
          data[i - 2] = palette[offset + 1]; // Green
          data[i - 1] = palette[offset + 2]; // Blue
          data[i] = Math.round(alpha * opacity); // Scaled Alpha
        }
      }

      ctx.putImageData(imgData, 0, 0);
    };

    // Update canvas opacity
    canvas.style.opacity = visible ? '1' : '0';

    // Render immediately
    render();

    // Attach Leaflet event listeners
    map.on('moveend zoomend viewreset resize', render);

    return () => {
      map.off('moveend zoomend viewreset resize', render);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      canvasRef.current = null;
    };
  }, [map, points, radius, blur, opacity, visible, gradient]);

  // Handle visibility & opacity dynamic updates
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.opacity = visible ? '1' : '0';
    }
  }, [visible]);

  return null;
};
