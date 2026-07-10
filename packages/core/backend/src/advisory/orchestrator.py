import logging
import json
import asyncio
import httpx
from django.conf import settings
from market_serving.models import SymbolSnapshot, SessionFacts
from .advisory_helpers import (
    _parse_prompt_config,
    build_ohlcv_lookback_context,
    build_cvd_lookback_context
)

logger = logging.getLogger(__name__)


async def call_agent_async(
    client: httpx.AsyncClient,
    agent_name: str,
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    ai_model: str,
    temperature: float,
    max_tokens: int,
    endpoint: str
) -> str:
    """Helper to asynchronously invoke the LLM for a specific sub-agent."""
    headers = {
        "Content-Type": "application/json"
    }
    if api_key and api_key != 'no-key-needed':
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {
        "model": ai_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    logger.info(f"Triggering async LLM request for sub-agent: {agent_name}")
    try:
        response = await client.post(endpoint, headers=headers, json=payload, timeout=25.0)
        response.raise_for_status()
        res_data = response.json()
        choice = res_data['choices'][0]['message']['content']
        return choice.strip()
    except Exception as e:
        logger.error(f"LLM request failed for sub-agent {agent_name}: {e}")
        return f"Không thể lấy phân tích từ {agent_name} do lỗi hệ thống: {str(e)}"


class AdvisoryOrchestrator:
    @classmethod
    def run(cls, effective_context: dict, symbol: str) -> dict:
        """
        Coordinates Technical, Flow, and Sentiment agents in parallel,
        incorporating historical lookback context and dynamic source routing configurations.
        """
        symbol = symbol.strip().upper()
        # Parse and resolve prompt configuration
        prompt_config = _parse_prompt_config(effective_context.get('prompt_config'))
        sources = prompt_config["sources"]

        # Fetch latest price snapshot
        snapshot = SymbolSnapshot.objects.filter(symbol=symbol).order_by('-session_date').first()
        price = float(snapshot.price) if snapshot else 0.0
        price_change_pct = float(snapshot.price_change_pct) * 100 if snapshot else 0.0
        high_price = float(snapshot.high) if snapshot and snapshot.high else price
        low_price = float(snapshot.low) if snapshot and snapshot.low else price
        volume = int(snapshot.volume) if snapshot else 0

        # Fetch latest session flow facts
        facts = SessionFacts.objects.filter(symbol=symbol).order_by('-session_date').first()
        cvd = float(facts.cvd_normalized) if facts else 0.0
        buy_strength = float(facts.buy_strength) if facts else 0.0
        inst_strength = float(facts.institutional_strength) if facts else 0.0
        whale_flow = int(facts.whale_net_flow) if facts else 0

        # Build lookback contexts dynamically based on enabled flags
        ohlcv_context = ""
        if sources["technical"]["enabled"]:
            tech_lookback = sources["technical"]["lookback"]
            ohlcv_context = build_ohlcv_lookback_context(symbol, limit=tech_lookback)

        cvd_context = ""
        if sources["whale"]["enabled"] or sources["dark_flow"]["enabled"]:
            whale_lookback = max(sources["whale"]["lookback"], sources["dark_flow"]["lookback"])
            cvd_context = build_cvd_lookback_context(symbol, limit=whale_lookback)

        db_data = {
            "price": price,
            "price_change_pct": price_change_pct,
            "high_price": high_price,
            "low_price": low_price,
            "volume": volume,
            "cvd": cvd,
            "buy_strength": buy_strength,
            "inst_strength": inst_strength,
            "whale_flow": whale_flow,
            "ohlcv_context": ohlcv_context,
            "cvd_context": cvd_context,
        }

        return asyncio.run(cls.run_async(effective_context, symbol, db_data))

    @classmethod
    async def run_async(cls, effective_context: dict, symbol: str, db_data: dict) -> dict:
        symbol = symbol.strip().upper()
        ai_model = effective_context.get('ai_model') or 'gpt-4o-mini'
        api_key = effective_context.get('api_key')
        temperature = effective_context.get('temperature') or 0.3
        max_tokens = effective_context.get('max_tokens') or 1000
        language = effective_context.get('language') or 'vi'

        # Extract values from pre-fetched db_data
        price = db_data["price"]
        price_change_pct = db_data["price_change_pct"]
        high_price = db_data["high_price"]
        low_price = db_data["low_price"]
        volume = db_data["volume"]
        cvd = db_data["cvd"]
        buy_strength = db_data["buy_strength"]
        inst_strength = db_data["inst_strength"]
        whale_flow = db_data["whale_flow"]
        ohlcv_context = db_data["ohlcv_context"]
        cvd_context = db_data["cvd_context"]

        # Load dynamic custom prompts from metadata or fallback to standard templates
        metadata = effective_context.get('metadata') or {}
        
        tech_sys = metadata.get('technical_agent_prompt') or 'Bạn là chuyên gia phân tích kỹ thuật chứng khoán cho mã {symbol}.'
        flow_sys = metadata.get('flow_agent_prompt') or 'Bạn là chuyên gia phân tích dòng tiền lớn và dấu vết cá mập cho mã {symbol}.'
        sent_sys = metadata.get('sentiment_agent_prompt') or 'Bạn là chuyên gia phân tích tâm lý thị trường cho mã {symbol}.'
        synth_sys = metadata.get('synthesis_agent_prompt') or 'Bạn là Giám đốc Phân tích tổng hợp khuyến nghị cho mã {symbol}.'

        provider = effective_context.get('ai_provider', 'openai')
        custom_endpoint = effective_context.get('custom_endpoint', '')

        # Local provider: allow empty API key
        is_local = provider == 'local'
        if is_local:
            api_key = api_key or 'no-key-needed'

        # Check if we should use simulated fallback
        is_mock = (not api_key or api_key.lower() in ('mock', 'mock_key') or api_key.startswith('mock_'))
        if is_mock:
            if not getattr(settings, 'DEBUG', False):
                raise ValueError("Không tìm thấy API Key cấu hình cho AI Provider.")
            
            logger.info("Using simulated fallback response in DEBUG mode")
            trend_label = "MUA" if cvd > 0.1 else "BÁN" if cvd < -0.1 else "TRUNG LẬP"
            if language == 'en':
                trend_label = "BUY" if cvd > 0.1 else "SELL" if cvd < -0.1 else "NEUTRAL"
                text = (
                    f"AI analysis for {symbol} (Price: {price:,.0f} VND, {price_change_pct:+.2f}%). "
                    f"Whale flow registered {whale_flow:,.0f} VND with CVD at {cvd:.2f}. "
                    f"Technical signals point to a {trend_label.lower()} posture."
                )
                return {
                    'advisory_text': text,
                    'ai_model': ai_model,
                    'tokens_used': 150,
                    'technical_analysis': f"Technical analysis for {symbol} shows price trading between {low_price:,.0f} and {high_price:,.0f} VND. Support is established at {low_price:,.0f} VND.",
                    'whale_analysis': f"Whale flow analysis shows net flow of {whale_flow:,.0f} VND. Institutional strength is calibrated at {inst_strength * 100:.1f}%.",
                    'sentiment_analysis': f"Market sentiment for {symbol} is currently {trend_label.lower()} with normalized CVD of {cvd:.2f}.",
                    'recommendation': f"Recommendation is to maintain a {trend_label.lower()} bias. Monitor resistance level near {high_price:,.0f} VND.",
                    'summary': text
                }
            else:
                text = (
                    f"Bản phân tích AI cho mã {symbol} (Thị giá: {price:,.0f} VND, biến động {price_change_pct:+.2f}%). "
                    f"Dòng tiền cá mập đạt {whale_flow:,.0f} VND ròng với chỉ số CVD {cvd:.2f}. "
                    f"Các tín hiệu kỹ thuật cho thấy xu hướng {trend_label}."
                )
                return {
                    'advisory_text': text,
                    'ai_model': ai_model,
                    'tokens_used': 150,
                    'technical_analysis': f"Phân tích kỹ thuật mã {symbol} ghi nhận biên độ giao động từ {low_price:,.0f} đến {high_price:,.0f} VND. Ngưỡng hỗ trợ tĩnh hình thành quanh {low_price:,.0f} VND.",
                    'whale_analysis': f"Dòng tiền lớn (Whale Flow) ghi nhận ròng {whale_flow:,.0f} VND. Cường độ tổ chức (Institutional Strength) duy trì ở mức {inst_strength * 100:.1f}%.",
                    'sentiment_analysis': f"Tâm lý chung đối với {symbol} nghiêng về trạng thái {trend_label.lower()} với lực mua ròng đạt {buy_strength * 100:.1f}% tổng khớp.",
                    'recommendation': f"Khuyến nghị duy trì trạng thái {trend_label.lower()}. Tiếp tục quan sát biến động quanh ngưỡng kháng cự {high_price:,.0f} VND.",
                    'summary': text
                }

        # Resolve endpoints
        if provider == 'local':
            if custom_endpoint:
                endpoint = custom_endpoint.rstrip('/') + '/chat/completions'
            else:
                endpoint = "http://localhost:11434/v1/chat/completions"
        elif provider == 'gemini' or ai_model.lower().startswith('gemini'):
            endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        else:
            endpoint = "https://api.openai.com/v1/chat/completions"

        # Build user prompts for each sub-agent
        tech_user_prompt = f"""
Analyze the technical posture for symbol {symbol}:
- Current Price: {price:,.2f} VND (Change: {price_change_pct:+.2f}%)
- Session High: {high_price:,.2f} VND, Session Low: {low_price:,.2f} VND, Volume: {volume:,}
{ohlcv_context}
Based on these metrics, write a technical analysis block in {"Vietnamese" if language == 'vi' else "English"}.
"""

        flow_user_prompt = f"""
Analyze the money flow & large transactions for symbol {symbol}:
- Cumulative CVD Normalized: {cvd:.3f}
- Buy Strength: {buy_strength:.3f}
- Institutional Strength: {inst_strength:.3f}
- Whale Net Flow (VND): {whale_flow:,}
{cvd_context}
Based on these metrics, write a flow analysis block in {"Vietnamese" if language == 'vi' else "English"}.
"""

        sentiment_user_prompt = f"""
Analyze the retail and institutional sentiment for symbol {symbol}:
- Current Price: {price:,.2f} VND (Change: {price_change_pct:+.2f}%)
- Cumulative CVD Normalized: {cvd:.3f}
- Buy Strength: {buy_strength:.3f}
- Whale Net Flow (VND): {whale_flow:,}
Based on these metrics, write a sentiment analysis block in {"Vietnamese" if language == 'vi' else "English"}.
"""

        # Call sub-agents concurrently
        async with httpx.AsyncClient(timeout=30.0) as client:
            tech_task = call_agent_async(
                client, "technical", tech_sys.format(symbol=symbol), tech_user_prompt,
                api_key, ai_model, temperature, 400, endpoint
            )
            flow_task = call_agent_async(
                client, "flow", flow_sys.format(symbol=symbol), flow_user_prompt,
                api_key, ai_model, temperature, 400, endpoint
            )
            sent_task = call_agent_async(
                client, "sentiment", sent_sys.format(symbol=symbol), sentiment_user_prompt,
                api_key, ai_model, temperature, 300, endpoint
            )

            # Await all sub-agents
            tech_res, flow_res, sent_res = await asyncio.gather(tech_task, flow_task, sent_task)

            # Synthesis Prompt
            synthesis_user_prompt = f"""
You are the Lead Analyst. Review and synthesize the following sub-agent inputs for {symbol}:
- Technical Analysis: {tech_res}
- Flow Analysis: {flow_res}
- Sentiment Analysis: {sent_res}

You must respond strictly as a JSON object (without markdown blocks like ```json ... ```).
The output JSON keys must be:
- "recommendation": Final calibrated action (BUY/SELL/HOLD/WATCH), target parameters, risks, and guidelines.
- "summary": A concise, final summary (under 100 words).

Please write all text in {"Vietnamese" if language == 'vi' else "English"}.
"""
            
            # Call Synthesis Agent
            synth_headers = {
                "Content-Type": "application/json"
            }
            if api_key and api_key != 'no-key-needed':
                synth_headers["Authorization"] = f"Bearer {api_key}"
                
            synth_payload = {
                "model": ai_model,
                "messages": [
                    {"role": "system", "content": synth_sys.format(symbol=symbol)},
                    {"role": "user", "content": synthesis_user_prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if provider != 'local':
                synth_payload["response_format"] = {"type": "json_object"}

            logger.info("Triggering LLM request for Synthesis Agent")
            response = await client.post(endpoint, headers=synth_headers, json=synth_payload, timeout=25.0)
            response.raise_for_status()
            res_data = response.json()
            
            choice = res_data['choices'][0]['message']['content']
            parsed_json = json.loads(choice.strip())
            
            tokens_used = res_data.get('usage', {}).get('total_tokens', 250)

            return {
                'advisory_text': parsed_json.get('summary') or parsed_json.get('recommendation') or "",
                'ai_model': ai_model,
                'tokens_used': tokens_used,
                'technical_analysis': tech_res,
                'whale_analysis': flow_res,
                'sentiment_analysis': sent_res,
                'recommendation': parsed_json.get('recommendation') or "",
                'summary': parsed_json.get('summary') or "",
            }
