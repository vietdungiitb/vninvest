import logging
import datetime
from django.conf import settings
from django.utils import timezone
from celery import shared_task
from django.db import transaction
from django.db.models import F

from identity_access.models import CoreTenant
from advertising.models import AdCampaign, AdDailySummary, AdImpressionLog, AdClickLog

logger = logging.getLogger(__name__)

# Redis Cache Indexing Constants
CACHE_TTL = 86400  # 24 hours
STREAM_BATCH_LIMIT = 1000
CONSUMER_GROUP = 'advertising_workers'
CONSUMER_NAME = 'celery_worker'


def _get_redis_client():
    import redis
    broker_url = getattr(settings, 'CELERY_BROKER_URL', None) or getattr(settings, 'REDIS_URL', 'redis://localhost:6379/1')
    return redis.from_url(broker_url)


@shared_task(name='advertising.tasks.rebuild_ads_cache_index')
def rebuild_ads_cache_index():
    """Rebuild Redis Set active ad campaign indexes to support SUNION selection."""
    try:
        redis_client = _get_redis_client()
        now = timezone.now()
        
        active_campaigns = AdCampaign.objects.filter(
            status=AdCampaign.Status.ACTIVE,
            start_date__lte=now,
            end_date__gte=now
        )

        # 1. Clean existing active index keys
        keys_to_delete = list(redis_client.scan_iter("ads:active:*"))
        if keys_to_delete:
            redis_client.delete(*keys_to_delete)

        # 2. Populate new sets
        active_keys = set()
        for campaign in active_campaigns:
            slot_size = f"{campaign.banner_width}x{campaign.banner_height}"
            campaign_id_str = str(campaign.id)
            
            if campaign.tenant:
                # Enterprise/Custom Tenant Specific
                key = f"ads:active:tenant:{campaign.tenant.public_id}:{slot_size}"
                redis_client.sadd(key, campaign_id_str)
                active_keys.add(key)
            else:
                # Public Campaign
                targeting = campaign.targeting_rules or {}
                target_symbols = targeting.get("target_symbols", [])
                
                if target_symbols:
                    # Target specific symbols
                    for symbol in target_symbols:
                        symbol_upper = str(symbol).strip().upper()
                        key = f"ads:active:symbol:{symbol_upper}:{slot_size}"
                        redis_client.sadd(key, campaign_id_str)
                        active_keys.add(key)
                else:
                    # Public to all symbols
                    key = f"ads:active:all:{slot_size}"
                    redis_client.sadd(key, campaign_id_str)
                    active_keys.add(key)

        # 3. Apply TTL to all index sets to prevent memory leaks
        for key in active_keys:
            redis_client.expire(key, CACHE_TTL)

        logger.info("Successfully reindexed %d active ad campaigns.", len(active_campaigns))
        return {'status': 'success', 'campaigns_count': len(active_campaigns)}
    except Exception as exc:
        logger.error("Failed to rebuild ads cache index: %s", exc, exc_info=True)
        return {'status': 'failed', 'error': str(exc)}


