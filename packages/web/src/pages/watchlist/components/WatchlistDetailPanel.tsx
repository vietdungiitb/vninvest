import { Button } from "@/components/ui/button";
import { useWatchlist } from "./WatchlistContext";
import { VNInvestCharts } from "../../../components/vninvestcharts/src/widget/VNInvestCharts.js";

const Chart = VNInvestCharts as any;

export function WatchlistDetailPanel() {
  const { activeSymbolDetail, setActiveSymbolDetail } = useWatchlist();

  if (!activeSymbolDetail) return null;

  return (
    <aside className="w-[350px] flex flex-col gap-4 border-l border-slate-800 bg-slate-900/60 backdrop-blur-xl h-full p-4 overflow-y-auto shrink-0 animate-in slide-in-from-right duration-300">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-slate-100 font-mono tracking-tight flex items-center gap-2">
          {activeSymbolDetail}
          <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">
            Realtime
          </span>
        </h2>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-full"
          onClick={() => setActiveSymbolDetail(null)}
        >
          ✕
        </Button>
      </div>

      <div className="w-full h-[280px] rounded-lg border border-slate-800 overflow-hidden bg-slate-950/80 shadow-inner relative">
        <Chart 
          symbol={activeSymbolDetail} 
          theme="dark" 
          hideToolbar={true} // Compact mode
          hideFooter={true}
        />
      </div>

      {/* AI Advisor Panel Placeholder */}
      <div className="flex flex-col gap-2 p-4 rounded-lg border border-indigo-500/30 bg-indigo-950/20 mt-2 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
        <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
          <span>🧠</span> AI Advisor
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong>Nhận định nhanh:</strong> Dòng tiền hiện tại vào mã {activeSymbolDetail} đang duy trì sức mạnh. MACD Histogram mở rộng cho thấy xu hướng Bullish trong ngắn hạn.
        </p>
      </div>

      {/* Whale Alerts Panel Placeholder */}
      <div className="flex flex-col gap-2 p-4 rounded-lg border border-slate-800 bg-slate-950/40 mt-2">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <span>🐋</span> Whale Order Flow
        </h3>
        <ul className="flex flex-col gap-2 mt-1">
          <li className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-mono">14:28:10</span>
            <span className="text-emerald-400 font-bold">MUA 150,000</span>
          </li>
          <li className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-mono">14:15:05</span>
            <span className="text-rose-400 font-bold">BÁN 80,000</span>
          </li>
          <li className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-mono">13:50:22</span>
            <span className="text-emerald-400 font-bold">MUA 220,000</span>
          </li>
        </ul>
      </div>
      
      {/* News Feed Placeholder */}
      <div className="flex flex-col gap-3 p-4 rounded-lg border border-slate-800 bg-slate-950/40 mt-2 flex-grow">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <span>📰</span> Tin tức liên quan
        </h3>
        <div className="flex flex-col gap-3">
          <article className="border-b border-slate-800 pb-2">
            <a href="#" className="text-xs font-semibold text-cyan-400 hover:underline line-clamp-2">
              Khối ngoại mua ròng {activeSymbolDetail} phiên thứ 3 liên tiếp.
            </a>
            <span className="text-[10px] text-slate-500 mt-1 block">15 phút trước - CafeF</span>
          </article>
          <article className="">
            <a href="#" className="text-xs font-semibold text-cyan-400 hover:underline line-clamp-2">
              Phân tích kỹ thuật {activeSymbolDetail}: Vượt cản chéo trung hạn.
            </a>
            <span className="text-[10px] text-slate-500 mt-1 block">2 giờ trước - FireAnt</span>
          </article>
        </div>
      </div>
    </aside>
  );
}
