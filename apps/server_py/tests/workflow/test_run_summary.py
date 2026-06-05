def test_run_summary_shape_stub():
    summary = {"runId": "run_1", "status": "SUCCESS", "durationMs": 10}
    assert summary["status"] == "SUCCESS"