@shared_task(name='advertising.tasks.aggregate_ad_metrics')
def aggregate_ad_metrics():
    """Consume metrics logs from Redis Streams, batch write to logs and upsert AdDailySummary."""
    try:
        redis_client = _get_redis_client()
    except Exception as exc:
        logger.error("Failed to connect to Redis for ad metrics aggregation: %s", exc)
        return {'status': 'failed', 'error': str(exc)}

    streams = {
        'ads:impressions:stream': 'impression',
        'ads:clicks:stream': 'click'
    }

    # Initialize Consumer Groups
    for stream_key in streams:
        try:
            redis_client.xgroup_create(stream_key, CONSUMER_GROUP, id='0', mkstream=True)
        except Exception:
            # Group already exists or stream was created automatically
            pass

    processed_counts = {'impression': 0, 'click': 0}
    
    # Process both streams
    for stream_key, event_type in streams.items():
        try:
            # Read messages from Stream
            raw_response = redis_client.xreadgroup(
                CONSUMER_GROUP,
                CONSUMER_NAME,
                {stream_key: '>'},
                count=STREAM_BATCH_LIMIT
            )
            
            if not raw_response:
                continue

            messages = raw_response[0][1]
            if not messages:
                continue

            msg_ids = []
            aggregated_data = {}  # key: (campaign_id, tenant_id_str, symbol, date) -> {'impressions': int, 'clicks': int}
            logs_to_create = []

            for msg_id, payload in messages:
                # Decode payload keys and values from bytes
                decoded_payload = {k.decode('utf-8', errors='replace'): v.decode('utf-8', errors='replace') for k, v in payload.items()}
                
                campaign_id = decoded_payload.get('campaign_id')
                tenant_id = decoded_payload.get('tenant_id', '')
                symbol = decoded_payload.get('symbol', 'ALL').strip().upper()
                ip_address = decoded_payload.get('ip_address', '')
                user_agent = decoded_payload.get('user_agent', '')
                
                if not campaign_id:
                    msg_ids.append(msg_id)
                    continue

                # Parse created_at from message ID timestamp
                try:
                    timestamp_ms = int(msg_id.decode('utf-8').split('-')[0])
                    created_at = timezone.make_aware(
                        datetime.datetime.fromtimestamp(timestamp_ms / 1000.0, tz=datetime.UTC)
                    )
                except Exception:
                    created_at = timezone.now()

                date_obj = created_at.date()
                agg_key = (campaign_id, tenant_id, symbol, date_obj)
                
                if agg_key not in aggregated_data:
                    aggregated_data[agg_key] = {'impressions': 0, 'clicks': 0}
                
                if event_type == 'impression':
                    aggregated_data[agg_key]['impressions'] += 1
                    logs_to_create.append(AdImpressionLog(
                        campaign_id=campaign_id,
                        tenant=CoreTenant.objects.filter(public_id=tenant_id).first() if tenant_id else None,
                        symbol=symbol,
                        ip_address=ip_address or None,
                        user_agent=user_agent,
                        created_at=created_at
                    ))
                elif event_type == 'click':
                    aggregated_data[agg_key]['clicks'] += 1
                    logs_to_create.append(AdClickLog(
                        campaign_id=campaign_id,
                        tenant=CoreTenant.objects.filter(public_id=tenant_id).first() if tenant_id else None,
                        symbol=symbol,
                        ip_address=ip_address or None,
                        user_agent=user_agent,
                        created_at=created_at
                    ))
                
                msg_ids.append(msg_id)

            # DB Operations
            if aggregated_data:
                with transaction.atomic():
                    # 1. Bulk Upsert Daily Summaries
                    for agg_key, counts in aggregated_data.items():
                        c_id, t_id, sym, dt = agg_key
                        tenant_obj = CoreTenant.objects.filter(public_id=t_id).first() if t_id else None
                        
                        summary, created = AdDailySummary.objects.select_for_update().get_or_create(
                            campaign_id=c_id,
                            tenant=tenant_obj,
                            symbol=sym,
                            date=dt,
                            defaults={
                                'impressions_count': counts['impressions'],
                                'clicks_count': counts['clicks']
                            }
                        )
                        if not created:
                            summary.impressions_count = F('impressions_count') + counts['impressions']
                            summary.clicks_count = F('clicks_count') + counts['clicks']
                            summary.save(update_fields=['impressions_count', 'clicks_count'])

                    # 2. Bulk Insert Raw Logs
                    if event_type == 'impression':
                        AdImpressionLog.objects.bulk_create(logs_to_create)
                    elif event_type == 'click':
                        AdClickLog.objects.bulk_create(logs_to_create)

            # 3. Acknowledge messages in Redis Stream
            if msg_ids:
                redis_client.xack(stream_key, CONSUMER_GROUP, *msg_ids)
                # Cleanup stream by deleting acknowledged keys
                redis_client.xdel(stream_key, *msg_ids)
                processed_counts[event_type] = len(msg_ids)

        except Exception as exc:
            logger.error("Error processing stream %s: %s", stream_key, exc, exc_info=True)

    return {'status': 'completed', 'processed': processed_counts}
