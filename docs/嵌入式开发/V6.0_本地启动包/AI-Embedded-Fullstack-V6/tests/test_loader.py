import unittest
from pathlib import Path

from aies.loader import RuleLoader
from aies.routing import route_task


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


class LoaderTests(unittest.TestCase):
    def test_same_session_unchanged_rule_is_cached(self):
        loader = RuleLoader(PACKAGE_ROOT)
        first = loader.load("rules/core/rules.json")
        second = loader.load("rules/core/rules.json")
        self.assertIs(first, second)
        self.assertEqual(1, loader.metrics["disk_reads"])
        self.assertEqual(1, loader.metrics["cache_hits"])

    def test_cross_session_handoff_revalidates_hash(self):
        first = RuleLoader(PACKAGE_ROOT)
        first.load("rules/core/rules.json")
        second = RuleLoader(PACKAGE_ROOT, first.handoff_index())
        second.load("rules/core/rules.json")
        self.assertEqual(1, second.metrics["revalidated"])
        self.assertEqual(1, second.metrics["disk_reads"])

    def test_routing_variants_keep_required_domain_coverage(self):
        variants = ("UART DMA", "串口 DMA 接收", "FreeRTOS UART direct memory access")
        routes = [route_task(str(PACKAGE_ROOT), task) for task in variants]
        self.assertTrue(all("software" in route.domains for route in routes))
        self.assertTrue(all("core" in route.domains for route in routes))


if __name__ == "__main__":
    unittest.main()
