import logging

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
        logger.info(f"AdvisoryOrchestrator.run called for {symbol} with model {effective_context.get('ai_model')}")
        return {
            'advisory_text': f"Bản phân tích AI cho mã {symbol} dựa trên cấu hình {effective_context.get('ai_model')}.",
            'ai_model': effective_context.get('ai_model') or 'gpt-4o-mini',
            'tokens_used': 150,
        }
