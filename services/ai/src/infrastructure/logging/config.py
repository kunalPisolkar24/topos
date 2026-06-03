import logging
import sys
from pythonjsonlogger import jsonlogger
from src.config.settings import settings
from src.core.context import trace_id_var

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        if not log_record.get('timestamp'):
            log_record['timestamp'] = record.created
        if log_record.get('level'):
            log_record['level'] = log_record['level'].upper()
        else:
            log_record['level'] = record.levelname
        trace_id = trace_id_var.get()
        if trace_id:
            log_record['trace_id'] = trace_id

def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(settings.LOG_LEVEL.upper())
    
    handler = logging.StreamHandler(sys.stdout)
    formatter = CustomJsonFormatter('%(timestamp)s %(level)s %(name)s %(message)s')
    handler.setFormatter(formatter)
    
    logger.handlers = []
    logger.addHandler(handler)
    
    logging.getLogger("httpx").setLevel(logging.WARNING)
