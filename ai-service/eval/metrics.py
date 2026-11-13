"""Pure evaluation metrics (no I/O, no model calls) so they can be unit-tested in isolation."""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple


def _ratio(num: float, den: float) -> Optional[float]:
    return None if den == 0 else num / den


def binary_classification(y_true: Sequence[bool], y_pred: Sequence[bool]) -> Dict[str, Any]:
    """Confusion counts plus precision, recall, F1 and false-positive rate. Undefined ratios are None."""
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred differ in length")
    tp = sum(1 for t, p in zip(y_true, y_pred) if t and p)
    fp = sum(1 for t, p in zip(y_true, y_pred) if not t and p)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t and not p)
    tn = sum(1 for t, p in zip(y_true, y_pred) if not t and not p)
    precision = _ratio(tp, tp + fp)
    recall = _ratio(tp, tp + fn)
    f1 = None if precision is None or recall is None or (precision + recall) == 0 else 2 * precision * recall / (precision + recall)
    return {
        "n": len(y_true),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "falsePositiveRate": _ratio(fp, fp + tn),
        "accuracy": _ratio(tp + tn, len(y_true)),
    }


def _percentile(sorted_vals: Sequence[float], q: float) -> float:
    if not sorted_vals:
        raise ValueError("empty")
    k = (len(sorted_vals) - 1) * q
    lo, hi = math.floor(k), math.ceil(k)
    if lo == hi:
        return float(sorted_vals[int(k)])
    return float(sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (k - lo))


def regression_errors(pairs: Iterable[Tuple[float, float]], bin_edges: Sequence[float] = (0, 1, 2, 5, 10, 20, math.inf)) -> Dict[str, Any]:
    """Errors of predicted vs reference values. `pairs` is (reference, predicted).

    Returns n, MAE, RMSE, bias (mean signed error = predicted - reference), median and 90th-percentile absolute
    error, and a histogram of absolute errors over `bin_edges`.
    """
    errs = [float(p) - float(r) for r, p in pairs]
    if not errs:
        return {"n": 0, "mae": None, "rmse": None, "bias": None, "p50AbsError": None, "p90AbsError": None, "histogram": []}
    abs_errs = sorted(abs(e) for e in errs)
    hist = []
    for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
        hist.append({"from": lo, "to": None if math.isinf(hi) else hi, "count": sum(1 for e in abs_errs if lo <= e < hi)})
    return {
        "n": len(errs),
        "mae": sum(abs_errs) / len(errs),
        "rmse": math.sqrt(sum(e * e for e in errs) / len(errs)),
        "bias": sum(errs) / len(errs),
        "p50AbsError": _percentile(abs_errs, 0.5),
        "p90AbsError": _percentile(abs_errs, 0.9),
        "histogram": hist,
    }


def confusion_matrix(labels: Sequence[str], y_true: Sequence[str], y_pred: Sequence[str]) -> Dict[str, Any]:
    """Multiclass confusion matrix as nested dict matrix[true][pred], plus accuracy. Unknown labels are counted."""
    all_labels = list(labels)
    for v in list(y_true) + list(y_pred):
        if v not in all_labels:
            all_labels.append(v)
    matrix = {t: {p: 0 for p in all_labels} for t in all_labels}
    for t, p in zip(y_true, y_pred):
        matrix[t][p] += 1
    correct = sum(matrix[l][l] for l in all_labels)
    return {"labels": all_labels, "matrix": matrix, "n": len(y_true), "accuracy": _ratio(correct, len(y_true))}


def group_by(records: Iterable[Dict[str, Any]], key: Callable[[Dict[str, Any]], Optional[str]]) -> Dict[str, List[Dict[str, Any]]]:
    """Group records by a cohort key; records whose key is None go under "unlabelled"."""
    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in records:
        groups[key(r) or "unlabelled"].append(r)
    return dict(groups)


def failure_rate(records: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """Share of records where the engine crashed (status "error"), distinct from deliberate rejections."""
    n = len(records)
    errors = sum(1 for r in records if r.get("status") == "error")
    rejected = sum(1 for r in records if r.get("status") == "rejected")
    return {"n": n, "errors": errors, "errorRate": _ratio(errors, n), "rejected": rejected, "rejectionRate": _ratio(rejected, n)}


def calibration_table(confidences: Sequence[Optional[float]], correct: Sequence[bool], bins: int = 10) -> Dict[str, Any]:
    """Reliability bins and expected calibration error.

    Only meaningful when an engine emits a probability-like confidence for a decision that has a reference label.
    When no confidence values are available the table is reported as not applicable rather than invented.
    """
    pairs = [(c / 100.0 if c is not None and c > 1 else c, ok) for c, ok in zip(confidences, correct) if c is not None]
    if not pairs:
        return {"applicable": False, "reason": "The engine emits no probabilistic confidence for this decision."}
    rows = []
    ece = 0.0
    for b in range(bins):
        lo, hi = b / bins, (b + 1) / bins
        in_bin = [(c, ok) for c, ok in pairs if (lo <= c < hi) or (b == bins - 1 and c == 1.0)]
        if not in_bin:
            continue
        mean_conf = sum(c for c, _ in in_bin) / len(in_bin)
        acc = sum(1 for _, ok in in_bin if ok) / len(in_bin)
        ece += len(in_bin) / len(pairs) * abs(acc - mean_conf)
        rows.append({"from": lo, "to": hi, "n": len(in_bin), "meanConfidence": mean_conf, "accuracy": acc})
    return {"applicable": True, "n": len(pairs), "bins": rows, "expectedCalibrationError": ece}
