"""Offline self-test for the capture agent.

Run it from capture-agent/ with:

    python test_agent.py

It needs no network, no root, no scapy and no backend - it feeds hand-built
packet records through the real aggregation and feature code and checks the
numbers against values worked out by hand. That makes it the fastest way to
confirm the agent is sane before wiring it to a live interface.

The feature-sync tests are the important ones: they are what catches the
failure mode this project cares most about, where the agent, the training
notebook and the backend quietly disagree about the feature set.
"""

import ast
import json
import math
import os
import statistics
import unittest

from aggregator import Flow, FlowTable, RunningStats, flow_key
from capture import PROTO_TCP, PacketRecord
from features import (
    AGENT_TO_MODEL,
    FEATURE_KEYS,
    compute_flow_features,
    is_reportable,
    load_model_feature_names,
    validate_features,
    verify_feature_sync,
)
from sender import build_payload

_HERE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.join(_HERE, "..")
_BACKEND_FEATURES = os.path.join(_PROJECT_ROOT, "backend", "ml", "feature_list.json")
_PIPELINE_FEATURES = os.path.join(
    _PROJECT_ROOT, "ml-pipeline", "notebooks", "output", "feature_list.json"
)
_PREDICTOR = os.path.join(_PROJECT_ROOT, "backend", "ml", "predictor.py")

CLIENT = ("10.0.0.1", 5000)
SERVER = ("10.0.0.2", 80)


def packet(seconds, from_client, payload_bytes, flags):
    """Build one PacketRecord for the sample conversation used by the tests."""
    source, destination = (CLIENT, SERVER) if from_client else (SERVER, CLIENT)
    return PacketRecord(
        timestamp=seconds,
        src_ip=source[0],
        dst_ip=destination[0],
        src_port=source[1],
        dst_port=destination[1],
        protocol=PROTO_TCP,
        payload_bytes=payload_bytes,
        flags=flags,
    )


# One complete TCP conversation: handshake, one request, one reply, teardown.
#           time      from client   payload   flags
SAMPLE_FLOW = [
    packet(0.0000,    True,         0,        "S"),
    packet(0.0001,    False,        0,        "SA"),
    packet(0.0003,    True,         0,        "A"),
    packet(0.0010,    True,         100,      "PA"),
    packet(0.0020,    False,        200,      "PA"),
    packet(0.0030,    True,         0,        "FA"),
    packet(0.0040,    False,        0,        "FA"),
]

# Derived by hand from SAMPLE_FLOW; see the individual assertions below.
SAMPLE_IATS_US = [100.0, 200.0, 700.0, 1000.0, 1000.0, 1000.0]
SAMPLE_LENGTHS = [0, 0, 0, 100, 200, 0, 0]


def build_sample_flow():
    flow = Flow(flow_key(SAMPLE_FLOW[0]), SAMPLE_FLOW[0])
    for record in SAMPLE_FLOW:
        flow.add(record)
    return flow


class FeatureSyncTests(unittest.TestCase):
    """The golden rule: one feature set, identical everywhere."""

    def test_agent_mapping_matches_feature_list(self):
        self.assertEqual(list(AGENT_TO_MODEL.values()), load_model_feature_names())
        verify_feature_sync()   # raises FeatureSyncError on any drift

    def test_feature_list_matches_backend_and_training_copies(self):
        agent_features = load_model_feature_names()
        for path in (_BACKEND_FEATURES, _PIPELINE_FEATURES):
            if not os.path.exists(path):
                self.skipTest(f"{path} is not present in this checkout")
            with open(path) as handle:
                self.assertEqual(json.load(handle), agent_features,
                                 f"feature_list.json drift against {path}")

    def test_agent_mapping_matches_backend_predictor(self):
        """AGENT_TO_MODEL must equal FEATURE_NAME_MAP in backend/ml/predictor.py.

        The dict is read out of the source with ast rather than imported,
        because importing predictor.py loads model.pkl and every ML dependency.
        """
        if not os.path.exists(_PREDICTOR):
            self.skipTest("backend/ml/predictor.py is not present in this checkout")

        with open(_PREDICTOR) as handle:
            tree = ast.parse(handle.read())

        backend_map = None
        for node in tree.body:
            if not isinstance(node, (ast.Assign, ast.AnnAssign)):
                continue
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for target in targets:
                if isinstance(target, ast.Name) and target.id == "FEATURE_NAME_MAP":
                    backend_map = ast.literal_eval(node.value)

        self.assertIsNotNone(backend_map, "FEATURE_NAME_MAP not found in predictor.py")
        self.assertEqual(dict(AGENT_TO_MODEL), backend_map)


