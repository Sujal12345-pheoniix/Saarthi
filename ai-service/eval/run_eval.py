"""Run the CV engines over a labelled manifest and report accuracy, errors, failures and per-cohort breakdowns.

    python -m eval.run_eval --manifest path/to/manifest.jsonl --out reports/eval-YYYYMMDD

Each manifest line is one JSON object (see eval/manifest.schema.json). Entries without dataset provenance,
licence, consent and labeller information are refused, so the report can always state where its data came from.
No dataset ships with this repository; see docs/ai/EVALUATION.md for what is required.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from eval.metrics import binary_classification, calibration_table, confusion_matrix, failure_rate, group_by, regression_errors

COHORT_KEYS = ("fitzpatrick", "monkSkinTone", "lighting", "camera", "ageBand", "bodyType", "pose", "occlusion")
REQUIRED_PROVENANCE = ("dataset", "source", "license", "consent", "labelledBy", "labelProtocol")
DOMAINS = ("skin", "posture")
VIEWS = ("frontal", "side")


def validate_entry(entry: Dict[str, Any]) -> List[str]:
    """Return a list of problems with a manifest entry (empty when valid)."""
    problems: List[str] = []
    for key in ("id", "imagePath", "domain", "expected", "provenance"):
        if key not in entry:
            problems.append(f"missing '{key}'")
    if entry.get("domain") not in DOMAINS:
        problems.append("domain must be 'skin' or 'posture'")
    expected = entry.get("expected") or {}
    if not isinstance(expected.get("shouldReject"), bool):
        problems.append("expected.shouldReject must be a boolean")
    view = expected.get("view")
    if view is not None and view not in VIEWS:
        problems.append("expected.view must be 'frontal' or 'side'")
    for k, v in (expected.get("measurements") or {}).items():
        if not isinstance(v, (int, float)):
            problems.append(f"expected.measurements.{k} must be a number")
    prov = entry.get("provenance") or {}
    for key in REQUIRED_PROVENANCE:
        if not str(prov.get(key, "")).strip():
            problems.append(f"provenance.{key} is required")
    return problems


def load_manifest(path: Path) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    errors: List[str] = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        entry = json.loads(line)
        problems = validate_entry(entry)
        if problems:
            errors.append(f"line {n}: " + "; ".join(problems))
        entries.append(entry)
    if errors:
        raise ValueError("Invalid manifest:\n  " + "\n  ".join(errors))
    return entries


def run_engine(entry: Dict[str, Any], base_dir: Path) -> Dict[str, Any]:
    """Run the matching engine on one entry. Imports are local so metric code is usable without MediaPipe."""
    from app.core.config import Settings
    from app.services.fitness import analyze_posture
    from app.services.image_io import ImageRejected, decode_image
    from app.services.skin import analyze_skin

    settings = Settings(app_env="test", token=None, max_upload_bytes=20 * 1024 * 1024, min_dimension=320, max_dimension=8192, max_pixels=40_000_000)
    record: Dict[str, Any] = {
        "id": entry["id"],
        "domain": entry["domain"],
        "expected": entry["expected"],
        "cohort": entry.get("cohort") or {},
    }
    try:
        img = decode_image((base_dir / entry["imagePath"]).read_bytes(), settings)
        result = analyze_skin(img) if entry["domain"] == "skin" else analyze_posture(img)
        record["status"] = "ok"
        record["engineVersion"] = result.engineVersion
        record["predicted"] = {
            "view": getattr(result, "view", None),
            "measurements": {m.key: m.value for m in result.measurements},
            "imageQualityScore": result.imageQuality.score,
        }
    except ImageRejected as exc:
        record["status"] = "rejected"
        record["rejectMessage"] = exc.message
    except Exception as exc:  # an engine crash is a failure to report, not to hide
        record["status"] = "error"
        record["error"] = f"{type(exc).__name__}: {exc}"
    return record


def summarise(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """All metrics for one set of records (pure)."""
    decided = [r for r in records if r.get("status") in ("ok", "rejected")]
    rejection = binary_classification(
        [bool(r["expected"]["shouldReject"]) for r in decided], [r["status"] == "rejected" for r in decided]
    )

    keys = sorted({k for r in records for k in (r["expected"].get("measurements") or {})})
    numeric: Dict[str, Any] = {}
    for key in keys:
        pairs = []
        for r in records:
            ref = (r["expected"].get("measurements") or {}).get(key)
            pred = ((r.get("predicted") or {}).get("measurements") or {}).get(key)
            if r.get("status") == "ok" and ref is not None and pred is not None:
                pairs.append((ref, pred))
        numeric[key] = regression_errors(pairs)

    view_records = [r for r in records if r.get("status") == "ok" and r["expected"].get("view")]
    view = (
        confusion_matrix(list(VIEWS), [r["expected"]["view"] for r in view_records], [r["predicted"]["view"] or "none" for r in view_records])
        if view_records
        else None
    )
    return {
        "n": len(records),
        "failures": failure_rate(records),
        "rejection": rejection,
        "measurements": numeric,
        "viewClassification": view,
        # Engines emit no probability for their decisions; reported honestly as not applicable.
        "calibration": calibration_table([None] * len(decided), [True] * len(decided)),
    }


def evaluate_records(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_domain = group_by(records, lambda r: r["domain"])
    report: Dict[str, Any] = {"overall": summarise(records), "domains": {}, "cohorts": {}}
    for domain, rs in by_domain.items():
        report["domains"][domain] = summarise(rs)
    for ck in COHORT_KEYS:
        groups = group_by(records, lambda r, ck=ck: None if r["cohort"].get(ck) is None else str(r["cohort"][ck]))
        if set(groups) == {"unlabelled"}:
            continue
        report["cohorts"][ck] = {g: summarise(rs) for g, rs in groups.items()}
    return report


def _fmt(v: Optional[float], pct: bool = False) -> str:
    if v is None:
        return "n/a"
    return f"{v * 100:.1f}%" if pct else f"{v:.2f}"


def to_markdown(report: Dict[str, Any], meta: Dict[str, Any]) -> str:
    lines = [
        "# Saarthi CV evaluation report",
        "",
        f"Generated {meta['generatedAt']} from `{meta['manifest']}` ({meta['entries']} entries).",
        f"Datasets: {', '.join(meta['datasets'])}. Licences: {', '.join(meta['licenses'])}.",
        "",
        "Results describe this dataset only. They are not clinical validation.",
        "",
    ]

    def section(title: str, s: Dict[str, Any]) -> None:
        rej = s["rejection"]
        f = s["failures"]
        lines.extend(
            [
                f"## {title}",
                "",
                f"- Records: {s['n']}; engine errors: {f['errors']} ({_fmt(f['errorRate'], True)}); rejections: {f['rejected']} ({_fmt(f['rejectionRate'], True)})",
                f"- Rejection precision {_fmt(rej['precision'], True)}, recall {_fmt(rej['recall'], True)}, false-positive rate {_fmt(rej['falsePositiveRate'], True)}",
            ]
        )
        if s["viewClassification"]:
            lines.append(f"- View classification accuracy {_fmt(s['viewClassification']['accuracy'], True)} (n={s['viewClassification']['n']})")
        for key, m in s["measurements"].items():
            lines.append(f"- `{key}`: n={m['n']}, MAE {_fmt(m['mae'])}, RMSE {_fmt(m['rmse'])}, bias {_fmt(m['bias'])}, p90 |error| {_fmt(m['p90AbsError'])}")
        cal = s["calibration"]
        lines.append(f"- Calibration: {'not applicable — ' + cal['reason'] if not cal['applicable'] else 'ECE ' + _fmt(cal['expectedCalibrationError'])}")
        lines.append("")

    section("Overall", report["overall"])
    for d, s in report["domains"].items():
        section(f"Domain: {d}", s)
    for ck, groups in report["cohorts"].items():
        for g, s in groups.items():
            section(f"Cohort {ck} = {g}", s)
    return "\n".join(lines)


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path, help="output path prefix (writes .json and .md)")
    args = parser.parse_args(list(argv) if argv is not None else None)

    entries = load_manifest(args.manifest)
    records = [run_engine(e, args.manifest.parent) for e in entries]
    report = evaluate_records(records)
    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "manifest": str(args.manifest),
        "entries": len(entries),
        "datasets": sorted({e["provenance"]["dataset"] for e in entries}),
        "licenses": sorted({e["provenance"]["license"] for e in entries}),
        "engineVersions": sorted({r["engineVersion"] for r in records if r.get("engineVersion")}),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.with_suffix(".json").write_text(json.dumps({"meta": meta, "report": report, "records": records}, indent=2), encoding="utf-8")
    args.out.with_suffix(".md").write_text(to_markdown(report, meta), encoding="utf-8")
    print(f"wrote {args.out.with_suffix('.json')} and {args.out.with_suffix('.md')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
