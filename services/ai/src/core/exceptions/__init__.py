class AIServiceException(Exception):
    pass

class LLMProviderError(AIServiceException):
    pass

class DataParsingError(AIServiceException):
    pass