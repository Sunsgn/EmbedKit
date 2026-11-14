class AIESError(Exception):
    exit_code = 70


class ContractError(AIESError):
    exit_code = 2


class CapabilityUnavailable(AIESError):
    exit_code = 3


class AuthorizationRequired(AIESError):
    exit_code = 4


class InputConflict(AIESError):
    exit_code = 5
