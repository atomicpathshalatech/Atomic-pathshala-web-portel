"use client";

import { useEffect, useRef } from "react";

/**
 * Animated gradient background used behind the hero section.
 * Ported from the Stitch-generated inline <script> into a proper
 * React client component (no DOM queries by id, cleans up on unmount).
 */
export function HeroShaderCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    let ro: ResizeObserver | undefined;

    function syncSize() {
      if (!canvas) return;
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(syncSize);
      ro.observe(canvas);
    }
    syncSize();

    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return;

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    const fs = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec2 mouseNorm = u_mouse / u_resolution;

    float t = u_time * 0.15;

    float wave1 = sin(uv.x * 3.0 + t) * 0.5 + 0.5;
    float wave2 = cos(uv.y * 2.0 - t * 0.8) * 0.5 + 0.5;

    float dist = distance(uv, mouseNorm);
    float glow = smoothstep(0.4, 0.0, dist) * 0.15;

    vec3 color1 = vec3(0.043, 0.075, 0.149);
    vec3 color2 = vec3(0.388, 0.4, 0.945);
    vec3 color3 = vec3(0.063, 0.106, 0.22);

    vec3 finalColor = mix(color1, color3, wave1 * wave2);
    finalColor = mix(finalColor, color2, (wave1 + glow) * 0.2);

    float pulse = sin(u_time * 2.0) * 0.02 + 0.98;
    finalColor *= pulse;

    gl_FragColor = vec4(finalColor, 1.0);
}`;

    function compileShader(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

    function onMouseMove(event: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        mouse.x = nx * canvas.width;
        mouse.y = ny * canvas.height;
      }
    }
    window.addEventListener("mousemove", onMouseMove);

    function render(t: number) {
      if (!gl || !canvas) return;
      if (typeof ResizeObserver === "undefined") syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="w-full h-full opacity-40">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  );
}
