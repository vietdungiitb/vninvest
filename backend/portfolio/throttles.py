from rest_framework.throttling import UserRateThrottle


class RealtimeOpsMetricsRateThrottle(UserRateThrottle):
    scope = 'realtime_ops_metrics'
