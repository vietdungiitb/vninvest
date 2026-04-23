import hashlib
import json
import uuid
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from redis import Redis
from .models import WhaleServiceJob

# Initialise a Redis client
_REDIS_CLIENT = Redis.from_url(getattr(settings, "CELERY_BROKER_URL", "redis://localhost:6379/0"))
_DEFAULT_LOCK_TTL = 300  # 5 minutes default
_CREATE_GATE_TTL = 10

class WhaleJobManager:
    @staticmethod
    def _release_token_lock(lock_key, token):
        """Release Redis lock only if token matches current owner."""
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        try:
            _REDIS_CLIENT.eval(script, 1, lock_key, token)
        except Exception:
            pass

    @staticmethod
    def generate_idempotency_key(service_type, params):
        """Generate a stable key based on service type and sorted params."""
        params_str = json.dumps(params, sort_keys=True)
        raw = f"{service_type}:{params_str}"
        return hashlib.sha256(raw.encode()).hexdigest()

    @staticmethod
    def generate_lock_key(service_type, params):
        """Generate a lock key based on the scope of the job."""
        # For USER_REFRESH, scope is usually symbol + user
        # For GLOBAL_RECOMPUTE, scope might be 'global' or 'vn30'
        # For BACKFILL, scope is symbols + date range
        scope_parts = []
        if service_type == WhaleServiceJob.ServiceType.USER_REFRESH:
            scope_parts.append(f"user:{params.get('user_id')}")
            scope_parts.append(f"symbol:{params.get('symbol')}")
        elif service_type == WhaleServiceJob.ServiceType.GLOBAL_RECOMPUTE:
            scope_parts.append("global")
            if params.get('symbols'):
                 scope_parts.append(f"symbols:{','.join(sorted(params.get('symbols')))}")
        elif service_type == WhaleServiceJob.ServiceType.BACKFILL:
            scope_parts.append("backfill")
            # Support both start_date/end_date and from_date/to_date
            scope_parts.append(f"from:{params.get('start_date') or params.get('from_date')}")
            scope_parts.append(f"to:{params.get('end_date') or params.get('to_date')}")
            if params.get('symbols'):
                 scope_parts.append(f"symbols:{','.join(sorted(params.get('symbols')))}")
        
        scope_str = ":".join(scope_parts)
        return f"whale:lock:{service_type.lower()}:{scope_str}"

    @classmethod
    def get_or_create_job(cls, service_type, params, created_by=None):
        """
        Idempotency layer: 
        1. Check if an identical job is already PENDING or RUNNING.
        2. If found, return (job, created=False, status='in_progress').
        3. If not, create new PENDING job.
        """
        idempotency_key = cls.generate_idempotency_key(service_type, params)
        lock_key = cls.generate_lock_key(service_type, params)
        create_gate_key = f"whale:create-gate:{lock_key}"
        create_gate_token = str(uuid.uuid4())

        # Serialize create path per scope to avoid race when DB unique(lock_key) is removed.
        try:
            acquired_gate = _REDIS_CLIENT.set(create_gate_key, create_gate_token, ex=_CREATE_GATE_TTL, nx=True)
        except Exception:
            acquired_gate = True

        if not acquired_gate:
            concurrent_job = WhaleServiceJob.objects.filter(
                lock_key=lock_key,
                status__in=[WhaleServiceJob.StatusChoices.PENDING, WhaleServiceJob.StatusChoices.RUNNING],
            ).order_by('-created_at').first()
            if concurrent_job:
                if concurrent_job.idempotency_key == idempotency_key:
                    return concurrent_job, False, 'duplicate'
                return concurrent_job, False, 'in_progress'
            return None, False, 'in_progress'
        
        try:
            with transaction.atomic():
                # 1. Check for existing active job with same idempotency key
                existing_job = WhaleServiceJob.objects.select_for_update().filter(
                    idempotency_key=idempotency_key,
                    status__in=[WhaleServiceJob.StatusChoices.PENDING, WhaleServiceJob.StatusChoices.RUNNING],
                ).order_by('-created_at').first()
                if existing_job:
                    return existing_job, False, 'duplicate'

                # 2. Check for any active job holding the same lock_key
                lock_holder = WhaleServiceJob.objects.select_for_update().filter(
                    lock_key=lock_key,
                    status__in=[WhaleServiceJob.StatusChoices.PENDING, WhaleServiceJob.StatusChoices.RUNNING],
                ).order_by('-created_at').first()
                if lock_holder:
                    return lock_holder, False, 'in_progress'

                # 3. Create new PENDING job
                job = WhaleServiceJob.objects.create(
                    service_type=service_type,
                    params=params,
                    idempotency_key=idempotency_key,
                    lock_key=lock_key,
                    status=WhaleServiceJob.StatusChoices.PENDING,
                    created_by=created_by
                )
                return job, True, 'accepted'
        finally:
            cls._release_token_lock(create_gate_key, create_gate_token)

    @staticmethod
    def mark_job_skipped_duplicate(job_id, log_entry=None):
        """Mark job as duplicate/in-progress conflict to prevent orphan PENDING rows."""
        try:
            job = WhaleServiceJob.objects.get(id=job_id)
        except WhaleServiceJob.DoesNotExist:
            return False

        # Respect terminal or active states set by another worker.
        if job.status != WhaleServiceJob.StatusChoices.PENDING:
            return False

        job.status = WhaleServiceJob.StatusChoices.SKIPPED_DUPLICATE
        job.finished_at = timezone.now()
        if log_entry:
            job.log = (job.log + "\n" + log_entry).strip()
        job.save(update_fields=['status', 'finished_at', 'log', 'updated_at'])
        return True

    @staticmethod
    def start_job(job_id, task_id):
        """Transition job to RUNNING and acquire Redis lock."""
        try:
            job = WhaleServiceJob.objects.get(id=job_id)
            if job.status != WhaleServiceJob.StatusChoices.PENDING:
                return False, f"Cannot start job in status {job.status}"
            
            # Try acquire Redis lock
            # We use the lock_key defined in DB
            if not _REDIS_CLIENT.set(job.lock_key, task_id, ex=_DEFAULT_LOCK_TTL, nx=True):
                # Lock exists in Redis but maybe DB state is stale?
                # Or another worker picked it up
                return False, "Redis lock already held"
            
            job.status = WhaleServiceJob.StatusChoices.RUNNING
            job.started_at = timezone.now()
            job.heartbeat_at = timezone.now()
            # We store task_id in log or metadata if needed, but for now just update status
            job.save(update_fields=['status', 'started_at', 'heartbeat_at', 'updated_at'])
            return True, "Started"
        except WhaleServiceJob.DoesNotExist:
            return False, "Job not found"

    @staticmethod
    def heartbeat(job_id, task_id):
        """Refresh lock TTL and update heartbeat_at."""
        try:
            job = WhaleServiceJob.objects.get(id=job_id)
            if job.status != WhaleServiceJob.StatusChoices.RUNNING:
                return False
            
            # LUA script to only refresh if task_id matches
            script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("expire", KEYS[1], ARGV[2])
            else
                return 0
            end
            """
            result = _REDIS_CLIENT.eval(script, 1, job.lock_key, task_id, _DEFAULT_LOCK_TTL)
            
            if result:
                job.heartbeat_at = timezone.now()
                job.save(update_fields=['heartbeat_at', 'updated_at'])
                return True
            return False
        except Exception:
            return False

    @staticmethod
    def update_progress(job_id, progress_pct, processed=None, failed=None, total=None):
        """Update job progress counters."""
        update_fields = ['progress_pct', 'updated_at']
        update_data = {'progress_pct': progress_pct}
        
        if processed is not None:
            update_data['processed_items'] = processed
            update_fields.append('processed_items')
        if failed is not None:
            update_data['failed_items'] = failed
            update_fields.append('failed_items')
        if total is not None:
            update_data['total_items'] = total
            update_fields.append('total_items')
            
        WhaleServiceJob.objects.filter(id=job_id).update(**update_data, updated_at=timezone.now())

    @staticmethod
    def finish_job(job_id, task_id, status, log_entry=None):
        """Finalize job and release Redis lock."""
        try:
            job = WhaleServiceJob.objects.get(id=job_id)
            
            # Release Redis lock
            script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            _REDIS_CLIENT.eval(script, 1, job.lock_key, task_id)
            
            job.status = status
            job.finished_at = timezone.now()
            if log_entry:
                job.log = (job.log + "\n" + log_entry).strip()
            
            job.save(update_fields=['status', 'finished_at', 'log', 'updated_at'])
            return True
        except WhaleServiceJob.DoesNotExist:
            return False
