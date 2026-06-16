import logging
import json
import httpx
from django.conf import settings
from market_serving.models import SymbolSnapshot, SessionFacts

logger = logging.getLogger(__name__)

class AdvisoryOrchestrator:
    @classmethod
    def run(cls, effective_context: dict, symbol: str) -> dict:
        """
        Coordinates Technical, Flow, and Sentiment agents using the effective AI context.
        
        Args:
            effective_context (dict): The merged configuration context (Global + Account).
            symbol (str): The stock ticker symbol.
            
        Returns:
            dict: The orchestration results including generated text, model used, and token count.
        """
        symbol = symbol.strip().upper()
        ai_model = effective_context.get('ai_model') or 'gpt-4o-mini'
        api_key = effective_context.get('api_key')
        temperature = effective_context.get('temperature') or 0.3
        max_tokens = effective_context.get('max_tokens') or 1000
        language = effective_context.get('language') or 'vi'
        prompt_template = effective_context.get('prompt_template') or 'Bạn là trợ lý tư vấn tài chính chuyên nghiệp cho mã {symbol}.'

        logger.info(f"AdvisoryOrchestrator.run called for {symbol} with model {ai_model}")

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

        # Check if we should use simulated fallback
        is_mock = not api_key or api_key.lower() in ('mock', 'mock_key') or api_key.startswith('mock_')
        if is_mock:
            if not getattr(settings, 'DEBUG', False):
                raise ValueError("Không tìm thấy API Key cấu hình cho AI Provider.")
            
            logger.info("Using simulated fallback response in DEBUG mode")
            # Construct a realistic mock response utilizing the real-time stock snapshot & facts
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

        # Build Prompts
        system_prompt = prompt_template.format(symbol=symbol)
        
        user_prompt = f"""
Analyze the Vietnamese stock symbol {symbol} with the following session metrics:
- Current Price: {price:,.2f} VND (Change: {price_change_pct:+.2f}%)
- Daily High: {high_price:,.2f} VND, Daily Low: {low_price:,.2f} VND, Volume: {volume:,}
- Cumulative CVD Normalized: {cvd:.3f} (range -1 to 1)
- Buy Strength: {buy_strength:.3f} (range 0 to 1)
- Institutional Strength: {inst_strength:.3f} (range 0 to 1)
- Whale Net Flow (VND): {whale_flow:,}

Please act as 3 separate agents (Technical Agent, Flow/Whale Agent, and Sentiment Agent) and coordinate their perspectives to output a combined recommendation.
You must respond strictly as a JSON object (without markdown blocks like ```json ... ```).
The output JSON keys must be:
- "technical_analysis": Analysis of price action, support, resistance, volatility.
- "whale_analysis": Analysis of CVD, buy/institutional strength, and large transaction flows.
- "sentiment_analysis": Sentiment score calibration and retail/institutional bias.
- "recommendation": Final calibrated action (BUY/SELL/HOLD), risk parameters, and guidelines.
- "summary": A concise, final summary (under 100 words).

Please write all text in {"Vietnamese" if language == 'vi' else "English"}.
"""

        # Call LLM Endpoint
        if ai_model.lower().startswith('gemini'):
            # Google Gemini OpenAI compatibility endpoint
            endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        else:
            # OpenAI standard endpoint
            endpoint = "https://api.openai.com/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": ai_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"}
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(endpoint, headers=headers, json=payload)
                response.raise_for_status()
                res_data = response.json()
                
            choice = res_data['choices'][0]['message']['content']
            parsed_json = json.loads(choice.strip())
            
            tokens_used = res_data.get('usage', {}).get('total_tokens', 150)
            
            return {
                'advisory_text': parsed_json.get('summary') or parsed_json.get('recommendation') or "",
                'ai_model': ai_model,
                'tokens_used': tokens_used,
                'technical_analysis': parsed_json.get('technical_analysis') or "",
                'whale_analysis': parsed_json.get('whale_analysis') or "",
                'sentiment_analysis': parsed_json.get('sentiment_analysis') or "",
                'recommendation': parsed_json.get('recommendation') or "",
                'summary': parsed_json.get('summary') or "",
            }
        except Exception as e:
            logger.error(f"Failed to fetch AI advisory from {endpoint}: {e}")
            raise RuntimeError(f"Lỗi truy xuất dịch vụ AI: {str(e)}")