class RunningStatsTests(unittest.TestCase):
    def test_matches_the_standard_library(self):
        values = [3.0, 1.0, 4.0, 1.0, 5.0, 9.0, 2.0, 6.0]
        stats = RunningStats()
        for value in values:
            stats.add(value)

        self.assertEqual(stats.count, len(values))
        self.assertAlmostEqual(stats.mean, statistics.fmean(values))
        self.assertAlmostEqual(stats.std, statistics.stdev(values))   # sample, n-1
        self.assertEqual(stats.minimum, 1.0)
        self.assertEqual(stats.maximum, 9.0)

    def test_empty_and_single_value_report_zero_instead_of_nan(self):
        empty = RunningStats()
        self.assertEqual((empty.mean, empty.std, empty.minimum, empty.maximum),
                         (0.0, 0.0, 0.0, 0.0))

        single = RunningStats()
        single.add(42.0)
        self.assertEqual(single.mean, 42.0)
        self.assertEqual(single.std, 0.0)   # one value has no spread


class FlowKeyTests(unittest.TestCase):
    def test_both_directions_share_one_key(self):
        forward = SAMPLE_FLOW[0]
        backward = SAMPLE_FLOW[1]
        self.assertEqual(flow_key(forward), flow_key(backward))

    def test_different_ports_are_different_flows(self):
        other = packet(0.0, True, 0, "S")
        other.src_port = 5001
        self.assertNotEqual(flow_key(SAMPLE_FLOW[0]), flow_key(other))

    def test_first_packet_sets_the_forward_direction(self):
        flow = build_sample_flow()
        self.assertEqual(flow.src_ip, CLIENT[0])
        self.assertEqual(flow.src_port, CLIENT[1])
        self.assertTrue(flow.is_forward(SAMPLE_FLOW[0]))
        self.assertFalse(flow.is_forward(SAMPLE_FLOW[1]))


class FeatureValueTests(unittest.TestCase):
    """Every one of the 20 features, checked against hand-computed values."""

    def setUp(self):
        self.features = compute_flow_features(build_sample_flow())

    def test_all_twenty_features_are_present_in_model_order(self):
        self.assertEqual(list(self.features), FEATURE_KEYS)
        self.assertEqual(len(self.features), 20)

    def test_counts_and_totals(self):
        # Client sent packets 1, 3, 4, 6; server sent 2, 5, 7.
        self.assertEqual(self.features["total_fwd_packets"], 4.0)
        self.assertEqual(self.features["total_bwd_packets"], 3.0)
        # Payload bytes only, so the empty handshake and teardown packets add nothing.
        self.assertEqual(self.features["total_length_fwd_packets"], 100.0)
        self.assertEqual(self.features["total_length_bwd_packets"], 200.0)

    def test_duration_is_microseconds(self):
        # 0.0040s - 0.0000s = 4000 microseconds.
        self.assertAlmostEqual(self.features["flow_duration"], 4000.0, places=6)

    def test_rates_are_per_second(self):
        # 300 payload bytes and 7 packets over 0.004 seconds.
        self.assertAlmostEqual(self.features["flow_bytes_per_second"], 75_000.0, places=3)
        self.assertAlmostEqual(self.features["flow_packets_per_second"], 1_750.0, places=3)

    def test_inter_arrival_times(self):
        self.assertAlmostEqual(self.features["flow_iat_mean"],
                               statistics.fmean(SAMPLE_IATS_US), places=6)
        self.assertAlmostEqual(self.features["flow_iat_std"],
                               statistics.stdev(SAMPLE_IATS_US), places=6)
        self.assertAlmostEqual(self.features["flow_iat_max"], 1000.0, places=6)
        self.assertAlmostEqual(self.features["flow_iat_min"], 100.0, places=6)

    def test_flag_counts_cover_both_directions(self):
        self.assertEqual(self.features["syn_flag_count"], 2.0)   # S and SA
        self.assertEqual(self.features["ack_flag_count"], 6.0)   # every packet but the first
        self.assertEqual(self.features["rst_flag_count"], 0.0)
        self.assertEqual(self.features["fin_flag_count"], 2.0)   # both FA packets
        self.assertEqual(self.features["psh_flag_count"], 2.0)   # both PA packets

    def test_packet_length_statistics(self):
        self.assertAlmostEqual(self.features["packet_length_mean"],
                               statistics.fmean(SAMPLE_LENGTHS))
        self.assertAlmostEqual(self.features["packet_length_std"],
                               statistics.stdev(SAMPLE_LENGTHS))
        self.assertEqual(self.features["min_packet_length"], 0.0)
        self.assertEqual(self.features["max_packet_length"], 200.0)

    def test_every_value_is_finite(self):
        for key, value in self.features.items():
            self.assertTrue(math.isfinite(value), f"{key} is {value}")

    def test_zero_duration_does_not_divide_by_zero(self):
        """Two packets sharing a timestamp used to be Infinity in the raw dataset."""
        same_instant = [packet(1.0, True, 40, "S"), packet(1.0, False, 40, "SA")]
        flow = Flow(flow_key(same_instant[0]), same_instant[0])
        for record in same_instant:
            flow.add(record)

        features = compute_flow_features(flow)
        self.assertIsNone(validate_features(features))
        self.assertTrue(math.isfinite(features["flow_bytes_per_second"]))


