import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from aies.authorization import sign_claim, verify_authorization
from aies.errors import AuthorizationRequired, InputConflict
from aies.evidence import validate_completion_contract, verify_evidence
from aies.hashing import sha256_file
from aies.state import claim_write_lock, create_input_lock, recovery_plan, transition, verify_input_lock


class SecurityEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.evidence = self.root / "evidence"
        self.evidence.mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def test_read_only_needs_no_artifact(self):
        verify_authorization("inspect", self.root, None, None)

    def test_plain_approved_string_cannot_authorize_delete(self):
        with self.assertRaises(AuthorizationRequired):
            verify_authorization("delete", self.root, {"approval": "APPROVED"}, b"key")

    def test_valid_scoped_signed_artifact(self):
        claim = {"action": "git_commit", "target": str(self.root), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(), "nonce": "n-1"}
        claim["signature"] = sign_claim(claim, b"secret")
        verify_authorization("git_commit", self.root, claim, b"secret")

    def test_wrong_target_is_denied(self):
        claim = {"action": "flash", "target": str(self.root), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(), "nonce": "n-2"}
        claim["signature"] = sign_claim(claim, b"secret")
        with self.assertRaises(AuthorizationRequired):
            verify_authorization("flash", self.root / "device", claim, b"secret")

    def test_pass_without_evidence_is_rejected(self):
        result = verify_evidence({"status": "PASS", "level": "ARTIFACT_VERIFIED", "artifacts": []}, self.evidence)
        self.assertFalse(result["valid"])

    def test_missing_and_tampered_artifact_rejected(self):
        path = self.evidence / "result.log"
        path.write_text("real", encoding="utf-8")
        record = {"status": "PASS", "level": "ARTIFACT_VERIFIED", "artifacts": [{"path": "result.log", "sha256": "0" * 64}]}
        self.assertFalse(verify_evidence(record, self.evidence)["valid"])

    def test_exit_zero_without_output_is_rejected(self):
        path = self.evidence / "tool.log"
        path.write_text("exit 0", encoding="utf-8")
        record = {"status": "PASS", "level": "TOOL_VERIFIED", "artifacts": [{"path": "tool.log", "sha256": sha256_file(path)}], "execution": {"exit_code": 0, "expected_outputs": ["missing.elf"]}}
        self.assertFalse(verify_evidence(record, self.evidence)["valid"])

    def test_self_asserted_approval_is_rejected(self):
        path = self.evidence / "approval.log"
        path.write_text("APPROVED", encoding="utf-8")
        record = {"status": "PASS", "level": "APPROVAL_VERIFIED", "artifacts": [{"path": "approval.log", "sha256": sha256_file(path)}], "execution": {"exit_code": 0, "expected_outputs": ["approval.log"]}, "approval": {"status": "APPROVED"}}
        self.assertFalse(verify_evidence(record, self.evidence)["valid"])

    def test_completion_without_contract_is_rejected(self):
        self.assertFalse(validate_completion_contract({}, {})["valid"])

    def test_all_required_checks_need_valid_evidence(self):
        task = {"required_checks": [{"id": "build", "required": True}]}
        self.assertFalse(validate_completion_contract(task, {"build": {"status": "PASS", "evidence_valid": False}})["valid"])

    def test_changed_input_blocks_resume(self):
        source = self.root / "input.c"
        source.write_text("a", encoding="utf-8")
        lock = create_input_lock([source], self.root, "6.0")
        source.write_text("b", encoding="utf-8")
        result = verify_input_lock(lock, "6.0")
        self.assertEqual("NEEDS_REVIEW", result["state"])

    def test_old_package_handoff_requires_migration(self):
        lock = create_input_lock([], self.root, "5.1.4")
        self.assertFalse(verify_input_lock(lock, "6.0")["valid"])

    def test_only_one_writer_can_claim_target(self):
        lock = self.root / "locks" / "same.lock"
        claim_write_lock(lock, "task-a", "driver.c")
        with self.assertRaises(InputConflict):
            claim_write_lock(lock, "task-b", "driver.c")

    def test_invalid_state_transition_rejected(self):
        with self.assertRaises(Exception):
            transition({"state": "DISCOVERING"}, "COMPLETED")

    def test_interrupted_side_effect_is_not_blindly_replayed(self):
        events = [
            {"operation_id": "hash-1", "result": "COMPLETED", "idempotent": True},
            {"operation_id": "flash-1", "result": "STARTED", "idempotent": False},
        ]
        result = recovery_plan(events)
        self.assertEqual("NEEDS_REVIEW", result["state"])
        self.assertIn("flash-1", result["needs_review"])


if __name__ == "__main__":
    unittest.main()
