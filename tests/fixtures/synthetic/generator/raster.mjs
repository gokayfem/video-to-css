// Tiny software rasterizer for synthetic reference clips.
// Deliberately independent of any browser: shapes are signed-distance fields
// composited in linear float RGB, then quantized to sRGB-ish 8-bit (no gamma
// math; colors are treated as display values, like CSS does by default).

export function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Raster {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = new Float32Array(w * h * 3);
  }

  fill(rgb) {
    for (let i = 0; i < this.w * this.h; i++) {
      this.buf[i * 3] = rgb[0];
      this.buf[i * 3 + 1] = rgb[1];
      this.buf[i * 3 + 2] = rgb[2];
    }
  }

  // Vertical two-stop gradient (top -> bottom).
  vgradient(top, bottom) {
    for (let y = 0; y < this.h; y++) {
      const t = (y + 0.5) / this.h;
      const c = [0, 1, 2].map((k) => top[k] + (bottom[k] - top[k]) * t);
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 3;
        this.buf[i] = c[0];
        this.buf[i + 1] = c[1];
        this.buf[i + 2] = c[2];
      }
    }
  }

  // Composite an SDF shape. sdf(x, y) < 0 inside. bbox = [x0, y0, x1, y1].
  shape(sdf, bbox, rgb, alpha = 1) {
    const x0 = Math.max(0, Math.floor(bbox[0]) - 2);
    const y0 = Math.max(0, Math.floor(bbox[1]) - 2);
    const x1 = Math.min(this.w - 1, Math.ceil(bbox[2]) + 2);
    const y1 = Math.min(this.h - 1, Math.ceil(bbox[3]) + 2);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = sdf(x + 0.5, y + 0.5);
        const cov = clamp01(0.5 - d) * alpha;
        if (cov <= 0) continue;
        const i = (y * this.w + x) * 3;
        this.buf[i] += (rgb[0] - this.buf[i]) * cov;
        this.buf[i + 1] += (rgb[1] - this.buf[i + 1]) * cov;
        this.buf[i + 2] += (rgb[2] - this.buf[i + 2]) * cov;
      }
    }
  }

  circle(cx, cy, r, rgb, alpha = 1) {
    this.shape((x, y) => Math.hypot(x - cx, y - cy) - r, [cx - r, cy - r, cx + r, cy + r], rgb, alpha);
  }

  ring(cx, cy, r, thick, rgb, alpha = 1) {
    const R = r + thick / 2;
    this.shape((x, y) => Math.abs(Math.hypot(x - cx, y - cy) - r) - thick / 2, [cx - R, cy - R, cx + R, cy + R], rgb, alpha);
  }

  ellipse(cx, cy, rx, ry, rgb, alpha = 1) {
    // Approximate SDF: scale to unit circle, multiply back by the local min radius.
    const m = Math.min(rx, ry);
    this.shape((x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * m, [cx - rx, cy - ry, cx + rx, cy + ry], rgb, alpha);
  }

  // Rounded rectangle centred at (cx, cy), rotated by `rot` radians.
  rrect(cx, cy, w, h, radius, rot, rgb, alpha = 1) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const hw = w / 2 - radius, hh = h / 2 - radius;
    const ext = Math.hypot(w, h) / 2 + 1;
    this.shape((x, y) => {
      const dx = x - cx, dy = y - cy;
      const lx = Math.abs(dx * c + dy * s) - hw;
      const ly = Math.abs(-dx * s + dy * c) - hh;
      const ox = Math.max(lx, 0), oy = Math.max(ly, 0);
      return Math.hypot(ox, oy) + Math.min(Math.max(lx, ly), 0) - radius;
    }, [cx - ext, cy - ext, cx + ext, cy + ext], rgb, alpha);
  }

  // Convex polygon, points in either winding order.
  polygon(pts, rgb, alpha = 1) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      area += ax * by - bx * ay;
    }
    const sign = area > 0 ? 1 : -1;
    const edges = pts.map((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const len = Math.hypot(ex, ey) || 1;
      // outward normal
      return { ax: a[0], ay: a[1], nx: (ey / len) * sign, ny: (-ex / len) * sign };
    });
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    this.shape((x, y) => {
      let d = -Infinity;
      for (const e of edges) d = Math.max(d, (x - e.ax) * e.nx + (y - e.ay) * e.ny);
      return d;
    }, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], rgb, alpha);
  }

  toRGB24() {
    const out = Buffer.alloc(this.w * this.h * 3);
    for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.min(255, Math.max(0, this.buf[i])));
    return out;
  }
}

// Easing helpers implemented here independently of CSS timing functions.
export const ease = {
  linear: (t) => t,
  inOutSine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
};

export const smoothClamp = (t) => clamp01(t);
