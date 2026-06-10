import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it, vi } from "vitest";
import { CandlestickRenderer } from "./CandlestickRenderer";
class SoftwareRasterContext {
    width;
    height;
    pixels;
    path = [];
    state = {
        strokeStyle: "#000000",
        fillStyle: "#000000",
        lineWidth: 1,
        globalAlpha: 1,
    };
    stack = [];
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.pixels = new Uint8Array(width * height * 4);
    }
    set strokeStyle(value) {
        this.state.strokeStyle = value;
    }
    set fillStyle(value) {
        this.state.fillStyle = value;
    }
    set lineWidth(value) {
        this.state.lineWidth = value;
    }
    set globalAlpha(value) {
        this.state.globalAlpha = value;
    }
    save() {
        this.stack.push({ ...this.state });
    }
    restore() {
        const previous = this.stack.pop();
        if (previous) {
            this.state = previous;
        }
    }
    setLineDash(_dash) {
        void _dash;
    }
    beginPath() {
        this.path = [];
    }
    moveTo(x, y) {
        this.path.push({ x, y });
    }
    lineTo(x, y) {
        this.path.push({ x, y });
    }
    stroke() {
        for (let index = 1; index < this.path.length; index += 1) {
            this.drawSegment(this.path[index - 1], this.path[index], this.state.strokeStyle);
        }
    }
    fillRect(x, y, width, height) {
        const color = this.parseColor(this.state.fillStyle);
        const startX = Math.max(0, Math.floor(x));
        const startY = Math.max(0, Math.floor(y));
        const endX = Math.min(this.width, Math.ceil(x + width));
        const endY = Math.min(this.height, Math.ceil(y + height));
        for (let row = startY; row < endY; row += 1) {
            for (let col = startX; col < endX; col += 1) {
                this.setPixel(col, row, color);
            }
        }
    }
    strokeRect(x, y, width, height) {
        const color = this.parseColor(this.state.strokeStyle);
        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = Math.floor(x + width - 1);
        const bottom = Math.floor(y + height - 1);
        for (let col = left; col <= right; col += 1) {
            this.setPixel(col, top, color);
            this.setPixel(col, bottom, color);
        }
        for (let row = top; row <= bottom; row += 1) {
            this.setPixel(left, row, color);
            this.setPixel(right, row, color);
        }
    }
    toPngBuffer() {
        const png = new PNG({ width: this.width, height: this.height });
        png.data = Buffer.from(this.pixels);
        return PNG.sync.write(png);
    }
    drawSegment(start, end, colorValue) {
        const color = this.parseColor(colorValue);
        let x0 = Math.round(start.x);
        let y0 = Math.round(start.y);
        const x1 = Math.round(end.x);
        const y1 = Math.round(end.y);
        const dx = Math.abs(x1 - x0);
        const sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0);
        const sy = y0 < y1 ? 1 : -1;
        let error = dx + dy;
        while (true) {
            this.setPixel(x0, y0, color);
            if (x0 === x1 && y0 === y1) {
                break;
            }
            const twiceError = 2 * error;
            if (twiceError >= dy) {
                error += dy;
                x0 += sx;
            }
            if (twiceError <= dx) {
                error += dx;
                y0 += sy;
            }
        }
    }
    parseColor(raw) {
        const alpha = Math.max(0, Math.min(255, Math.round(this.state.globalAlpha * 255)));
        const normalized = raw.trim().toLowerCase();
        if (normalized.startsWith("#")) {
            const hex = normalized.slice(1);
            if (hex.length === 3) {
                const red = Number.parseInt(hex[0] + hex[0], 16);
                const green = Number.parseInt(hex[1] + hex[1], 16);
                const blue = Number.parseInt(hex[2] + hex[2], 16);
                return [red, green, blue, alpha];
            }
            if (hex.length === 6) {
                const red = Number.parseInt(hex.slice(0, 2), 16);
                const green = Number.parseInt(hex.slice(2, 4), 16);
                const blue = Number.parseInt(hex.slice(4, 6), 16);
                return [red, green, blue, alpha];
            }
        }
        if (normalized === "none" || normalized === "transparent") {
            return [0, 0, 0, 0];
        }
        return [0, 0, 0, alpha];
    }
    setPixel(x, y, color) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return;
        }
        const offset = (y * this.width + x) * 4;
        this.pixels[offset] = color[0];
        this.pixels[offset + 1] = color[1];
        this.pixels[offset + 2] = color[2];
        this.pixels[offset + 3] = color[3];
    }
}
const baselinePath = path.resolve(__dirname, "__fixtures__", "candlestick-baseline.png");
function createPixelContext(width = 220, height = 120) {
    return new SoftwareRasterContext(width, height);
}
function renderCanonicalBaselinePng() {
    const renderer = new CandlestickRenderer();
    const context = createPixelContext();
    const bars = [
        { x: 20, open: 28, high: 33, low: 24, close: 31 },
        { x: 44, open: 31, high: 35, low: 26, close: 27 },
        { x: 68, open: 27, high: 32, low: 25, close: 30 },
        { x: 92, open: 30, high: 37, low: 28, close: 36 },
        { x: 116, open: 36, high: 38, low: 29, close: 31 },
        { x: 140, open: 31, high: 34, low: 27, close: 33 },
    ];
    renderer.render(context, bars, {
        yScale: (value) => 110 - value * 2,
        barWidth: 8,
        mode: "candlestick",
        upColor: "#6BA583",
        downColor: "#FF0000",
    });
    return context.toPngBuffer();
}
function createContextMock() {
    const context = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        setLineDash: vi.fn(),
        set strokeStyle(_value) {
            void _value;
        },
        set fillStyle(_value) {
            void _value;
        },
        set lineWidth(_value) {
            void _value;
        },
        set globalAlpha(_value) {
            void _value;
        },
    };
    return context;
}
const baseData = [
    { x: 100, open: 10, high: 25, low: 5, close: 20 },
];
describe("CandlestickRenderer", () => {
    it("draws wick and candle body in candlestick mode", () => {
        const ctx = createContextMock();
        const renderer = new CandlestickRenderer();
        renderer.render(ctx, baseData, {
            yScale: (value) => value,
            barWidth: 6,
            mode: "candlestick",
        });
        expect(ctx.moveTo).toHaveBeenCalled();
        expect(ctx.lineTo).toHaveBeenCalled();
        expect(ctx.fillRect).toHaveBeenCalledWith(97, 10, 6, 10);
        expect(ctx.strokeRect).toHaveBeenCalledWith(97, 10, 6, 10);
    });
    it("draws open and close ticks in ohlc mode", () => {
        const ctx = createContextMock();
        const renderer = new CandlestickRenderer();
        renderer.render(ctx, baseData, {
            yScale: (value) => value,
            barWidth: 6,
            mode: "ohlc",
        });
        expect(ctx.fillRect).not.toHaveBeenCalled();
        expect(ctx.strokeRect).not.toHaveBeenCalled();
        expect(ctx.moveTo).toHaveBeenCalledWith(97, 10);
        expect(ctx.lineTo).toHaveBeenCalledWith(100, 10);
        expect(ctx.moveTo).toHaveBeenCalledWith(100, 20);
        expect(ctx.lineTo).toHaveBeenCalledWith(103, 20);
    });
    it("draws hollow up candles without fill", () => {
        const ctx = createContextMock();
        const renderer = new CandlestickRenderer();
        renderer.render(ctx, baseData, {
            yScale: (value) => value,
            barWidth: 6,
            mode: "hollow",
        });
        expect(ctx.fillRect).not.toHaveBeenCalled();
        expect(ctx.strokeRect).toHaveBeenCalledWith(97, 10, 6, 10);
    });
    it("skips hidden and invalid bars", () => {
        const ctx = createContextMock();
        const renderer = new CandlestickRenderer();
        renderer.render(ctx, [
            { x: 100, open: 10, high: 20, low: 8, close: 15, visible: false },
            { x: 120, open: Number.NaN, high: 20, low: 8, close: 15 },
        ], {
            yScale: (value) => value,
        });
        expect(ctx.moveTo).not.toHaveBeenCalled();
        expect(ctx.fillRect).not.toHaveBeenCalled();
        expect(ctx.strokeRect).not.toHaveBeenCalled();
    });
    it("matches committed pixel baseline for canonical candlestick sample", () => {
        const actualPng = renderCanonicalBaselinePng();
        if (process.env.UPDATE_CANVAS_BASELINE === "1") {
            fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
            fs.writeFileSync(baselinePath, actualPng);
        }
        expect(fs.existsSync(baselinePath)).toBe(true);
        const expectedPng = fs.readFileSync(baselinePath);
        expect(actualPng.equals(expectedPng)).toBe(true);
    });
});
