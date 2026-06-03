class AIServiceException(Exception):
    pass

class LLMProviderError(AIServiceException):
    pass

class RateLimitError(AIServiceException):
    def __init__(self, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.retry_after = retry_after

class DataParsingError(AIServiceException):
    pass