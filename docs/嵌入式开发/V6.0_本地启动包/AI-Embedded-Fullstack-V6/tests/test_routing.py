import tempfile
import unittest
from pathlib import Path

from aies.discovery import inspect_project, resolve_fact_candidates
from aies.errors import InputConflict
from aies.models import Fact
from aies.routing import route_task


class RoutingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def route(self, task):
        return route_task(str(self.root), task)

    def test_uart_dma_is_software_not_full_lifecycle(self):
        route = self.route("A22 FreeRTOS 修改 UART DMA")
        self.assertIn("software", route.domains)
        self.assertNotIn("pcb", route.domains)
        self.assertEqual("STANDARD", route.depth)

    def test_bs20_modbus_routes_protocol_software(self):
        scoped = self.root / "BS20"
        scoped.mkdir()
        (scoped / "CONSTRAINTS.md").write_text("BS20 only", encoding="utf-8")
        route = self.route("BS20 LiteOS OSAL 新增 MC661 Modbus 读取")
        self.assertIn("software", route.domains)
        self.assertEqual("T1", route.risk)
        self.assertIn("BS20/CONSTRAINTS.md", route.rule_files)

    def test_bs20_constraint_does_not_leak_to_a22(self):
        scoped = self.root / "BS20"
        scoped.mkdir()
        (scoped / "CONSTRAINTS.md").write_text("UART0 BS20", encoding="utf-8")
        route = self.route("A22 FreeRTOS UART DMA")
        self.assertNotIn("BS20/CONSTRAINTS.md", route.rule_files)

    def test_schematic_does_not_force_pcb(self):
        route = self.route("审核 AD19 原理图 ERC")
        self.assertIn("hardware", route.domains)
        self.assertNotIn("pcb", route.domains)

    def test_pcb_routes_manufacturing_only_when_signalled(self):
        route = self.route("按约束生成 KiCad PCB 布线并检查 Gerber")
        self.assertIn("pcb", route.domains)
        self.assertIn("manufacturing", route.domains)

    def test_pure_directory_is_light_and_no_product_domains(self):
        route = self.route("只整理已有项目目录 ORGANIZE")
        self.assertEqual(["core", "directory"], route.domains)
        self.assertEqual(("LIGHT", "T0"), (route.depth, route.risk))

    def test_safety_adds_cross_domain_contracts(self):
        route = self.route("修改燃气控制安全状态机")
        self.assertTrue({"security", "integration", "verification"}.issubset(route.domains))
        self.assertEqual("FULL", route.depth)

    def test_unknown_task_never_allows_empty_general_edit(self):
        route = self.route("处理 foobar 子系统")
        self.assertIn("software", route.domains)
        self.assertTrue(route.unknowns)

    def test_missing_workspace_is_rejected(self):
        with self.assertRaises(InputConflict):
            route_task(str(self.root / "missing"), "查看日志")

    def test_pinmux_adds_integration_verification(self):
        route = self.route("修改 MCU pinmux")
        self.assertIn("integration", route.domains)
        self.assertIn("verification", route.domains)

    def test_inspection_scopes_nested_constraint(self):
        nested = self.root / "bs20"
        nested.mkdir()
        (nested / "CONSTRAINTS.md").write_text("BS20 only", encoding="utf-8")
        data = inspect_project(self.root)
        facts = [f for f in data["facts"] if f["key"] == "constraint_file"]
        self.assertEqual("bs20", facts[0]["scope"])

    def test_conflicting_uart_facts_are_not_guessed(self):
        facts = [
            Fact("uart.debug", 1, "VERIFIED", "a.md"),
            Fact("uart.debug", 0, "VERIFIED", "b.md"),
        ]
        result = resolve_fact_candidates(facts)
        self.assertFalse(result["valid_for_write"])
        self.assertEqual("CONFLICT", result["conflicts"][0]["status"])


if __name__ == "__main__":
    unittest.main()
