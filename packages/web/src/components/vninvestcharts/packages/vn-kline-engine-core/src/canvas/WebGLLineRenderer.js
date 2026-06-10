function hexToRgba(color) {
    const normalized = color.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/i.test(normalized)) {
        const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
        const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
        const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
        return [r, g, b, 1];
    }
    return [0.16, 0.38, 1, 1];
}
function buildThickLineVertices(points, width) {
    if (points.length < 2) {
        return new Float32Array();
    }
    const half = Math.max(0.5, width / 2);
    const vertices = [];
    for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index];
        const b = points[index + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        if (!Number.isFinite(length) || length <= 0) {
            continue;
        }
        const nx = -dy / length;
        const ny = dx / length;
        const ox = nx * half;
        const oy = ny * half;
        // Two triangles per segment (rectangle strip for thick line)
        vertices.push(a.x + ox, a.y + oy, a.x - ox, a.y - oy, b.x + ox, b.y + oy, b.x + ox, b.y + oy, a.x - ox, a.y - oy, b.x - ox, b.y - oy);
    }
    return new Float32Array(vertices);
}
const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
uniform vec2 u_resolution;
void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
}
`;
const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec4 u_color;
void main() {
  gl_FragColor = u_color;
}
`;
export class WebGLLineRenderer {
    gl;
    program;
    buffer;
    positionLocation;
    resolutionLocation;
    colorLocation;
    constructor(canvas) {
        const webglCanvas = canvas;
        this.gl = webglCanvas.getContext?.("webgl") ?? null;
        if (!this.gl) {
            this.program = null;
            this.buffer = null;
            this.positionLocation = -1;
            this.resolutionLocation = null;
            this.colorLocation = null;
            return;
        }
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
        if (!vertexShader || !fragmentShader) {
            this.program = null;
            this.buffer = null;
            this.positionLocation = -1;
            this.resolutionLocation = null;
            this.colorLocation = null;
            return;
        }
        const program = this.gl.createProgram();
        if (!program) {
            this.program = null;
            this.buffer = null;
            this.positionLocation = -1;
            this.resolutionLocation = null;
            this.colorLocation = null;
            return;
        }
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            this.gl.deleteProgram(program);
            this.program = null;
            this.buffer = null;
            this.positionLocation = -1;
            this.resolutionLocation = null;
            this.colorLocation = null;
            return;
        }
        this.program = program;
        this.buffer = this.gl.createBuffer();
        this.positionLocation = this.gl.getAttribLocation(program, "a_position");
        this.resolutionLocation = this.gl.getUniformLocation(program, "u_resolution");
        this.colorLocation = this.gl.getUniformLocation(program, "u_color");
    }
    get isAvailable() {
        return this.gl !== null && this.program !== null && this.buffer !== null && this.positionLocation >= 0;
    }
    drawLine(points, style) {
        if (!this.isAvailable || !this.gl || !this.program || !this.buffer) {
            return;
        }
        if (points.length < 2) {
            return;
        }
        const vertices = buildThickLineVertices(points, style.width);
        if (vertices.length === 0) {
            return;
        }
        const [r, g, b, a] = hexToRgba(style.color);
        this.gl.useProgram(this.program);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STREAM_DRAW);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.uniform2f(this.resolutionLocation, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.uniform4f(this.colorLocation, r, g, b, a);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, vertices.length / 2);
    }
    flush() {
        if (!this.gl) {
            return;
        }
        this.gl.flush();
    }
    dispose() {
        if (!this.gl) {
            return;
        }
        if (this.buffer) {
            this.gl.deleteBuffer(this.buffer);
        }
        if (this.program) {
            this.gl.deleteProgram(this.program);
        }
    }
    createShader(type, source) {
        if (!this.gl) {
            return null;
        }
        const shader = this.gl.createShader(type);
        if (!shader) {
            return null;
        }
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
}
