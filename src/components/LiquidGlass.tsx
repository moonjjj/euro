"use client";

import { useEffect, useRef, useState } from "react";

// WebGL liquid glass, ported from https://github.com/dashersw/liquid-glass-js
// Instead of a one-time html2canvas page snapshot, it samples the live
// `img[data-glass-source]` elements so the glass follows swipes and scroll.

type Props = React.HTMLAttributes<HTMLElement> & {
  as?: "div" | "button";
  /** Refraction strength in CSS px */
  refraction?: number;
  /** Blur radius in CSS px */
  blur?: number;
  /** White→gray gradient tint amount (0-1) */
  tint?: number;
  /** Darkening for white text legibility (0-1) */
  shade?: number;
  /** Color shown where no source image is behind the glass */
  backdrop?: string;
  /** Styles applied until WebGL is ready (or if it fails) */
  fallbackStyle?: React.CSSProperties;
};

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_rect;
uniform float u_radius;
uniform sampler2D u_tex0;
uniform vec4 u_rect0;
uniform sampler2D u_tex1;
uniform vec4 u_rect1;
uniform vec3 u_backdrop;
uniform float u_refraction;
uniform float u_blur;
uniform float u_tint;
uniform float u_shade;

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

bool inUnit(vec2 t) {
  return t.x >= 0.0 && t.y >= 0.0 && t.x <= 1.0 && t.y <= 1.0;
}

vec3 sampleBg(vec2 s) {
  if (u_rect0.z > 0.0) {
    vec2 t = (s - u_rect0.xy) / u_rect0.zw;
    if (inUnit(t)) return texture2D(u_tex0, t).rgb;
  }
  if (u_rect1.z > 0.0) {
    vec2 t = (s - u_rect1.xy) / u_rect1.zw;
    if (inUnit(t)) return texture2D(u_tex1, t).rgb;
  }
  return u_backdrop;
}

