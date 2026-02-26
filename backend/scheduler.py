"""
APScheduler setup — runs daily knowledge base updates at 3:00 AM.
Also provides an in-memory TTL cache for expensive API responses.
"""

import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None
_last_update_result: dict | None = None


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


def get_last_update_result() -> dict | None:
    return _last_update_result


def setup_scheduler(rag_system) -> AsyncIOScheduler:
    """
    Start the background scheduler.
    Registers a daily job at 3:00 AM to update the knowledge base.
    """
    global _scheduler

    from data_updater import MedicalDataUpdater

    async def run_daily_update():
        global _last_update_result
        logger.info("Scheduled knowledge base update starting...")
        updater = MedicalDataUpdater(rag_system)
        try:
            result = await updater.run_full_update()
            _last_update_result = result
            logger.info(f"Scheduled update done: +{result['new_documents_added']} docs")
        except Exception as e:
            logger.error(f"Scheduled update failed: {e}")
            _last_update_result = {
                "status": "error",
                "error": str(e),
                "updated_at": datetime.utcnow().isoformat(),
            }

    sched = AsyncIOScheduler(timezone="UTC")

    # Daily at 3:00 AM UTC
    sched.add_job(
        run_daily_update,
        CronTrigger(hour=3, minute=0),
        id="daily_kb_update",
        name="Daily Medical Knowledge Base Update",
        replace_existing=True,
        misfire_grace_time=3600,  # Allow up to 1h late start
    )

    sched.start()
    _scheduler = sched
    logger.info("Scheduler started — daily knowledge base update at 03:00 UTC")
    return sched
