from copy import deepcopy

CORE_SERVICE_NAMES = ("core-api", "core-worker", "core-beat")
CORE_CONTRACT_NAMESPACES = ("access", "market", "operator", "partner")

CORE_APP_MANIFEST = {
    "package": "vninvest-core",
    "version": "0.1.0",
    "python": ">=3.13",
    "service_names": list(CORE_SERVICE_NAMES),
    "contract_namespaces": list(CORE_CONTRACT_NAMESPACES),
    "topology": {
        "database": "core-db",
        "cache": "core-redis",
        "api": "core-api",
        "worker": "core-worker",
        "beat": "core-beat",
    },
}


def get_core_manifest():
    return deepcopy(CORE_APP_MANIFEST)