class FlowTableTests(unittest.TestCase):
    def test_teardown_closes_the_flow_immediately(self):
        table = FlowTable()
        for record in SAMPLE_FLOW:
            table.add_packet(record)

        # The second FIN completes the teardown, so nothing should still be open.
        self.assertEqual(table.active_flow_count, 0)
        finished = table.collect_finished(SAMPLE_FLOW[-1].timestamp)
        self.assertEqual(len(finished), 1)
        self.assertEqual(finished[0].end_reason, "tcp_teardown")
        self.assertEqual(finished[0].packet_count, 7)

    def test_reset_closes_the_flow(self):
        """A closed-port scan probe: SYN out, RST back. This is the PortScan shape."""
        table = FlowTable()
        table.add_packet(packet(0.0, True, 0, "S"))
        table.add_packet(packet(0.0005, False, 0, "RA"))

        finished = table.collect_finished(0.0005)
        self.assertEqual(len(finished), 1)
        self.assertEqual(finished[0].end_reason, "tcp_teardown")
        self.assertEqual(finished[0].flag_counts["RST"], 1)

    def test_idle_timeout_closes_a_quiet_flow(self):
        table = FlowTable(idle_timeout=10.0)
        table.add_packet(packet(0.0, True, 50, "PA"))
        table.add_packet(packet(1.0, False, 50, "PA"))

        self.assertEqual(table.collect_finished(5.0), [])       # still active
        finished = table.collect_finished(11.0)                  # 10s after the last packet
        self.assertEqual(len(finished), 1)
        self.assertEqual(finished[0].end_reason, "idle_timeout")

    def test_duration_cap_closes_a_long_lived_flow(self):
        table = FlowTable(max_duration=5.0)
        table.add_packet(packet(0.0, True, 50, "PA"))
        table.add_packet(packet(6.0, False, 50, "PA"))

        finished = table.collect_finished(6.0)
        self.assertEqual(len(finished), 1)
        self.assertEqual(finished[0].end_reason, "duration_cap")

    def test_flush_reports_everything_still_open(self):
        table = FlowTable()
        table.add_packet(packet(0.0, True, 50, "PA"))
        self.assertEqual(table.active_flow_count, 1)

        finished = table.flush()
        self.assertEqual(len(finished), 1)
        self.assertEqual(finished[0].end_reason, "shutdown")
        self.assertEqual(table.active_flow_count, 0)

    def test_table_evicts_instead_of_growing_without_bound(self):
        """A port scan creates one flow per port; the table must stay bounded."""
        table = FlowTable(max_active_flows=10)
        for port in range(50):
            probe = packet(port * 0.001, True, 0, "S")
            probe.dst_port = 1000 + port
            table.add_packet(probe)

        self.assertLessEqual(table.active_flow_count, 10)
        self.assertEqual(table.flows_evicted, 40)


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.features = compute_flow_features(build_sample_flow())

    def test_a_good_feature_dict_passes(self):
        self.assertIsNone(validate_features(self.features))

    def test_missing_feature_is_reported(self):
        broken = dict(self.features)
        del broken["flow_iat_std"]
        self.assertIn("flow_iat_std", validate_features(broken))

    def test_unexpected_key_is_reported(self):
        broken = dict(self.features)
        broken["unique_dst_ports"] = 5.0
        self.assertIn("unique_dst_ports", validate_features(broken))

    def test_infinity_and_nan_are_rejected(self):
        for bad_value in (float("inf"), float("-inf"), float("nan")):
            broken = dict(self.features)
            broken["flow_bytes_per_second"] = bad_value
            self.assertIsNotNone(validate_features(broken), f"{bad_value} slipped through")

    def test_non_numeric_value_is_rejected(self):
        broken = dict(self.features)
        broken["syn_flag_count"] = "2"
        self.assertIn("syn_flag_count", validate_features(broken))

    def test_single_packet_flow_is_not_reportable(self):
        lone = packet(0.0, True, 0, "S")
        flow = Flow(flow_key(lone), lone)
        flow.add(lone)
        self.assertFalse(is_reportable(flow))
        self.assertTrue(is_reportable(build_sample_flow()))


class PayloadTests(unittest.TestCase):
    def test_payload_is_src_ip_plus_the_twenty_features(self):
        payload = build_payload("10.0.0.1", compute_flow_features(build_sample_flow()))

        self.assertEqual(list(payload), ["src_ip"] + FEATURE_KEYS)
        self.assertEqual(payload["src_ip"], "10.0.0.1")
        for key in FEATURE_KEYS:
            self.assertIsInstance(payload[key], float)

    def test_payload_is_json_serialisable(self):
        payload = build_payload("10.0.0.1", compute_flow_features(build_sample_flow()))
        self.assertEqual(json.loads(json.dumps(payload))["src_ip"], "10.0.0.1")

    def test_payload_keys_translate_onto_every_model_column(self):
        """What the backend will see after FEATURE_NAME_MAP is applied."""
        payload = build_payload("10.0.0.1", compute_flow_features(build_sample_flow()))
        translated = [AGENT_TO_MODEL[key] for key in payload if key != "src_ip"]
        self.assertEqual(translated, load_model_feature_names())


if __name__ == "__main__":
    unittest.main(verbosity=2)
