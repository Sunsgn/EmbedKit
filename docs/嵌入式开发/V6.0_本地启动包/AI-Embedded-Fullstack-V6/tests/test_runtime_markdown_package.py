import importlib.util
import re
import tempfile
import unittest
import zipfile
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
LAUNCH_ROOT = PACKAGE_ROOT.parent
RUNTIME_ROOT = LAUNCH_ROOT / "AI-Embedded-Constraints-V6-Runtime-MD"
SCRIPT = PACKAGE_ROOT / "tools" / "package_runtime_md.py"
SPEC = importlib.util.spec_from_file_location("package_runtime_md", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class RuntimeMarkdownPackageTests(unittest.TestCase):
    def test_root_concrete_constraint_document_is_directly_usable(self):
        path = RUNTIME_ROOT / "具体工程约束.md"
        content = path.read_text(encoding="utf-8")
        for required in (
            "AI 嵌入式开发具体工程约束",
            "U_isr = Σ(f_i × C_i)",
            "capacity >= ceil(R_peak × T_block) + F_max",
            "R_min = (VDD - VOL_max) / IOL_max",
            "I_rail,max = ΣI_load,max + I_dynamic + I_external",
            "PLAN_ONLY / EDITABLE_LAYOUT / ROUTED / DRC_VERIFIED",
            "PASS、FAIL、BLOCKED、NOT_RUN、UNAVAILABLE 和 UNKNOWN",
        ):
            self.assertIn(required, content)

    def test_runtime_tree_is_complete_and_markdown_only(self):
        result = MODULE.validate_runtime(RUNTIME_ROOT)
        self.assertTrue(result["valid"], result["errors"])
        self.assertTrue(result["markdown_only"])
        self.assertEqual(25, result["domains"])
        self.assertEqual(10, result["workflows"])
        self.assertEqual(6, result["templates"])
        self.assertEqual(5, result["project_constraints"])
        self.assertEqual(6, result["detail_packs"])
        self.assertEqual(60, result["atomic_rules"])

    def test_runtime_entry_is_compact_and_routes_on_demand(self):
        entry = (RUNTIME_ROOT / "AGENTS.md").read_text(encoding="utf-8")
        self.assertLessEqual(len(entry.encode("utf-8")), 5 * 1024)
        self.assertIn("不得预读全部专业约束", entry)
        self.assertIn("PROJECT_PROFILE.md", entry)
        self.assertIn("PROJECT_CONSTRAINTS.md", entry)
        self.assertIn("project_constraints", entry)
        self.assertIn("constraints/INDEX.md", entry)

    def test_project_constraints_reach_bs20_style_specificity_without_value_leakage(self):
        index = (RUNTIME_ROOT / ".ai" / "PROJECT_CONSTRAINTS.md").read_text(encoding="utf-8")
        self.assertIn("实例/路径/命令/接口/单位/上限/失败动作", index)
        root = RUNTIME_ROOT / ".ai" / "project_constraints"
        required = {
            "software.md": ("正式软件根目录", "任务、事件、中断和实时预算", "工作目录", "UART", "烧录命令即使已知也不等于已授权执行"),
            "hardware_pcb.md": ("软硬件接口矩阵", "规则类", "独立回读", "REAL_EDA_NOT_RUN"),
            "verification_manufacturing.md": ("可测量验收条件", "设备、仪器、端口和身份", "状态未知时，非幂等写入不得自动重放"),
            "security_release_field.md": ("危险输出和安全状态", "任意点掉电后结果", "正式发布批准", "RMA"),
            "system_lifecycle.md": ("明确非目标", "量化系统预算", "完整 MPN", "AI 不得自行决定风险可接受"),
        }
        for name, terms in required.items():
            content = (root / name).read_text(encoding="utf-8")
            self.assertGreaterEqual(len(content.encode("utf-8")), 5000, name)
            for term in terms:
                self.assertIn(term, content, name)
        combined = "\n".join(path.read_text(encoding="utf-8") for path in root.glob("*.md"))
        for leaked in ("standard-bs20-n1200", "LiteOS/OSAL", "UART0", "UART1", "MC661"):
            self.assertNotIn(leaked, combined)

    def test_workflows_and_records_are_enforceable_not_descriptive_only(self):
        required = ("触发条件：", "必须执行：", "禁止：", "有效条件：", "失败处理：")
        groups = {
            "workflows": "## 强制执行合同",
            "templates": "## 强制记录合同",
        }
        for directory, heading in groups.items():
            paths = sorted((RUNTIME_ROOT / ".ai" / directory).glob("*.md"))
            self.assertTrue(paths)
            for path in paths:
                content = path.read_text(encoding="utf-8")
                self.assertIn(heading, content, path.name)
                for term in required:
                    self.assertIn(term, content, path.name)

        profile = (RUNTIME_ROOT / ".ai" / "PROJECT_PROFILE.md").read_text(encoding="utf-8")
        self.assertIn("不是专业约束文件", profile)
        entry = (RUNTIME_ROOT / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("文件效力分类", entry)
        self.assertIn("UNKNOWN` 表格本身只是待确认事实", entry)

    def test_common_software_hardware_pcb_rules_are_atomic_and_routed(self):
        detail_root = RUNTIME_ROOT / ".ai" / "constraints" / "details"
        expected = {
            "software_execution_io.md": ("GPIO 与 Pinmux 配置", "中断注册、优先级与 ISR 内容", "DMA、Cache 与异步所有权", "ADC、PWM、定时器"),
            "software_architecture_resource.md": ("RTOS、裸机与事件驱动", "共享状态、锁与消息队列", "状态机、时间与重试", "NVM、配置与掉电一致性"),
            "hardware_power_digital.md": ("电源树、稳压与启动裕量", "去耦、旁路与储能", "复位、Boot Strap", "数字电平、方向与电平转换"),
            "hardware_analog_safety.md": ("模拟信号链与动态范围", "误差、不确定度与温漂预算", "隔离、高压、爬电", "安全输出、联锁与失效方向"),
            "pcb_layout_signal.md": ("叠层、参考层与回流路径", "线宽、间距、过孔与网络类", "差分对与高速串行接口", "模拟、数字和敏感网络布线"),
            "pcb_power_emc_manufacturing.md": ("电源路径、电流与压降", "开关电源 PCB 回路", "串扰、边沿与 EMI 控制", "制造输出和独立回读"),
        }
        contract = ("触发条件：", "必须执行：", "禁止：", "必需证据：", "PASS 条件：", "失败处理：")
        total = 0
        for name, terms in expected.items():
            content = (detail_root / name).read_text(encoding="utf-8")
            sections = content.split("\n## ")[1:]
            self.assertEqual(10, len(sections), name)
            total += len(sections)
            for section in sections:
                for label in contract:
                    self.assertIn(label, section, f"{name}: {section.splitlines()[0]}")
            for term in terms:
                self.assertIn(term, content, name)
        self.assertEqual(60, total)
        index = (RUNTIME_ROOT / ".ai" / "constraints" / "INDEX.md").read_text(encoding="utf-8")
        for name in expected:
            self.assertIn(f"details/{name}", index)
        combined = "\n".join(path.read_text(encoding="utf-8") for path in detail_root.glob("*.md"))
        for forbidden_default in ("常用 6/6 mil", "常用 3 mm/6 mm"):
            self.assertIn(forbidden_default, combined)
        for concrete_contract in (
            "U_isr = Σ(f_i × C_i)",
            "ceil(R_peak × T_block) + F_max",
            "R_min=(VDD-VOL_max)/IOL_max",
            "寿命秒数/最短写间隔×最坏写放大",
            "I_rail,max=ΣI_load,max+I_dynamic+I_external",
            "C_ideal>=I_step×Δt/ΔV_allow",
            "NMH=VOH_min-VIH_min",
            "输入及单位→来源版本/页码→公式或工具版本",
            "单孔电阻/损耗/温升",
        ):
            self.assertIn(concrete_contract, combined)

    def test_every_professional_section_has_a_unique_stable_rule_id(self):
        ids = []
        for path in sorted((RUNTIME_ROOT / ".ai" / "constraints").glob("*.md")):
            if path.name == "INDEX.md":
                continue
            headings = [line for line in path.read_text(encoding="utf-8").splitlines() if line.startswith("## ")]
            self.assertGreaterEqual(len(headings), 8, path)
            for heading in headings:
                match = re.match(r"^## ([A-Z]+-[0-9]{3})：", heading)
                self.assertIsNotNone(match, f"missing stable rule ID: {path}: {heading}")
                ids.append(match.group(1))
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreaterEqual(len(ids), 220)

    def test_added_specialist_domains_have_concrete_engineering_gates(self):
        required = {
            "power_energy.md": ("反向供电", "唤醒风暴", "典型电流"),
            "bootloader_ota.md": ("任意指令点掉电", "最后可启动", "禁止降级"),
            "rf_wireless.md": ("OTA 良好", "共存", "模组证书"),
            "motor_control_power.md": ("直通", "急停", "上下桥互锁"),
            "sensing_calibration.md": ("不确定度", "只保存最终系数", "独立验证点"),
            "compliance_certification.md": ("AI 不得自行作法律结论", "预扫", "量产不一致"),
            "field_maintenance.md": ("状态未知的非幂等写入", "RMA", "日志风暴"),
            "supply_chain_lifecycle.md": ("完整 MPN", "PCN/EOL", "可疑批次"),
        }
        root = RUNTIME_ROOT / ".ai" / "constraints"
        for name, terms in required.items():
            content = (root / name).read_text(encoding="utf-8")
            self.assertGreaterEqual(len(content.encode("utf-8")), 4500, name)
            for term in terms:
                self.assertIn(term, content, name)

    def test_deterministic_zip_contains_only_markdown(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.zip"
            second = Path(directory) / "second.zip"
            one = MODULE.create_runtime_package(RUNTIME_ROOT, first)
            two = MODULE.create_runtime_package(RUNTIME_ROOT, second)
            self.assertEqual(one["sha256"], two["sha256"])
            with zipfile.ZipFile(first) as archive:
                names = archive.namelist()
            self.assertTrue(names)
            self.assertTrue(all(name.lower().endswith(".md") for name in names))
            self.assertIn("AGENTS.md", names)
            self.assertIn(".ai/constraints/core.md", names)


if __name__ == "__main__":
    unittest.main()
