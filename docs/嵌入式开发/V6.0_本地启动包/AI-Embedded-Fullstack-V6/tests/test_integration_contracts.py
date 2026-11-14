import unittest

from aies.integration import check_version_compatibility, evaluate_error_budget, validate_interface_mapping, validate_nvm_migration, validate_safety_contract


class IntegrationContractTests(unittest.TestCase):
    def test_pin_mapping_detects_conflict(self):
        rows = [
            {"signal": "UART_TX", "hardware_pin": "P1", "software_driver": "uart0", "voltage_v": 3.3, "direction": "output"},
            {"signal": "ALARM", "hardware_pin": "P1", "software_driver": "gpio", "voltage_v": 3.3, "direction": "output"},
        ]
        self.assertEqual("FAIL", validate_interface_mapping(rows)["status"])

    def test_complete_pin_mapping_passes(self):
        rows = [{"signal": "UART_TX", "hardware_pin": "P1", "software_driver": "uart0", "voltage_v": 3.3, "direction": "output"}]
        self.assertEqual("PASS", validate_interface_mapping(rows)["status"])

    def test_error_budget_without_data_is_unknown(self):
        result = evaluate_error_budget([{"name": "ADC reference", "worst_case": None, "unit": "%"}], 2.0, "%")
        self.assertEqual("UNKNOWN", result["status"])

    def test_error_budget_is_deterministic(self):
        result = evaluate_error_budget([{"name": "ADC", "worst_case": 0.4, "unit": "%"}, {"name": "sensor", "worst_case": 0.8, "unit": "%"}], 1.5, "%")
        self.assertEqual("PASS", result["status"])

    def test_mixed_version_not_unconditionally_released(self):
        matrix = [{"hardware": "A", "firmware": "1", "calibration": "1", "status": "VERIFIED_COMPATIBLE"}]
        self.assertEqual("BLOCKED", check_version_compatibility(matrix, "B", "1", "1")["status"])

    def test_verified_version_combination_passes(self):
        matrix = [{"hardware": "A", "firmware": "1", "calibration": "1", "status": "VERIFIED_COMPATIBLE"}]
        self.assertEqual("PASS", check_version_compatibility(matrix, "A", "1", "1")["status"])

    def test_nvm_upgrade_requires_rollback(self):
        contract = {"from_version": 1, "to_version": 2, "length": 16, "checksum": "crc32", "migration": "migrate_v1", "rollback": ""}
        self.assertEqual("FAIL", validate_nvm_migration(contract)["status"])

    def test_safety_missing_measurement_remains_not_run(self):
        contract = {"hazard": "unsafe output", "safe_state": "off"}
        self.assertEqual("NOT_RUN", validate_safety_contract(contract)["status"])


if __name__ == "__main__":
    unittest.main()