void main() {
  vec2 half_ = u_size * 0.5;
  vec2 p = (v_uv - 0.5) * u_size;
  float d = sdRoundRect(p, half_, u_radius);
  float inside = max(-d, 0.0);

  // Outward surface normal of the rounded rect / pill
  vec2 q = abs(p) - half_ + u_radius;
  vec2 n;
  if (q.x > 0.0 && q.y > 0.0) n = normalize(q);
  else n = q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  n *= vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);

  // Edge + rim + corner refraction and rim ripple (same model as liquid-glass-js)
  float edge = exp(-inside * 0.15);
  float rim = exp(-inside * 0.8);
  float minDim = min(u_size.x, u_size.y);
  float cornerDist = max(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y)) * minDim;
  float corner = exp(-cornerDist * 0.3);
  vec2 offset = n * u_refraction * (edge * 0.2 + rim + corner * 0.4);
  vec2 perp = vec2(-n.y, n.x);
  offset += perp * sin(inside / minDim * 25.0) * rim * u_refraction * 0.5;

  vec2 scale = u_rect.zw / u_size;
  vec2 s = u_rect.xy + (v_uv * u_size + offset) * scale;

  // Gaussian blur
  vec3 col = vec3(0.0);
  float total = 0.0;
  float step_ = u_blur * 0.5;
  // Per-pixel random rotation of the tap grid turns blocky aliasing into fine frost
  float ang = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  mat2 rot = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  for (float i = -4.0; i <= 4.0; i += 1.0) {
    for (float j = -4.0; j <= 4.0; j += 1.0) {
      float r = length(vec2(i, j));
      if (r > 4.0) continue;
      float w = exp(-(r * r) / 12.5);
      col += sampleBg(s + rot * vec2(i, j) * step_) * w;
      total += w;
    }
  }
  col /= total;

  // Vertical gradient tint, then shade for legibility
  vec3 grad = mix(vec3(1.0), vec3(0.7), v_uv.y);
  col = mix(col, grad, u_tint);
  col *= 1.0 - u_shade;

  // Specular rim light from the top-left
  float light = 0.5 + 0.5 * dot(n, normalize(vec2(-0.4, -1.0)));
  col += exp(-inside * 0.9) * light * 0.35;

  float a = 1.0 - smoothstep(-0.75, 0.25, d);
  gl_FragColor = vec4(col * a, a);
}`;

// Downscaled source images, shared across all glass instances
const sourceCache = new Map<string, HTMLCanvasElement>();

function getSourceCanvas(img: HTMLImageElement, maxTex: number): HTMLCanvasElement | null {
  const src = img.currentSrc || img.src;
  const cached = sourceCache.get(src);
  if (cached) return cached;
  if (!img.complete || !img.naturalWidth) return null;
  const k = Math.min(1, 512 / img.naturalWidth, maxTex / img.naturalHeight);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  sourceCache.set(src, c);
  return c;
}

// Rect of the actually painted image content (handles object-fit: cover)
function contentRect(img: HTMLImageElement): [number, number, number, number] {
  const r = img.getBoundingClientRect();
  if (getComputedStyle(img).objectFit !== "cover" || !img.naturalWidth) {
    return [r.left, r.top, r.width, r.height];
  }
  const k = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  return [r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h];
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export default function LiquidGlass({
  as: Tag = "div",
  refraction = 18,
  blur = 5,
  tint = 0.15,
  shade = 0.35,
  backdrop = "#212121",
  fallbackStyle,
  className,
  style,
  children,
  ...rest
}: Props) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const opts = useRef({ refraction, blur, tint, shade, backdrop });
  useEffect(() => {
    opts.current = { refraction, blur, tint, shade, backdrop };
  }, [refraction, blur, tint, shade, backdrop]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("LiquidGlass shader:", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const loc = {
      size: u("u_size"),
      rect: u("u_rect"),
      radius: u("u_radius"),
      rect0: u("u_rect0"),
      rect1: u("u_rect1"),
      backdrop: u("u_backdrop"),
      refraction: u("u_refraction"),
      blur: u("u_blur"),
      tint: u("u_tint"),
      shade: u("u_shade"),
    };
    gl.uniform1i(u("u_tex0"), 0);
    gl.uniform1i(u("u_tex1"), 1);

    const maxTex = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    const slots = [0, 1].map(() => ({ tex: gl.createTexture()!, source: null as HTMLCanvasElement | null }));
    slots.forEach((slot, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, slot.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    });

    let raf = 0;
    let lastKey = "";
    let isReady = false;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      if (!w || !h) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(w * dpr);
      const ch = Math.round(h * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        gl.viewport(0, 0, cw, ch);
      }

      const rects: [number, number, number, number][] = [];
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[data-glass-source]"));
      for (let i = 0; i < 2; i++) {
        const slot = slots[i];
        const img = imgs[i];
        const source = img ? getSourceCanvas(img, maxTex) : null;
        if (source && slot.source !== source) {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, slot.tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
          slot.source = source;
        }
        rects.push(source ? contentRect(img) : [0, 0, 0, 0]);
      }

      const r = host.getBoundingClientRect();
      const radius = Math.min(parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0, w / 2, h / 2);
      const o = opts.current;
      const key = [w, h, r.left, r.top, r.width, r.height, radius, ...rects.flat(), slots[0].source && slots[0].source.width, slots[1].source && slots[1].source.width, o.refraction, o.blur, o.tint, o.shade, o.backdrop].join();
      if (key === lastKey) return;
      lastKey = key;

      gl.uniform2f(loc.size, w, h);
      gl.uniform4f(loc.rect, r.left, r.top, r.width, r.height);
      gl.uniform1f(loc.radius, radius);
      gl.uniform4f(loc.rect0, ...rects[0]);
      gl.uniform4f(loc.rect1, ...rects[1]);
      gl.uniform3f(loc.backdrop, ...hexToRgb(o.backdrop));
      gl.uniform1f(loc.refraction, o.refraction);
      gl.uniform1f(loc.blur, o.blur);
      gl.uniform1f(loc.tint, o.tint);
      gl.uniform1f(loc.shade, o.shade);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!isReady && slots[0].source) {
        isReady = true;
        setReady(true);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      slots.forEach((slot) => gl.deleteTexture(slot.tex));
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <Tag
      ref={hostRef as React.Ref<never>}
      className={className}
      style={{ ...(ready ? null : fallbackStyle), ...style, isolation: "isolate", position: style?.position ?? "relative" }}
      {...rest}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: -1, opacity: ready ? 1 : 0, transition: "opacity 0.3s ease" }}
      />
      {children}
    </Tag>
  );
}
