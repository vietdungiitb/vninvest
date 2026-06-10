const SaveChartAsImage = {
    save(doc, container, background, isDark, cb) {
        const containerRect = container.getBoundingClientRect();
        const watermarkHeight = 40;
        // 1. Create composite canvas
        const canvas = doc.createElement("canvas");
        canvas.width = containerRect.width;
        canvas.height = containerRect.height + watermarkHeight;
        const context = canvas.getContext("2d");
        // 2. Draw watermark background
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        // Divider line
        context.strokeStyle = isDark ? "#2a2a2a" : "#e0e3eb";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, watermarkHeight);
        context.lineTo(canvas.width, watermarkHeight);
        context.stroke();
        // Brand logo (left)
        context.font = "bold 12px Arial, sans-serif";
        context.fillStyle = "#2962ff";
        context.fillText("VNINVESTCHARTS", 12, 24);
        // Metadata (right)
        context.font = "10px Arial, sans-serif";
        context.fillStyle = isDark ? "#a0a0a0" : "#707070";
        context.textAlign = "right";
        context.fillText(`Charts powered by VNInvestCharts • ${new Date().toUTCString()}`, canvas.width - 12, 24);
        context.textAlign = "left"; // Reset
        // 3. Draw HTML text elements (OHLC Header)
        const ohlcEl = container.querySelector(".vnsc-ohlc-header");
        if (ohlcEl) {
            const ohlcRect = ohlcEl.getBoundingClientRect();
            const relativeY = ohlcRect.top - containerRect.top + watermarkHeight;
            context.fillStyle = isDark ? "#111820" : "#f8f9fa";
            context.fillRect(0, relativeY, containerRect.width, ohlcRect.height);
            const symbolText = ohlcEl.querySelector("strong")?.textContent || "";
            const timeframeText = ohlcEl.querySelector(".vnsc-ohlc-header__timeframe")?.textContent || "";
            const valuesText = ohlcEl.querySelector(".vnsc-ohlc-header__values")?.textContent || ohlcEl.childNodes[1]?.textContent || "";
            let startX = 12;
            context.font = "bold 13px Arial, sans-serif";
            context.fillStyle = isDark ? "#e0e0e0" : "#131722";
            context.fillText(symbolText, startX, relativeY + 20);
            startX += context.measureText(symbolText).width + 8;
            if (timeframeText) {
                context.font = "bold 11px Arial, sans-serif";
                context.fillStyle = "#2962ff";
                context.fillText(`(${timeframeText})`, startX, relativeY + 20);
                startX += context.measureText(`(${timeframeText})`).width + 12;
            }
            context.font = "12px Arial, sans-serif";
            context.fillStyle = isDark ? "#a0a0a0" : "#707070";
            context.fillText(valuesText, startX, relativeY + 20);
        }
        // 4. Draw canvases using root-relative offsets
        const canvasList = container.getElementsByTagName("canvas");
        for (let i = 0; i < canvasList.length; i++) {
            const each = canvasList[i];
            if (each) {
                const rect = each.getBoundingClientRect();
                const relativeX = rect.left - containerRect.left;
                const relativeY = rect.top - containerRect.top + watermarkHeight;
                context.drawImage(each, relativeX, relativeY);
            }
        }
        // 5. Draw SVGs (e.g. drawings)
        const svgList = container.getElementsByTagName("svg");
        let pendingSvgs = 0;
        const drawImageOnCanvas = (url, rx, ry) => {
            const img = new Image();
            img.onload = () => {
                context.drawImage(img, rx, ry);
                URL.revokeObjectURL(url);
                pendingSvgs--;
                if (pendingSvgs === 0)
                    cb(canvas.toDataURL("image/png"));
            };
            img.src = url;
        };
        const svgElementsToDraw = [];
        for (let i = 0; i < svgList.length; i++) {
            const svg = svgList[i];
            if (svg && svg.getAttribute("data-rsc-fork-children") !== "true") {
                const rect = svg.getBoundingClientRect();
                const rx = rect.left - containerRect.left;
                const ry = rect.top - containerRect.top + watermarkHeight;
                const svgString = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
                const url = URL.createObjectURL(svgBlob);
                svgElementsToDraw.push({ url, rx, ry });
            }
        }
        if (svgElementsToDraw.length === 0) {
            cb(canvas.toDataURL("image/png"));
        }
        else {
            pendingSvgs = svgElementsToDraw.length;
            svgElementsToDraw.forEach(({ url, rx, ry }) => drawImageOnCanvas(url, rx, ry));
        }
    },
    saveChartAsImage(container, isDark) {
        const bg = isDark ? "#0a0e14" : "#ffffff";
        this.save(document, container, bg, isDark, (src) => {
            const a = document.createElement("a");
            a.setAttribute("href", src);
            a.setAttribute("download", "Chart-Viewport.png");
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }
};
export default SaveChartAsImage;
