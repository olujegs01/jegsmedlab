"""
In-memory TTL cache for expensive or frequently-read API responses.
Avoids hitting the database and AI engine on every identical request.
"""

from cachetools import TTLCache
from functools import wraps
import asyncio
import hashlib
import json
import logging

logger = logging.getLogger(__name__)

# Cache instances (thread-safe for asyncio)
_stats_cache = TTLCache(maxsize=256, ttl=120)       # Dashboard stats: 2 min TTL
_trends_cache = TTLCache(maxsize=256, ttl=300)      # Trends: 5 min TTL
_history_cache = TTLCache(maxsize=256, ttl=60)      # History list: 1 min TTL
_alerts_cache = TTLCache(maxsize=256, ttl=30)       # Alerts: 30 sec TTL


def _cache_key(*args, **kwargs) -> str:
    key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.md5(key_data.encode()).hexdigest()


def get_stats_cache(patient_id: str):
    return _stats_cache.get(patient_id)

def set_stats_cache(patient_id: str, value):
    _stats_cache[patient_id] = value

def get_trends_cache(patient_id: str):
    return _trends_cache.get(patient_id)

def set_trends_cache(patient_id: str, value):
    _trends_cache[patient_id] = value

def get_history_cache(patient_id: str):
    return _history_cache.get(patient_id)

def set_history_cache(patient_id: str, value):
    _history_cache[patient_id] = value

def get_alerts_cache(patient_id: str):
    return _alerts_cache.get(patient_id)

def set_alerts_cache(patient_id: str, value):
    _alerts_cache[patient_id] = value


def invalidate_patient_cache(patient_id: str):
    """Call this whenever a patient's data changes (new upload, alert read, etc.)."""
    for cache in (_stats_cache, _trends_cache, _history_cache, _alerts_cache):
        cache.pop(patient_id, None)
    logger.debug(f"Cache invalidated for patient {patient_id}")
