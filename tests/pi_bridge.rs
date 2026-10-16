use ccometixline::config::{Config, InputData, SegmentId};
use ccometixline::core::collect_all_segments;
use ccometixline::core::segments::{ContextWindowSegment, Segment};
use serde_json::json;

fn payload(tokens: serde_json::Value) -> InputData {
    serde_json::from_value(json!({
        "pi": true,
        "model": {"id": "custom-model", "display_name": "Custom model"},
        "workspace": {"current_dir": "."},
        "transcript_path": "DO_NOT_READ.jsonl",
        "context_window": {"tokens": tokens, "context_window": 1000000},
        "cost": {"total_cost_usd": 0.75, "total_duration_ms": 60000}
    }))
    .unwrap()
}

#[test]
fn pi_context_uses_runtime_limit_for_arbitrary_models() {
    let data = ContextWindowSegment::new()
        .collect(&payload(json!(250000)))
        .unwrap();
    assert_eq!(data.metadata["percentage"], "25");
    assert_eq!(data.metadata["limit"], "1000000");
}

#[test]
fn compaction_unknown_is_not_zero_or_transcript_fallback() {
    let data = ContextWindowSegment::new()
        .collect(&payload(json!(null)))
        .unwrap();
    assert_eq!(data.metadata["tokens"], "-");
}

#[test]
fn claude_only_segments_are_skipped_even_when_enabled() {
    let mut config = Config::default();
    for segment in &mut config.segments {
        segment.enabled = true;
    }
    let collected = collect_all_segments(&config, &payload(json!(0)));
    for (segment, _) in &collected {
        assert!(!matches!(
            segment.id,
            SegmentId::Usage | SegmentId::OutputStyle | SegmentId::Update
        ));
    }
    assert!(collected
        .iter()
        .any(|(segment, data)| segment.id == SegmentId::Cost && data.primary == "$0.75"));
    assert!(collected
        .iter()
        .any(|(segment, data)| segment.id == SegmentId::Session && data.primary == "1m"));
}
