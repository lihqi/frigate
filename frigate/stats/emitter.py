"""Emit stats to listeners."""

import datetime
import json
import logging
import os
import threading
import time
from multiprocessing.synchronize import Event as MpEvent

from frigate.comms.inter_process import InterProcessRequestor
from frigate.config import FrigateConfig
from frigate.const import PORT_INTER_PROCESS_COMM
from frigate.stats.util import stats_snapshot
from frigate.types import StatsTrackingTypes

logger = logging.getLogger(__name__)


class StatsEmitter(threading.Thread):
    def __init__(
        self,
        config: FrigateConfig,
        stats_tracking: StatsTrackingTypes,
        stop_event: MpEvent,
    ):
        threading.Thread.__init__(self)
        self.name = "frigate_stats_emitter"
        self.config = config
        self.stats_tracking = stats_tracking
        self.stop_event = stop_event
        self.hwaccel_errors: list[str] = []
        self.stats_history: list[dict[str, any]] = []

        # create communication for finished previews
        INTER_PROCESS_COMM_PORT = (
            os.environ.get("INTER_PROCESS_COMM_PORT") or PORT_INTER_PROCESS_COMM
        )
        self.requestor = InterProcessRequestor(INTER_PROCESS_COMM_PORT)

    def get_latest_stats(self) -> dict[str, any]:
        """Get latest stats."""
        if len(self.stats_history) > 0:
            return self.stats_history[-1]
        else:
            stats = stats_snapshot(
                self.config, self.stats_tracking, self.hwaccel_errors
            )
            self.stats_history.append(stats)
            return stats

    def get_stats_history(self) -> list[dict[str, any]]:
        """Get stats history."""
        return self.stats_history

    def run(self) -> None:
        time.sleep(10)
        while not self.stop_event.wait(self.config.mqtt.stats_interval):
            logger.debug("Starting stats collection")
            stats = stats_snapshot(
                self.config, self.stats_tracking, self.hwaccel_errors
            )
            self.stats_history.append(stats)
            self.stats_history = self.stats_history[-10:]
            self.requestor.send_data("stats", json.dumps(stats))
            logger.debug("Finished stats collection")
        logger.info("Exiting stats emitter...")
