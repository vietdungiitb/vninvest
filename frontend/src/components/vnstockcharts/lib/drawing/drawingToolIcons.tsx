import React from "react";

/**
 * drawingToolIcons.tsx — DT-Icon Registry (Widget-First Rule)
 * 
 * Chứa bộ icon SVG chuyên biệt, sắc nét riêng cho từng công cụ vẽ đặc thù.
 * Giúp giải quyết triệt để việc dùng chung icon hàng loạt của hệ thống cũ.
 * 
 * Luật: src/lib MUST NOT import from src/demo. File này sống tại src/lib để widget tiêu thụ trực tiếp.
 */
export const drawingToolIcons: Record<string, React.ReactNode> = {
	xabcdPattern: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Mẫu Harmonic XABCD: Hai cánh đối xứng tam giác qua điểm B */}
			<polygon points="2,12 5,4 8,9" stroke="currentColor" strokeWidth="1.2" fill="rgba(8, 145, 178, 0.08)" strokeLinejoin="round" />
			<polygon points="8,9 11,5 14,11" stroke="currentColor" strokeWidth="1.2" fill="rgba(8, 145, 178, 0.08)" strokeLinejoin="round" />
			<line x1="2" y1="12" x2="14" y2="11" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
			<circle cx="2" cy="12" r="0.8" fill="currentColor" />
			<circle cx="5" cy="4" r="0.8" fill="currentColor" />
			<circle cx="8" cy="9" r="0.8" fill="currentColor" />
			<circle cx="11" cy="5" r="0.8" fill="currentColor" />
			<circle cx="14" cy="11" r="0.8" fill="currentColor" />
		</svg>
	),
	cypherPattern: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Mẫu Harmonic Cypher: Tam giác trượt với điểm C cao hơn A */}
			<polygon points="2,11 6,3 9,9" stroke="currentColor" strokeWidth="1.2" fill="rgba(8, 145, 178, 0.06)" strokeLinejoin="round" />
			<polygon points="9,9 12,2 14,12" stroke="currentColor" strokeWidth="1.2" fill="rgba(8, 145, 178, 0.06)" strokeLinejoin="round" />
			<circle cx="2" cy="11" r="0.8" fill="currentColor" />
			<circle cx="6" cy="3" r="0.8" fill="currentColor" />
			<circle cx="9" cy="9" r="0.8" fill="currentColor" />
			<circle cx="12" cy="2" r="0.8" fill="currentColor" />
			<circle cx="14" cy="12" r="0.8" fill="currentColor" />
		</svg>
	),
	headAndShoulders: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Vai trái - Đầu - Vai phải */}
			<path d="M1.5,12 L4,8 L6.5,10 L9,4 L11.5,9 L14,7.5 L15,9" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			<line x1="1.5" y1="12" x2="15" y2="9.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
			<circle cx="4" cy="8" r="0.8" fill="currentColor" />
			<circle cx="9" cy="4" r="0.9" fill="currentColor" />
			<circle cx="14" cy="7.5" r="0.8" fill="currentColor" />
		</svg>
	),
	trianglePattern: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* 2 Đường hội tụ và zigzag nến bên trong */}
			<line x1="2" y1="3" x2="14" y2="7.5" stroke="currentColor" strokeWidth="1.2" />
			<line x1="2" y1="13" x2="14" y2="8.5" stroke="currentColor" strokeWidth="1.2" />
			<polyline points="3,5 5,11 8,7 10,10 12,8" stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="1.5 1" />
		</svg>
	),
	threeDrivesPattern: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* 3 Đợt sóng đẩy lên liên tiếp */}
			<path d="M1.5,13 L4,8 L5.5,11 L8.5,6 L10,9 L13.5,4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			<circle cx="4" cy="8" r="0.8" fill="currentColor" />
			<circle cx="8" cy="6" r="0.8" fill="currentColor" />
			<circle cx="13.5" cy="4" r="0.8" fill="currentColor" />
		</svg>
	),
	elliottImpulse: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Sóng xung lực Elliott: 0 -> 1 -> 2 -> 3 -> 4 -> 5 */}
			<polyline points="1.5,13 4,7 5.5,10.5 10.5,3.5 12,8 14.5,4.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			<text x="4.2" y="6" fontSize="7" fontWeight="bold" fill="currentColor">1</text>
			<text x="5.8" y="12" fontSize="7" fontWeight="bold" fill="currentColor">2</text>
			<text x="10.8" y="3.5" fontSize="7" fontWeight="bold" fill="currentColor">3</text>
			<text x="12.3" y="9" fontSize="7" fontWeight="bold" fill="currentColor">4</text>
			<text x="14.8" y="4.5" fontSize="7" fontWeight="bold" fill="currentColor">5</text>
		</svg>
	),
	elliottCorrection: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Sóng điều chỉnh Elliott: A -> B -> C */}
			<polyline points="2,4 6,10 9,6.5 13.5,12" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			<text x="5.8" y="12" fontSize="7" fontWeight="bold" fill="currentColor">A</text>
			<text x="8.8" y="5.5" fontSize="7" fontWeight="bold" fill="currentColor">B</text>
			<text x="13.8" y="13" fontSize="7" fontWeight="bold" fill="currentColor">C</text>
		</svg>
	),
	elliottTriangle: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Sóng Elliott tam giác co hẹp A-B-C-D-E */}
			<path d="M1.5,4 L5.5,11.5 L8.5,6 L11.5,9.5 L13,7.5 L14.5,8.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			<line x1="1" y1="3" x2="15" y2="8" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" />
			<line x1="1" y1="13" x2="15" y2="9" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" />
		</svg>
	),
	elliottDoubleCombo: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Sóng kết hợp đôi W-X-Y */}
			<polyline points="1.5,5 5,11 7.5,7 11.5,12" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			<text x="4.8" y="13" fontSize="7" fontWeight="bold" fill="currentColor">W</text>
			<text x="7.8" y="6" fontSize="7" fontWeight="bold" fill="currentColor">X</text>
			<text x="11.8" y="13" fontSize="7" fontWeight="bold" fill="currentColor">Y</text>
		</svg>
	),
	elliottTripleCombo: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Sóng kết hợp ba W-X-Y-X-Z */}
			<path d="M1.5,5 L4.5,10 L6,7 L8.5,11.5 L10,8.5 L12.5,12.5" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			<text x="4" y="12" fontSize="6.5" fontWeight="bold" fill="currentColor">W</text>
			<text x="8" y="13" fontSize="6.5" fontWeight="bold" fill="currentColor">Y</text>
			<text x="12" y="14" fontSize="6.5" fontWeight="bold" fill="currentColor">Z</text>
		</svg>
	),
	fibChannel: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Kênh song song Fibonacci gồm nhiều dải */}
			<line x1="1" y1="4" x2="15" y2="9" stroke="currentColor" strokeWidth="1.4" />
			<line x1="1" y1="6.5" x2="15" y2="11.5" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
			<line x1="1" y1="8" x2="15" y2="13" stroke="currentColor" strokeWidth="1.2" />
			<line x1="1" y1="10.5" x2="15" y2="15.5" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
		</svg>
	),
	fibSpeedResistanceFan: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Quạt Fib tốc độ gồm 4 tia tỏa ra */}
			<line x1="2" y1="13" x2="14" y2="2" stroke="currentColor" strokeWidth="1.2" />
			<line x1="2" y1="13" x2="14" y2="5" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
			<line x1="2" y1="13" x2="14" y2="8" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
			<line x1="2" y1="13" x2="14" y2="11" stroke="currentColor" strokeWidth="0.8" />
			<circle cx="2" cy="13" r="1" fill="currentColor" />
		</svg>
	),
	trendBasedFibTime: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Múi giờ Fib xu hướng */}
			<line x1="2" y1="13" x2="7" y2="5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
			<line x1="7" y1="5" x2="12" y2="9" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
			<line x1="2" y1="1.5" x2="2" y2="14.5" stroke="currentColor" strokeWidth="1.2" />
			<line x1="5" y1="1.5" x2="5" y2="14.5" stroke="currentColor" strokeWidth="0.9" />
			<line x1="9" y1="1.5" x2="9" y2="14.5" stroke="currentColor" strokeWidth="0.9" />
			<line x1="14" y1="1.5" x2="14" y2="14.5" stroke="currentColor" strokeWidth="1.2" />
		</svg>
	),
	fibCircles: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Vòng tròn đồng tâm Fib */}
			<circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="0.8" />
			<circle cx="8" cy="8" r="4.8" stroke="currentColor" strokeWidth="1.2" />
			<circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 2" />
			<line x1="8" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
			<circle cx="8" cy="8" r="1" fill="currentColor" />
		</svg>
	),
	fibSpiral: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Xoắn ốc Fibonacci vàng tuyệt đẹp */}
			<path d="M 8,8 A 0.8,0.8 0 0,1 8,6.4 A 1.6,1.6 0 0,1 9.6,8 A 2.6,2.6 0 0,1 8,10.6 A 4.2,4.2 0 0,1 3.8,8 A 6.8,6.8 0 0,1 8,1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<circle cx="8" cy="8" r="0.9" fill="currentColor" />
		</svg>
	),
	fibSpeedResistanceArcs: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Cung cản Fib tốc độ/kháng cự */}
			<path d="M1.5,13.5 A 12,12 0 0,1 13.5,1.5" stroke="currentColor" strokeWidth="1.2" />
			<path d="M1.5,13.5 A 8,8 0 0,1 9.5,5.5" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
			<path d="M1.5,13.5 A 5,5 0 0,1 6.5,8.5" stroke="currentColor" strokeWidth="0.8" />
			<line x1="1.5" y1="13.5" x2="11.5" y2="3.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
			<circle cx="1.5" cy="13.5" r="1.2" fill="currentColor" />
		</svg>
	),
	fibWedge: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Nêm Fibonacci */}
			<line x1="2" y1="2" x2="14" y2="6.5" stroke="currentColor" strokeWidth="1.2" />
			<line x1="2" y1="14" x2="14" y2="8.5" stroke="currentColor" strokeWidth="1.2" />
			<path d="M 4,2.8 A 5.5,5.5 0 0,0 4,13.2" stroke="currentColor" strokeWidth="0.8" />
			<path d="M 7,3.8 A 4.2,4.2 0 0,0 7,12.2" stroke="currentColor" strokeWidth="1.2" />
			<path d="M 10,4.8 A 3.1,3.1 0 0,0 10,11.2" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" />
		</svg>
	),
	pitchfan: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Pitchfan: Tỏa quạt từ Andrew Pitchfork */}
			<line x1="3" y1="8" x2="14" y2="3" stroke="currentColor" strokeWidth="1.2" />
			<line x1="3" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
			<line x1="3" y1="8" x2="14" y2="13" stroke="currentColor" strokeWidth="1.2" />
			<circle cx="3" cy="8" r="1.2" fill="currentColor" />
		</svg>
	),
	gannFan: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Quạt Gann gồm 5 tia góc đối xứng từ 1x8 đến 8x1 */}
			<line x1="1" y1="14" x2="15" y2="1" stroke="currentColor" strokeWidth="1.3" />
			<line x1="1" y1="14" x2="15" y2="5" stroke="currentColor" strokeWidth="0.9" />
			<line x1="1" y1="14" x2="15" y2="9" stroke="currentColor" strokeWidth="0.9" strokeDasharray="3 2" />
			<line x1="1" y1="14" x2="15" y2="12" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 2" />
			<line x1="1" y1="14" x2="8" y2="1" stroke="currentColor" strokeWidth="0.9" />
			<line x1="1" y1="14" x2="4" y2="1" stroke="currentColor" strokeWidth="0.8" />
			<circle cx="1" cy="14" r="1" fill="currentColor" />
		</svg>
	),
	gannBox: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Hộp Gann: Hình vuông có lưới chéo và ngang ở giữa */}
			<rect x="2" y="2" width="12" height="12" stroke="currentColor" strokeWidth="1.2" />
			<line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="0.8" />
			<line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="0.8" />
			<line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" />
			<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" />
		</svg>
	),
	gannSquare: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Gann Square */}
			<rect x="2" y="2" width="12" height="12" stroke="currentColor" strokeWidth="1.4" />
			<line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" />
			<line x1="10" y1="2" x2="10" y2="14" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" />
			<line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" />
			<line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" />
		</svg>
	),
	gannSquareFixed: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Gann Square Fixed */}
			<rect x="3" y="3" width="10" height="10" stroke="currentColor" strokeWidth="1.4" />
			<line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="0.9" />
			<line x1="3" y1="13" x2="13" y2="3" stroke="currentColor" strokeWidth="0.9" />
			<circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
		</svg>
	),
	cyclicLines: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Các đường dọc chu kỳ song song cách đều */}
			<line x1="2" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.2" />
			<line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" strokeWidth="1.2" />
			<line x1="10" y1="2" x2="10" y2="14" stroke="currentColor" strokeWidth="1.2" />
			<line x1="14" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.2" />
		</svg>
	),
	timeCycles: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Nửa đường tròn chu kỳ thời gian liên tiếp */}
			<path d="M1,12 A 3.25,3.25 0 0,1 7.5,12" stroke="currentColor" strokeWidth="1.2" fill="none" />
			<path d="M7.5,12 A 3.25,3.25 0 0,1 14,12" stroke="currentColor" strokeWidth="1.2" fill="none" />
			<circle cx="1" cy="12" r="0.8" fill="currentColor" />
			<circle cx="7.5" cy="12" r="0.8" fill="currentColor" />
			<circle cx="14" cy="12" r="0.8" fill="currentColor" />
		</svg>
	),
	sineLine: (
		<svg width="15" height="15" viewBox="0 0 16 16" fill="none">
			{/* Đường sóng hình sin mượt mà */}
			<path d="M1,8 C 2.5,2 4.5,2 6,8 C 7.5,14 9.5,14 11,8 C 12.5,2 14.5,2 15,5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
		</svg>
	),
};
